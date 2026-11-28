import React, { useEffect, useRef, useState } from 'react';
import { pipelineFetch } from './pipeline-api.js';

const billingUrl = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/billing/test`;
const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const day = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
let checkoutScript;

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScript) checkoutScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      if (typeof window.Razorpay === 'function') resolve();
      else script.onerror();
    };
    script.onerror = () => { checkoutScript = undefined; script.remove(); reject(new Error('Checkout is unavailable.')); };
    document.head.append(script);
  });
  return checkoutScript;
}

async function post(route, details) {
  const response = await pipelineFetch(`${billingUrl}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The test payment could not be processed.');
  return data;
}

export function TestBilling() {
  const [plan, setPlan] = useState(null);
  const [orders, setOrders] = useState([]);
  const [availability, setAvailability] = useState('loading');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const orderRequest = useRef(null);
  const submitting = useRef(false);

  async function refresh(signal) {
    const response = await pipelineFetch(`${billingUrl}/plan`, { signal, cache: 'no-store' });
    if (response.status === 403 || response.status === 404) { setAvailability('disabled'); return; }
    if (!response.ok) throw new Error('Could not load test billing.');
    const currentPlan = await response.json();
    if (currentPlan.mode !== 'test') { setAvailability('disabled'); return; }
    setPlan(currentPlan);
    setAvailability('enabled');
    const history = await pipelineFetch(`${billingUrl}/orders`, { signal, cache: 'no-store' });
    if (!history.ok) throw new Error('Could not load test payment activity.');
    setOrders((await history.json()).orders);
  }

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal).catch(error => {
      if (!controller.signal.aborted) setStatus(error.message);
    });
    return () => controller.abort();
  }, []);

  async function reconcile(orderId) {
    setBusy(true);
    try {
      const result = await post(`/orders/${encodeURIComponent(orderId)}/reconcile`, {});
      setStatus(result.status === 'pending' ? 'Razorpay has yet to capture this test payment.' : 'Test payment status updated.');
      await refresh();
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }

  async function start() {
    if (submitting.current) return;
    submitting.current = true;
    const release = () => { submitting.current = false; setBusy(false); };
    setBusy(true);
    setStatus('');
    orderRequest.current ??= crypto.randomUUID();
    try {
      await loadCheckout();
      const order = await post('/orders', { requestId: orderRequest.current });
      let verifying = false;
      const checkout = new window.Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
        name: 'SocialStudio', description: `${plan.name} plan · Test Mode`,
        modal: { ondismiss: () => {
          if (verifying) return;
          release();
          void refresh().catch(error => setStatus(error.message));
        } },
        handler: async response => {
          verifying = true;
          orderRequest.current = null;
          setStatus('Confirming payment…');
          try {
            const result = await post('/verify', { orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id, signature: response.razorpay_signature });
            setPlan(current => ({ ...current, balance: result.balance }));
            setStatus(result.status === 'credited' ? 'Payment verified. Your credits are available.' : 'Payment received. Check Payment activity for the latest status.');
          } catch { setStatus('Confirmation is pending. Check the order status in Payment activity.'); }
          try { await refresh(); }
          catch { setStatus('Could not refresh payment activity. Reload to check the latest status.'); }
          finally { release(); }
        },
      });
      checkout.on('payment.failed', () => setStatus('Payment was declined. You can retry in Razorpay or close checkout and try again.'));
      checkout.open();
    } catch (error) { setStatus(error.message); release(); }
  }

  return <section aria-label="Credit plans and payments" className="billing-panel pricing-checkout">
    {availability === 'loading' && !status && <p role="status">Checking checkout availability…</p>}
    {availability === 'loading' && status && <button className="marketing-secondary" onClick={() => {
      setStatus('');
      void refresh().catch(error => setStatus(error.message));
    }}>Retry loading checkout</button>}
    {availability === 'disabled' && <p>Credit pack checkout is unavailable.</p>}
    {plan && availability === 'enabled' && <>
      <div className="pricing-card">
        <h2>{plan.name} plan</h2>
        <p className="creator-plan-price">{inr.format(plan.amount / 100)} <small>one-time</small></p>
        <p>{plan.credits} credits per pack</p>
        <p><strong>{plan.balance} credits available in your test wallet</strong></p>
        <button type="button" className="marketing-primary" onClick={start} disabled={busy}>Continue to Razorpay</button>
        <p className="pricing-note">Test payment. No real money is charged.</p>
        {plan.balance > 0 && <a href="/studio?create=1" className="marketing-secondary">Create a reel</a>}
        {status && <p role="status">{status}</p>}
      </div>
      <h3>Payment activity</h3>
      {orders.length ? <div className="billing-table"><table>
        <thead><tr><th scope="col">Date</th><th scope="col">Test amount</th><th scope="col">Credits added</th>
          <th scope="col">Status</th><th scope="col">Action</th></tr></thead>
        <tbody>{orders.map(order => <tr key={order.orderId}>
          <td>{day.format(new Date(order.createdAt))}</td><td>{inr.format(order.amount / 100)}</td>
          <td>{order.credited} of {order.credits}</td>
          <td className="billing-state">{order.state}{order.refunded > 0 && ` · ${inr.format(order.refunded / 100)} returned`}</td>
          <td><button type="button" className="btn btn-secondary" disabled={busy}
            onClick={() => void reconcile(order.orderId)}>Check status</button></td>
        </tr>)}</tbody>
      </table></div> : <p>No test orders yet.</p>}
    </>}
    {status && !plan && <p role="status">{status}</p>}
  </section>;
}
