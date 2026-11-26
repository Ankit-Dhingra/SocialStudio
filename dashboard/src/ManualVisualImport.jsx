import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Copy, Download, LoaderCircle, TriangleAlert } from 'lucide-react';
import { pipelineFetch } from './pipeline-api.js';

const maximumBytes = 256 * 1024;
const sourceFiles = ['MASTER_VISUAL_PROMPT.md', 'VISUAL_DESIGN_SYSTEM.md', 'MOTION_AND_TEACHING.md', 'GOLDEN_REFERENCE.svg',
  'GOLDEN_REFERENCE.png', 'GOLDEN_REFERENCE_SOURCE.md', 'PROJECT_SETUP.md', 'SCENE_SCHEMA.json',
  'RENDERER_CAPABILITIES.json', 'ANIMATION_RULES.md', 'VALID_EXAMPLE.json', 'CONTRACT_VERSION.json'];

function contextError(response, data) {
  if (!data.error && (response.status === 404 || response.ok)) {
    return {
      message: 'The connected backend did not return the Manual Visual Prompt endpoint.',
      resolution: 'Start or update the SocialStudio backend this dashboard connects to, then use Refresh Context in Advanced Settings.',
    };
  }
  return {
    message: data.error || `The server could not prepare the prompt (HTTP ${response.status}).`,
    resolution: data.issues?.[0]?.resolution || (response.status === 404 || response.status === 403
      ? 'Reopen the saved job in the browser where it was created and select Manual again.'
      : 'Check that the dashboard backend is running, then use Refresh Context in Advanced Settings.'),
  };
}

