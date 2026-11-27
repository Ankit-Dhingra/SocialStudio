import { createHash } from 'node:crypto';
import { Router, json, raw, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { attachTestOrder, findTestOrder, hasTestEvent, reconcileTestPayment, reserveTestOrder, testBalance } from './ledger.js';
import { orderId, paymentId, validSignature, type RazorpayTestConfig } from './razorpay.js';

const requestOrder = z.object({ requestId: z.string().uuid() }).strict();
const checkout = z.object({ orderId, paymentId, signature: z.string().length(64) }).strict();
const paymentEvent = z.object({ event: z.string(), payload: z.object({
  payment: z.object({ entity: z.object({ id: paymentId }) }).optional(),
  refund: z.object({ entity: z.object({ id: z.string().regex(/^rfnd_[a-zA-Z0-9]{3,64}$/), payment_id: paymentId,
    amount: z.number().int().positive().max(10_000_000), status: z.string() }) }).optional(),
}) });

function handle(action: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => { action(req, res).catch(next); };
}

async function fetchPayment(config: RazorpayTestConfig, id: string) {
  const payment = await config.client.payments.fetch(id);
  if (payment.id !== id) throw new Error('Unexpected Razorpay payment identifier.');
  return payment;
}

export function razorpayWebhook(config: RazorpayTestConfig) {
  const router = Router();
  router.post('/', raw({ type: 'application/json', limit: '128kb', inflate: false }), handle(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !validSignature(req.body, req.get('X-Razorpay-Signature'), config.webhookSecret)) {
      return res.status(401).json({ error: 'Invalid webhook signature.' });
    }
    let body;
    try { body = JSON.parse(req.body.toString('utf8')); }
    catch { return res.status(400).json({ error: 'Invalid webhook.' }); }
    const parsed = paymentEvent.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid webhook.' });
    const { event, payload } = parsed.data;
    if (event !== 'payment.captured' && event !== 'refund.processed') return res.sendStatus(204);
    const refund = payload.refund?.entity;
    const id = event === 'payment.captured' ? payload.payment?.entity.id : refund?.payment_id;
    if (!id) return res.status(400).json({ error: 'Missing payment identifier.' });
    if (event === 'refund.processed' && refund?.status !== 'processed') return res.status(400).json({ error: 'Refund is not processed.' });
    const receipt = event === 'refund.processed' && refund
      ? { id: refund.id, refundAmount: refund.amount }
      : { id: createHash('sha256').update(req.body).digest('hex') };
    if (await hasTestEvent(receipt.id)) return res.sendStatus(204);
    const payment = await fetchPayment(config, id);
    if (orderId.safeParse(payment.order_id).success) {
      const outcome = await reconcileTestPayment(payment.order_id!, payment, receipt);
      if (outcome.status === 'pending') return res.sendStatus(503);
    }
    return res.sendStatus(204);
  }));
  router.use((_req, res) => { res.sendStatus(404); });
  return router;
}

export function testBillingRouter(config: RazorpayTestConfig) {
  const router = Router();
  const owner = (res: Response): string => res.locals.studioAccount.clerkUserId;

  router.get('/plan', handle(async (_req, res) => res.json({ mode: 'test', amount: config.amount, credits: config.credits,
    currency: 'INR', balance: await testBalance(owner(res)) })));

  router.post('/orders', json({ limit: '2kb' }), handle(async (req, res) => {
    const parsed = requestOrder.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide a valid request ID.' });
    const { first, record } = await reserveTestOrder(owner(res), parsed.data.requestId, config.amount, config.credits);
    let external = record.orderId;
    if (!external) {
      const receipt = record._id.slice(0, 40);
      const matches = first ? [await config.client.orders.create({ amount: record.amount, currency: 'INR', receipt })]
        : (await config.client.orders.all({ receipt, count: 2 })).items.filter(item => item.receipt === receipt);
      if (matches.length !== 1) return res.status(409).json({ error: 'This order is awaiting reconciliation.' });
      const [order] = matches;
      external = orderId.parse(order.id);
      if (order.currency !== 'INR' || Number(order.amount) !== record.amount) throw new Error('Unexpected Razorpay order details.');
      await attachTestOrder(record._id, external);
    }
    return res.status(first ? 201 : 200).json({ keyId: config.keyId, orderId: external, amount: record.amount, currency: 'INR' });
  }));

  router.post('/orders/:orderId/reconcile', handle(async (req, res) => {
    const id = orderId.safeParse(req.params.orderId);
    if (!id.success) return res.status(404).json({ error: 'Order not found.' });
    const order = await findTestOrder(id.data);
    if (!order || order.ownerId !== owner(res)) return res.status(404).json({ error: 'Order not found.' });
    const payments = await config.client.orders.fetchPayments(id.data);
    const paid = payments.items.filter(payment => payment.status === 'captured' || payment.status === 'refunded');
    if (paid.length > 1) throw new Error('Order has multiple settled payments.');
    const result = paid.length ? await reconcileTestPayment(id.data, paid[0]) : { status: 'pending' };
    return res.json({ ...result, balance: await testBalance(owner(res)) });
  }));

  router.post('/verify', json({ limit: '2kb' }), handle(async (req, res) => {
    const parsed = checkout.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid checkout response.' });
    const details = parsed.data;
    const order = await findTestOrder(details.orderId);
    if (!order || order.ownerId !== owner(res)) return res.status(404).json({ error: 'Order not found.' });
    if (!validSignature(`${order.orderId}|${details.paymentId}`, details.signature, config.keySecret)) {
      return res.status(401).json({ error: 'Invalid checkout signature.' });
    }
    const payment = await fetchPayment(config, details.paymentId);
    const result = await reconcileTestPayment(details.orderId, payment);
    return res.json({ ...result, balance: await testBalance(owner(res)) });
  }));
  return router;
}
