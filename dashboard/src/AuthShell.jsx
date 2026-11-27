import React, { useEffect, useLayoutEffect } from 'react';
import { ClerkProvider, useAuth, useClerk, UserButton, UserProfile } from '@clerk/react';
import { registerPipelineTokenGetter } from './pipeline-api.js';
import { DemoLibrary } from './DemoLibrary.jsx';

function SignedInStudio({ Studio, userId, getToken }) {
  useLayoutEffect(() => registerPipelineTokenGetter(getToken), [getToken]);

  if (window.location.pathname === '/account') {
    return <main className="main-content">
      <a className="btn btn-secondary" href="/studio">Open Studio</a>
      <UserProfile routing="hash" />
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
  const signIn = () => openSignIn({ forceRedirectUrl: '/studio' });
  const signUp = () => openSignUp({ forceRedirectUrl: '/studio' });

  useEffect(() => {
    if (!isLoaded || isSignedIn || new URLSearchParams(window.location.search).get('signin') !== '1') return;
    window.history.replaceState(null, '', '/');
    openSignIn({ forceRedirectUrl: '/studio' });
  }, [isLoaded, isSignedIn, openSignIn]);

  if (isSignedIn) return <SignedInStudio key={userId} Studio={Studio} userId={userId} getToken={getToken} />;

  return <Studio canAccessStudio={false} onStudioRequired={isLoaded ? signIn : undefined} accountControls={<>
    <button className="btn btn-secondary" type="button" disabled={!isLoaded} onClick={signIn}>Sign in</button>
    <button className="btn btn-secondary" type="button" disabled={!isLoaded} onClick={signUp}>Sign up</button>
  </>} />;
}

export function AuthShell({ Studio }) {
  if (window.location.pathname.replace(/\/$/, '') === '/demo') return <DemoLibrary />;
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  if (key) {
    return <ClerkProvider publishableKey={key} afterSignOutUrl="/">
      <ClerkStudio Studio={Studio} />
    </ClerkProvider>;
  }

  if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) return <Studio />;
  return <Studio canAccessStudio={false} accountControls={<span role="status">Sign-in is unavailable.</span>} />;
}
