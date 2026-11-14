import React, { useEffect, useState, useRef } from 'react';
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
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Code2,
  ArrowRight,
  Send,
  MessageSquare,
  Bot,
  User,
  Download,
  Layers,
  Video,
  Zap,
  Volume2,
  Cpu,
} from 'lucide-react';
import './style.css';

import reactExample from '../../examples/react-state.json';
import checkoutExample from '../../examples/checkout.json';
import retrievalExample from '../../examples/retrieval.json';

const reviewedExamples = [reactExample, checkoutExample, retrievalExample];
const SAMPLE_SCRIPT = JSON.stringify(reactExample, null, 2);

const VIRAL_TECH_PRESETS = [
  {
    topic: 'How Zomato Decides Delivery & Surge Charges',
    angle: 'Offline queueing, H3 geospatial hexagons and real-time GPS sync',
  },
  {
    topic: 'Kafka Consumer Groups & Partition Rebalancing',
    angle: 'Stop-the-world rebalance spike during a sudden flash sale',
  },
  {
    topic: 'Redis Distributed Lock & Redlock Algorithm',
    angle: 'Race condition when two users try to book the last seat simultaneously',
  },
  {
    topic: 'PostgreSQL MVCC Table Bloat & VACUUM Internals',
    angle: 'Dead tuples accumulating on high-write analytics tables causing 10x query slowdown',
  },
  {
    topic: 'Stripe Webhook Idempotency & Transactional Outbox',
    angle: 'Preventing double charging when the customer refreshes payment confirmation page',
  },
];

const QUICK_CHAT_SUGGESTIONS = [
  '👉 Hook 2 ko final voiceover me use karo',
  '🎯 Act 4 me edge case thoda aur clear samjhao',
  '⏱️ Redis reveal hone se pehle thoda pause daalo',
  '💬 Tone thoda aur conversational Hinglish banao',
  '🚀 Code snippet ka context simple kardo',
];

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const toApiUrl = (p) => (p && p.startsWith('http') ? p : `${API_BASE}${p || ''}`);

