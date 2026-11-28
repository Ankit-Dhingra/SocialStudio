import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ClerkProvider, SignIn, useAuth, useClerk, useUser, UserButton, UserProfile } from '@clerk/react';
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
  const [switchError, setSwitchError] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();
  const returnTo = page === '/billing' || page === '/account' ? page : '/studio';
  useLayoutEffect(() => registerPipelineTokenGetter(getToken), [getToken]);
  useEffect(() => {
    const controller = new AbortController();
    pipelineFetch(apiBase + '/api/account', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const failure = response.status === 403 ? await response.json().catch(() => ({})) : null;
        if (controller.signal.aborted) return;
        if (response.ok) setAccess('granted');
        else if (failure?.error === 'Hosted staging is restricted to the Studio owner.') setAccess('wrongAccount');
        else if (response.status === 403) setAccess('restricted');
        else if (response.status === 401) setAccess('expired');
        else setAccess('unavailable');
      })
      .catch(() => { if (!controller.signal.aborted) setAccess('unavailable'); });
    return () => controller.abort();
  }, [getToken, retry]);

  if (access !== 'granted') return <AccessScreen>
    <div className="studio-access-card">
    {access === 'loading' && <p role="status">Opening your workspace…</p>}
    {['wrongAccount', 'restricted', 'expired'].includes(access) && <>
      <h1>{access === 'wrongAccount' ? 'Switch to your Studio owner account' : access === 'expired' ? 'Sign in again' : 'This account can’t open Studio'}</h1>
      {user?.primaryEmailAddress?.emailAddress && <p>Signed in as <strong>{user.primaryEmailAddress.emailAddress}</strong></p>}
      {access === 'wrongAccount' && <p>Use the Google account you enrolled for SocialStudio owner access.</p>}
      <button className="marketing-primary" type="button" onClick={() => {
        setSwitchError(false);
        void signOut({ redirectUrl: returnTo }).catch(() => setSwitchError(true));
      }}>{access === 'expired' ? 'Sign in again' : 'Use another account'}</button>
      {switchError && <p role="alert">Couldn’t switch accounts. Try again.</p>}
    </>}
    {access === 'unavailable' && <><h1>Studio couldn’t connect</h1><button className="marketing-secondary" onClick={() => { setAccess('loading'); setRetry(value => value + 1); }}>Try again</button></>}
    <a className="marketing-secondary" href="/demo">Watch demo</a>
    </div>
  </AccessScreen>;

  if (page === '/billing') return <BillingPage />;
  if (page === '/account') return <main className="main-content billing-page">
    <nav aria-label="Account navigation"><a className="btn btn-secondary" href="/studio">Workspace</a>
      <a className="btn btn-secondary" href="/billing">Plans & billing</a></nav>
    <UserProfile routing="hash" />
    <GenerationAccount />
  </main>;

  return <Studio userId={userId} accountControls={<>
    <UserButton /><a href="/account">Account settings</a>
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
