import React, { useEffect, useState } from 'react';
import { pipelineFetch } from './pipeline-api.js';
import { TestBilling } from './TestBilling.jsx';
import { PlanFaq } from './Plans.jsx';

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const number = new Intl.NumberFormat();
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function BillingPage() {
  const [usage, setUsage] = useState(null);
  const [status, setStatus] = useState('Loading generation credits…');
  useEffect(() => {
    const controller = new AbortController();
    pipelineFetch(`${apiBase}/api/credits/usage`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Could not load generation credits.');
        setUsage(await response.json());
        setStatus('');
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('Could not load generation credits.'); });
    return () => controller.abort();
  }, []);

  return <main className="main-content billing-page">
    <nav aria-label="Billing navigation">
      <a className="btn btn-secondary" href="/studio">Studio</a>
      <a className="btn btn-secondary" href="/account">Account</a>
    </nav>
    <h1>Plans & billing</h1>
    <TestBilling />
    <section className="billing-panel" aria-labelledby="generation-credit-heading">
      <h2 id="generation-credit-heading">Generation credits</h2>
      {status && <p role="status">{status}</p>}
      {usage && <>
        <dl className="billing-stats">
          <div><dt>Available</dt><dd>{number.format(usage.available)}</dd></div>
          <div><dt>Reserved for jobs</dt><dd>{number.format(usage.reserved)}</dd></div>
          <div><dt>Used to date</dt><dd>{number.format(usage.used)}</dd></div>
          <div><dt>Expired unused</dt><dd>{number.format(usage.expired)}</dd></div>
        </dl>
        {usage.nextExpiry && <p>Next credit expiry <time dateTime={usage.nextExpiry}>{date.format(new Date(usage.nextExpiry))}</time></p>}
      </>}
    </section>
    <PlanFaq />
  </main>;
}
