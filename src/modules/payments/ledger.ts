import { createHash } from 'node:crypto';
import mongoose, { Schema } from 'mongoose';
import { earnedCredits, validatePayment } from './razorpay.js';

const orders = mongoose.model('TestPaymentOrder', new Schema({
  _id: { type: String, required: true }, ownerId: { type: String, required: true, immutable: true },
  orderId: String, paymentId: String, amount: { type: Number, required: true }, credits: { type: Number, required: true },
  credited: { type: Number, default: 0, required: true }, refunded: { type: Number, default: 0, required: true },
}, { collection: 'test_payment_orders', timestamps: true })
  .index({ orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $type: 'string' } } })
  .index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: 'string' } } }));
const wallets = mongoose.model('TestCreditWallet', new Schema({ _id: String, balance: { type: Number, default: 0 } }, { collection: 'test_wallets' }));
const entries = mongoose.model('TestCreditEntry', new Schema({
  ownerId: String, orderId: String, paymentId: String, delta: Number, refunded: Number,
}, { collection: 'test_credit_entries', timestamps: true }));
const receipts = mongoose.model('TestPaymentEvent', new Schema({ _id: String, orderId: String, refundAmount: Number },
  { collection: 'test_payment_events', timestamps: true }).index({ orderId: 1 }));

export const initTestBilling = () => Promise.all([orders.init(), wallets.init(), entries.init(), receipts.init()]);
export const findTestOrder = (orderId: string) => orders.findOne({ orderId }).lean().exec();
export const testBalance = async (ownerId: string) => (await wallets.findById(ownerId).lean())?.balance ?? 0;
export const hasTestEvent = (id: string) => receipts.exists({ _id: id });

export async function reserveTestOrder(ownerId: string, requestId: string, amount: number, credits: number) {
  const id = createHash('sha256').update(JSON.stringify([ownerId, requestId])).digest('hex');
  try {
    const record = await orders.create({ _id: id, ownerId, amount, credits });
    return { first: true, record };
  } catch (error) {
    if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) throw error;
    return { first: false, record: await orders.findById(id).orFail() };
  }
}

export async function attachTestOrder(id: string, orderId: string) {
  await orders.updateOne({ _id: id, orderId: { $exists: false } }, { $set: { orderId } });
}

export async function reconcileTestPayment(orderId: string, fetched: unknown, event?: { id: string; refundAmount?: number }) {
  let result: { status: 'unknown' | 'pending' | 'credited' | 'refunded' | 'duplicate'; credited?: number } = { status: 'unknown' };
  try {
    await mongoose.connection.transaction(async session => {
      const order = await orders.findOne({ orderId }).session(session);
      if (!order) return;
      const payment = validatePayment(fetched, { id: orderId, amount: order.amount });
      if (order.paymentId && order.paymentId !== payment.id) throw new Error('Order already has a different captured payment.');
      if (!earnedCredits(payment, order.credits, order.refunded)) { result = { status: 'pending' }; return; }
      if (event) await receipts.create([{ _id: event.id, orderId, refundAmount: event.refundAmount }], { session });
      const [verifiedRefunds] = await receipts.aggregate<{ total: number }>([
        { $match: { orderId, refundAmount: { $exists: true } } }, { $group: { _id: null, total: { $sum: '$refundAmount' } } },
      ]).session(session);
      if ((verifiedRefunds?.total ?? 0) > order.amount) throw new Error('Refund total exceeds the stored order amount.');
      const allocation = earnedCredits(payment, order.credits, Math.max(order.refunded, verifiedRefunds?.total ?? 0));
      if (!allocation) { result = { status: 'pending' }; return; }
      const delta = allocation.credits - order.credited;
      if (delta !== 0) {
        await wallets.updateOne({ _id: order.ownerId }, { $inc: { balance: delta } }, { upsert: true, session });
        await entries.create([{ ownerId: order.ownerId, orderId, paymentId: payment.id, delta, refunded: allocation.refunded }], { session });
      }
      order.paymentId = payment.id;
      order.credited = allocation.credits;
      order.refunded = allocation.refunded;
      await order.save({ session });
      result = { status: allocation.refunded ? 'refunded' : 'credited', credited: allocation.credits };
    });
  } catch (error) {
    if (event && error instanceof mongoose.mongo.MongoServerError && error.code === 11000 && await hasTestEvent(event.id)) {
      return { status: 'duplicate' as const };
    }
    throw error;
  }
  return result;
}
