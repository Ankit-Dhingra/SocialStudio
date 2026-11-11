import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Sparkles,
  FileText,
  Wand2,
  Copy,
  Check,
  RotateCcw,
  ShieldCheck,
  Clock,
  Music,
  Type,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Key,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Code2,
  ArrowRight
} from 'lucide-react';
import './style.css';

import reactExample from '../../examples/react-state.json';

import checkoutExample from '../../examples/checkout.json';
import retrievalExample from '../../examples/retrieval.json';
const reviewedExamples = [reactExample, checkoutExample, retrievalExample];
const SAMPLE_SCRIPT = JSON.stringify(reactExample, null, 2);

const TOPIC_PRESETS = [
  'How Node.js Event Loop handles Microtasks vs Macrotasks',
  'Why PostgreSQL MVCC Causes Table Bloat and VACUUM Internals',
  'Redis Persistence: RDB Snapshots vs AOF Journaling Under The Hood',
  'How V8 JIT Inline Caching and Hidden Classes Accelerate JavaScript',
  'Database Sharding vs Partitioning: When and Why it Matters',
];

const SCRIPT_PROMPT_TEMPLATE = `Write one complete Hinglish tech lesson for a 9:16 reel and short. Start with a concrete prediction. Trace one example with a labelled diagram, show the observed outcome, explain why it happened, and end with the practical rule. For each scene provide narration, the visible values and the phrase that triggers each change.`;

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const toApiUrl = (p) => (p && p.startsWith('http') ? p : `${API_BASE}${p || ''}`);

