import React, { useEffect, useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { MarketingNav } from './Landing.jsx';

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const mediaUrl = url => url.startsWith('/') ? apiBase + url : url;

function runtime(seconds) {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function DemoLibrary() {
  const [reels, setReels] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const request = new AbortController();
    fetch(`${apiBase}/api/demo/reels`, { credentials: 'omit', signal: request.signal })
      .then(response => {
        if (!response.ok) throw new Error('Could not load demo reels.');
        return response.json();
      })
      .then(({ reels: items }) => {
        setReels(items);
        setSelectedId((items.find(reel => reel.featured) || items[0])?.id || null);
      })
      .catch(() => { if (!request.signal.aborted) setError(true); });
    return () => request.abort();
  }, [attempt]);

  const selected = reels?.find(reel => reel.id === selectedId);
  const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
  const localStudio = import.meta.env.VITE_PORTFOLIO_ONLY !== 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

  return <main className="marketing-shell demo-page">
    <MarketingNav />
    <div className="demo-library">
    <header className="demo-header">
      <div>
        <p className="marketing-kicker">The demo library</p>
        <h1>Explore the reels</h1>
        <p>Five technical explainers from Behind The Tech. Pick a reel and press play.</p>
      </div>
      {clerkEnabled || localStudio ? (
        <a className="marketing-secondary" href="/studio">Open Studio <ArrowRight size={16} /></a>
      ) : (
        <span className="demo-access-note">Public demo · No account needed</span>
      )}
    </header>
    {error && <div>
      <p role="alert">The demo library is temporarily unavailable.</p>
      <button className="btn btn-secondary" type="button" onClick={() => {
        setError(false);
        setAttempt(current => current + 1);
      }}>Retry loading reels</button>
    </div>}
    {!error && !reels && <p role="status">Loading demo reels…</p>}
    {reels?.length === 0 && <p role="status">Demo reels are not available yet.</p>}
    {selected && <div className="demo-layout">
      <section className="demo-player" aria-labelledby="demo-reel-title">
        <div className="demo-stage">
        {playing ? <video key={selected.id} aria-label={selected.title} src={mediaUrl(selected.videoUrl)}
          poster={mediaUrl(selected.thumbnailUrl)} controls playsInline autoPlay onError={() => {
            setPlaybackError(true);
            setPlaying(false);
          }} /> :
          <button className="demo-poster" type="button" aria-label={`Play ${selected.title}`} onClick={() => {
            setPlaybackError(false);
            setPlaying(true);
          }}>
            <img src={mediaUrl(selected.thumbnailUrl)} alt="" />
            <span className="demo-play-icon"><Play size={24} fill="currentColor" aria-hidden="true" /></span>
          </button>}
        </div>
        <div className="demo-reel-details" aria-live="polite">
          <p className="marketing-kicker">{selected.category} · {runtime(selected.durationSeconds)}</p>
          <h2 id="demo-reel-title">{selected.title}</h2>
          <p>{selected.description}</p>
          {playbackError && <p role="alert">This video couldn’t load. Press play to retry.</p>}
        </div>
      </section>
      <section className="demo-reel-list" aria-label="Demo reel selection">
        <h2>Playlist</h2>
        {reels.map(reel => <button className="demo-reel-choice" type="button" key={reel.id}
          aria-pressed={reel.id === selectedId} onClick={() => {
            if (reel.id !== selectedId) {
              setSelectedId(reel.id);
              setPlaying(false);
              setPlaybackError(false);
            }
          }}>
          <img src={mediaUrl(reel.thumbnailUrl)} alt="" width="42" height="70" />
          <span><strong>{reel.title}</strong><small>{reel.category} · {runtime(reel.durationSeconds)}</small></span>
        </button>)}
      </section>
    </div>}
    </div>
  </main>;
}
