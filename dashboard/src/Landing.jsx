import React, { useEffect, useState } from 'react';
import { ArrowRight, Play, Zap } from 'lucide-react';

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const preview = 'https://social-studio-git-codex-d0540d-ankitdhingra1909-5016s-projects.vercel.app';

export function MarketingNav() {
  return <nav className="marketing-nav" aria-label="Main navigation">
    <a className="marketing-brand" href="/"><Zap size={19} /> SocialStudio</a>
    <div><a href="/demo">Demo</a><a href="/plans">Pricing</a></div>
  </nav>;
}

export function Landing({ onStart, signedIn }) {
  const [featured, setFeatured] = useState(null);
  useEffect(() => {
    const request = new AbortController();
    fetch(apiBase + '/api/demo/reels', { signal: request.signal, credentials: 'omit' })
      .then(response => response.ok ? response.json() : null)
      .then(data => setFeatured(data?.reels?.find(reel => reel.featured) || data?.reels?.[0]))
      .catch(() => {});
    return () => request.abort();
  }, []);
  const poster = featured?.thumbnailUrl;
  return <main className="marketing-shell">
    <MarketingNav />
    <div className="marketing-hero">
      <div>
        <p className="marketing-kicker">A studio for technical creators</p>
        <h1>Make complex ideas <em>worth watching.</em></h1>
        <p className="marketing-intro">Turn technical scripts into short video explainers. Keep your scripts, visual plans, and finished reels in one workspace.</p>
        <div className="marketing-actions">
          {onStart ? <button className="marketing-primary" onClick={onStart}>Get started <ArrowRight size={17} /></button>
            : <a className="marketing-primary" href={signedIn ? '/studio' : preview + '/?signin=1'}>
              {signedIn ? 'Open Studio' : 'Get started'} <ArrowRight size={17} /></a>}
          <a className="marketing-secondary" href="/demo"><Play size={16} /> Watch demo</a>
        </div>
      </div>
      <a className="marketing-showcase" href="/demo" aria-label="Watch sample reels">
        {poster && <img src={poster.startsWith('/') ? apiBase + poster : poster} alt="" />}
        <span className="marketing-play"><Play size={25} fill="currentColor" /></span>
        <strong>{featured?.title || 'Watch sample reels'}</strong>
      </a>
    </div>
  </main>;
}
