import React, { useEffect, useRef, useState } from 'react';
import { pipelineFetch } from './pipeline-api.js';

const billingUrl = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api/billing/test`;
let checkoutScript;

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScript) checkoutScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => { checkoutScript = undefined; script.remove(); reject(new Error('Checkout is unavailable.')); };
    document.head.append(script);
  });
  return checkoutScript;
}

async function post(route, details) {
  const response = await pipelineFetch(`${billingUrl}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The test payment could not be processed.');
  return data;
}

export function TestBilling() {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const orderRequest = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    pipelineFetch(`${billingUrl}/plan`, { signal: controller.signal })
      .then(async response => { if (response.ok) setPlan(await response.json()); }).catch(() => {});
    return () => controller.abort();
  }, []);

  if (plan?.mode !== 'test') return null;

  async function start() {
    setBusy(true);
    setStatus('');
    orderRequest.current ??= crypto.randomUUID();
    try {
      await loadCheckout();
      const order = await post('/orders', { requestId: orderRequest.current });
      const checkout = new window.Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency, name: 'SocialStudio test checkout',
        modal: { ondismiss: () => setBusy(false) },
        handler: async response => {
          orderRequest.current = null;
          try {
            const result = await post('/verify', { orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id, signature: response.razorpay_signature });
            setPlan(current => ({ ...current, balance: result.balance }));
            setStatus(result.status === 'pending' ? 'Waiting for payment capture.' : 'Test payment verified.');
          } catch { setStatus('Confirmation is pending. Razorpay will retry the webhook.'); }
          finally { setBusy(false); }
        },
      });
      checkout.open();
    } catch (error) { setStatus(error.message); setBusy(false); }
  }

  return <section aria-label="Test billing" className="test-billing">
    <h2>Test billing</h2>
    <p>{plan.balance} test credits available.</p>
    <button type="button" className="btn btn-secondary" onClick={start} disabled={busy}>
      Test {plan.credits} credits for {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(plan.amount / 100)}
    </button>
    {status && <p role="status">{status}</p>}
  </section>;
}
