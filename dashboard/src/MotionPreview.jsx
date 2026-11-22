import React, { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';

const cameras = ['locked', 'push-in', 'pull-back', 'track-left', 'track-right', 'rise'];

export function MotionPreview({ sessionId, scenes, toApiUrl }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [scope, setScope] = useState('sequence');
  const [preview, setPreview] = useState(null);
  const [job, setJob] = useState(null);
  const [requestCount, setRequestCount] = useState(0);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const video = useRef(null);
  const busy = submitting || job?.status === 'planning' || job?.status === 'rendering';

  useEffect(() => {
    const controller = new AbortController();
    let timer;
    let failures = 0;
    async function readStatus() {
      try {
        const response = await fetch(toApiUrl(`/api/pipeline/motion-preview/${sessionId}`), { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load motion preview.');
        if (controller.signal.aborted) return;
        failures = 0;
        setJob(data.job ?? null);
        setPreview(data.preview ?? null);
        if (data.job?.status === 'failed') setError(data.job.error);
        else if (data.job) setError('');
        timer = setTimeout(readStatus, data.job && data.job.status !== 'failed' ? 1600 : 7000);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (++failures < 4) timer = setTimeout(readStatus, 1600);
        else {
          setJob(null);
          setError(err.message);
        }
      }
    }
    void readStatus();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [sessionId, requestCount, toApiUrl]);

  async function generate(startScene = sceneIndex, directions = {}, previewScope = scope) {
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch(toApiUrl('/api/pipeline/motion-preview'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sceneIndex: startScene, directions, scope: previewScope }),
      });
      const data = await response.json();
      if (!response.ok && !data.job) throw new Error(data.error || 'Could not start motion preview.');
      setJob(data.job);
      setEditing(null);
      setRequestCount(count => count + 1);
    } catch (err) {
      setJob(null);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="motion-preview" aria-label="Motion preview">
      <div className="motion-preview-controls">
        <label>
          Starting scene
          <select value={sceneIndex} onChange={event => setSceneIndex(Number(event.target.value))} disabled={busy}>
            {scenes.map((scene, index) => <option key={scene.id} value={index}>Scene {index + 1}</option>)}
          </select>
        </label>
        <label>
          Range
          <select value={scope} onChange={event => setScope(event.target.value)} disabled={busy}>
            <option value="sequence">Up to 24 seconds</option>
            <option value="scene">Selected scene</option>
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={() => void generate()} disabled={busy}>
          <Play size={14} /> {busy ? 'Preparing preview…' : 'Generate Motion Preview'}
        </button>
      </div>
      {busy && <p role="status">{job?.status === 'rendering' ? `Rendering with saved voiceover… ${job.progress}%` : 'Planning local shots…'}</p>}
      {error && <p role="alert" className="motion-preview-error">{error}</p>}
      {preview && (
        <div className="motion-preview-review">
          <video key={preview.mediaUrl} ref={video} src={toApiUrl(preview.mediaUrl)} controls playsInline preload="metadata" />
          <div>
            <h4>Shot list</h4>
            <p>Scene {preview.sceneIndex + 1} · {preview.durationSec.toFixed(1)}s</p>
            <ol className="motion-shot-list">
              {preview.shots.map(shot => (
                <li key={shot.id}>
                  <button type="button" onClick={() => { if (video.current) video.current.currentTime = shot.fromSec; }}>
                    <time>{shot.fromSec.toFixed(1)}s</time> {shot.title}
                  </button>
                  {shot.action && <p>{shot.action}</p>}
                  {shot.action && <div className="motion-shot-meta">
                    <small>{shot.camera?.replaceAll('-', ' ') || 'Camera move'} · {shot.kind === 'film' ? '3D animation' : shot.footage ? 'Animated footage' : 'Framed artwork'}</small>
                    <button type="button" disabled={busy} onClick={() => setEditing({
                      id: shot.id, action: shot.action, camera: shot.camera || 'push-in',
                    })}>{shot.kind === 'film' ? 'Edit camera' : 'Edit direction'}</button>
                  </div>}
                  {editing?.id === shot.id && <form className="motion-shot-edit" onSubmit={event => {
                    event.preventDefault();
                    void generate(preview.sceneIndex, { [shot.id]: { action: editing.action.trim(), camera: editing.camera } }, preview.scope ?? 'sequence');
                  }}>
                    {shot.kind !== 'film' && <label>
                      Physical action
                      <textarea maxLength={240} required value={editing.action}
                        onChange={event => setEditing({ ...editing, action: event.target.value })} />
                    </label>}
                    <label>
                      Camera
                      <select value={editing.camera} onChange={event => setEditing({ ...editing, camera: event.target.value })}>
                        {cameras.map(camera => <option key={camera} value={camera}>{camera.replaceAll('-', ' ')}</option>)}
                      </select>
                    </label>
                    <div className="motion-preview-controls">
                      <button type="submit" className="btn btn-primary" disabled={busy || !editing.action.trim()}>Apply and preview</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </form>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  );
}
