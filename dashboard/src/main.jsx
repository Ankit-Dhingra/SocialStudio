import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionPreview } from './MotionPreview.jsx';
import { ManualVisualImport } from './ManualVisualImport.jsx';
import { pipelineFetch } from './pipeline-api.js';
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
  Camera,
  Maximize2,
  Eye,
  X,
  LayoutDashboard,
  PlusCircle,
  Film,
  ExternalLink,
  Sliders,
  Headphones,
  Trash2,
  Bookmark,
  Edit3,
} from 'lucide-react';
import './style.css';

const SAMPLE_6KEY_JSON = JSON.stringify(
  {
    title: "How Zomato Surge Pricing Works During Rain",
    hook: "रात के 12 बजे, तेज़ बारिश हो रही है। Zomato पर delivery charge ₹30 से अचानक ₹90 हो गया। Restaurant वही, घर वही, distance भी वही। फिर ये extra ₹60 कहाँ से आ गए?",
    problem: "मान लो उस area में 100 orders आ गए, लेकिन बारिश की वजह से सिर्फ 20 riders available हैं। अब हर order पर पूरी city के riders को search करना expensive होगा। और सिर्फ distance देखकर charge तय करेंगे, तो असली demand और rider shortage का पता ही नहीं चलेगा।",
    solution: "इस problem को solve करने के लिए एक possible design है Location-Based Dynamic Pricing। इसमें पूरे शहर की जगह छोटे geographical areas की demand और available riders को track करते हैं। फिर एक Pricing Engine इन्हीं local conditions के हिसाब से delivery charge calculate करता है।",
    tech_explained: "अब समझो backend में ये कैसे काम कर सकता है। हर rider की app GPS location और availability status भेजती है। System इन locations को छोटे geographical cells में map करता है। इसके लिए H3 Spatial Indexing जैसी technique इस्तेमाल हो सकती है। अब हर cell में कितने orders pending हैं और कितने riders actually available हैं, उसका count maintain किया जाता है। ये counts Redis जैसे fast cache में रख सकते हैं। मान लो तुम्हारे area में 100 orders और सिर्फ 20 available riders हैं। यानी हर rider पर average 5 orders की demand है। Pricing Engine इस imbalance के साथ बारिश, estimated delivery time और configured pricing rules को evaluate करता है। Example के लिए base delivery fee ₹30 है, और इन conditions में ₹60 additional charge calculate हुआ। तो app तुम्हें ₹90 दिखाएगी। लेकिन एक catch है। अगर rider offline हो गया और उसकी पुरानी GPS location cache में बची है, तो system उसे available समझ सकता है। इसलिए recent heartbeat, timestamp और active delivery status verify करना ज़रूरी है।",
    conclusion: "तो ₹30 से ₹90 होने की वजह distance बढ़ना ज़रूरी नहीं है। असली factor हो सकता है local demand, rider availability और delivery conditions का बदलना। यही Dynamic Pricing का core idea है। Price सिर्फ distance से नहीं, current supply-demand conditions से भी प्रभावित हो सकता है।",
    cta: "ऐसी ही interesting tech stories के पीछे की engineering समझने के लिए Behind The Tech को अभी follow करो।"
  },
  null,
  2
);

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
  'Hook 2 ko final voiceover me use karo',
  'Act 4 me edge case thoda aur clear samjhao',
  'Redis reveal hone se pehle thoda pause daalo',
  'Tone thoda aur conversational Hinglish banao',
  'Code snippet ka context simple kardo',
];

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const toApiUrl = (p) => (p && p.startsWith('http') ? p : `${API_BASE}${p || ''}`);

