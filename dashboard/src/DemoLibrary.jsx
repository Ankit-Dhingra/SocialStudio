import React, { useEffect, useState } from 'react';

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const mediaUrl = url => url.startsWith('/') ? apiBase + url : url;

function runtime(seconds) {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function DemoLibrary() {
  const [reels, setReels] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(false);

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
  }, []);

  const selected = reels?.find(reel => reel.id === selectedId);
  const clerkEnabled = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

  return <main className="main-content demo-library">
    <a className="btn btn-secondary" href="/">SocialStudio</a>
    <header className="demo-header">
      <div>
        <h1>Explore Demo</h1>
        <p>Watch finished examples from Behind The Tech. Demo reels are pre-rendered.</p>
      </div>
      <a className="btn btn-primary" href={clerkEnabled ? '/?signin=1' : '/studio'}>
        {clerkEnabled ? 'Sign in to create' : 'Open Studio'}
      </a>
    </header>
    {error && <p role="alert">The demo library is temporarily unavailable.</p>}
    {!error && !reels && <p role="status">Loading demo reels…</p>}
    {reels?.length === 0 && <p role="status">Demo reels are not available yet.</p>}
    {selected && <div className="demo-layout">
      <section className="demo-player" aria-labelledby="demo-reel-title">
        <video key={selected.id} aria-label={selected.title} src={mediaUrl(selected.videoUrl)} poster={mediaUrl(selected.thumbnailUrl)}
          controls playsInline preload="metadata" />
        <div aria-live="polite">
          <h2 id="demo-reel-title">{selected.title}</h2>
          <p>{selected.description}</p>
        </div>
      </section>
      <section className="demo-reel-list" aria-label="Demo reel selection">
        {reels.map(reel => <button className="demo-reel-choice" type="button" key={reel.id}
          aria-pressed={reel.id === selectedId} onClick={() => setSelectedId(reel.id)}>
          <img src={mediaUrl(reel.thumbnailUrl)} alt="" width="54" height="96" />
          <span><strong>{reel.title}</strong><small>{reel.category} · {runtime(reel.durationSeconds)}</small></span>
        </button>)}
      </section>
    </div>}
  </main>;
}
