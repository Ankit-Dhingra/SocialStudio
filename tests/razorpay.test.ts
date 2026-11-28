import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import mongoose from 'mongoose';
import { initTestBilling, testBalance } from '../src/modules/payments/ledger.js';
import { earnedCredits, razorpayTestConfig, validatePayment, validSignature, type RazorpayTestConfig } from '../src/modules/payments/razorpay.js';
import { razorpayWebhook, testBillingRouter } from '../src/modules/payments/routes.js';
import { admitGeneration, availableGenerationCredits, generationCreditUsage, grantGenerationCredits, initAdmission,
  settleGeneration } from '../src/modules/jobs/admission.js';
import { claimJob, getOwnedJob, initJobs, updateJobLease } from '../src/modules/jobs/durable-jobs.js';
import { createProject, initProjects } from '../src/modules/projects/repository.js';
import { masterScriptService } from '../src/modules/ai-script/master-script-service.js';

const secret = 'test-webhook-secret-not-a-credential';
const sign = (body: string) => createHmac('sha256', secret).update(body).digest('hex');
const captured = { id: 'pay_fixture123', order_id: 'order_fixture123', status: 'captured', captured: true,
  amount: 5000, amount_refunded: 0, currency: 'INR' };
const mongoUrl = process.env.STUDIO_BILLING_TEST_MONGODB_URI;

test('payment signatures use the exact body and live-mode keys stay disabled', () => {
  const body = '{"event":"payment.captured"}';
  assert.equal(validSignature(body, sign(body), secret), true);
  assert.equal(validSignature(`${body}\n`, sign(body), secret), false);
  assert.equal(validSignature(body, 'fake', secret), false);
  assert.equal(razorpayTestConfig({ RAZORPAY_KEY_ID: 'rzp_live_fixture' }), undefined);
  assert.throws(() => razorpayTestConfig({ RAZORPAY_TEST_ENABLED: 'true', RAZORPAY_KEY_ID: 'rzp_live_fixture' }), /test configuration/);
  assert.throws(() => razorpayTestConfig({ NODE_ENV: 'production', RAZORPAY_TEST_ENABLED: 'true' }), /staging deployment/);
  assert.throws(() => validatePayment({ ...captured, amount: 1 }, { id: captured.order_id, amount: 5000 }), /stored order/);
  assert.throws(() => validatePayment({ ...captured, currency: 'USD' }, { id: captured.order_id, amount: 5000 }));
  const authorized = validatePayment({ ...captured, status: 'authorized', captured: false }, { id: captured.order_id, amount: 5000 });
  assert.equal(earnedCredits(authorized, 20, 0), null);
});

test('generation admission atomically holds credits and budget and creates a durable owned job', { skip: !mongoUrl }, async () => {
  const uri = new URL(mongoUrl!);
  uri.pathname = `/studio_admit_test_${randomUUID().replaceAll('-', '')}`;
  try {
    await mongoose.connect(uri.href, { serverSelectionTimeoutMS: 7_000 });
    await Promise.all([initAdmission(), initJobs(), initProjects()]);
    const ownerId = 'user_budget';
    const project = await masterScriptService.buildCustomSession('A queue buffers work for an available process.');
    await createProject(ownerId, project);
    const expires = new Date(Date.now() + 3_600_000);
    assert.equal(await grantGenerationCredits(ownerId, 'ledger-001', 10, expires), true);
    assert.equal(await grantGenerationCredits(ownerId, 'ledger-001', 10, expires), false);
    const request = { ownerId, projectId: project.id, operation: 'visuals' as const, revision: 0, requestId: 'request-a',
      provider: 'groq' as const, credits: 4, boundMicros: 60 };
    const caps = { dailyMicros: 100, monthlyMicros: 200, userDailyMicros: 100, providerDailyMicros: 100 };
    await assert.rejects(admitGeneration({ ...request, ownerId: 'other' }, caps), /authorized project/);
    const id = await admitGeneration(request, caps);
    assert.equal(await admitGeneration(request, caps), id);
    assert.equal(await availableGenerationCredits(ownerId), 6);
    assert.deepEqual(await generationCreditUsage(ownerId), { available: 6, expired: 0, nextExpiry: expires, reserved: 4, used: 0 });
    assert.equal((await getOwnedJob(ownerId, id))?.status, 'queued');
    await assert.rejects(admitGeneration({ ...request, requestId: 'request-b', boundMicros: 1 }, caps));
    assert.equal(await availableGenerationCredits(ownerId), 6);
    assert.equal(await settleGeneration(id, 50, false), true);
    assert.equal(await settleGeneration(id, 0, false), false);
    assert.equal(await availableGenerationCredits(ownerId), 10);
    await assert.rejects(admitGeneration({ ...request, requestId: 'request-c' }, caps), /spending limit/);
    assert.equal(await availableGenerationCredits(ownerId), 10);
    const next = await admitGeneration({ ...request, requestId: 'request-d', boundMicros: 50 }, caps);
    await assert.rejects(settleGeneration(next, 50, true), /safe terminal outcome/);
    const lease = await claimJob(next);
    assert(lease?.leaseId);
    assert.equal(await updateJobLease(next, lease.leaseId, 'complete'), true);
    assert.equal(await settleGeneration(next, 50, true), true);
    assert.equal(await availableGenerationCredits(ownerId), 6);
    assert.equal(await availableGenerationCredits(ownerId, expires), 0);
    assert.deepEqual(await generationCreditUsage(ownerId, expires), { available: 0, expired: 6, nextExpiry: null, reserved: 0, used: 4 });
    assert.deepEqual(await generationCreditUsage('user_unrelated'), { available: 0, expired: 0, nextExpiry: null, reserved: 0, used: 0 });
  } finally {
    try { if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase(); }
    finally { await mongoose.disconnect(); }
  }
});