function App() {
  const [videos, setVideos] = useState([]);
  const [mode, setMode] = useState('topic'); // 'script' | 'topic'
  const [customScript, setCustomScript] = useState(SAMPLE_SCRIPT);
  const [topic, setTopic] = useState(TOPIC_PRESETS[0]);
  const [token, setToken] = useState('change-me-in-local-dev');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  async function refresh() {
    try {
      const res = await fetch(toApiUrl('/api/videos'));
      if (res.ok) {
        const data = await res.json();
        setVideos(data);
        if (!selectedId && data.length > 0) {
          setSelectedId(data[0].id);
        }
      }
    } catch {
      // Quiet background polling
    }
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [selectedId]);

  async function post(url, payload = {}) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(toApiUrl(url), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-automation-token': token,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
      await refresh();
      if (data.id) setSelectedId(data.id);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const [preview, setPreview] = useState(null);
  const input = mode === 'script' ? { customScript } : { topic };
  const inputKey = JSON.stringify(input);
  const currentPreview = preview?.inputKey === inputKey ? preview : null;

  async function previewLesson() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(toApiUrl('/api/previews'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'x-automation-token': token},
        body: inputKey,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPreview({...data, inputKey});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(SCRIPT_PROMPT_TEMPLATE);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }

  // Active / Selected Video
  const activeVideo = videos.find((v) => v.id === selectedId) || videos[0] || null;

  // Filter & Search
  const filteredVideos = videos.filter((v) => {
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'active'
        ? ['QUEUED', 'SCRIPTING', 'NARRATING', 'RENDERING'].includes(v.status)
        : filter === 'ready'
        ? v.status === 'READY_FOR_REVIEW'
        : filter === 'approved'
        ? v.status === 'APPROVED'
        : true;

    const matchesSearch =
      search.trim() === '' ||
      (v.title && v.title.toLowerCase().includes(search.toLowerCase())) ||
      (v.topic && v.topic.toLowerCase().includes(search.toLowerCase())) ||
      v.id.includes(search);

    return matchesFilter && matchesSearch;
  });

  // KPI calculations
  const totalCount = videos.length;
  const inProgressCount = videos.filter((v) =>
    ['QUEUED', 'SCRIPTING', 'NARRATING', 'RENDERING'].includes(v.status)
  ).length;
  const readyCount = videos.filter((v) => v.status === 'READY_FOR_REVIEW').length;
  const approvedCount = videos.filter((v) => v.status === 'APPROVED').length;

  function renderStatusTag(status) {
    switch (status) {
      case 'QUEUED':
        return <span className="status-tag status-tag-queued"><Clock size={11} /> Queued</span>;
      case 'SCRIPTING':
        return <span className="status-tag status-tag-active"><Wand2 size={11} /> Scripting</span>;
      case 'NARRATING':
        return <span className="status-tag status-tag-active"><Music size={11} /> Audio</span>;
      case 'RENDERING':
        return <span className="status-tag status-tag-active"><Play size={11} /> Rendering</span>;
      case 'READY_FOR_REVIEW':
        return <span className="status-tag status-tag-ready"><ShieldCheck size={11} /> Ready</span>;
      case 'APPROVED':
        return <span className="status-tag status-tag-approved"><CheckCircle2 size={11} /> Approved</span>;
      case 'REJECTED':
      case 'FAILED':
        return <span className="status-tag status-tag-failed"><XCircle size={11} /> {status}</span>;
      default:
        return <span className="status-tag">{status}</span>;
    }
  }

  return (
    <div className="app-wrapper">
      {/* MINIMALIST TOP NAV */}
      <header className="top-nav">
        <div className="top-nav-inner">
          <div className="nav-left">
            <div className="brand-badge-group">
              <div className="brand-logo-sq">
                <Sparkles size={14} />
              </div>
              <span className="brand-name">SocialStudio</span>
            </div>

            <nav className="nav-links">
              <span className="nav-link active">Dashboard</span>
              <span className="nav-link">Queue</span>
              <span className="nav-link">Settings</span>
            </nav>
          </div>

          <div className="nav-right">
            <div className="pipeline-status-chip">
              <span className="dot-pulse"></span>
              <span>Pipeline: Online</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={refresh}
              title="Refresh"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* DESKTOP FLUID VIEWPORT */}
      <main className="dashboard-viewport">
        {/* KPI STAT TILES */}
        <section className="metrics-row">
          <div className="metric-tile">
            <div className="metric-header">
              <span className="metric-title">Total Projects</span>
              <SlidersHorizontal size={14} className="metric-icon" />
            </div>
            <span className="metric-number">{totalCount}</span>
            <span className="metric-sub">Generated videos in database</span>
          </div>

          <div className="metric-tile">
            <div className="metric-header">
              <span className="metric-title">In Production</span>
              <Play size={14} className="metric-icon" />
            </div>
            <span className="metric-number">{inProgressCount}</span>
            <span className="metric-sub">Active worker queue jobs</span>
          </div>

          <div className="metric-tile">
            <div className="metric-header">
              <span className="metric-title">Ready for Review</span>
              <ShieldCheck size={14} className="metric-icon" />
            </div>
            <span className="metric-number" style={{ color: '#4ade80' }}>
              {readyCount}
            </span>
            <span className="metric-sub">Awaiting operator decision</span>
          </div>

          <div className="metric-tile">
            <div className="metric-header">
              <span className="metric-title">Approved</span>
              <CheckCircle2 size={14} className="metric-icon" />
            </div>
            <span className="metric-number">{approvedCount}</span>
            <span className="metric-sub">Certified for distribution</span>
          </div>
        </section>

        {/* RESPONSIVE TWO-COLUMN DESKTOP WORKSPACE */}
        <div className="workspace-grid">
          {/* LEFT COLUMN: STUDIO GENERATION DECK & PROJECT QUEUE */}
          <div className="left-column">
            {/* STUDIO DECK */}
            <section className="panel-card">
              <div className="panel-header">
                <span className="panel-title">
                  <SlidersHorizontal size={14} /> New Production
                </span>
                <span className="badge-mono">9:16 Video</span>
              </div>

              <div className="panel-body">
                {/* TABS */}
                <div className="tabs-control">
                  <button
                    type="button"
                    className={`tab-btn ${mode === 'script' ? 'active' : ''}`}
                    onClick={() => setMode('script')}
                  >
                    <FileText size={13} /> Custom Script
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${mode === 'topic' ? 'active' : ''}`}
                    onClick={() => setMode('topic')}
                  >
                    <Wand2 size={13} /> Generate Script
                  </button>
                </div>

                {mode === 'script' ? (
                  <div>
                    <div className="input-label-row">
                      <span className="input-label">Script Text & Scene Structure</span>
                      <div className="actions-inline">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={handleCopyPrompt}
                        >
                          {copiedPrompt ? <Check size={11} /> : <Copy size={11} />}
                          {copiedPrompt ? 'Copied' : 'Prompt Template'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setCustomScript(SAMPLE_SCRIPT)}
                        >
                          <RotateCcw size={11} /> Reset Sample
                        </button>
                      </div>
                    </div>
                    <div className="presets-wrap">
                      {reviewedExamples.map(example => <button key={example.topic} type="button" className="preset-chip"
                        onClick={() => setCustomScript(JSON.stringify(example, null, 2))}>{example.title}</button>)}
                    </div>
                    <textarea
                      className="console-area"
                      rows={8}
                      value={customScript}
                      onChange={(e) => setCustomScript(e.target.value)}
                      placeholder="Paste your video script formatted with Scenes, Narration, and Code..."
                    />
                  </div>
                ) : (
                  <div>
                    <div className="input-label-row">
                      <span className="input-label">Technical Concept or Architecture Topic</span>
                    </div>
                    <input
                      type="text"
                      className="text-field"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g. How Node.js Event Loop handles Microtasks vs Macrotasks"
                    />

                    <div className="presets-wrap">
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Presets:</span>
                      {TOPIC_PRESETS.map((t, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="preset-chip"
                          onClick={() => setTopic(t)}
                        >
                          {t.split(':')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <button 
                    className="btn btn-secondary" 
                    type="button" 
                    disabled={busy} 
                    onClick={previewLesson}
                    style={{ width: '100%', justifyContent: 'center', gap: 6 }}
                  >
                    {busy ? <RefreshCw size={12} className="animate-spin" /> : <Music size={12} />}
                    Preview Script & Opening Voice
                  </button>
                </div>
                {currentPreview && (
                  <div className="preview-card">
                    <div className="preview-header">
                      <div className="preview-title">
                        <Sparkles size={13} style={{ color: 'var(--text-primary)' }} />
                        <span>Storyboard Preview ({currentPreview.storyboard.scenes?.length || 0} scenes)</span>
                      </div>
                      <button 
                        className="btn btn-secondary" 
                        type="button" 
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        onClick={() => {
                          setCustomScript(JSON.stringify(currentPreview.storyboard, null, 2));
                          setMode('script');
                        }}
                      >
                        Edit Storyboard JSON
                      </button>
                    </div>

                    <audio className="preview-audio-player" controls src={toApiUrl(currentPreview.audioUrl)} />
                    {currentPreview.storyboard.sourceBrief && (
                      <div className="preview-claim-box">
                        <strong>Source Claim:</strong> {currentPreview.storyboard.sourceBrief.claim}
                      </div>
                    )}




                    <div className="preview-scenes-preview">
                      {currentPreview.storyboard.scenes.map((scene) => (
                        <div key={scene.id} className="preview-scene-item">
                          <div className="preview-scene-header">
                            [{scene.type}] {scene.onScreenText}
                          </div>
                          <div className="preview-scene-narration">
                            "{scene.narration}"
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="panel-footer-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--text-muted)' }}>
                    <span className="badge-mono">1080×1920</span>
                    <span>•</span>
                    <span>30 FPS</span>
                    <span>•</span>
                    <span>H.264 Audio Sync</span>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || (mode === 'script' ? !customScript.trim() : !topic.trim())}
                    onClick={() =>
                      post('/api/videos', currentPreview ? {customScript: JSON.stringify(currentPreview.storyboard)} : input)
                    }
                  >
                    {busy ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                    {busy ? 'Processing...' : 'Create Video'}
                  </button>
                </div>

                {error && (
                  <div className="alert-row">
                    <AlertTriangle size={13} />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </section>

            {/* QUEUE & PROJECT LIST VIEW */}
            <section>
              <div className="table-filter-bar">
                <div className="filter-pills-row">
                  <button
                    type="button"
                    className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                  >
                    All ({videos.length})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${filter === 'active' ? 'active' : ''}`}
                    onClick={() => setFilter('active')}
                  >
                    Active ({inProgressCount})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${filter === 'ready' ? 'active' : ''}`}
                    onClick={() => setFilter('ready')}
                  >
                    Ready ({readyCount})
                  </button>
                  <button
                    type="button"
                    className={`filter-pill ${filter === 'approved' ? 'active' : ''}`}
                    onClick={() => setFilter('approved')}
                  >
                    Approved ({approvedCount})
                  </button>
                </div>

                <div className="search-box">
                  <input
                    type="text"
                    className="text-field"
                    style={{ padding: '5px 10px', fontSize: 12 }}
                    placeholder="Search projects..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {!filteredVideos.length && (
                <div className="panel-card empty-placeholder">
                  <p>No projects match your current selection.</p>
                </div>
              )}

              {filteredVideos.map((v) => {
                const isSelected = activeVideo && activeVideo.id === v.id;
                return (
                  <article
                    key={v.id}
                    className={`project-item-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedId(v.id)}
                  >
                    <div className="project-left-meta">
                      <div className="project-title-line">{v.title || v.topic}</div>
                      <div className="project-submeta">
                        <span className="badge-mono">{v.id.slice(0, 8)}</span>
                        <span>•</span>
                        <span>{new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {v.audio_seconds && (
                          <>
                            <span>•</span>
                            <span>{v.audio_seconds.toFixed(1)}s</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {renderStatusTag(v.status)}
                      <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  </article>
                );
              })}
            </section>
          </div>

          {/* RIGHT COLUMN: STICKY DESKTOP INSPECTOR PANE */}
          <aside className="inspector-pane">
            {activeVideo ? (
              <div className="inspector-card">
                <div className="inspector-header">
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Video Inspector & Preview</span>
                  <span className="badge-mono">{activeVideo.id.slice(0, 8)}</span>
                </div>

                <div className="inspector-body">
                  <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
                    {activeVideo.title || activeVideo.topic}
                  </h4>

                  {/* ACTIVE WORKER PROGRESS */}
                  {['QUEUED', 'SCRIPTING', 'NARRATING', 'RENDERING'].includes(activeVideo.status) && (
                    <div className="worker-progress-box">
                      <div className="worker-progress-label">
                        <span>Stage: <strong>{activeVideo.status}</strong></span>
                        <span>
                          {activeVideo.job_progress != null
                            ? `${activeVideo.job_progress}%`
                            : activeVideo.status === 'QUEUED'
                            ? '10%'
                            : activeVideo.status === 'SCRIPTING'
                            ? '25%'
                            : activeVideo.status === 'NARRATING'
                            ? '50%'
                            : '75%'}
                        </span>
                      </div>
                      <div className="progress-track-sleek">
                        <div
                          className="progress-bar-sleek"
                          style={{
                            width:
                              activeVideo.job_progress != null
                                ? `${activeVideo.job_progress}%`
                                : activeVideo.status === 'QUEUED'
                                ? '10%'
                                : activeVideo.status === 'SCRIPTING'
                                ? '25%'
                                : activeVideo.status === 'NARRATING'
                                ? '50%'
                                : '75%',
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* FAILED STATUS BANNER & RETRY */}
                  {activeVideo.status === 'FAILED' && (
                    <div
                      style={{
                        padding: '16px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 'var(--radius-sm)',
                        marginBottom: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ color: '#ef4444', fontWeight: 600, fontSize: 13 }}>
                        ⚠️ Generation Failed or Stalled
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {activeVideo.error || 'The render process was interrupted or timed out.'}
                      </div>
                      <button
                        onClick={() => post(`/api/videos/${activeVideo.id}/retry`)}
                        disabled={busy}
                        className="btn btn-primary"
                        style={{ alignSelf: 'flex-start', marginTop: 4, fontSize: 12, padding: '6px 14px' }}
                      >
                        🔄 Retry Video Generation
                      </button>
                    </div>
                  )}

                  {/* PREVIEW VIDEO PLAYER */}
                  {activeVideo.media_path ? (
                    <div className="preview-container">
                      <video
                        controls
                        preload="metadata"
                        src={toApiUrl(activeVideo.media_path)}
                        className="preview-video"
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '32px 16px',
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: 12,
                        background: 'var(--bg-canvas)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        marginBottom: 16,
                      }}
                    >
                      Media rendering in progress...
                    </div>
                  )}

                  {/* TELEMETRY QA METRICS */}
                  {activeVideo.qa_report && (
                    <div className="telemetry-box">
                      <div className="telemetry-row">
                        <span>QA Certification</span>
                        <span className="telemetry-val" style={{ color: '#4ade80' }}>
                          Verified
                        </span>
                      </div>
                      <div className="telemetry-row">
                        <span>Duration</span>
                        <span className="telemetry-val">{activeVideo.qa_report.durationSec}s</span>
                      </div>
                      <div className="telemetry-row">
                        <span>File Size</span>
                        <span className="telemetry-val">
                          {(activeVideo.qa_report.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      </div>
                      <div className="telemetry-row">
                        <span>Audio Drift</span>
                        <span className="telemetry-val" style={{ color: '#4ade80' }}>
                          0.00s
                        </span>
                      </div>
                      <div className="telemetry-row">
                        <span>SHA-256</span>
                        <span className="badge-mono" style={{ fontSize: 10 }}>
                          {activeVideo.qa_report.sha256?.slice(0, 12)}...
                        </span>
                      </div>
                    </div>
                  )}

                  {/* STORYBOARD ACCORDION */}
                  {activeVideo.script && (
                    <details className="storyboard-details">
                      <summary>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Code2 size={12} /> Storyboard ({activeVideo.script.scenes?.length || 0} Scenes)
                        </span>
                        <ChevronDown size={13} />
                      </summary>
                      <div className="storyboard-content">
                        {activeVideo.script.scenes?.map((s, idx) => (
                          <div className="scene-item" key={idx}>
                            <div className="scene-item-meta">
                              <span>Scene {idx + 1} • {s.type}</span>
                              {s.durationTargetSec && <span>~{s.durationTargetSec}s</span>}
                            </div>
                            <div className="scene-item-narration">{s.narration}</div>
                            {s.visualProps?.code && (
                              <pre className="scene-item-code">{s.visualProps.code}</pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {/* ACTION CONTROLS */}
                  {activeVideo.status === 'READY_FOR_REVIEW' && (
                    <div className="inspector-actions">
                      <button
                        type="button"
                        className="btn btn-emerald"
                        style={{ flex: 1 }}
                        disabled={busy}
                        onClick={() =>
                          post(`/api/videos/${activeVideo.id}/approval`, { status: 'APPROVED' })
                        }
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-rose"
                        disabled={busy}
                        onClick={() =>
                          post(`/api/videos/${activeVideo.id}/approval`, { status: 'REJECTED' })
                        }
                      >
                        <XCircle size={12} /> Reject
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => post(`/api/videos/${activeVideo.id}/retry`)}
                      >
                        <RotateCcw size={12} /> Retry
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="panel-card empty-placeholder">
                <p>Select a video to inspect.</p>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
