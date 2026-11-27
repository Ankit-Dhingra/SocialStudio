import { createHmac, timingSafeEqual } from 'node:crypto';
import Razorpay from 'razorpay';
import { z } from 'zod';

export const paymentId = z.string().regex(/^pay_[a-zA-Z0-9]{3,64}$/);
export const orderId = z.string().regex(/^order_[a-zA-Z0-9]{3,64}$/);
export const disputeId = z.string().regex(/^disp_[a-zA-Z0-9]{3,64}$/);
export const disputeShape = z.object({ id: disputeId, payment_id: paymentId, currency: z.literal('INR'),
  amount: z.number().int().positive().max(10_000_000), amount_deducted: z.number().int().nonnegative(),
  status: z.enum(['open', 'under_review', 'action_required', 'won', 'lost', 'closed', 'accepted']) })
  .refine(dispute => dispute.amount_deducted <= dispute.amount);
export type VerifiedDispute = z.infer<typeof disputeShape>;
const paymentShape = z.object({ id: paymentId, order_id: orderId, currency: z.literal('INR'),
  amount: z.number().int().positive().max(10_000_000), amount_refunded: z.number().int().min(0),
  status: z.enum(['created', 'authorized', 'captured', 'refunded', 'failed']), captured: z.boolean() });
export type VerifiedPayment = z.infer<typeof paymentShape>;

export function validSignature(raw: string | Buffer, supplied: unknown, secret: string) {
  if (!secret || typeof supplied !== 'string' || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  return timingSafeEqual(createHmac('sha256', secret).update(raw).digest(), Buffer.from(supplied, 'hex'));
}

export function validatePayment(payment: unknown, expected: { id: string; amount: number }) {
  const result = paymentShape.parse(payment);
  if (result.order_id !== expected.id || result.amount !== expected.amount || result.amount_refunded > result.amount) {
    throw new Error('Payment does not match the stored order.');
  }
  return result;
}

export function earnedCredits(payment: VerifiedPayment, credits: number, previousRefund: number) {
  const refunded = Math.max(payment.amount_refunded, previousRefund);
  if (!(payment.status === 'captured' && payment.captured) && !(payment.status === 'refunded' && refunded > 0)) return null;
  return { refunded, credits: Math.floor(credits * (payment.amount - refunded) / payment.amount) };
}

export function razorpayTestConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.RAZORPAY_TEST_ENABLED !== 'true') return undefined;
  const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret, RAZORPAY_WEBHOOK_SECRET: webhookSecret } = env;
  const amount = Number(env.RAZORPAY_TEST_PLAN_PAISA);
  const credits = Number(env.RAZORPAY_TEST_PLAN_CREDITS);
  if (!keyId?.startsWith('rzp_test_') || !keySecret || !webhookSecret || webhookSecret.length < 24 ||
      !Number.isSafeInteger(amount) || amount < 100 || amount > 10_000_000 ||
      !Number.isSafeInteger(credits) || credits < 1 || credits > 1_000_000) throw new Error('Invalid Razorpay test configuration.');
  return { keyId, keySecret, webhookSecret, amount, credits, client: new Razorpay({ key_id: keyId, key_secret: keySecret }) };
}

export type RazorpayTestConfig = NonNullable<ReturnType<typeof razorpayTestConfig>>;
