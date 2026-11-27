import React, { useEffect, useState } from 'react';
import { pipelineFetch } from './pipeline-api.js';

const endpoint = path => `${import.meta.env.VITE_API_URL || ''}${path}`;

async function read(path, options) {
  const response = await pipelineFetch(endpoint(path), options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Could not load generation account details.');
  return body;
}

export function GenerationAccount() {
  const [balance, setBalance] = useState(null);
  const [trial, setTrial] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [account, credits, trialState] = await Promise.all([read('/api/account'), read('/api/credits/balance'), read('/api/credits/trial')]);
    setBalance(credits.available);
    setTrial(trialState);
    if (account.role === 'owner') setAdmin(await read('/api/admin/generation'));
  }

  useEffect(() => { void refresh().catch(error => setNotice(error.message)); }, []);

  async function update(path, method, body) {
    setBusy(true);
    setNotice('');
    try {
      await read(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      await refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }

  return <section aria-label="Generation account">
    <h2>Generation credits</h2>
    {balance !== null && <p>{balance} available</p>}
    {trial?.eligible && <button className="btn btn-secondary" type="button" disabled={busy}
      onClick={() => void update('/api/credits/trial/claim', 'POST')}>Claim trial credits</button>}
    {notice && <p role="status">{notice}</p>}
    {admin && <>
      <h3>Owner controls</h3>
      <button className="btn btn-secondary" type="button" disabled={busy}
        onClick={() => void update('/api/admin/generation/pause', 'PUT', { paused: !admin.paused })}>
        {admin.paused ? 'Resume generation' : 'Pause generation'}
      </button>
      <form onSubmit={event => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const selection = values.get('plan');
        const amount = selection ? { planId: selection }
          : { credits: Number(values.get('credits')), expiresInDays: Number(values.get('expiry')) };
        void update('/api/admin/generation/credits', 'POST', { reference: crypto.randomUUID(), ...amount });
      }}>
        {admin.plans.length > 0 && <label>Credit plan <select name="plan" defaultValue="">
          <option value="">Custom allocation</option>
          {admin.plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
        </select></label>}
        <label>Credits <input name="credits" type="number" min="1" max="100000" /></label>
        <label>Days until expiry <input name="expiry" type="number" required min="1" max="365" defaultValue="30" /></label>
        <button className="btn btn-secondary" type="submit" disabled={busy}>Allocate owner credits</button>
      </form>
      <h3>Recent jobs</h3>
      {admin.jobs.length ? <table>
        <thead><tr><th>Job</th><th>Status</th><th>Provider calls</th></tr></thead>
        <tbody>{admin.jobs.map(job => <tr key={job._id}>
          <td>{job.operation} · {job._id.slice(0, 8)}</td><td>{job.status}</td>
          <td>{job.calls.length > 0 ? <details>
            <summary>{job.calls.length} calls</summary>
            <ul>{job.calls.map(call => <li key={call.id}>
              {call.provider} · {call.status ?? 'Awaiting reconciliation'}{call.estimatedMicros !== undefined && ` · estimated ${call.estimatedMicros} µ`}
              {call.usage?.inputTokens !== undefined && ` · ${call.usage.inputTokens} input tokens`}
              {call.usage?.outputTokens !== undefined && ` · ${call.usage.outputTokens} output tokens`}
            </li>)}</ul>
          </details> : 'None'}</td>
        </tr>)}</tbody>
      </table> : <p>No generation jobs yet.</p>}
    </>}
  </section>;
}