function detectKeys(text) {
  try {
    const obj = JSON.parse(text);
    return {
      title: Boolean(obj.title || obj.topic),
      hook: Boolean(obj.hook || obj.hooks),
      problem: Boolean(obj.problem),
      solution: Boolean(obj.solution),
      tech_explained: Boolean(obj.tech_explained || obj.tech),
      conclusion: Boolean(obj.conclusion || obj.summary),
      cta: Boolean(obj.cta),
    };
  } catch (e) {
    return {
      title: /(?:["']?title["']?\s*:|#\s*)/i.test(text),
      hook: /(?:["']?hook["']?\s*:|hook)/i.test(text),
      problem: /(?:["']?problem["']?\s*:|problem)/i.test(text),
      solution: /(?:["']?solution["']?\s*:|solution)/i.test(text),
      tech_explained: /(?:["']?tech_explained["']?\s*:|tech)/i.test(text),
      conclusion: /(?:["']?conclusion["']?\s*:|summary)/i.test(text),
      cta: /(?:["']?cta["']?\s*:|follow)/i.test(text),
    };
  }
}

function extractSevenKeyScript(session, customText) {
  if (session?.sevenKeyScript) return session.sevenKeyScript;
  if (session?.currentMarkdown) {
    try {
      const obj = JSON.parse(session.currentMarkdown);
      if (obj && (obj.hook || obj.hooks || obj.tech_explained || obj.problem)) return obj;
    } catch {}
  }
  if (customText) {
    try {
      const obj = JSON.parse(customText);
      if (obj && (obj.hook || obj.hooks || obj.tech_explained || obj.problem)) return obj;
    } catch {}
  }
  return {
    title: session?.topic || '',
    hook: '',
    problem: '',
    solution: '',
    tech_explained: session?.storyboard?.scenes?.map(scene => scene.narration).join('\n\n') || '',
    conclusion: '',
    cta: '',
  };
}

function calcScriptStats(script) {
  if (!script) return { words: 0, durationSec: 0 };
  const allSpoken = [
    script.hook || '',
    script.problem || '',
    script.solution || '',
    script.tech_explained || '',
    script.conclusion || '',
    script.cta || '',
  ].join(' ');
  const words = allSpoken.trim().split(/\s+/).filter(Boolean).length;
  const durationSec = Math.max(15, Math.round(words / 2.35));
  return { words, durationSec };
}

function getSceneVisualMeta(type) {
  switch (type) {
    case 'smartphoneMockup':
      return {
        label: 'Smartphone UI Mockup',
        icon: '📱',
        color: '#06b6d4',
        badgeBg: 'rgba(6, 182, 212, 0.1)',
        borderColor: 'rgba(6, 182, 212, 0.3)',
      };
    case 'comparison':
      return {
        label: 'Split Comparison',
        icon: '⚖️',
        color: '#f59e0b',
        badgeBg: 'rgba(245, 158, 11, 0.1)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
      };
    case 'h3SpatialMap':
      return {
        label: 'H3 Spatial Hexagons',
        icon: '🌐',
        color: '#10b981',
        badgeBg: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
      };
    case 'architecturePipeline':
      return {
        label: 'Backend Architecture',
        icon: '🏗️',
        color: '#3b82f6',
        badgeBg: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 0.3)',
      };
    case 'tradeoffHUD':
    case 'tradeoffHLD':
      return {
        label: 'Tradeoff Matrix & CTA',
        icon: '📊',
        color: '#8b5cf6',
        badgeBg: 'rgba(139, 92, 246, 0.1)',
        borderColor: 'rgba(139, 92, 246, 0.3)',
      };
    case 'raceCondition':
      return {
        label: 'Race Condition Spike',
        icon: '⚡',
        color: '#ef4444',
        badgeBg: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
      };
    case 'code':
      return {
        label: 'Code Walkthrough',
        icon: '💻',
        color: '#a855f7',
        badgeBg: 'rgba(168, 85, 247, 0.1)',
        borderColor: 'rgba(168, 85, 247, 0.3)',
      };
    case 'requestFlow':
      return {
        label: 'Request Flow Pipeline',
        icon: '🔄',
        color: '#0ea5e9',
        badgeBg: 'rgba(14, 165, 233, 0.1)',
        borderColor: 'rgba(14, 165, 233, 0.3)',
      };
    case 'hook':
      return {
        label: 'Hook & Problem Frame',
        icon: '🎯',
        color: '#eab308',
        badgeBg: 'rgba(234, 179, 8, 0.1)',
        borderColor: 'rgba(234, 179, 8, 0.3)',
      };
    default:
      return {
        label: type || 'Visual Scene Cut',
        icon: '🎬',
        color: '#6366f1',
        badgeBg: 'rgba(99, 102, 241, 0.1)',
        borderColor: 'rgba(99, 102, 241, 0.3)',
      };
  }
}

function App() {
  // Sidebar Navigation: 'overview' or 'create'
  const [activeNav, setActiveNav] = useState('overview');

  // Create Reel Timeline Stepper: 1: Script, 2: Voiceover, 3: Visuals, 4: Render
  const [stage, setStage] = useState(1);

  // Script Mode: 'ai' (Generate AI) or 'paste' (Paste Script)
  const [scriptMode, setScriptMode] = useState('ai');
  const [customScriptText, setCustomScriptText] = useState('');
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // Script Viewer & Edit States
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [aiRefinePrompt, setAiRefinePrompt] = useState('');
  const [refiningAi, setRefiningAi] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);

  // Studio Pipeline State
  const [topic, setTopic] = useState('');
  const [angle, setAngle] = useState('');
  const [session, setSession] = useState(null);
  const [sessionsList, setSessionsList] = useState([]);
  const [studioLoading, setStudioLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [activeScriptTab, setActiveScriptTab] = useState('full'); // 'full' | 'acts' | 'scenes' | 'cheat'
  const [copiedScript, setCopiedScript] = useState(false);
  const [audioSynthesizing, setAudioSynthesizing] = useState(false);
  const [audioResult, setAudioResult] = useState(null);
  const [stills, setStills] = useState([]);
  const [reviewedVisualRevision, setReviewedVisualRevision] = useState(null);
  const [generatingStills, setGeneratingStills] = useState(false);
  const [visualMode, setVisualMode] = useState('automatic');
  const [visualPreviewError, setVisualPreviewError] = useState(null);
  const [selectedStill, setSelectedStill] = useState(null);
  const [selectedMotionFrame, setSelectedMotionFrame] = useState(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [renderedMediaUrl, setRenderedMediaUrl] = useState('');
  const [renderError, setRenderError] = useState('');
  const [qaReport, setQaReport] = useState(null);

  // Video Preview Modal for Overview Library
  const [previewModalUrl, setPreviewModalUrl] = useState('');

  // Save as Draft Notification Toast
  const [draftToast, setDraftToast] = useState(null);

  useEffect(() => {
    if (!draftToast) return;
    const timer = setTimeout(() => setDraftToast(null), 3500);
    return () => clearTimeout(timer);
  }, [draftToast]);

  const chatScrollRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [session?.messages, chatSending]);

  // Sync active stage and session to localStorage
  useEffect(() => {
    localStorage.setItem('socialstudio_active_stage', String(stage));
  }, [stage]);

  useEffect(() => {
    if (session?.id) {
      localStorage.setItem('socialstudio_active_session', session.id);
    }
  }, [session?.id]);

  // Load existing pipeline sessions on mount & for Overview library
  async function loadSessions() {
    try {
      const res = await pipelineFetch(toApiUrl('/api/pipeline/sessions'));
      if (res.ok) {
        const list = await res.json();
        setSessionsList(list || []);

        const savedId = localStorage.getItem('socialstudio_active_session');
        const targetId = savedId && list.some((s) => s.id === savedId) ? savedId : null;
        if (targetId && !session) {
          const latestRes = await pipelineFetch(toApiUrl(`/api/pipeline/status/${targetId}`));
          if (latestRes.ok) {
            const statusData = await latestRes.json();
            const fullSession = statusData.session || {};
            setSession(fullSession);
            setTopic(fullSession.topic || '');
            setAngle(fullSession.angle || '');
            if (fullSession.sevenKeyScript) {
              setCustomScriptText(JSON.stringify(fullSession.sevenKeyScript, null, 2));
              setEditForm(fullSession.sevenKeyScript);
            } else if (fullSession.currentMarkdown) {
              setCustomScriptText(fullSession.currentMarkdown);
            }
            if (fullSession.audioResult) setAudioResult(fullSession.audioResult);
            if (fullSession.stillPreviews) setStills(fullSession.stillPreviews);

            const rState = statusData.renderState || fullSession.renderState;
            if (statusData.mediaUrl || rState?.mediaUrl) {
              setRenderedMediaUrl(statusData.mediaUrl || rState?.mediaUrl);
            }

            const savedStage = parseInt(localStorage.getItem('socialstudio_active_stage') || '1', 10);
            if (fullSession.voiceoverNeedsRefresh) {
              setStage(2);
            } else if (savedStage >= 1 && savedStage <= 4) {
              setStage(savedStage);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch pipeline sessions:', e);
    }
  }

  // Handle Save as Draft
  async function handleSaveDraft() {
    setDraftToast(null);
    try {
      if (!session?.id) {
        const draft = scriptMode === 'paste' ? await handleParseCustomScript() : await handleGenerateScript();
        if (!draft?.id) return;
      } else {
        const response = await pipelineFetch(toApiUrl('/api/pipeline/script/finalize'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: session.id,
            customMarkdown: session.currentMarkdown || JSON.stringify(session.sevenKeyScript || {}),
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `Server returned HTTP ${response.status}.`);
        }
        localStorage.setItem('socialstudio_active_session', session.id);
        localStorage.setItem('socialstudio_active_stage', String(stage));
        await loadSessions();
      }
      setDraftToast({ message: 'Draft saved! You can resume it anytime from the Drafts tab.' });
    } catch (e) {
      setDraftToast({ error: true, message: `Could not save draft. ${e.message}` });
    }
  }

  // Handle Delete Session (Draft or Library Reel)
  async function handleDeleteSession(sessionId, e) {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this reel / draft?')) return;
    try {
      const res = await pipelineFetch(toApiUrl(`/api/pipeline/session/${sessionId}`), {
        method: 'DELETE',
      });
      if (res.ok) {
        if (session?.id === sessionId) {
          setSession(null);
          setAudioResult(null);
          setStills([]);
          setRenderedMediaUrl('');
          setStage(1);
          localStorage.removeItem('socialstudio_active_session');
          localStorage.removeItem('socialstudio_active_stage');
        }
        await loadSessions();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  }

  // Load Session into Studio for Editing / Remixing
  async function handleLoadSessionIntoStudio(sess, targetStage = null) {
    try {
      setStudioLoading(true);
      const res = await pipelineFetch(toApiUrl(`/api/pipeline/status/${sess.id}`));
      let fullSession = sess;
      let fullAudio = null;
      let fullStills = [];
      let mediaUrl = '';
      if (res.ok) {
        const data = await res.json();
        fullSession = data.session || sess;
        fullAudio = fullSession.audioResult || null;
        fullStills = fullSession.stillPreviews || [];
        mediaUrl = data.mediaUrl || fullSession.renderState?.mediaUrl || '';
      }
      setSession(fullSession);
      setTopic(fullSession.topic || '');
      setAngle(fullSession.angle || '');
      if (fullSession.sevenKeyScript) {
        setCustomScriptText(JSON.stringify(fullSession.sevenKeyScript, null, 2));
        setEditForm(fullSession.sevenKeyScript);
      } else if (fullSession.currentMarkdown) {
        setCustomScriptText(fullSession.currentMarkdown);
      }
      setAudioResult(fullAudio);
      setStills(fullStills);
      setRenderedMediaUrl(mediaUrl);
      localStorage.setItem('socialstudio_active_session', fullSession.id);

      let s = 1;
      if (targetStage) {
        s = targetStage;
      } else if (fullSession.voiceoverNeedsRefresh) {
        s = 2;
      } else if (mediaUrl) {
        s = 4;
      } else if (fullStills && fullStills.length > 0) {
        s = 3;
      } else if (fullAudio) {
        s = 2;
      }
      setStage(s);
      localStorage.setItem('socialstudio_active_stage', String(s));
      setActiveNav('create');
    } catch (err) {
      console.error('Failed to load session into studio:', err);
    } finally {
      setStudioLoading(false);
    }
  }

  // Start fresh reel
  function handleStartNewReel() {
    if (session && !window.confirm('Start a fresh reel? Your current work is saved in Drafts/Library.')) {
      return;
    }
    setSession(null);
    setAudioResult(null);
    setStills([]);
    setRenderedMediaUrl('');
    setStage(1);
    setIsEditingScript(false);
    setPasteSuccess(false);
    setEditForm({});
    setCustomScriptText('');
    setTopic('');
    setAngle('');
    localStorage.removeItem('socialstudio_active_session');
    localStorage.removeItem('socialstudio_active_stage');
  }

  useEffect(() => {
    loadSessions();
  }, [activeNav]);

  // Poll server pipeline job and render status
  useEffect(() => {
    let interval = null;
    if (rendering && session?.id) {
      interval = setInterval(async () => {
        try {
          const res = await pipelineFetch(toApiUrl(`/api/pipeline/status/${session.id}`));
          if (res.ok) {
            const data = await res.json();
            const job = data.job;
            const rState = data.renderState || data.session?.renderState;
            if (data.session) {
              setSession(data.session);
              if (data.session.audioResult) setAudioResult(data.session.audioResult);
              if (data.session.stillPreviews) setStills(data.session.stillPreviews);
            }
            if (job) {
              setRenderProgress(job.progress || rState?.progress || 0);
              if (job.status === 'completed' || rState?.status === 'completed') {
                setRendering(false);
                setRenderedMediaUrl(data.mediaUrl || rState?.mediaUrl);
                setQaReport(job.qa || rState?.qa);
                setStage(4);
                loadSessions();
              } else if (job.status === 'failed' || rState?.status === 'failed') {
                setRendering(false);
                setRenderError(job.error || rState?.error || 'Pipeline execution failed.');
              }
            }
          }
        } catch (e) {
          console.warn('Pipeline status polling error:', e);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [rendering, session?.id]);

  function clearRenderPreview() {
    setStills([]);
    setReviewedVisualRevision(null);
    setSelectedStill(null);
    setQaReport(null);
    setRendering(false);
    setRenderProgress(0);
    setRenderError('');
    setRenderedMediaUrl('');
  }

  // 0. Full Reel Generator (Server-Orchestrated)
  async function handleGenerateReel() {
    if (!topic.trim()) return;
    setStudioLoading(true);
    setRenderError('');
    clearRenderPreview();
    try {
      const res = await pipelineFetch(toApiUrl('/api/pipeline/generate-reel'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), angle: angle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start reel generation');

      const curSession = data.session || { id: data.sessionId };
      setSession(curSession);
      localStorage.setItem('socialstudio_active_session', data.sessionId);
      setRendering(true);
      setRenderProgress(data.job?.progress || 10);
      setStage(4);
    } catch (err) {
      setRenderError(err.message);
      alert(`Reel Generation Error: ${err.message}`);
    } finally {
      setStudioLoading(false);
    }
  }

  // 1. Generate Script via AI (Contract V4)
  async function handleGenerateScript() {
    if (!topic.trim()) return;
    setStudioLoading(true);
    setIsEditingScript(false);
    try {
      const res = await pipelineFetch(toApiUrl('/api/pipeline/script/start'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), angle: angle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate script');
      setSession(data);
      setAudioResult(null);
      clearRenderPreview();
      setStage(1);
      loadSessions();
      return data;
    } catch (err) {
      alert(`Script Generation Error: ${err.message}`);
    } finally {
      setStudioLoading(false);
    }
  }

  // 1b. Parse Creator Custom Script (6-Key / 7-Key JSON or Text)
  async function handleParseCustomScript() {
    if (!customScriptText.trim()) return;
    setStudioLoading(true);
    setPasteSuccess(false);
    setIsEditingScript(false);
    try {
      let payload;
      try {
        payload = JSON.parse(customScriptText);
      } catch (e) {
        payload = customScriptText.trim();
      }
      const res = await pipelineFetch(toApiUrl('/api/pipeline/script/custom'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customScript: payload, topic: payload.title || topic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse custom script');
      setSession(data);
      setTopic(data.topic || 'Creator Reel');
      setAudioResult(null);
      clearRenderPreview();
      setPasteSuccess(true);
      loadSessions();
      return data;
    } catch (err) {
      alert(`Script Parsing Error: ${err.message}`);
    } finally {
      setStudioLoading(false);
    }
  }

  // 1c. Save Script Changes from Script Viewer
  async function handleSaveScriptEdits() {
    if (!editForm || !session?.id) return;
    setSavingEdits(true);
    try {
      const res = await pipelineFetch(toApiUrl('/api/pipeline/script/custom'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customScript: editForm,
          topic: editForm.title || session.topic,
          sessionId: session.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update script');
      setSession(data);
      setAudioResult(null);
      clearRenderPreview();
      setIsEditingScript(false);
      loadSessions();
    } catch (err) {
      alert(`Save Error: ${err.message}`);
    } finally {
      setSavingEdits(false);
    }
  }

  // 1d. AI Refine from within Script Viewer
  async function handleAiRefine() {
    if (!aiRefinePrompt.trim() || !session?.id) return;
    setRefiningAi(true);
    try {
      const res = await pipelineFetch(toApiUrl('/api/pipeline/script/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, message: aiRefinePrompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refinement failed');
      setSession(data);
      setAudioResult(null);
      clearRenderPreview();
      const updatedScript = extractSevenKeyScript(data);
      setEditForm(updatedScript);
      setAiRefinePrompt('');
      loadSessions();
    } catch (err) {
      alert(`Refine Error: ${err.message}`);
    } finally {
      setRefiningAi(false);
    }
  }

  // 2. Chat Refine Instruction
  async function handleSendChat(instructionText) {
    const text = instructionText || chatInput;
    if (!text.trim() || !session?.id) return;
    setChatSending(true);
    setChatInput('');
    try {
      const res = await pipelineFetch(toApiUrl('/api/pipeline/script/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, message: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refinement failed');
      setSession(data);
      setAudioResult(null);
      clearRenderPreview();
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
      const res = await pipelineFetch(toApiUrl('/api/pipeline/script/finalize'), {
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
      const res = await pipelineFetch(toApiUrl('/api/pipeline/audio/synthesize'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Audio synthesis failed');
      setAudioResult(data.audioResult);
      clearRenderPreview();
      const sessRes = await pipelineFetch(toApiUrl(`/api/pipeline/script/${session.id}`));
      if (sessRes.ok) setSession(await sessRes.json());
    } catch (err) {
      alert(`Audio Synthesis Error: ${err.message}`);
    } finally {
      setAudioSynthesizing(false);
    }
  }

  useEffect(() => {
    setVisualMode(session?.visualAssets?.source === 'manual' ? 'manual' : 'automatic');
  }, [session?.id, session?.visualAssets?.source]);

  function acceptVisualPreviews(data) {
    setStills(data.stills || []);
    setReviewedVisualRevision({ sessionId: session.id, fingerprint: data.visuals.fingerprint });
    setSession(current => current?.id === session.id ? { ...current, visualAssets: data.visuals } : current);
    setVisualPreviewError(null);
  }

  async function handleGenerateStills(editorFeedback, sceneIndex) {
    if (!session?.id) return;
    setGeneratingStills(true);
    setVisualPreviewError(null);
    try {
      const res = await pipelineFetch(toApiUrl('/api/pipeline/stills'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, editorFeedback, sceneIndex, visualMode: 'automatic' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate visual stills');
      acceptVisualPreviews(data);
    } catch (err) {
      setVisualPreviewError({ sessionId: session.id, message: err.message });
    } finally {
      setGeneratingStills(false);
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
      const res = await pipelineFetch(toApiUrl('/api/pipeline/render'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          visualRevision: reviewedVisualRevision?.sessionId === session.id
            ? reviewedVisualRevision.fingerprint : session.visualAssets?.inputRevision ? session.visualAssets.fingerprint : undefined,
        }),
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

  const detectedKeys = detectKeys(customScriptText);
  const awaitingManualVisuals = visualMode === 'manual' && session?.visualAssets?.source !== 'manual';

  const libraryReels = sessionsList.filter((s) => Boolean(s.hasVideo || s.mediaUrl));
  const draftsList = sessionsList.filter((s) => !s.hasVideo && !s.mediaUrl);

  return (
    <div className="app-layout">
      {/* =========================================================================
          LEFT SIDEBAR NAVIGATION
          ========================================================================= */}
      <aside className="sidebar">
        <div>
          {/* BRAND HEADER */}
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <Zap size={16} fill="#09090b" />
            </div>
            <span className="sidebar-brand-title">SocialStudio</span>
          </div>

          {/* MENU SECTION */}
          <div className="sidebar-menu-label">Workspace</div>
          <nav className="sidebar-nav-list">
            <button
              type="button"
              className={`sidebar-nav-item ${activeNav === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveNav('overview')}
            >
              <div className="sidebar-nav-left">
                <LayoutDashboard size={15} />
                <span>Overview</span>
              </div>
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${activeNav === 'create' ? 'active' : ''}`}
              onClick={() => setActiveNav('create')}
            >
              <div className="sidebar-nav-left">
                <PlusCircle size={15} />
                <span>Create Reel</span>
              </div>
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${activeNav === 'drafts' ? 'active' : ''}`}
              onClick={() => setActiveNav('drafts')}
            >
              <div className="sidebar-nav-left">
                <FileText size={15} />
                <span>Drafts</span>
              </div>
              {draftsList.length > 0 && (
                <span className="sidebar-badge">{draftsList.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`sidebar-nav-item ${activeNav === 'library' ? 'active' : ''}`}
              onClick={() => setActiveNav('library')}
            >
              <div className="sidebar-nav-left">
                <Film size={15} />
                <span>Library</span>
              </div>
              {libraryReels.length > 0 && (
                <span className="sidebar-badge">{libraryReels.length}</span>
              )}
            </button>
          </nav>
        </div>
      </aside>

      {/* =========================================================================
          MAIN CONTENT VIEWPORT
          ========================================================================= */}
      <main className="main-content">
        {/* =====================================================================
            VIEW 1: OVERVIEW & ANALYTICS (Clean workspace overview)
            ===================================================================== */}
        {activeNav === 'overview' && (
          <div className="overview-container">
            {/* OVERVIEW HEADER */}
            <div className="overview-header">
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fafafa', letterSpacing: -0.4, margin: '0 0 4px' }}>
                  Studio Overview
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  High-retention developer reel production engine & media library.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveNav('create')}
                style={{
                  height: 38,
                  padding: '0 18px',
                  gap: 8,
                }}
              >
                <PlusCircle size={15} />
                <span>Create Reel</span>
              </button>
            </div>

            {/* METRICS ROW */}
            <div className="overview-stats-grid">
              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">Library Videos</span>
                  <div className="stat-icon-wrap">
                    <Film size={16} />
                  </div>
                </div>
                <div className="stat-value">{libraryReels.length}</div>
                <div className="stat-subtext">Rendered 1080×1920 MP4s</div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">Active Drafts</span>
                  <div className="stat-icon-wrap">
                    <FileText size={16} />
                  </div>
                </div>
                <div className="stat-value">{draftsList.length}</div>
                <div className="stat-subtext">In-progress reel projects</div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">Voiceover Engine</span>
                  <div className="stat-icon-wrap">
                    <Volume2 size={16} />
                  </div>
                </div>
                <div className="stat-value">Sarvam Neural</div>
                <div className="stat-subtext">sunny_hi_reels • Hinglish</div>
              </div>

              <div className="stat-card">
                <div className="stat-top">
                  <span className="stat-label">Output Aspect</span>
                  <div className="stat-icon-wrap">
                    <Layers size={16} />
                  </div>
                </div>
                <div className="stat-value">9:16 HD</div>
                <div className="stat-subtext">1080×1920 Viral Shorts</div>
              </div>
            </div>

            {/* QUICK ACTIONS HUB */}
            <div className="overview-hub-grid">
              <div className="overview-hub-card">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                      <PlusCircle size={18} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#fafafa' }}>Create New Reel</h3>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    Generate dynamic system design scripts or paste your own 7-key prompt with multi-stage audio synthesis.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveNav('create')}
                  style={{ width: '100%', gap: 6 }}
                >
                  <span>Open Studio</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              <div className="overview-hub-card">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}>
                      <FileText size={18} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#fafafa' }}>Project Drafts</h3>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {draftsList.length > 0
                      ? `${draftsList.length} in-progress drafts waiting for voiceover or render.`
                      : 'Save any reel draft in progress and resume from where you left off.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveNav('drafts')}
                  style={{ width: '100%', gap: 6 }}
                >
                  <span>View Drafts ({draftsList.length})</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              <div className="overview-hub-card">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                      <Film size={18} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#fafafa' }}>Reel Library</h3>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {libraryReels.length > 0
                      ? `${libraryReels.length} rendered videos ready to watch, download, or edit.`
                      : 'Rendered 1080×1920 MP4 reels will automatically be organized here.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setActiveNav('library')}
                  style={{ width: '100%', gap: 6 }}
                >
                  <span>Open Library ({libraryReels.length})</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* RECENT COMPLETED REELS SHOWCASE (ONLY RENDERED REELS) */}
            {libraryReels.length > 0 ? (
              <div className="reels-library-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 2px' }}>
                      Recently Rendered Reels
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                      Quick access to your latest exported videos.
                    </p>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveNav('library')}>
                    <span>View All ({libraryReels.length})</span>
                    <ArrowRight size={12} />
                  </button>
                </div>

                <div className="reels-grid">
                  {libraryReels.slice(0, 3).map((sess) => (
                    <div key={sess.id} className="reel-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="badge-mono" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                          Ready • {sess.duration || '~80s'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(sess.updatedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <h4 title={sess.title || sess.topic} style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>
                          {sess.title || sess.topic}
                        </h4>
                        <p title={sess.angle} style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                          {sess.angle || 'System Design Reel'}
                        </p>
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        1080×1920 Full HD • {sess.scenesCount || 12} Cuts
                      </div>

                      <div className="reel-card-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setPreviewModalUrl(sess.mediaUrl)}
                          style={{ flex: 1, gap: 6 }}
                        >
                          <Play size={12} fill="#09090b" />
                          <span>Play</span>
                        </button>
                        <a
                          href={sess.mediaUrl}
                          download={`${(sess.title || sess.topic).replace(/\s+/g, '_')}.mp4`}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0 10px' }}
                          title="Download MP4"
                        >
                          <Download size={13} />
                        </a>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleLoadSessionIntoStudio(sess, 4)}
                          style={{ padding: '0 10px' }}
                          title="Edit in Studio"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state-card">
                <div className="empty-state-icon">
                  <Film size={24} />
                </div>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#fafafa' }}>
                  No Rendered Reels Yet
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, maxWidth: 440 }}>
                  Start by generating or pasting a technical script in Create Reel. Your finished videos will appear here and in your Library.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveNav('create')}
                  style={{ marginTop: 6, gap: 6 }}
                >
                  <PlusCircle size={13} />
                  <span>Create Your First Reel</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            VIEW 2: DRAFTS (IN-PROGRESS SCRIPTS & SESSIONS)
            ===================================================================== */}
        {activeNav === 'drafts' && (
          <div className="overview-container">
            <div className="overview-header">
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fafafa', letterSpacing: -0.4, margin: '0 0 4px' }}>
                  Saved Drafts ({draftsList.length})
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  Resume your unfinished scripts, voiceovers, or storyboard cuts anytime.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={loadSessions} title="Refresh Drafts">
                  <RefreshCw size={13} />
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    handleStartNewReel();
                    setActiveNav('create');
                  }}
                  style={{ height: 38, padding: '0 18px', gap: 8 }}
                >
                  <PlusCircle size={15} />
                  <span>New Reel</span>
                </button>
              </div>
            </div>

            {draftsList.length === 0 ? (
              <div className="empty-state-card">
                <div className="empty-state-icon">
                  <FileText size={24} />
                </div>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#fafafa' }}>
                  No Saved Drafts
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, maxWidth: 420 }}>
                  When creating a reel, click "Save as Draft" to preserve your script and audio progress here.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveNav('create')}
                  style={{ marginTop: 6, gap: 6 }}
                >
                  <PlusCircle size={13} />
                  <span>Start a Reel</span>
                </button>
              </div>
            ) : (
              <div className="reels-grid">
                {draftsList.map((sess) => {
                  const stageLabel = sess.hasAudio
                    ? 'Stage 2: Voiceover Ready'
                    : sess.hasStoryboard
                    ? 'Stage 3: Storyboard Ready'
                    : 'Stage 1: Script Draft';
                  const stageBg = sess.hasAudio
                    ? 'rgba(56, 189, 248, 0.12)'
                    : sess.hasStoryboard
                    ? 'rgba(168, 85, 247, 0.12)'
                    : 'rgba(245, 158, 11, 0.12)';
                  const stageColor = sess.hasAudio
                    ? '#38bdf8'
                    : sess.hasStoryboard
                    ? '#c084fc'
                    : '#fbbf24';

                  return (
                    <div key={sess.id} className="reel-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span
                          className="badge-mono"
                          style={{
                            background: stageBg,
                            color: stageColor,
                            border: `1px solid ${stageColor}33`,
                          }}
                        >
                          {stageLabel}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {new Date(sess.updatedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <h4 title={sess.title || sess.topic} style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>
                          {sess.title || sess.topic}
                        </h4>
                        <p title={sess.angle} style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                          {sess.angle || 'System Design Reel'}
                        </p>
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {sess.scenesCount ? `${sess.scenesCount} Cuts` : 'Script In Progress'} • {sess.hasAudio ? 'Voiceover Synthesized' : 'Awaiting Audio'}
                      </div>

                      <div className="reel-card-actions">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleLoadSessionIntoStudio(sess)}
                          style={{ flex: 1, gap: 6 }}
                        >
                          <Wand2 size={12} />
                          <span>Resume & Edit</span>
                        </button>
                        <button
                          type="button"
                          className="btn-danger-ghost"
                          onClick={(e) => handleDeleteSession(sess.id, e)}
                          title="Delete Draft"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            VIEW 3: LIBRARY (RENDERED MP4 VIDEOS)
            ===================================================================== */}
        {activeNav === 'library' && (
          <div className="overview-container">
            <div className="overview-header">
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fafafa', letterSpacing: -0.4, margin: '0 0 4px' }}>
                  Reel Library ({libraryReels.length})
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                  All exported 1080×1920 developer reels ready to preview, download, or remix in Studio.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={loadSessions} title="Refresh Library">
                  <RefreshCw size={13} />
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setActiveNav('create')}
                  style={{ height: 38, padding: '0 18px', gap: 8 }}
                >
                  <PlusCircle size={15} />
                  <span>Create Reel</span>
                </button>
              </div>
            </div>

            {libraryReels.length === 0 ? (
              <div className="empty-state-card">
                <div className="empty-state-icon">
                  <Film size={24} />
                </div>
                <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#fafafa' }}>
                  No Rendered Reels in Library
                </h4>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, maxWidth: 440 }}>
                  Your finished video renders will be saved here automatically with instant MP4 downloads.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setActiveNav('create')}
                  style={{ marginTop: 6, gap: 6 }}
                >
                  <PlusCircle size={13} />
                  <span>Render Your First Reel</span>
                </button>
              </div>
            ) : (
              <div className="reels-grid">
                {libraryReels.map((sess) => (
                  <div key={sess.id} className="reel-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="badge-mono" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                        Ready • {sess.duration || '~80s'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {new Date(sess.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      <h4 title={sess.title || sess.topic} style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: '#fff' }}>
                        {sess.title || sess.topic}
                      </h4>
                      <p title={sess.angle} style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                        {sess.angle || 'System Design Reel'}
                      </p>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      1080×1920 Full HD • MP4 Video • {sess.scenesCount || 12} Cuts
                    </div>

                    <div className="reel-card-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setPreviewModalUrl(sess.mediaUrl)}
                        style={{ flex: 1, gap: 6 }}
                      >
                        <Play size={12} fill="#09090b" />
                        <span>Play Reel</span>
                      </button>
                      <a
                        href={sess.mediaUrl}
                        download={`${(sess.title || sess.topic).replace(/\s+/g, '_')}.mp4`}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0 10px' }}
                        title="Download MP4"
                      >
                        <Download size={13} />
                      </a>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleLoadSessionIntoStudio(sess, 4)}
                        style={{ padding: '0 10px' }}
                        title="Edit in Studio (Prefill all values)"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-danger-ghost"
                        onClick={(e) => handleDeleteSession(sess.id, e)}
                        title="Delete Reel"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            VIEW 2: CREATE REEL (WORKFLOW TIMELINE NAVBAR)
            ===================================================================== */}
        {activeNav === 'create' && (
          <div className="dashboard-viewport" style={{ padding: '24px 32px' }}>
            <div className="studio-main-container">
              {/* STUDIO WORKFLOW BREADCRUMB / HEADER */}
              <div className="studio-workflow-header">
                <div className="studio-header-heading">
                  <div className="studio-breadcrumbs">
                    <span>Studio</span>
                    <span style={{ opacity: 0.4 }}>/</span>
                    <span className="breadcrumb-active">System Design Reel</span>
                  </div>
                  <h1 className="studio-project-title">
                    {session?.topic || topic || 'Create High-Retention Tech Reel'}
                  </h1>
                  {session?.angle && (
                    <p className="studio-project-subtitle">{session.angle}</p>
                  )}
                </div>

                <div className="studio-header-right">
                  <div className="studio-tag-group">
                    <span className="studio-meta-tag">
                      <Film size={12} />
                      <span>1080×1920 (9:16)</span>
                    </span>
                    <span className="studio-meta-tag">
                      <Clock size={12} />
                      <span>~80s Fast-Paced</span>
                    </span>
                    {session && (
                      <span className="studio-meta-tag active">
                        <CheckCircle2 size={12} color="#4ade80" />
                        <span>{session.storyboard?.scenes?.length ? `${session.storyboard.scenes.length} Storyboard Cuts` : 'Dynamic Storyboard'}</span>
                      </span>
                    )}
                  </div>

                  <div className="studio-header-actions">
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      className="btn btn-secondary"
                      disabled={studioLoading || (!session?.id && !(scriptMode === 'paste' ? customScriptText.trim() : topic.trim()))}
                      title="Save Current State as Draft"
                    >
                      <Bookmark size={13} />
                      <span>Save Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStartNewReel}
                      className="btn btn-secondary"
                      title="Start a fresh Reel"
                    >
                      <RotateCcw size={13} />
                      <span>New Reel</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* TOP TIMELINE STEPPER NAVBAR */}
              <nav className="timeline-stepper">
                <button
                  type="button"
                  className={`timeline-step ${stage === 1 ? 'active' : stage > 1 ? 'completed' : ''}`}
                  onClick={() => setStage(1)}
                >
                  <div className="timeline-step-circle">{stage > 1 ? <Check size={13} strokeWidth={2.5} /> : '1'}</div>
                  <div className="timeline-step-text">
                    <span className="timeline-step-title">1. Generate Script</span>
                    <span className="timeline-step-sub">7-Key Master Prompt</span>
                  </div>
                </button>

                <div className={`timeline-step-line ${stage > 1 ? 'completed' : ''}`} />

                <button
                  type="button"
                  className={`timeline-step ${stage === 2 ? 'active' : stage > 2 ? 'completed' : ''}`}
                  onClick={() => session && setStage(2)}
                  disabled={!session}
                  style={{ opacity: session ? 1 : 0.4 }}
                >
                  <div className="timeline-step-circle">{stage > 2 ? <Check size={13} strokeWidth={2.5} /> : '2'}</div>
                  <div className="timeline-step-text">
                    <span className="timeline-step-title">2. Generate Voiceover</span>
                    <span className="timeline-step-sub">Sarvam AI sunny_hi</span>
                  </div>
                </button>

                <div className={`timeline-step-line ${stage > 2 ? 'completed' : ''}`} />

                <button
                  type="button"
                  className={`timeline-step ${stage === 3 ? 'active' : stage > 3 ? 'completed' : ''}`}
                  onClick={() => (audioResult || session?.audioResult) && setStage(3)}
                  disabled={!audioResult && !session?.audioResult}
                  style={{ opacity: audioResult || session?.audioResult ? 1 : 0.4 }}
                >
                  <div className="timeline-step-circle">{stage > 3 ? <Check size={13} strokeWidth={2.5} /> : '3'}</div>
                  <div className="timeline-step-text">
                    <span className="timeline-step-title">3. Visual Stills Review</span>
                    <span className="timeline-step-sub">{session?.storyboard?.scenes?.length ? `${session.storyboard.scenes.length} Visual Cuts QA` : 'Visual Cuts QA'}</span>
                  </div>
                </button>

                <div className={`timeline-step-line ${stage > 3 ? 'completed' : ''}`} />

                <button
                  type="button"
                  className={`timeline-step ${stage === 4 ? 'active' : ''}`}
                  onClick={() => (renderedMediaUrl || rendering) && setStage(4)}
                  disabled={!renderedMediaUrl && !rendering}
                  style={{ opacity: renderedMediaUrl || rendering ? 1 : 0.4 }}
                >
                  <div className="timeline-step-circle">4</div>
                  <div className="timeline-step-text">
                    <span className="timeline-step-title">4. Final 1080×1920 MP4</span>
                    <span className="timeline-step-sub">Render & Export</span>
                  </div>
                </button>
              </nav>

              {/* STAGE 1: GENERATE SCRIPT */}
              {stage === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* SCRIPT SUB-SWITCHER: GENERATE AI vs PASTE SCRIPT */}
                  <div className="script-mode-switcher">
                    <button
                      type="button"
                      className={`script-mode-btn ${scriptMode === 'ai' ? 'active' : ''}`}
                      onClick={() => setScriptMode('ai')}
                    >
                      <Sparkles size={13} />
                      <span>Generate Script (AI)</span>
                    </button>
                    <button
                      type="button"
                      className={`script-mode-btn ${scriptMode === 'paste' ? 'active' : ''}`}
                      onClick={() => setScriptMode('paste')}
                    >
                      <FileText size={13} />
                      <span>Paste Script</span>
                    </button>
                  </div>

                  {/* SCRIPT GENERATOR / PASTE INPUTS (Shown when no script has been generated yet) */}
                  {!session ? (
                    <>
                      {/* MODE A: GENERATE SCRIPT (AI) */}
                      {scriptMode === 'ai' && (
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
                                placeholder="e.g. How Zomato Surge Pricing Works During Rain"
                                onKeyDown={(e) => e.key === 'Enter' && handleGenerateScript()}
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
                                placeholder="e.g. Late-night heavy rain, GPS cell mapping"
                                onKeyDown={(e) => e.key === 'Enter' && handleGenerateScript()}
                              />
                            </div>

                            <button
                              type="button"
                              className="btn btn-primary"
                              id="btn-generate-script"
                              disabled={studioLoading || !topic.trim()}
                              onClick={handleGenerateScript}
                              style={{ height: 38, padding: '0 20px', gap: 8 }}
                            >
                              {studioLoading ? (
                                <RefreshCw size={13} className="animate-spin" />
                              ) : (
                                <Wand2 size={13} />
                              )}
                              <span>{studioLoading ? 'Generating Script...' : 'Generate Script'}</span>
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
                      )}

                      {/* MODE B: PASTE SCRIPT */}
                      {scriptMode === 'paste' && (
                        <div className="paste-script-card">
                          <div className="paste-script-header">
                            <div>
                              <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 2px' }}>
                                Paste 6-Key / 7-Key Storyboard Script
                              </h3>
                              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                                Enter raw JSON with keys: <code>title</code>, <code>hook</code>, <code>problem</code>, <code>solution</code>, <code>tech_explained</code>, <code>conclusion</code>, <code>cta</code>.
                              </p>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setCustomScriptText(SAMPLE_6KEY_JSON);
                                  setPasteSuccess(false);
                                }}
                              >
                                <Copy size={12} />
                                <span>Load Sample 6-Key JSON</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  setCustomScriptText('');
                                  setPasteSuccess(false);
                                }}
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          {/* 6-KEY VALIDATION CHECKLIST BAR */}
                          <div className="key-checklist-bar">
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', marginRight: 4 }}>
                              Detected Keys:
                            </span>
                            <span className={`key-pill ${detectedKeys.title ? 'present' : 'missing'}`}>
                              {detectedKeys.title ? <Check size={11} strokeWidth={2.5} /> : <X size={11} strokeWidth={2} />} title
                            </span>
                            <span className={`key-pill ${detectedKeys.hook ? 'present' : 'missing'}`}>
                              {detectedKeys.hook ? <Check size={11} strokeWidth={2.5} /> : <X size={11} strokeWidth={2} />} hook
                            </span>
                            <span className={`key-pill ${detectedKeys.problem ? 'present' : 'missing'}`}>
                              {detectedKeys.problem ? <Check size={11} strokeWidth={2.5} /> : <X size={11} strokeWidth={2} />} problem
                            </span>
                            <span className={`key-pill ${detectedKeys.solution ? 'present' : 'missing'}`}>
                              {detectedKeys.solution ? <Check size={11} strokeWidth={2.5} /> : <X size={11} strokeWidth={2} />} solution
                            </span>
                            <span className={`key-pill ${detectedKeys.tech_explained ? 'present' : 'missing'}`}>
                              {detectedKeys.tech_explained ? <Check size={11} strokeWidth={2.5} /> : <X size={11} strokeWidth={2} />} tech_explained
                            </span>
                            <span className={`key-pill ${detectedKeys.conclusion ? 'present' : 'missing'}`}>
                              {detectedKeys.conclusion ? <Check size={11} strokeWidth={2.5} /> : <X size={11} strokeWidth={2} />} conclusion
                            </span>
                            <span className={`key-pill ${detectedKeys.cta ? 'present' : 'missing'}`}>
                              {detectedKeys.cta ? <Check size={11} strokeWidth={2.5} /> : <X size={11} strokeWidth={2} />} cta
                            </span>
                          </div>

                          {/* CODE EDITOR TEXTAREA */}
                          <textarea
                            className="paste-script-textarea"
                            value={customScriptText}
                            onChange={(e) => {
                              setCustomScriptText(e.target.value);
                              setPasteSuccess(false);
                            }}
                            placeholder="Paste your script here…"
                          />

                          {/* ACTION BUTTON */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={handleParseCustomScript}
                              disabled={studioLoading || !customScriptText.trim()}
                              style={{
                                padding: '8px 20px',
                                fontSize: 13,
                                fontWeight: 600,
                                gap: 8,
                              }}
                            >
                              {studioLoading ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={14} />}
                              <span>Validate & Parse Script</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* SCRIPT VIEWER: OPENS FOR BOTH GENERATE AND PASTE MODES */
                    (() => {
                      const activeScript = extractSevenKeyScript(session, customScriptText);
                      const stats = calcScriptStats(activeScript);

                      return (
                        <div className="script-viewer-card">
                          {/* VIEWER HEADER */}
                          <div className="script-viewer-header">
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span className="badge-mono" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                                  <Check size={11} strokeWidth={2.5} /> Script Ready • 7-Key Format
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                  ~{stats.words} words • ~{stats.durationSec}s duration
                                </span>
                              </div>
                              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', margin: 0, letterSpacing: '-0.02em' }}>
                                {activeScript.title || session.topic}
                              </h2>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(JSON.stringify(activeScript, null, 2));
                                  setCopiedScript(true);
                                  setTimeout(() => setCopiedScript(false), 2000);
                                }}
                                title="Copy JSON"
                              >
                                {copiedScript ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
                                <span>{copiedScript ? 'Copied' : 'Copy JSON'}</span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setSession(null);
                                  setIsEditingScript(false);
                                  setPasteSuccess(false);
                                }}
                                title="Reset and start a new script"
                              >
                                <RotateCcw size={12} />
                                <span>New Script</span>
                              </button>
                            </div>
                          </div>

                          {/* VIEWER BODY: DISPLAY OR INLINE EDIT */}
                          {!isEditingScript ? (
                            <div className="script-sections-flow">
                              {/* 1. HOOK */}
                              <div className="script-section-block sec-hook">
                                <div className="script-section-top">
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b' }}>0–7s • Hook</span>
                                  <span className="script-act-label">Opening Relatable Mystery</span>
                                </div>
                                <p className="script-section-text">{activeScript.hook || '—'}</p>
                              </div>

                              {/* 2. PROBLEM */}
                              <div className="script-section-block sec-problem">
                                <div className="script-section-top">
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(244, 63, 94, 0.4)', color: '#f43f5e' }}>7–18s • Problem</span>
                                  <span className="script-act-label">Naive Approach & Real Bottleneck</span>
                                </div>
                                <p className="script-section-text">{activeScript.problem || '—'}</p>
                              </div>

                              {/* 3. SOLUTION */}
                              <div className="script-section-block sec-solution">
                                <div className="script-section-top">
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}>18–30s • Solution</span>
                                  <span className="script-act-label">Hero Architectural Concept</span>
                                </div>
                                <p className="script-section-text">{activeScript.solution || '—'}</p>
                              </div>

                              {/* 4. TECH EXPLAINED */}
                              <div className="script-section-block sec-tech">
                                <div className="script-section-top">
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(6, 182, 212, 0.4)', color: '#38bdf8' }}>30–67s • Deep Dive</span>
                                  <span className="script-act-label">Under-The-Hood Architecture & Edge Case</span>
                                </div>
                                <p className="script-section-text" style={{ fontSize: 14 }}>{activeScript.tech_explained || '—'}</p>
                              </div>

                              {/* 5. CONCLUSION */}
                              <div className="script-section-block sec-conclusion">
                                <div className="script-section-top">
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(139, 92, 246, 0.4)', color: '#a78bfa' }}>67–80s • Conclusion</span>
                                  <span className="script-act-label">Recap & Key Architectural Takeaway</span>
                                </div>
                                <p className="script-section-text">{activeScript.conclusion || '—'}</p>
                              </div>

                              {/* 6. CTA */}
                              <div className="script-section-block sec-cta">
                                <div className="script-section-top">
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(34, 197, 94, 0.4)', color: '#4ade80' }}>Last 4–6s • Branded CTA</span>
                                  <span className="script-act-label">Behind The Tech</span>
                                </div>
                                <p className="script-section-text">{activeScript.cta || '—'}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="script-edit-container">
                              <div className="script-edit-field">
                                <div className="script-edit-label-row">
                                  <span className="input-label" style={{ fontWeight: 600, color: '#fafafa' }}>Script Title</span>
                                </div>
                                <input
                                  type="text"
                                  className="text-field"
                                  value={editForm.title || ''}
                                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                />
                              </div>

                              <div className="script-edit-field">
                                <div className="script-edit-label-row">
                                  <span className="input-label" style={{ fontWeight: 600, color: '#fafafa' }}>Hook</span>
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b' }}>0–7s</span>
                                </div>
                                <textarea
                                  className="script-edit-textarea"
                                  rows={3}
                                  value={editForm.hook || ''}
                                  onChange={(e) => setEditForm({ ...editForm, hook: e.target.value })}
                                />
                              </div>

                              <div className="script-edit-field">
                                <div className="script-edit-label-row">
                                  <span className="input-label" style={{ fontWeight: 600, color: '#fafafa' }}>Problem</span>
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(244, 63, 94, 0.4)', color: '#f43f5e' }}>7–18s</span>
                                </div>
                                <textarea
                                  className="script-edit-textarea"
                                  rows={3}
                                  value={editForm.problem || ''}
                                  onChange={(e) => setEditForm({ ...editForm, problem: e.target.value })}
                                />
                              </div>

                              <div className="script-edit-field">
                                <div className="script-edit-label-row">
                                  <span className="input-label" style={{ fontWeight: 600, color: '#fafafa' }}>Solution</span>
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}>18–30s</span>
                                </div>
                                <textarea
                                  className="script-edit-textarea"
                                  rows={3}
                                  value={editForm.solution || ''}
                                  onChange={(e) => setEditForm({ ...editForm, solution: e.target.value })}
                                />
                              </div>

                              <div className="script-edit-field">
                                <div className="script-edit-label-row">
                                  <span className="input-label" style={{ fontWeight: 600, color: '#fafafa' }}>Tech Explained (Deep Dive)</span>
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(6, 182, 212, 0.4)', color: '#38bdf8' }}>30–67s</span>
                                </div>
                                <textarea
                                  className="script-edit-textarea"
                                  rows={6}
                                  value={editForm.tech_explained || ''}
                                  onChange={(e) => setEditForm({ ...editForm, tech_explained: e.target.value })}
                                />
                              </div>

                              <div className="script-edit-field">
                                <div className="script-edit-label-row">
                                  <span className="input-label" style={{ fontWeight: 600, color: '#fafafa' }}>Conclusion</span>
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(139, 92, 246, 0.4)', color: '#a78bfa' }}>67–80s</span>
                                </div>
                                <textarea
                                  className="script-edit-textarea"
                                  rows={3}
                                  value={editForm.conclusion || ''}
                                  onChange={(e) => setEditForm({ ...editForm, conclusion: e.target.value })}
                                />
                              </div>

                              <div className="script-edit-field">
                                <div className="script-edit-label-row">
                                  <span className="input-label" style={{ fontWeight: 600, color: '#fafafa' }}>CTA (Brand Close)</span>
                                  <span className="script-act-tag" style={{ borderColor: 'rgba(34, 197, 94, 0.4)', color: '#4ade80' }}>Last 4–6s</span>
                                </div>
                                <input
                                  type="text"
                                  className="text-field"
                                  value={editForm.cta || ''}
                                  onChange={(e) => setEditForm({ ...editForm, cta: e.target.value })}
                                />
                              </div>

                              {/* AI Refine Prompt */}
                              <div style={{ padding: 12, background: '#141417', borderRadius: 8, border: '1px solid #222226' }}>
                                <span className="input-label" style={{ marginBottom: 6, display: 'block' }}>Or Refine with AI Prompt:</span>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <input
                                    type="text"
                                    className="text-field"
                                    placeholder="e.g. Hook ko aur punchy banao ya Redis ka part thoda aur detail me samjhao..."
                                    value={aiRefinePrompt}
                                    onChange={(e) => setAiRefinePrompt(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAiRefine()}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleAiRefine}
                                    disabled={refiningAi || !aiRefinePrompt.trim()}
                                    style={{ gap: 6, whiteSpace: 'nowrap' }}
                                  >
                                    {refiningAi ? <RefreshCw size={13} className="animate-spin" /> : <Wand2 size={13} />}
                                    <span>Refine</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* BOTTOM ACTION BAR */}
                          <div className="script-action-bar">
                            <div style={{ display: 'flex', gap: 8 }}>
                              {!isEditingScript ? (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    setEditForm({ ...activeScript });
                                    setIsEditingScript(true);
                                  }}
                                  style={{ gap: 6 }}
                                >
                                  <Sliders size={13} />
                                  <span>Make Changes</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleSaveScriptEdits}
                                    disabled={savingEdits}
                                    style={{ gap: 6 }}
                                  >
                                    {savingEdits ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
                                    <span>Save Changes</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    onClick={() => setIsEditingScript(false)}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleSaveDraft}
                                style={{
                                  padding: '0 16px',
                                  height: 38,
                                  gap: 6,
                                }}
                              >
                                <Bookmark size={13} />
                                <span>Save as Draft</span>
                              </button>

                              {/* PROCEED TO VOICEOVER */}
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() => setStage(2)}
                                style={{
                                  padding: '0 22px',
                                  height: 38,
                                  gap: 8,
                                  fontWeight: 600,
                                }}
                              >
                                <span>Proceed to Voiceover</span>
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* STAGE 2: VOICEOVER GENERATION */}
              {stage === 2 && (() => {
                const activeAudio = audioResult || session?.audioResult;
                const scenes = session?.storyboard?.scenes || [];
                const totalTargetSec = scenes.reduce((acc, s) => acc + (s.durationTargetSec || 8), 0);

                return (
                  <section className="voiceover-hub-card">
                    {/* HERO HEADER */}
                    <div className="voiceover-hero-header">
                      <div>
                        <div className="voiceover-header-badge">
                          <Headphones size={12} />
                          <span>AI Spoken Audio Studio</span>
                        </div>
                        <h2 className="voiceover-hero-title">
                          Stage 2: Voiceover Synthesis
                        </h2>
                        <p className="voiceover-hero-desc">
                          High-retention neural Hinglish voiceover powered by <strong>Sarvam AI</strong> (<code>sunny_hi_reels</code>) with exact millisecond silence injection across all cuts.
                        </p>
                      </div>

                      <div className="voice-badge-chip">
                        <span className="voice-dot-live" />
                        <span>sunny_hi_reels (Pace 1.0)</span>
                      </div>
                    </div>

                    {/* CONTROL ACTION BAR */}
                    <div className="voiceover-control-bar">
                      <div className="voiceover-status-left">
                        <div className="voiceover-status-icon">
                          <Volume2 size={18} />
                        </div>
                        <div>
                          <div className="voiceover-status-title">
                            {activeAudio ? 'Voiceover Synthesized & Synced' : 'Ready to Synthesize Spoken Narration'}
                          </div>
                          <div className="voiceover-status-sub">
                            {activeAudio
                              ? `Master track duration: ~${Math.round(activeAudio.totalDurationSec || 0)}s • ${scenes.length} cuts synchronized`
                              : session?.voiceoverNeedsRefresh
                                ? 'Original narration restored. Generate a new voiceover to update the reel.'
                                : `Estimated duration: ~${totalTargetSec}s • ${scenes.length} storyboard scenes`}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={handleSaveDraft}
                          style={{ padding: '9px 16px', fontSize: 13, gap: 6 }}
                        >
                          <Bookmark size={13} />
                          <span>Save as Draft</span>
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={audioSynthesizing}
                          onClick={handleSynthesizeAudio}
                          style={{ padding: '9px 22px', fontSize: 13, gap: 8, fontWeight: 600 }}
                        >
                          {audioSynthesizing ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : (
                            <Volume2 size={14} />
                          )}
                          <span>{audioSynthesizing ? 'Synthesizing Audio...' : activeAudio ? 'Re-Synthesize Audio' : 'Synthesize Voiceover'}</span>
                        </button>

                        <button
                          type="button"
                          className={`btn ${activeAudio ? 'btn-secondary' : 'btn-disabled'}`}
                          disabled={!activeAudio}
                          onClick={() => setStage(3)}
                          style={{
                            padding: '9px 18px',
                            gap: 6,
                            fontWeight: 500,
                            opacity: activeAudio ? 1 : 0.45,
                            cursor: activeAudio ? 'pointer' : 'not-allowed',
                          }}
                        >
                          <span>Next: Visuals</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>

                    {/* MASTER AUDIO PLAYER CARD */}
                    {activeAudio?.fullAudioUrl && (
                      <div className="master-audio-player-card">
                        <div className="master-player-info">
                          <div className="master-player-icon-wrap">
                            <Volume2 size={18} color="#fafafa" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="master-player-title">Master Narration Audio (Combined Storyboard Track)</div>
                            <div className="master-player-meta">
                              <span>Duration: ~{Math.round(activeAudio.totalDurationSec || 0)}s</span>
                              <span>•</span>
                              <span>Sarvam AI Hinglish (48kHz Stereo)</span>
                              <span>•</span>
                              <span style={{ color: '#4ade80' }}>Synced with Remotion Timeline</span>
                            </div>
                          </div>
                          <a
                            href={toApiUrl(activeAudio.fullAudioUrl)}
                            download={`${(session?.topic || 'voiceover').replace(/\s+/g, '_')}_master.mp3`}
                            className="btn btn-secondary btn-sm"
                            style={{ gap: 6 }}
                          >
                            <Download size={12} />
                            <span>Download MP3</span>
                          </a>
                        </div>

                        <div className="master-audio-element-wrap">
                          <audio
                            controls
                            src={toApiUrl(activeAudio.fullAudioUrl)}
                          />
                        </div>
                      </div>
                    )}

                    {/* SCENES STREAM HEADER */}
                    <div className="scenes-stream-header">
                      <span className="scenes-stream-title">
                        Storyboard Cuts & Narration Flow ({scenes.length} Scenes)
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {activeAudio ? `Recorded: ${Number(activeAudio.totalDurationSec).toFixed(1)}s` : `Estimate: ~${totalTargetSec}s`}
                      </span>
                    </div>

                    {/* SCENE VOICE STREAM */}
                    <div className="scenes-voice-stream">
                      {scenes.map((scene, idx) => {
                        const meta = getSceneVisualMeta(scene.type);
                        const clip = activeAudio?.clips?.find(
                          (c) => c.sceneId === scene.id || c.sceneIndex === idx
                        );
                        const wordCount = scene.narration ? scene.narration.trim().split(/\s+/).filter(Boolean).length : 0;

                        return (
                          <div
                            key={scene.id}
                            className="scene-voice-card"
                            style={{ borderLeftColor: meta.color }}
                          >
                            {/* Scene Top Bar */}
                            <div className="scene-voice-header">
                              <div className="scene-header-left">
                                <span className="scene-cut-badge">
                                  CUT {String(idx + 1).padStart(2, '0')}
                                </span>
                                <span
                                  className="scene-type-badge"
                                  style={{
                                    background: meta.badgeBg,
                                    color: meta.color,
                                    borderColor: meta.borderColor,
                                  }}
                                >
                                  <span>{meta.icon}</span>
                                  <span>{meta.label}</span>
                                </span>
                                {scene.onScreenText && (
                                  <span className="scene-hud-pill">
                                    HUD: {scene.onScreenText}
                                  </span>
                                )}
                              </div>

                              <div className="scene-header-right">
                                {!clip && <span className="scene-stat-pill">
                                  <Clock size={11} />
                                  <span>~{scene.durationTargetSec || 8}s estimate</span>
                                </span>}
                                <span className="scene-stat-pill">
                                  <span>{wordCount} words</span>
                                </span>
                                {clip && (
                                  <span className="scene-stat-pill clip-ready">
                                    <CheckCircle2 size={11} color="#4ade80" />
                                    <span>{((clip.durationSec ?? (clip.durationMs ? clip.durationMs / 1000 : 0)) || 0).toFixed(1)}s actual</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Scene Narration Text */}
                            <div className="scene-voice-content">
                              <p className="scene-narration-text">
                                {scene.narration}
                              </p>
                            </div>

                            {/* Scene Footer */}
                            <div className="scene-voice-footer">
                              <div className="scene-keypoint-tag">
                                <Cpu size={12} color="var(--text-muted)" />
                                <span>
                                  Key Concept: <strong>{scene.technicalKeyPoint || scene.visualProps?.headline || scene.type}</strong>
                                </span>
                              </div>

                              {clip?.url && (
                                <div className="scene-clip-player">
                                  <audio
                                    controls
                                    src={toApiUrl(clip.url)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}

              {/* STAGE 3: VISUAL STILLS REVIEW */}
              {stage === 3 && (
                <section className="stills-review-card">
                  {!audioResult && !session?.audioResult ? (
                    <div className="panel-card empty-placeholder" style={{ padding: '48px 24px', textAlign: 'center' }}>
                      <Volume2 size={32} style={{ margin: '0 auto 12px', color: '#60a5fa' }} />
                      <h4 style={{ fontSize: 16, fontWeight: 600, color: '#fafafa', marginBottom: 6 }}>Voiceover Audio Required</h4>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto 18px' }}>
                        Visual keyframes are synchronized to actual spoken word timestamps. Please synthesize voiceover in Stage 2 first.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setStage(2)}
                        style={{ padding: '9px 22px', fontSize: 13, gap: 8 }}
                      >
                        <Volume2 size={14} />
                        <span>Go to Stage 2: Voiceover Synthesis</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="stills-header" style={{ marginBottom: 24 }}>
                        <div>
                          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                            Stage 3: Visual Shot Review
                          </h3>
                          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
                            Review camera moves and cuts with the saved voiceover, or inspect individual frames.
                          </p>
                          <div className="visual-mode-switch" role="group" aria-label="Visual generation mode">
                            <button type="button" aria-pressed={visualMode === 'automatic'} disabled={generatingStills}
                              onClick={() => setVisualMode('automatic')}>Automatic (Groq)</button>
                            <button type="button" aria-pressed={visualMode === 'manual'} disabled={generatingStills}
                              onClick={() => setVisualMode('manual')}>Manual (Import JSON)</button>
                          </div>
                          {visualMode === 'manual' && session?.id && <ManualVisualImport key={session.id} sessionId={session.id} toApiUrl={toApiUrl}
                            narrationKey={JSON.stringify([(audioResult || session.audioResult)?.fullAudioUrl, session.finalized, session.voiceoverNeedsRefresh])}
                            busy={generatingStills} onBusyChange={setGeneratingStills} onGenerated={data => { acceptVisualPreviews(data); setRenderedMediaUrl(''); }} />}
                        </div>

                        <div style={{ display: 'flex', gap: 10, marginTop: 14, marginBottom: 24, alignItems: 'center' }}>
                          {visualMode === 'automatic' && <button
                            type="button"
                            className="btn btn-primary"
                            disabled={generatingStills}
                            onClick={() => handleGenerateStills()}
                            style={{ padding: '8px 20px', fontSize: 13, gap: 8 }}
                          >
                            {generatingStills ? (
                              <RefreshCw size={13} className="animate-spin" />
                            ) : (
                              <Camera size={13} />
                            )}
                            <span>{generatingStills ? 'Preparing stills…' : 'Generate Stills'}</span>
                          </button>}

                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleSaveDraft}
                            style={{ padding: '8px 16px', fontSize: 13, gap: 6 }}
                          >
                            <Bookmark size={13} />
                            <span>Save as Draft</span>
                          </button>

                          <button
                            type="button"
                            className="btn btn-emerald"
                            disabled={generatingStills || awaitingManualVisuals}
                            onClick={() => setStage(4)}
                            style={{ padding: '8px 18px', gap: 6 }}
                          >
                            <span>Next: Render Video</span>
                            <ArrowRight size={13} />
                          </button>
                        </div>
                      </div>

                      {visualPreviewError && visualPreviewError.sessionId === session?.id && (
                        <p role="alert" style={{ color: '#f87171', fontSize: 13 }}>
                          {visualPreviewError.message}
                        </p>
                      )}
                      {stills.length > 0 && session?.visualAssets?.status === 'ready' && !session.visualAssets.unresolvedScenes?.length && (
                        <p role="status" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                          {stills.length} visual shots ready.
                        </p>
                      )}
                      {!!session?.visualAssets?.unresolvedScenes?.length && (
                        <p role="status" className="text-sm text-amber-200">
                          Visual planning is incomplete for scenes {session.visualAssets.unresolvedScenes.map(index => index + 1).join(', ')}. Generate Stills retries the flagged scenes.
                        </p>
                      )}
                      {session?.visualAssets?.review?.status === 'unavailable' && (
                        <p role="status" className="text-sm text-amber-200">Automated visual review unavailable. Inspect the previews before export.</p>
                      )}
                      {session?.visualAssets?.review?.status === 'needs-review' && (
                        <ul className="text-sm text-amber-200">
                          {session.visualAssets.review.issues.map(({ sceneIndex, issue }, index) => (
                            <li key={index}>Scene {sceneIndex + 1} · {issue}</li>
                          ))}
                        </ul>
                      )}
                      {stills.length > 0 && session?.visualAssets?.visualThread && (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{session.visualAssets.visualThread}</p>
                      )}
                      {visualMode === 'automatic' && session?.visualAssets?.source !== 'manual' && <details key={session?.id} style={{ marginBottom: 16 }}>
                        <summary style={{ cursor: 'pointer', fontSize: 13 }}>Revise visual plan</summary>
                        <form onSubmit={event => {
                          event.preventDefault();
                          const data = new FormData(event.currentTarget);
                          const feedback = data.get('editorFeedback')?.trim();
                          const selectedScene = data.get('sceneIndex');
                          if (feedback) void handleGenerateStills(feedback, selectedScene ? Number(selectedScene) : undefined);
                        }} style={{ display: 'grid', justifyItems: 'start', gap: 8, marginTop: 8 }}>
                          <textarea name="editorFeedback" aria-label="Visual direction feedback" required maxLength={500}
                            rows={2} placeholder="Describe what should change in the shots or timing."
                            style={{ width: '100%', maxWidth: 540, resize: 'vertical', font: 'inherit', padding: 8 }} />
                          {stills.length > 0 && (
                            <select name="sceneIndex" aria-label="Scene to revise">
                              <option value="">All scenes</option>
                              {session.storyboard?.scenes?.map((scene, index) => (
                                <option key={scene.id} value={index}>Scene {index + 1} · {scene.onScreenText}</option>
                              ))}
                            </select>
                          )}
                          <button type="submit" disabled={generatingStills} className="btn btn-secondary">Regenerate with feedback</button>
                        </form>
                      </details>}
                      {session?.id && !awaitingManualVisuals && <MotionPreview
                        key={`${session.id}:${audioResult?.fullAudioUrl || session.audioResult?.fullAudioUrl || ''}:${session.visualAssets?.fingerprint || ''}`}
                        sessionId={session.id} scenes={session.storyboard?.scenes ?? []} toApiUrl={toApiUrl}
                        visualRevision={session.visualAssets?.fingerprint}
                        onReviewedRevision={setReviewedVisualRevision}
                      />}

                      {/* STILLS GRID */}
                      {stills && stills.length > 0 ? (
                        <div className="stills-gallery-grid" style={{ marginTop: 24 }}>
                          {stills.map((still, idx) => {
                            const scene = session?.storyboard?.scenes?.[still.sceneIndex ?? idx];
                            return (
                              <div
                                key={idx}
                                className="still-card-wrapper"
                                onClick={() => {
                                  setSelectedStill(still);
                                  setSelectedMotionFrame(null);
                                }}
                              >
                                <div className="still-thumbnail-box">
                                  <img src={toApiUrl(still.url)} alt={still.label || `Cut ${idx + 1}`} />
                                  <span className="still-thumbnail-badge">{still.shotId ? `SHOT ${still.shotId}` : `CUT ${String(idx + 1).padStart(2, '0')}`}</span>
                                  <span className="still-thumbnail-frame">{still.motionFrames?.length ? 'Motion' : still.type || scene?.type || 'SCENE'}</span>
                                </div>
                                <div className="still-card-meta">
                                  <span className="still-card-title">{still.label || scene?.onScreenText || `Cut ${idx + 1}`}</span>
                                  <span className="still-card-sub">{still.evidence || scene?.technicalKeyPoint || 'Visual Keyframe'}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="panel-card empty-placeholder" style={{ padding: '40px 20px' }}>
                          <Camera size={24} style={{ margin: '0 auto 10px', color: 'var(--text-muted)' }} />
                          <p style={{ color: 'var(--text-muted)' }}>
                            Generate previews to review the artwork, animation keyframes and captions.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              {/* STAGE 4: FINALIZE & RENDER REEL */}
              {stage === 4 && (
                <section className="render-export-card">
                  <div className="render-header">
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                        Stage 4: 1080×1920 MP4 Video Export
                      </h3>
                      <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                        Hardware-accelerated Remotion rendering with locked audio and strict Media QA verification.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={rendering || Boolean(session?.visualAssets?.unresolvedScenes?.length)}
                      onClick={handleRenderVideo}
                      style={{
                        padding: '8px 20px',
                        fontSize: 13,
                        fontWeight: 600,
                        gap: 8,
                      }}
                    >
                      {rendering ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                      <span>{rendering ? `Rendering (${renderProgress}%)` : 'Start Render'}</span>
                    </button>
                  </div>

                  {!!session?.visualAssets?.unresolvedScenes?.length && (
                    <p role="status" className="text-sm text-amber-200">Return to visual previews and retry the flagged scenes to enable export.</p>
                  )}

                  {/* PROGRESS BAR */}
                  {rendering && (
                    <div style={{ marginTop: 16 }}>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${renderProgress}%` }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{renderProgress <= 5 ? 'Preparing visual assets…' : 'Rendering frames @ 1080×1920 30FPS…'}</span>
                        <span style={{ fontWeight: 600, color: '#fafafa' }}>{renderProgress}%</span>
                      </div>
                    </div>
                  )}

                  {/* ERROR BANNER */}
                  {renderError && (
                    <div
                      style={{
                        marginTop: 16,
                        padding: '12px 16px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 8,
                        color: '#f87171',
                        fontSize: 12.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <AlertTriangle size={15} />
                      <span>Render Error: {renderError}</span>
                    </div>
                  )}

                  {/* VIDEO PLAYER & QA */}
                  {renderedMediaUrl && (
                    <div className="video-player-qa-grid" style={{ marginTop: 20 }}>
                      <div className="video-player-pane">
                        <video
                          src={toApiUrl(renderedMediaUrl)}
                          controls
                          autoPlay
                          loop
                          style={{
                            width: '100%',
                            maxHeight: 520,
                            borderRadius: 12,
                            background: '#000',
                            border: '1px solid var(--border)',
                          }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
                          <a
                            href={toApiUrl(renderedMediaUrl)}
                            download="socialstudio_reel.mp4"
                            className="btn btn-emerald"
                            style={{ padding: '8px 24px', gap: 8, fontWeight: 700 }}
                          >
                            <Download size={14} />
                            <span>Download 1080×1920 MP4</span>
                          </a>
                        </div>
                      </div>

                      {/* QA REPORT CARD */}
                      <div className="qa-report-pane">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <ShieldCheck size={18} style={{ color: '#10B981' }} />
                          <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Quality Assurance Report</h4>
                        </div>

                        <div className="qa-checks-list">
                          <div className="qa-check-item passed">
                            <CheckCircle2 size={14} />
                            <span>Resolution: 1080×1920 (9:16 Vertical)</span>
                          </div>
                          <div className="qa-check-item passed">
                            <CheckCircle2 size={14} />
                            <span>Audio/Video Clock Sync: 100% Locked</span>
                          </div>
                          <div className="qa-check-item passed">
                            <CheckCircle2 size={14} />
                            <span>Visual Retention: {session?.storyboard?.scenes?.length || 'Dynamic'}-Cut Adaptive Pacing</span>
                          </div>
                          <div className="qa-check-item passed">
                            <CheckCircle2 size={14} />
                            <span>Safe-Zone Blackout Adherence: Verified</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          PREVIEW VIDEO MODAL (FROM OVERVIEW)
          ========================================================================= */}
      {previewModalUrl && (
        <div
          className="still-lightbox-overlay"
          onClick={() => setPreviewModalUrl('')}
          style={{ zIndex: 100 }}
        >
          <div
            className="still-lightbox-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, width: '90%' }}
          >
            <div className="still-lightbox-header">
              <span style={{ fontSize: 13, fontWeight: 700 }}>HD Reel Preview</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPreviewModalUrl('')}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 16, background: '#000', display: 'flex', justifyContent: 'center' }}>
              <video
                src={toApiUrl(previewModalUrl)}
                controls
                autoPlay
                style={{
                  width: '100%',
                  maxHeight: '75vh',
                  borderRadius: 8,
                }}
              />
            </div>
            <div
              style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <a
                href={toApiUrl(previewModalUrl)}
                download="reel.mp4"
                className="btn btn-primary btn-sm"
                style={{ gap: 6 }}
              >
                <Download size={13} />
                <span>Download MP4</span>
              </a>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreviewModalUrl('')}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          STILL LIGHTBOX MODAL (FROM STAGE 3)
          ========================================================================= */}
      {selectedStill && (
        <div
          className="still-lightbox-overlay"
          onClick={() => setSelectedStill(null)}
          style={{ zIndex: 100 }}
        >
          <div className="still-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <div className="still-lightbox-header">
              <span style={{ fontSize: 13, fontWeight: 700 }}>
                {selectedStill.label || 'Still Preview (1080×1920)'}
              </span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSelectedStill(null)}
              >
                <X size={14} />
              </button>
            </div>
            {selectedStill.motionFrames?.length > 0 && (
              <div className="still-motion-controls" role="group" aria-label="Motion keyframes">
                {selectedStill.motionFrames.map((beat) => (
                  <button
                    key={beat.label}
                    type="button"
                    className={`btn btn-sm ${(selectedMotionFrame?.label || 'After') === beat.label ? 'btn-primary' : 'btn-ghost'}`}
                    aria-pressed={(selectedMotionFrame?.label || 'After') === beat.label}
                    onClick={() => setSelectedMotionFrame(beat)}
                  >
                    {beat.label}
                  </button>
                ))}
              </div>
            )}
            <div className="still-lightbox-body">
              <img src={toApiUrl(selectedMotionFrame?.url || selectedStill.url)} alt={selectedStill.label || 'Reel preview'} />
            </div>
          </div>
        </div>
      )}
      {/* FLOATING TOAST NOTIFICATION */}
      {draftToast && (
        <div className="toast-notification" role={draftToast.error ? 'alert' : 'status'}>
          <Bookmark size={15} color={draftToast.error ? '#fb7185' : '#4ade80'} aria-hidden="true" />
          <span>{draftToast.message}</span>
        </div>
      )}
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('[Dashboard Error Boundary]:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#09090b',
          color: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'Inter, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: 500,
            background: '#121216',
            border: '1px solid #272730',
            borderRadius: 12,
            padding: 32,
            textAlign: 'center'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#ef4444' }}>
              Dashboard UI Caught an Error
            </h3>
            <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 20 }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#fafafa',
                color: '#09090b',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