async function requestContext(url, signal) {
  try {
    const response = await pipelineFetch(url, { signal, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    return response.ok && data.prompt ? { context: data } : { error: contextError(response, data) };
  } catch {
    return { error: { message: 'Could not reach the dashboard backend.',
      resolution: 'Check that the backend is running, then try again.' } };
  }
}

function download(name, content, type) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function ManualVisualImport({ sessionId, narrationKey, toApiUrl, onGenerated, busy, onBusyChange }) {
  const [text, setText] = useState('');
  const [prepared, setPrepared] = useState(null);
  const [copiedPrompt, setCopiedPrompt] = useState('');
  const [issues, setIssues] = useState([]);
  const [layoutWarnings, setLayoutWarnings] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [operation, setOperation] = useState('');
  const [contextLoad, setContextLoad] = useState(0);
  const endpoint = `/api/pipeline/manual-visual/${encodeURIComponent(sessionId)}`;
  const requestKey = JSON.stringify([endpoint, narrationKey, contextLoad]);
  const active = prepared?.key === requestKey ? prepared : null;
  const context = active?.context;
  const loading = !active;

  useEffect(() => {
    const controller = new AbortController();
    void requestContext(toApiUrl(`${endpoint}/context`), controller.signal).then(result => {
      if (!controller.signal.aborted) setPrepared({ key: requestKey, ...result });
    });
    return () => controller.abort();
  }, [endpoint, requestKey, toApiUrl]);

  const refresh = () => setContextLoad(value => value + 1);

  async function copyPrompt(repair = false) {
    if (!context || busy || operation) return;
    setOperation('copy');
    if (!repair) {
      setError('');
      setCopiedPrompt('');
    }
    const latest = requestContext(toApiUrl(`${endpoint}/context`));
    const value = latest.then(result => {
      if (result.error) throw new Error(result.error.message);
      setPrepared(previous => previous?.key === requestKey ? { key: requestKey, ...result } : previous);
      if (!repair) return result.context.prompt;
      return `${result.context.prompt}\n\nRepair only the fields or sequences identified by the errors below. Preserve every valid sequence, unaffected geometry, cue IDs, sequence ranges and job bindings. Return the complete revised object in one json code block.\n`
        + JSON.stringify({ errors: issues, originalImport: text });
    });
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': value.then(prompt => new Blob([prompt], { type: 'text/plain' })) })]);
      } else {
        await navigator.clipboard.writeText(await value);
      }
      if (repair) setStatus('Repair prompt copied.');
      else setCopiedPrompt(requestKey);
    } catch {
      await value.catch(() => {});
      const { error: failure } = await latest;
      setError(failure ? `${failure.message} ${failure.resolution}`
        : 'Clipboard access failed. Allow clipboard access, or use Download Prompt in Advanced Settings.');
    } finally {
      setOperation('');
    }
  }

  function updateText(value) {
    setText(value);
    setIssues([]);
    setLayoutWarnings([]);
    setError('');
    setStatus('');
  }

  async function submit(action) {
    if (!text.trim() || !context || busy || operation) return;
    const generate = action === 'generate';
    setOperation(action);
    if (generate) onBusyChange(true);
    setIssues([]);
    setLayoutWarnings([]);
    setError('');
    setStatus(generate ? 'Validating JSON and generating stills…' : 'Validating JSON and geometry…');
    try {
      const response = await pipelineFetch(toApiUrl(`${endpoint}/${action}`), { method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body: text });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const details = result.issues ?? [];
        setIssues(details);
        if (details.some(issue => ['$.inputRevision', '$.schemaHash', '$.version'].includes(issue.path))) refresh();
        throw new Error(result.error || `Could not prepare the visuals (HTTP ${response.status}).`);
      }
      if (generate) onGenerated(result);
      setLayoutWarnings(result.layoutWarnings ?? []);
      const focalNotice = result.focalRepairs?.length ? ' Invalid focal references were removed. Visible layers were preserved.' : '';
      const connectorNotice = result.connectorRepairs?.length ? ' Connector attachments or routes were corrected.' : '';
      setStatus(`${generate ? 'Visuals ready to review.' : 'JSON and geometry validated.'}${focalNotice}${connectorNotice}${result.strippedFence ? ' The surrounding JSON fence was removed.' : ''}`);
    } catch (err) { setStatus(''); setError(err.message); }
    finally { setOperation(''); if (generate) onBusyChange(false); }
  }

  const working = busy || Boolean(operation);
  const canSubmit = context && !working && text.trim();
  return (
    <section className="manual-visual-import" aria-label="Manual visual directive import">
      <div className="manual-visual-step">
        <h4>Copy the prompt into ChatGPT</h4>
        <button className="btn btn-secondary" type="button" disabled={!context || working} aria-describedby="visual-context-status"
          onClick={() => copyPrompt()}>
          <Copy size={14} aria-hidden="true" /> Copy Visual Prompt
        </button>
        <div id="visual-context-status" className={`manual-visual-context${active?.error ? ' manual-visual-error' : ''}`}
          role={active?.error ? 'alert' : 'status'}>
          {loading || operation === 'copy' ? <><LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Preparing the prompt from saved narration and timings…</>
            : context ? <><CheckCircle2 size={14} aria-hidden="true" /> {copiedPrompt === requestKey ? 'Prompt copied. Paste it into ChatGPT.' : 'Prompt ready to copy.'}</>
              : <><TriangleAlert size={14} aria-hidden="true" /><div><p>{active.error.message}</p><p>{active.error.resolution}</p></div></>}
        </div>
      </div>

      <form className="manual-visual-step" onSubmit={event => { event.preventDefault(); void submit('generate'); }}>
        <label className="manual-visual-label" htmlFor="visual-directive-json">Paste the ChatGPT JSON response</label>
        <textarea id="visual-directive-json" value={text} rows={7} disabled={working} spellCheck={false}
          aria-invalid={issues.length > 0} placeholder="Paste the JSON response here" onChange={event => updateText(event.target.value)} />
        <div className="manual-visual-actions">
          <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
            {operation === 'generate' ? <><LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Generating Visuals…</> : 'Generate Visuals'}
          </button>
          {issues.length > 0 && <button className="btn btn-secondary" type="button" disabled={!context || working}
            onClick={() => copyPrompt(true)}>Copy Repair Prompt</button>}
        </div>
        {status && <p className="manual-visual-feedback" role="status">{status}</p>}
        {layoutWarnings.length > 0 && <details className="manual-visual-advanced manual-visual-feedback">
          <summary>Layout notes ({layoutWarnings.length}) <ChevronDown size={15} aria-hidden="true" /></summary>
          <div className="manual-visual-advanced-content">
            {layoutWarnings.map(({ path, message, scenes, resolution }, index) => <div key={index}>
              <p>{message}{scenes?.length ? ` (Scenes ${scenes.map(scene => scene + 1).join(', ')})` : ''}</p>
              <p><code>{path}</code> {resolution}</p>
            </div>)}
          </div>
        </details>}
        {error && <div className="manual-visual-feedback manual-visual-error" role="alert">
          <p>{error}</p>
          {issues.length > 0 && <ul>{issues.map(({ path, message, scenes, resolution }, index) => (
            <li key={index}><code>{path}</code>{message !== error ? ` ${message}` : ''}{scenes?.length ? ` (Scenes ${scenes.map(scene => scene + 1).join(', ')})` : ''}
              {resolution && <p>{resolution}</p>}</li>
          ))}</ul>}
        </div>}
      </form>

      <details className="manual-visual-advanced">
        <summary>Advanced Settings <ChevronDown size={15} aria-hidden="true" /></summary>
        <div className="manual-visual-advanced-content">
          <div className="manual-visual-actions">
            <button className="btn btn-secondary" type="button" disabled={!context || working} onClick={() => download('visual-prompt.md', context.prompt, 'text/markdown')}>Download Prompt</button>
            <button className="btn btn-secondary" type="button" disabled={!context || working} onClick={() => download('visual-context.json', JSON.stringify({ job: context.job, specification: context.specification, artDirection: context.artDirection }, null, 2), 'application/json')}>Download Context JSON</button>
            <button className="btn btn-secondary" type="button" disabled={loading || working} onClick={refresh}>Refresh Context</button>
            <button className="btn btn-secondary" type="button" disabled={!canSubmit} onClick={() => submit('validate')}>Validate JSON</button>
            <label className={`btn btn-secondary manual-visual-upload${working ? ' is-disabled' : ''}`}>
              Upload JSON <input type="file" accept=".json,application/json" disabled={working} onChange={async event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                if (file.size > maximumBytes) { setStatus(''); setError('Choose a JSON file under 256 KB.'); return; }
                try { updateText(await file.text()); }
                catch { setStatus(''); setError('Could not read the selected JSON file.'); }
              }} />
            </label>
          </div>
          {context && <p className="manual-visual-meta">Production schema <code>{context.specification.version}</code></p>}
          <div>
            <h4>Visual Director source files</h4>
            <p>Download these for one-time ChatGPT Project setup.</p>
          </div>
          <div className="manual-visual-files" aria-label="Source file downloads">
            {sourceFiles.map(name => <a className="btn btn-secondary" key={name} href={toApiUrl(`/api/pipeline/visual-source-pack/${name}`)} download={name}>
              <Download size={13} aria-hidden="true" /> {name}
            </a>)}
          </div>
        </div>
      </details>
    </section>
  );
}
