import React, { useEffect, useState } from 'react';
import { ArrowRight, FileText, Film, Layers, Play, Zap } from 'lucide-react';

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const preview = 'https://social-studio-git-codex-d0540d-ankitdhingra1909-5016s-projects.vercel.app';

export function MarketingNav() {
  return <nav className="marketing-nav" aria-label="Main navigation">
    <a className="marketing-brand" href="/"><Zap size={19} /> SocialStudio</a>
    <div><a href="/demo">Demo</a><a href="/plans">Pricing</a></div>
  </nav>;
}

const workflow = [
  { icon: FileText, title: 'Start with a script', description: 'Break down a technical idea and save your script as a draft.' },
  { icon: Layers, title: 'Plan the visuals', description: 'Pair saved narration with a scene-by-scene visual plan.' },
  { icon: Film, title: 'Review your reels', description: 'Keep finished videos and drafts together in your library.' },
];

export function Landing({ studioHref }) {
  const [reels, setReels] = useState([]);
  useEffect(() => {
    const request = new AbortController();
    fetch(apiBase + '/api/demo/reels', { signal: request.signal, credentials: 'omit' })
      .then(response => response.ok ? response.json() : null)
      .then(data => setReels(data?.reels || []))
      .catch(() => {});
    return () => request.abort();
  }, []);
  const featured = reels.find(reel => reel.featured) || reels[0];
  const poster = featured?.thumbnailUrl;
  return <main className="marketing-shell">
    <MarketingNav />
    <div className="marketing-hero">
      <div>
        <p className="marketing-kicker">A studio for technical creators</p>
        <h1>Make complex ideas <em>worth watching.</em></h1>
        <p className="marketing-intro">A workspace for turning technical scripts into short video explainers. Organize your drafts, plan your visuals, and review finished reels.</p>
        <div className="marketing-actions">
          <a className="marketing-primary" href={studioHref || preview + '/studio'}>Get started <ArrowRight size={17} /></a>
          <a className="marketing-secondary" href="/demo"><Play size={16} /> Watch demo</a>
        </div>
        {!studioHref && <p className="pricing-note">Studio access is by invitation. The demo is open to everyone.</p>}
      </div>
      <a className="marketing-showcase" href="/demo" aria-label="Watch sample reels">
        {poster && <img src={poster.startsWith('/') ? apiBase + poster : poster} alt="" />}
        <span className="marketing-play"><Play size={25} fill="currentColor" /></span>
        <strong>{featured?.title || 'Watch sample reels'}</strong>
      </a>
    </div>
    <section className="marketing-section" aria-labelledby="workflow-title">
      <div className="marketing-section-head"><h2 id="workflow-title">From script to screen</h2><a href="/plans">See pricing <ArrowRight size={16} /></a></div>
      <div className="marketing-workflow">
        {workflow.map(({ icon: Icon, title, description }) => <article key={title}>
          <Icon size={23} /><h3>{title}</h3><p>{description}</p>
        </article>)}
      </div>
    </section>
    <footer className="marketing-footer"><a className="marketing-brand" href="/">SocialStudio</a><a href="/demo">Demo library</a><a href="/plans">Creator plan</a></footer>
  </main>;
}
