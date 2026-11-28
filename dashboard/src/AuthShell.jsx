import React, { useEffect, useLayoutEffect } from 'react';
import { ClerkProvider, useAuth, useClerk, UserButton, UserProfile } from '@clerk/react';
import { registerPipelineTokenGetter } from './pipeline-api.js';
import { DemoLibrary } from './DemoLibrary.jsx';
import { BillingPage } from './BillingPage.jsx';
import { GenerationAccount } from './GenerationAccount.jsx';
import { Plans } from './Plans.jsx';
import { Landing } from './Landing.jsx';

function SignedInStudio({ Studio, userId, getToken }) {
  useLayoutEffect(() => registerPipelineTokenGetter(getToken), [getToken]);

  const page = window.location.pathname.replace(/\/$/, '');
  if (page === '/billing') return <BillingPage />;
  if (page === '/account') {
    return <main className="main-content">
      <a className="btn btn-secondary" href="/studio">Open Studio</a>
      <a className="btn btn-secondary" href="/billing">Plans & billing</a>
      <UserProfile routing="hash" />
      <GenerationAccount />
    </main>;
  }

  return <Studio userId={userId} accountControls={<>
    <a className="btn btn-secondary" href="/account">Account</a>
    <UserButton />
  </>} />;
}

function ClerkStudio({ Studio }) {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { openSignIn, openSignUp } = useClerk();
  const page = window.location.pathname.replace(/\/$/, '');
  const destination = page === '/billing' ? '/billing' : '/studio';
  const signIn = () => openSignIn({ forceRedirectUrl: destination });
  const signUp = () => openSignUp({ forceRedirectUrl: '/studio' });

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('signin') === '1';
    if (!isLoaded) return;
    if (isSignedIn && requested) { window.location.replace(destination); return; }
    if (isSignedIn || !requested) return;
    window.history.replaceState(null, '', window.location.pathname);
    openSignIn({ forceRedirectUrl: destination });
  }, [destination, isLoaded, isSignedIn, openSignIn]);

  if (page === '') return <Landing onStart={isLoaded && !isSignedIn ? signIn : undefined} signedIn={isSignedIn} />;

  if (isSignedIn) return <SignedInStudio key={userId} Studio={Studio} userId={userId} getToken={getToken} />;

  return <Studio canAccessStudio={false} onStudioRequired={isLoaded ? signIn : undefined} accountControls={<>
    <button className="btn btn-secondary" type="button" disabled={!isLoaded} onClick={signIn}>Sign in</button>
    <button className="btn btn-secondary" type="button" disabled={!isLoaded} onClick={signUp}>Sign up</button>
  </>} />;
}

export function AuthShell({ Studio }) {
  const page = window.location.pathname.replace(/\/$/, '');
  if (page === '/demo') return <DemoLibrary />;
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (page === '/plans') return <Plans checkoutHref={key ? '/billing?signin=1' : undefined} />;
  if (key) {
    return <ClerkProvider publishableKey={key} afterSignOutUrl="/">
      <ClerkStudio Studio={Studio} />
    </ClerkProvider>;
  }

  if (import.meta.env.VITE_PORTFOLIO_ONLY !== 'true' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return <Studio />;
  return <Landing />;
}
