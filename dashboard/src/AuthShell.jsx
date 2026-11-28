import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ClerkProvider, SignIn, useAuth, UserButton, UserProfile } from '@clerk/react';
import { pipelineFetch, registerPipelineTokenGetter } from './pipeline-api.js';
import { DemoLibrary } from './DemoLibrary.jsx';
import { BillingPage } from './BillingPage.jsx';
import { GenerationAccount } from './GenerationAccount.jsx';
import { Plans } from './Plans.jsx';
import { Landing, MarketingNav } from './Landing.jsx';

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function AccessScreen({ children }) {
  return <main className="marketing-shell">
    <MarketingNav />
    <section className="studio-access">{children}</section>
  </main>;
}

function SignedInStudio({ Studio, getToken, userId, page }) {
  const [access, setAccess] = useState('loading');
  const [retry, setRetry] = useState(0);
  useLayoutEffect(() => registerPipelineTokenGetter(getToken), [getToken]);
  useEffect(() => {
    const controller = new AbortController();
    pipelineFetch(apiBase + '/api/account', { signal: controller.signal, cache: 'no-store' })
      .then(response => {
        if (!controller.signal.aborted) setAccess(response.ok ? 'granted' : response.status === 403 ? 'restricted' : 'unavailable');
      })
      .catch(() => { if (!controller.signal.aborted) setAccess('unavailable'); });
    return () => controller.abort();
  }, [getToken, retry]);

  if (access !== 'granted') return <AccessScreen>
    {access === 'loading' && <p role="status">Opening your workspace…</p>}
    {access === 'restricted' && <><h1>Studio access is by invitation</h1><p>Switch to the account that has Studio access, or explore the demo.</p><UserButton /></>}
    {access === 'unavailable' && <><h1>Studio couldn’t connect</h1><button className="marketing-secondary" onClick={() => { setAccess('loading'); setRetry(value => value + 1); }}>Try again</button></>}
    <a className="marketing-secondary" href="/demo">Watch demo</a>
  </AccessScreen>;

  if (page === '/billing') return <BillingPage />;
  if (page === '/account') return <main className="main-content billing-page">
    <nav aria-label="Account navigation"><a className="btn btn-secondary" href="/studio">Workspace</a>
      <a className="btn btn-secondary" href="/billing">Plans & billing</a></nav>
    <UserProfile routing="hash" />
    <GenerationAccount />
  </main>;

  return <Studio userId={userId} accountControls={<>
    <a className="btn btn-secondary" href="/account">Account</a><UserButton />
  </>} />;
}

function ClerkStudio({ Studio, page }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  if (!isLoaded) return <AccessScreen><p role="status">Loading Studio…</p></AccessScreen>;
  if (isSignedIn) return <SignedInStudio key={userId} Studio={Studio} userId={userId} getToken={getToken} page={page} />;

  const destination = page === '/billing' ? '/billing' : page === '/account' ? '/account' : '/studio';
  return <AccessScreen>
    <SignIn routing="hash" forceRedirectUrl={destination} signUpForceRedirectUrl={destination} />
  </AccessScreen>;
}

export function AuthShell({ Studio }) {
  const page = window.location.pathname.replace(/\/$/, '');
  if (page === '/demo') return <DemoLibrary />;
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (page === '/plans') return <Plans checkoutHref={key ? '/billing' : undefined} />;
  const local = import.meta.env.VITE_PORTFOLIO_ONLY !== 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  if (page === '') return <Landing studioHref={key || local ? '/studio' : undefined} />;
  if (key) return <ClerkProvider publishableKey={key} afterSignOutUrl="/">
    <ClerkStudio Studio={Studio} page={page} />
  </ClerkProvider>;
  if (local) return <Studio />;
  return <Landing />;
}