test('checkout, duplicate webhooks, refunds and disputes reconcile through MongoDB transactions', { skip: !mongoUrl }, async () => {
  const uri = new URL(mongoUrl!);
  uri.pathname = `/studio_billing_test_${randomUUID().replaceAll('-', '')}`;
  let current = { ...captured, status: 'authorized', captured: false };
  let createdOrders = 0;
  let canonical = { id: 'disp_fixture', payment_id: captured.id, currency: 'INR', amount: 1000,
    amount_deducted: 0, status: 'open' };
  const client = {
    orders: { async create() { createdOrders++; return { id: captured.order_id, amount: 5000, currency: 'INR' }; },
      async fetchPayments() { return { items: [current] }; } },
    payments: { async fetch() { return current; } },
    disputes: { async fetch() { return canonical; } },
  } as unknown as RazorpayTestConfig['client'];
  const config = { client, amount: 5000, credits: 20, keyId: 'rzp_test_fixture', keySecret: secret, webhookSecret: secret };

  try {
    await mongoose.connect(uri.href, { serverSelectionTimeoutMS: 7_000 });
    await initTestBilling();
    const app = express();
    app.use('/webhook', razorpayWebhook(config));
    app.use('/billing', (req, res, next) => { res.locals.studioAccount = { clerkUserId: req.get('X-Test-Identity') }; next(); }, testBillingRouter(config));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const post = (route: string, body: string, headers: Record<string, string>) => fetch(base + route,
      { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
    const verify = JSON.stringify({ orderId: captured.order_id, paymentId: captured.id, signature: sign(`${captured.order_id}|${captured.id}`) });
    const checkout = (user = 'user_buyer') => post('/billing/verify', verify, { 'X-Test-Identity': user });
    const list = async (user = 'user_buyer') => {
      const response = await fetch(base + '/billing/orders', { headers: { 'X-Test-Identity': user } });
      assert.equal(response.status, 200);
      return (await response.json()).orders;
    };
    const event = (event: string, id = 'same') => JSON.stringify({ event, id, payload: {
      payment: { entity: { id: captured.id } }, refund: { entity: { id: `rfnd_${id}`, payment_id: captured.id, amount: 2500, status: 'processed' } },
    } });
    const webhook = (body: string, signature = sign(body)) => post('/webhook', body, { 'X-Razorpay-Signature': signature });
    const dispute = (status: string, timestamp: number) => JSON.stringify({ event: `payment.dispute.${status}`,
      created_at: timestamp, payload: { dispute: { entity: { id: canonical.id, payment_id: captured.id } } } });
    try {
      const newOrder = JSON.stringify({ requestId: randomUUID() });
      assert.equal((await post('/billing/orders', newOrder, { 'X-Test-Identity': 'user_buyer' })).status, 201);
      assert.equal((await post('/billing/orders', newOrder, { 'X-Test-Identity': 'user_buyer' })).status, 200);
      assert.equal(createdOrders, 1);
      assert.deepEqual(await list('user_other'), []);
      assert.equal((await list())[0].state, 'pending');
      assert.equal((await checkout('user_other')).status, 404);
      assert.equal((await checkout()).status, 200);
      assert.equal(await testBalance('user_buyer'), 0);
      assert.equal((await post(`/billing/orders/${captured.order_id}/reconcile`, '{}', { 'X-Test-Identity': 'user_other' })).status, 404);
      const capture = event('payment.captured');
      assert.equal((await webhook(capture, 'bad')).status, 401);
      assert.equal((await webhook(capture)).status, 503);
      current = captured;
      assert.deepEqual((await Promise.all([webhook(capture), webhook(capture), checkout()])).map(response => response.status), [204, 204, 200]);
      assert.equal(await testBalance('user_buyer'), 20);
      assert.equal((await list())[0].state, 'credited');

      const opened = dispute('created', 123);
      assert.deepEqual((await Promise.all([webhook(opened), webhook(opened)])).map(response => response.status), [204, 204]);
      assert.equal(await testBalance('user_buyer'), 16);
      canonical = { ...canonical, status: 'won' };
      assert.equal((await webhook(dispute('won', 125))).status, 204);
      assert.equal(await testBalance('user_buyer'), 20);
      canonical = { ...canonical, status: 'open' };
      assert.equal((await webhook(dispute('under_review', 124))).status, 204);
      assert.equal(await testBalance('user_buyer'), 20);

      current = captured;
      assert.equal((await webhook(event('refund.processed'))).status, 204);
      assert.equal(await testBalance('user_buyer'), 10);
      current = captured;
      assert.equal((await webhook(event('payment.captured', 'reordered'))).status, 204);
      assert.equal(await testBalance('user_buyer'), 10);
      current = { ...captured, status: 'refunded', amount_refunded: 5000 };
      assert.equal((await webhook(event('refund.processed', 'full'))).status, 204);
      assert.equal(await testBalance('user_buyer'), 0);
      const [refunded] = await list();
      assert.equal(refunded.state, 'refunded');
      assert.equal(refunded.refunded, 5000);
      assert.equal(refunded.credited, 0);
      assert.equal(refunded.paymentId, undefined);
      const refresh = await post(`/billing/orders/${captured.order_id}/reconcile`, '{}', { 'X-Test-Identity': 'user_buyer' });
      assert.equal(refresh.status, 200);
      assert.equal((await refresh.json()).balance, 0);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  } finally {
    try { if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase(); }
    finally { await mongoose.disconnect(); }
  }
});