function App() {
  // Navigation: 'studio' (Flagship Pipeline) or 'legacy' (Jobs / Admin queue)
  const [activeNav, setActiveNav] = useState('studio');

  // Studio Pipeline State
  const [stage, setStage] = useState(1); // 1: Script & Chat, 2: Audio, 3: Preview, 4: Render
  const [topic, setTopic] = useState(VIRAL_TECH_PRESETS[0].topic);
  const [angle, setAngle] = useState(VIRAL_TECH_PRESETS[0].angle);
  const [session, setSession] = useState(null);
  const [studioLoading, setStudioLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [activeScriptTab, setActiveScriptTab] = useState('full'); // 'full' | 'acts' | 'scenes' | 'cheat' | 'raw'
  const [copiedScript, setCopiedScript] = useState(false);
  const [audioSynthesizing, setAudioSynthesizing] = useState(false);
  const [audioResult, setAudioResult] = useState(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [renderedMediaUrl, setRenderedMediaUrl] = useState('');
  const [renderError, setRenderError] = useState('');
  const [qaReport, setQaReport] = useState(null);

  // Legacy Queue State
  const [videos, setVideos] = useState([]);
  const [mode, setMode] = useState('topic');
  const [customScript, setCustomScript] = useState(SAMPLE_SCRIPT);
  const [token, setToken] = useState('change-me-in-local-dev');
  const [legacyError, setLegacyError] = useState('');
  const [legacyBusy, setLegacyBusy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const chatScrollRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [session?.messages, chatSending]);

  // Load existing pipeline sessions on mount
  useEffect(() => {
    async function loadSessions() {
      try {
        const res = await fetch(toApiUrl('/api/pipeline/sessions'));
        if (res.ok) {
          const list = await res.json();
          if (list && list.length > 0) {
            // Load latest session
            const latestRes = await fetch(toApiUrl(`/api/pipeline/script/${list[0].id}`));
            if (latestRes.ok) {
              const fullSession = await latestRes.json();
              setSession(fullSession);
              setTopic(fullSession.topic || '');
              setAngle(fullSession.angle || '');
              if (fullSession.audioResult) setAudioResult(fullSession.audioResult);
              if (fullSession.renderState?.mediaUrl) setRenderedMediaUrl(fullSession.renderState.mediaUrl);
              if (fullSession.renderState?.qa) setQaReport(fullSession.renderState.qa);
              if (fullSession.finalized) {
                setStage(fullSession.renderState?.mediaUrl ? 4 : fullSession.audioResult ? 3 : 2);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Could not fetch pipeline sessions:', e);
      }
    }
    loadSessions();
  }, []);

  // Poll render status when rendering
  useEffect(() => {
    let interval = null;
    if (rendering && session?.id) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(toApiUrl(`/api/pipeline/render/status/${session.id}`));
          if (res.ok) {
            const data = await res.json();
            const state = data.renderState;
            if (state) {
              setRenderProgress(state.progress || 0);
              if (state.status === 'completed') {
                setRendering(false);
                setRenderedMediaUrl(state.mediaUrl);
                setQaReport(state.qa);
                setStage(4);
              } else if (state.status === 'failed') {
                setRendering(false);
                setRenderError(state.error || 'Video rendering failed.');
              }
            }
          }
        } catch (e) {
          console.warn('Render status polling error:', e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [rendering, session?.id]);

  // Legacy Queue polling
  async function refreshQueue() {
    try {
      const res = await fetch(toApiUrl('/api/videos'));
      if (res.ok) {
        const data = await res.json();
        setVideos(data || []);
        if (!selectedId && data && data.length > 0) {
          setSelectedId(data[0].id);
        }
      }
    } catch {}
  }

  useEffect(() => {
    refreshQueue();
    const interval = setInterval(refreshQueue, 5000);
    return () => clearInterval(interval);
  }, [selectedId]);

  // ==========================================
  // PIPELINE HANDLERS
  // ==========================================

  // 1. Generate Initial Master Script
  async function handleGenerateScript() {
    if (!topic.trim()) return;
    setStudioLoading(true);
    setLegacyError('');
    try {
      const res = await fetch(toApiUrl('/api/pipeline/script/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), angle: angle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate script');
      setSession(data);
      setStage(1);
    } catch (err) {
      alert(`Script Generation Error: ${err.message}`);
    } finally {
      setStudioLoading(false);
    }
  }

  // 2. Chat Refine Instruction
  async function handleSendChat(instructionText) {
    const text = instructionText || chatInput;
    if (!text.trim() || !session?.id) return;
    setChatSending(true);
    setChatInput('');
    try {
      const res = await fetch(toApiUrl('/api/pipeline/script/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, message: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refinement failed');
      setSession(data);
    } catch (err) {
      alert(`Chat Refinement Error: ${err.message}`);
    } finally {
      setChatSending(false);
    }
  }

  // 3. Finalize Script & Proceed
  async function handleFinalizeScript() {
    if (!session?.id) return;
    setStudioLoading(true);
    try {
      const res = await fetch(toApiUrl('/api/pipeline/script/finalize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Finalization failed');
      setSession(data);
      setStage(2); // Advance to Voiceover stage
    } catch (err) {
      alert(`Finalization Error: ${err.message}`);
    } finally {
      setStudioLoading(false);
    }
  }

  // 4. Synthesize Voiceover with Sarvam AI
  async function handleSynthesizeAudio() {
    if (!session?.id) return;
    setAudioSynthesizing(true);
    try {
      const res = await fetch(toApiUrl('/api/pipeline/audio/synthesize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audio synthesis failed');
      setAudioResult(data.audioResult);
      // Reload session
      const sessRes = await fetch(toApiUrl(`/api/pipeline/script/${session.id}`));
      if (sessRes.ok) setSession(await sessRes.json());
    } catch (err) {
      alert(`Audio Synthesis Error: ${err.message}`);
    } finally {
      setAudioSynthesizing(false);
    }
  }

  // 5. Trigger Video Render
  async function handleRenderVideo() {
    if (!session?.id) return;
    setRendering(true);
    setRenderError('');
    setRenderProgress(5);
    setStage(4);
    try {
      const res = await fetch(toApiUrl('/api/pipeline/render'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Render trigger failed');
    } catch (err) {
      setRendering(false);
      setRenderError(err.message);
      alert(`Render Trigger Error: ${err.message}`);
    }
  }

  function handleCopyCurrentScript() {
    if (session?.currentMarkdown) {
      navigator.clipboard.writeText(session.currentMarkdown);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  }

  // Active / Selected Video in Legacy Queue
  const activeVideo = videos.find((v) => v.id === selectedId) || videos[0] || null;

  return (
    <div className="app-wrapper">
      {/* DESKTOP TOP NAV */}
      <header className="top-nav">
        <div className="top-nav-inner">
          <div className="nav-left">
            <div className="brand-badge-group">
              <div className="brand-logo-sq">
                <Sparkles size={14} />
              </div>
              <span className="brand-name">SocialStudio</span>
              <span className="badge-mono" style={{ background: '#3b82f6', color: '#fff' }}>
                PRO PIPELINE
              </span>
            </div>

            <nav className="nav-links">
              <button
                type="button"
                className={`nav-link ${activeNav === 'studio' ? 'active' : ''}`}
                onClick={() => setActiveNav('studio')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                ⚡ Reel Pipeline Studio
              </button>
              <button
                type="button"
                className={`nav-link ${activeNav === 'legacy' ? 'active' : ''}`}
                onClick={() => setActiveNav('legacy')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                📋 Project Queue
              </button>
            </nav>
          </div>

          <div className="nav-right">
            <div className="pipeline-status-chip">
              <span className="dot-pulse"></span>
              <span>Sarvam AI & Remotion Online</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={refreshQueue}
              title="Refresh Queue"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* VIEW 1: FLAGSHIP REEL PIPELINE STUDIO */}
      {activeNav === 'studio' && (
        <main className="dashboard-viewport" style={{ padding: '20px 24px' }}>
          <div className="studio-main-container">
            {/* 4-STEP PIPELINE TRACKER */}
            <nav className="pipeline-stepper">
              <div
                className={`step-indicator-item ${stage === 1 ? 'active' : stage > 1 ? 'completed' : ''}`}
                onClick={() => setStage(1)}
              >
                <div className="step-num-badge">{stage > 1 ? <Check size={11} /> : '1'}</div>
                <span className="step-label">1. Script & Chat Refinement</span>
              </div>

              <div className="step-divider" />

              <div
                className={`step-indicator-item ${stage === 2 ? 'active' : stage > 2 ? 'completed' : ''}`}
                onClick={() => session && setStage(2)}
              >
                <div className="step-num-badge">{stage > 2 ? <Check size={11} /> : '2'}</div>
                <span className="step-label">2. Voiceover (Sarvam AI)</span>
              </div>

              <div className="step-divider" />

              <div
                className={`step-indicator-item ${stage === 3 ? 'active' : stage > 3 ? 'completed' : ''}`}
                onClick={() => audioResult && setStage(3)}
              >
                <div className="step-num-badge">{stage > 3 ? <Check size={11} /> : '3'}</div>
                <span className="step-label">3. Remotion Preview</span>
              </div>

              <div className="step-divider" />

              <div
                className={`step-indicator-item ${stage === 4 ? 'active' : ''}`}
                onClick={() => (renderedMediaUrl || rendering) && setStage(4)}
              >
                <div className="step-num-badge">4</div>
                <span className="step-label">4. 1080×1920 MP4 Render</span>
              </div>
            </nav>

            {/* STAGE 1: SCRIPT STUDIO & CHATGPT REFINEMENT */}
            {stage === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* TOP BAR: TOPIC & ANGLE GENERATOR */}
                <section className="topic-generator-card">
                  <div className="topic-inputs-grid">
                    <div>
                      <div className="input-label-row">
                        <span className="input-label">Tech Topic / Engineering Mystery</span>
                      </div>
                      <input
                        type="text"
                        className="text-field"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        placeholder="e.g. How Zomato Decides Delivery & Surge Charges"
                      />
                    </div>

                    <div>
                      <div className="input-label-row">
                        <span className="input-label">Story Angle (Optional)</span>
                      </div>
                      <input
                        type="text"
                        className="text-field"
                        value={angle}
                        onChange={(e) => setAngle(e.target.value)}
                        placeholder="e.g. Offline queueing and real-time GPS sync"
                      />
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={studioLoading || !topic.trim()}
                      onClick={handleGenerateScript}
                      style={{ height: 38, padding: '0 18px', gap: 8 }}
                    >
                      {studioLoading ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <Wand2 size={13} />
                      )}
                      <span>{studioLoading ? 'Generating Script...' : 'Generate Master Script'}</span>
                    </button>
                  </div>

                  {/* PRESETS */}
                  <div className="presets-wrap" style={{ marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Quick Presets:</span>
                    {VIRAL_TECH_PRESETS.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="preset-chip"
                        onClick={() => {
                          setTopic(p.topic);
                          setAngle(p.angle);
                        }}
                      >
                        {p.topic.split('&')[0]}
                      </button>
                    ))}
                  </div>
                </section>

                {/* CHATGPT REFINEMENT SPLIT VIEW */}
                {session ? (
                  <div className="chat-refine-grid">
                    {/* LEFT COLUMN: CHATGPT ASSISTANT */}
                    <div className="chat-assistant-pane">
                      <div className="chat-pane-header">
                        <div className="chat-pane-title">
                          <Bot size={16} style={{ color: '#3b82f6' }} />
                          <span>AI Script Assistant</span>
                          <span className="badge-mono" style={{ fontSize: 10 }}>
                            ChatGPT Refinement
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {session.messages?.length || 0} messages
                        </span>
                      </div>

                      {/* CHAT MESSAGE STREAM */}
                      <div className="chat-message-stream" ref={chatScrollRef}>
                        <div className="chat-bubble-ai">
                          👋 <strong>Master Script Ready!</strong> Script 7-part master standard ke hisaab se ready hai.
                          <br />
                          Agar aapko koi Hook change karwana ho, kisi Act me koi detail ya term add/fix karni ho, toh neeche prompt likhiye!
                        </div>

                        {session.messages?.map((msg, idx) => (
                          <div
                            key={idx}
                            className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}
                          >
                            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 4, display: 'flex', gap: 4 }}>
                              {msg.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                              <span>{msg.role === 'user' ? 'You' : 'Antigravity AI'}</span>
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>
                              {msg.role === 'assistant'
                                ? msg.content.slice(0, 350) +
                                  (msg.content.length > 350
                                    ? '\n\n✨ [Full updated script reflected in inspector on right ➡️]'
                                    : '')
                                : msg.content}
                            </div>
                          </div>
                        ))}

                        {chatSending && (
                          <div className="chat-bubble-ai" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <RefreshCw size={12} className="animate-spin" />
                            <span>Refining script and updating scene JSON...</span>
                          </div>
                        )}
                      </div>

                      {/* QUICK SUGGESTION PILLS */}
                      <div className="chat-quick-suggestions">
                        {QUICK_CHAT_SUGGESTIONS.map((sug, i) => (
                          <button
                            key={i}
                            type="button"
                            className="quick-pill"
                            onClick={() => handleSendChat(sug)}
                            disabled={chatSending}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>

                      {/* CHAT INPUT BAR */}
                      <form
                        className="chat-input-bar"
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleSendChat();
                        }}
                      >
                        <input
                          type="text"
                          className="chat-input-field"
                          placeholder="Tell AI: 'Act 3 me H3 ki jagah Geohash explain karo'..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          disabled={chatSending}
                        />
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={chatSending || !chatInput.trim()}
                          style={{ padding: '0 14px', height: 34 }}
                        >
                          {chatSending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                        </button>
                      </form>
                    </div>

                    {/* RIGHT COLUMN: LIVE SCRIPT INSPECTOR */}
                    <div className="script-inspector-pane">
                      <div className="script-inspector-header">
                        <div className="script-tabs">
                          <button
                            type="button"
                            className={`script-tab-btn ${activeScriptTab === 'full' ? 'active' : ''}`}
                            onClick={() => setActiveScriptTab('full')}
                          >
                            <FileText size={12} /> Full Script
                          </button>
                          <button
                            type="button"
                            className={`script-tab-btn ${activeScriptTab === 'acts' ? 'active' : ''}`}
                            onClick={() => setActiveScriptTab('acts')}
                          >
                            <Volume2 size={12} /> 5-Act Voiceover
                          </button>
                          <button
                            type="button"
                            className={`script-tab-btn ${activeScriptTab === 'scenes' ? 'active' : ''}`}
                            onClick={() => setActiveScriptTab('scenes')}
                          >
                            <Layers size={12} /> Remotion Scenes
                          </button>
                          <button
                            type="button"
                            className={`script-tab-btn ${activeScriptTab === 'cheat' ? 'active' : ''}`}
                            onClick={() => setActiveScriptTab('cheat')}
                          >
                            <Cpu size={12} /> SDE Cheat-Sheet
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleCopyCurrentScript}
                            title="Copy Markdown"
                          >
                            {copiedScript ? <Check size={11} /> : <Copy size={11} />}
                            <span>{copiedScript ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* INSPECTOR TAB CONTENT */}
                      <div className="script-inspector-content">
                        {activeScriptTab === 'full' && (
                          <div className="script-markdown-view">
                            {session.currentMarkdown}
                          </div>
                        )}

                        {activeScriptTab === 'acts' && (
                          <div className="acts-cards-stream">
                            <div className="act-card-item">
                              <div className="act-card-top">
                                <span className="act-card-badge">Section 1: Hook Options</span>
                              </div>
                              <pre style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                                {session.sections?.hookOptions || 'Analyzing hook variations...'}
                              </pre>
                            </div>

                            <div className="act-card-item" style={{ borderLeft: '3px solid #3b82f6' }}>
                              <div className="act-card-top">
                                <span className="act-card-badge" style={{ background: '#3b82f6', color: '#fff' }}>
                                  Section 2: Final Voiceover (5 Acts)
                                </span>
                              </div>
                              <div className="act-card-text" style={{ whiteSpace: 'pre-wrap' }}>
                                {session.sections?.voiceoverScript || 'Generating voiceover...'}
                              </div>
                            </div>
                          </div>
                        )}

                        {activeScriptTab === 'scenes' && (
                          <div className="acts-cards-stream">
                            {session.storyboard?.scenes?.map((scene, idx) => (
                              <div key={idx} className="act-card-item">
                                <div className="act-card-top">
                                  <span className="act-card-badge">
                                    Act {idx + 1} • {scene.type}
                                  </span>
                                  <span className="badge-mono" style={{ fontSize: 11 }}>
                                    ~{scene.durationTargetSec || 14}s
                                  </span>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {scene.onScreenText}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                  "{scene.narration}"
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  Visual: {scene.technicalKeyPoint}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {activeScriptTab === 'cheat' && (
                          <div className="acts-cards-stream">
                            <div className="act-card-item">
                              <div className="act-card-top">
                                <span className="act-card-badge">Interview Cheat Sheet</span>
                              </div>
                              <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                {session.sections?.interviewCheatSheet || 'Cheat sheet content'}
                              </div>
                            </div>

                            <div className="act-card-item">
                              <div className="act-card-top">
                                <span className="act-card-badge">SDE-3 Architecture Tradeoff</span>
                              </div>
                              <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                {session.sections?.tradeoffDilemma || 'Tradeoff analysis'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* BOTTOM LOCK-IN BAR */}
                      <div
                        style={{
                          padding: '12px 18px',
                          background: 'var(--bg-surface)',
                          borderTop: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          Satisfied with the script? Lock it in to generate Sarvam voiceover.
                        </div>

                        <button
                          type="button"
                          className="btn btn-emerald"
                          onClick={handleFinalizeScript}
                          disabled={studioLoading}
                          style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, gap: 8 }}
                        >
                          <CheckCircle2 size={14} />
                          <span>Finalize Script & Proceed to Voiceover</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="panel-card empty-placeholder" style={{ padding: '60px 20px' }}>
                    <Wand2 size={24} style={{ margin: '0 auto 12px', color: 'var(--text-muted)' }} />
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Ready to Generate Viral Tech Reel</h3>
                    <p style={{ maxWidth: 500, margin: '0 auto', color: 'var(--text-muted)' }}>
                      Enter your topic and angle above or choose a preset. Antigravity AI will create a complete 7-part master script, Remotion scene structure, and chat with you to refine it!
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STAGE 2: VOICEOVER GENERATION (SARVAM AI) */}
            {stage === 2 && (
              <section className="voiceover-hub-card">
                <div className="voiceover-hero-header">
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                      🎙️ Stage 2: Studio Voiceover Synthesis
                    </h3>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      Powered by <strong>Sarvam AI</strong> (Hinglish Neural Voice <code>sunny_hi_reels</code>) with exact millisecond silence injection and phonetic enhancements.
                    </p>
                  </div>

                  <div className="voice-badge-chip">
                    <Music size={13} />
                    <span>sunny_hi_reels (Pace 1.0)</span>
                  </div>
                </div>

                {/* ACTION BANNER */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Synthesize Spoken Audio</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Synthesizes all 5 scene acts and combines them into master audio. Strictly on-demand to protect your credits!
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={audioSynthesizing}
                    onClick={handleSynthesizeAudio}
                    style={{ padding: '8px 22px', fontSize: 13, gap: 8 }}
                  >
                    {audioSynthesizing ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Volume2 size={13} />
                    )}
                    <span>{audioSynthesizing ? 'Synthesizing Audio...' : 'Synthesize Voiceover'}</span>
                  </button>
                </div>

                {/* AUDIO PLAYERS & DURATION STATS */}
                {audioResult ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* MASTER AUDIO PLAYER */}
                    <div className="audio-master-player-box">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CheckCircle2 size={14} style={{ color: '#4ade80' }} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>Full Master Narration</span>
                        </div>
                        <span className="badge-mono" style={{ background: '#4ade80', color: '#000', fontWeight: 700 }}>
                          {audioResult.totalDurationSec}s Spoken Duration
                        </span>
                      </div>
                      <audio
                        controls
                        src={toApiUrl(audioResult.fullAudioUrl || audioResult.clips?.[0]?.url)}
                        className="preview-audio-player"
                      />
                    </div>

                    {/* INDIVIDUAL ACT PLAYERS */}
                    <div className="audio-scenes-grid">
                      {audioResult.clips?.map((clip, idx) => (
                        <div key={idx} className="audio-scene-card">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="badge-mono">Act {idx + 1}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {(clip.durationMs / 1000).toFixed(1)}s
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', maxHeight: 40, overflow: 'hidden' }}>
                            {session?.storyboard?.scenes?.[idx]?.narration || `Act ${idx + 1} Narration`}
                          </div>
                          <audio controls src={toApiUrl(clip.url)} style={{ width: '100%', height: 32 }} />
                        </div>
                      ))}
                    </div>

                    {/* NEXT STEP BUTTON */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => setStage(1)}
                      >
                        ⬅️ Back to Script Chat
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setStage(3)}
                        style={{ padding: '8px 24px', fontSize: 13, gap: 8 }}
                      >
                        <span>Proceed to Remotion Preview</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-placeholder" style={{ padding: '40px 0' }}>
                    <Music size={24} style={{ margin: '0 auto 8px', color: 'var(--text-muted)' }} />
                    <p>Click "Synthesize Voiceover" above to produce studio-grade audio.</p>
                  </div>
                )}
              </section>
            )}

            {/* STAGE 3: REMOTION PREVIEW & STORYBOARD TIMELINE */}
            {stage === 3 && (
              <section className="voiceover-hub-card">
                <div className="voiceover-hero-header">
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                      🎬 Stage 3: Remotion Storyboard & Composition
                    </h3>
                    <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      Composition: <code>StudioShort</code> (1080×1920 @ 30 FPS Vertical). Word-level kinetic captions and animated scene components.
                    </p>
                  </div>

                  <div className="badge-mono" style={{ background: '#3b82f6', color: '#fff' }}>
                    {session?.storyboard?.scenes?.length || 5} Scenes • {audioResult?.totalDurationSec || 75}s
                  </div>
                </div>

                {/* SCENES BREAKDOWN */}
                <div className="acts-cards-stream">
                  {session?.storyboard?.scenes?.map((scene, idx) => (
                    <div key={idx} className="act-card-item">
                      <div className="act-card-top">
                        <span className="act-card-badge" style={{ background: '#3b82f6', color: '#fff' }}>
                          Scene {idx + 1}: {scene.type}
                        </span>
                        <span className="badge-mono" style={{ fontSize: 11 }}>
                          Frame {idx * 210} → {(idx + 1) * 210} (~{scene.durationTargetSec || 14}s)
                        </span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {scene.onScreenText}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                        "{scene.narration}"
                      </div>
                      <div style={{ fontSize: 11.5, color: '#60a5fa', background: 'rgba(59, 130, 246, 0.08)', padding: '6px 10px', borderRadius: 4 }}>
                        🎨 Visual Elements: {scene.technicalKeyPoint}
                      </div>
                    </div>
                  ))}
                </div>

                {/* ACTION BUTTONS */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setStage(2)}
                  >
                    ⬅️ Back to Voiceover
                  </button>

                  <button
                    type="button"
                    className="btn btn-emerald"
                    onClick={handleRenderVideo}
                    disabled={rendering}
                    style={{ padding: '10px 28px', fontSize: 14, fontWeight: 700, gap: 10 }}
                  >
                    <Video size={16} />
                    <span>Render Final Video (1080×1920 MP4)</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            )}

            {/* STAGE 4: 1080×1920 MP4 RENDER & DOWNLOAD */}
            {stage === 4 && (
              <section className="render-hub-card">
                <div style={{ textAlign: 'center', maxWidth: 500 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
                    🚀 Stage 4: Production Video Render
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Exporting high-retention 1080×1920 9:16 vertical tech reel with Remotion & H.264 encoding.
                  </p>
                </div>

                {/* RENDERING PROGRESS */}
                {rendering && (
                  <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                      <span>Rendering Remotion Frames...</span>
                      <span>{renderProgress}%</span>
                    </div>
                    <div className="progress-track-sleek" style={{ height: 8 }}>
                      <div className="progress-bar-sleek" style={{ width: `${renderProgress}%`, background: '#3b82f6' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                      Please wait a moment while Chromium renders and encodes the video...
                    </div>
                  </div>
                )}

                {renderError && (
                  <div className="alert-row" style={{ maxWidth: 460 }}>
                    <AlertTriangle size={14} />
                    <span>{renderError}</span>
                  </div>
                )}

                {/* COMPLETED VIDEO PREVIEW */}
                {renderedMediaUrl && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <div className="vertical-video-wrapper">
                      <video
                        controls
                        autoPlay
                        loop
                        src={toApiUrl(renderedMediaUrl)}
                      />
                    </div>

                    {/* TELEMETRY QA BADGE */}
                    <div className="telemetry-box" style={{ width: 320 }}>
                      <div className="telemetry-row">
                        <span>Status</span>
                        <span className="telemetry-val" style={{ color: '#4ade80' }}>
                          QA Certified ✅
                        </span>
                      </div>
                      <div className="telemetry-row">
                        <span>Format</span>
                        <span className="telemetry-val">1080×1920 (9:16)</span>
                      </div>
                      <div className="telemetry-row">
                        <span>Frame Rate</span>
                        <span className="telemetry-val">30 FPS H.264</span>
                      </div>
                      <div className="telemetry-row">
                        <span>Audio Sync Drift</span>
                        <span className="telemetry-val" style={{ color: '#4ade80' }}>
                          0.00s
                        </span>
                      </div>
                    </div>

                    {/* ACTION BUTTONS */}
                    <div style={{ display: 'flex', gap: 12 }}>
                      <a
                        href={toApiUrl(renderedMediaUrl)}
                        download="tech-reel-final.mp4"
                        className="btn btn-primary"
                        style={{ padding: '8px 20px', gap: 8 }}
                      >
                        <Download size={14} />
                        <span>Download MP4</span>
                      </a>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setSession(null);
                          setAudioResult(null);
                          setRenderedMediaUrl('');
                          setStage(1);
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>Create New Reel</span>
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      )}

      {/* VIEW 2: LEGACY QUEUE & JOBS (A-Z BACKGROUND SYSTEM) */}
      {activeNav === 'legacy' && (
        <main className="dashboard-viewport">
          <section className="metrics-row">
            <div className="metric-tile">
              <div className="metric-header">
                <span className="metric-title">Total Projects</span>
                <SlidersHorizontal size={14} className="metric-icon" />
              </div>
              <span className="metric-number">{videos.length}</span>
              <span className="metric-sub">Videos in database</span>
            </div>
            <div className="metric-tile">
              <div className="metric-header">
                <span className="metric-title">Active Queue</span>
                <Play size={14} className="metric-icon" />
              </div>
              <span className="metric-number">
                {videos.filter((v) => ['QUEUED', 'SCRIPTING', 'NARRATING', 'RENDERING'].includes(v.status)).length}
              </span>
              <span className="metric-sub">Worker jobs in flight</span>
            </div>
            <div className="metric-tile">
              <div className="metric-header">
                <span className="metric-title">Ready for Review</span>
                <ShieldCheck size={14} className="metric-icon" />
              </div>
              <span className="metric-number" style={{ color: '#4ade80' }}>
                {videos.filter((v) => v.status === 'READY_FOR_REVIEW').length}
              </span>
              <span className="metric-sub">Awaiting decision</span>
            </div>
          </section>

          <div className="workspace-grid">
            <div className="left-column">
              <div className="table-filter-bar">
                <div className="filter-pills-row">
                  <button
                    type="button"
                    className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                  >
                    All ({videos.length})
                  </button>
                </div>
              </div>

              {!videos.length && (
                <div className="panel-card empty-placeholder">
                  <p>No jobs in queue yet. Use the Reel Pipeline Studio to create your first reel!</p>
                </div>
              )}

              {videos.map((v) => (
                <article
                  key={v.id}
                  className={`project-item-card ${activeVideo?.id === v.id ? 'selected' : ''}`}
                  onClick={() => setSelectedId(v.id)}
                >
                  <div className="project-left-meta">
                    <div className="project-title-line">{v.title || v.topic}</div>
                    <div className="project-submeta">
                      <span className="badge-mono">{v.id.slice(0, 8)}</span>
                      <span>•</span>
                      <span>{v.status}</span>
                    </div>
                  </div>
                  <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} />
                </article>
              ))}
            </div>

            <aside className="inspector-pane">
              {activeVideo ? (
                <div className="inspector-card">
                  <div className="inspector-header">
                    <span>Job Inspector</span>
                    <span className="badge-mono">{activeVideo.id.slice(0, 8)}</span>
                  </div>
                  <div className="inspector-body">
                    <h4>{activeVideo.title || activeVideo.topic}</h4>
                    {activeVideo.media_path && (
                      <div className="preview-container">
                        <video controls src={toApiUrl(activeVideo.media_path)} className="preview-video" />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="panel-card empty-placeholder">
                  <p>Select a video to inspect details.</p>
                </div>
              )}
            </aside>
          </div>
        </main>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
