import { createHash } from 'node:crypto';
import mongoose, { Schema } from 'mongoose';
import { earnedCredits, validatePayment, type VerifiedDispute } from './razorpay.js';

const orders = mongoose.model('TestPaymentOrder', new Schema({
  _id: { type: String, required: true }, ownerId: { type: String, required: true, immutable: true },
  orderId: String, paymentId: String, amount: { type: Number, required: true }, credits: { type: Number, required: true },
  credited: { type: Number, default: 0, required: true }, refunded: { type: Number, default: 0, required: true },
}, { collection: 'test_payment_orders', timestamps: true })
  .index({ ownerId: 1, createdAt: -1, _id: -1 })
  .index({ orderId: 1 }, { unique: true, partialFilterExpression: { orderId: { $type: 'string' } } })
  .index({ paymentId: 1 }, { unique: true, partialFilterExpression: { paymentId: { $type: 'string' } } }));
const wallets = mongoose.model('TestCreditWallet', new Schema({ _id: String, balance: { type: Number, default: 0 } }, { collection: 'test_wallets' }));
const entries = mongoose.model('TestCreditEntry', new Schema({
  ownerId: String, orderId: String, paymentId: String, delta: Number, refunded: Number,
}, { collection: 'test_credit_entries', timestamps: true }));
const receipts = mongoose.model('TestPaymentEvent', new Schema({ _id: String, orderId: String, refundAmount: Number },
  { collection: 'test_payment_events', timestamps: true }).index({ orderId: 1 }));
const disputes = mongoose.model('TestPaymentDispute', new Schema({
  _id: String, orderId: String, paymentId: String, heldAmount: Number, status: String, observedAt: Number,
}, { collection: 'test_payment_disputes', timestamps: true }).index({ orderId: 1 }));

export const initTestBilling = () => Promise.all([orders.init(), wallets.init(), entries.init(), receipts.init(), disputes.init()]);
export const findTestOrder = (orderId: string) => orders.findOne({ orderId }).lean().exec();
export const testBalance = async (ownerId: string) => (await wallets.findById(ownerId).lean())?.balance ?? 0;
export async function recentTestOrders(ownerId: string) {
  const records = await orders.find({ ownerId, orderId: { $type: 'string' } })
    .select('orderId paymentId amount credits credited refunded createdAt')
    .sort({ createdAt: -1, _id: -1 }).limit(20).lean();
  return records.map(record => ({
    orderId: record.orderId, amount: record.amount, credits: record.credits, credited: record.credited,
    refunded: record.refunded, createdAt: record.createdAt,
    state: !record.paymentId ? 'pending' : record.refunded === record.amount ? 'refunded' :
      record.refunded ? 'partially refunded' : record.credited < record.credits ? 'adjusted' : 'credited',
  }));
}
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

type PaymentEvent = { id: string; refundAmount?: number; dispute?: { canonical: VerifiedDispute; observedAt: number } };

export async function reconcileTestPayment(orderId: string, fetched: unknown, event?: PaymentEvent) {
  let result: { status: 'unknown' | 'pending' | 'credited' | 'refunded' | 'duplicate' | 'disputed'; credited?: number } = { status: 'unknown' };
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
      if (event?.dispute) {
        const { canonical, observedAt } = event.dispute;
        if (canonical.payment_id !== payment.id || canonical.amount > payment.amount) throw new Error('Dispute does not match the stored payment.');
        const previous = await disputes.findById(canonical.id).session(session);
        if (previous && (previous.paymentId !== payment.id || previous.orderId !== orderId)) throw new Error('Dispute payment changed.');
        const terminal = ['won', 'lost', 'closed', 'accepted'];
        const hold = terminal.includes(canonical.status) ? canonical.amount_deducted : canonical.amount;
        if (!previous || (previous.observedAt! <= observedAt &&
          (!terminal.includes(previous.status!) || terminal.includes(canonical.status)))) {
          await disputes.updateOne({ _id: canonical.id }, { $set: { orderId, paymentId: payment.id,
            heldAmount: hold, observedAt, status: canonical.status } }, { upsert: true, session });
        }
      }
      const [adjustment] = await disputes.aggregate<{ total: number }>([
        { $match: { orderId } }, { $group: { _id: null, total: { $sum: '$heldAmount' } } },
      ]).session(session);
      const disputed = adjustment?.total ?? 0;
      const combined = Math.min(order.amount, allocation.refunded + disputed);
      const credited = Math.floor(order.credits * (order.amount - combined) / order.amount);
      const delta = credited - order.credited;
      if (delta !== 0) {
        await wallets.updateOne({ _id: order.ownerId }, { $inc: { balance: delta } }, { upsert: true, session });
        await entries.create([{ ownerId: order.ownerId, orderId, paymentId: payment.id, delta, refunded: allocation.refunded }], { session });
      }
      order.paymentId = payment.id;
      order.credited = credited;
      order.refunded = allocation.refunded;
      await order.save({ session });
      result = { status: disputed ? 'disputed' : allocation.refunded ? 'refunded' : 'credited', credited };
    });
  } catch (error) {
    if (event && error instanceof mongoose.mongo.MongoServerError && error.code === 11000 && await hasTestEvent(event.id)) {
      return { status: 'duplicate' as const };
    }
    throw error;
  }
  return result;
}
