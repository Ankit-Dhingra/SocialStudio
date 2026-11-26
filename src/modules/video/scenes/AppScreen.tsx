import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimedShot } from '../visual-story.js';
import { ScreenActivity } from './ScreenActivity.js';
import { BrandMark, findBrandLogo } from './CinematicStage.js';
import { IPhoneMockup, PremiumCard, motionEase } from '../PremiumVisuals.js';
import { VideoDesignTokens as design } from '../design-system.js';

type AppShot = Extract<TimedShot, { kind: 'device' }>;
const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const;

function PhoneStates({ shot, current, reveal }: { shot: AppShot; current: number; reveal: number }) {
  const state = shot.actors[current];
  const mode = shot.screenContent;
  const label = shot.appName ?? ({ messages: 'Messages', feed: 'Feed', checkout: 'Checkout',
    status: 'Status', document: 'Document' } as const)[mode ?? 'status'];
  const title = mode === 'messages' ? 'Chats' : label;
  const color = mode === 'messages' ? '#95efca' : mode === 'checkout' ? '#f4cbb1' : '#c9dbff';
  return <div style={{ position: 'absolute', inset: 0, background: design.colors.background, color: design.colors.ink, padding: '84px 22px 54px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '4px 8px 24px', borderBottom: '1px solid #3b4852' }}>
      <div style={{ fontSize: 46, fontWeight: 760 }}>{title}</div>
      {mode === 'messages' && shot.appName && <div style={{ fontSize: 22, color }}>{shot.appName}</div>}
    </div>
    {mode === 'feed' && <div aria-hidden style={{ marginTop: 24, height: 240, borderRadius: 18, background: 'linear-gradient(130deg, #254261, #111b28 68%)', display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 105, aspectRatio: 1, borderRadius: 16, border: '2px solid #91b1d5', display: 'grid', placeItems: 'center' }}><div style={{ border: '2px solid #91b1d5', width: 51, aspectRatio: 1, borderRadius: '50%' }} /></div>
    </div>}
    {state && <div style={{ marginTop: 24, borderRadius: 18, padding: '23px 20px', background: '#1c2b34', borderLeft: `4px solid ${color}`,
      opacity: 0.7 + 0.3 * reveal, translate: `0 ${(1 - reveal) * 15}px`, overflowWrap: 'anywhere' }}>
      <div style={{ fontSize: 31, fontWeight: 670 }}>{state.label}</div>
      {state.value && <div style={{ fontSize: 50, fontWeight: 780, color, lineHeight: 1.1, marginTop: 10 }}>{state.value}</div>}
    </div>}
    {(mode === 'messages' || mode === 'checkout') && shot.actors.slice(0, current).reverse().map((actor, index) => <div key={`${actor.entity}-${index}`}
      style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '22px 5px', borderBottom: '1px solid #263b44' }}>
      <div aria-hidden style={{ width: 52, height: 52, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#253c49', color, fontSize: 24 }}>{mode === 'messages' ? Array.from(actor.label)[0] : '•'}</div>
      <div style={{ fontSize: 27, lineHeight: 1.1, overflowWrap: 'anywhere' }}>{actor.label}{actor.value && <div style={{ color: '#aab9c8', fontSize: 20, marginTop: 7 }}>{actor.value}</div>}</div>
    </div>)}
  </div>;
}

export function AppScreen({ shot }: { shot: AppShot }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opener = shot.openFrame ?? 0;
  const open = interpolate(frame, [opener, opener + design.motion.enter * fps], [0, 1], motionEase);
  const tap = interpolate(frame, [opener - 0.22 * fps, opener, opener + 0.22 * fps], [0, 1, 0], ease);
  const current = shot.reveals.reduce((latest, cue, index) => cue <= frame ? index : latest, -1);
  const state = shot.actors[current];
  const stateFrame = shot.reveals[current] ?? opener;
  const stateReveal = interpolate(frame, [stateFrame, stateFrame + 0.24 * fps], [0, 1], ease);
  const appName = shot.appName ?? shot.actors[0]?.label ?? '';
  const accent = design.colors.cyan;
  const lightCheckout = shot.screenContent === 'checkout' && Boolean(shot.screenActions) && !shot.asset && !shot.clip;
  const media = { width: '100%', height: '100%', objectFit: 'contain' as const, display: 'block' };
  const interaction = shot.interactionFrame === undefined ? 0 : interpolate(frame,
    [shot.interactionFrame, shot.interactionFrame + 0.22 * fps, shot.interactionFrame + 0.7 * fps, shot.interactionFrame + 1.1 * fps],
    [0, 1, 1, 0], ease);

  return <AbsoluteFill style={{ overflow: 'hidden' }}>
    <IPhoneMockup screen={lightCheckout && open > 0.5 ? 'light' : 'dark'} style={{ scale: 0.982 + open * 0.018 }}>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 22,
          background: design.colors.background, opacity: 1 - open }}>
          <div style={{ position: 'relative', display: 'grid', placeItems: 'center', width: 142, height: 142, borderRadius: 36,
            background: design.colors.elevated, border: `1px solid ${design.colors.border}`, scale: 1 - tap * 0.09 }}>
            {findBrandLogo(shot.appName) ? <BrandMark brand={shot.appName} size={92} />
              : <span style={{ fontSize: 65, fontWeight: 760, color: design.colors.ink }}>{Array.from(appName)[0]?.toLocaleUpperCase()}</span>}
            <div style={{ position: 'absolute', inset: -tap * 30, borderRadius: 47, border: '3px solid white', opacity: tap }} />
          </div>
          <div style={{ fontSize: 35, fontWeight: 650, color: '#e7f0f0' }}>{appName}</div>
        </div>
        {open > 0 && <div style={{ position: 'absolute', inset: 0, background: lightCheckout ? '#f4f6f8' : design.colors.background,
          opacity: open, translate: `0 ${(1 - open) * 22}px` }}>
          {shot.screenActions && !shot.asset && !shot.clip ? (
            <div style={{ position: 'absolute', inset: '88px 12px 70px', overflow: 'hidden' }}>
              <div style={{ padding: '10px 18px', color: lightCheckout ? design.colors.background : design.colors.ink, fontSize: design.typography.node, fontWeight: 740,
                display: 'flex', alignItems: 'center', gap: 12, overflowWrap: 'anywhere' }}>
                <BrandMark brand={shot.appName} size={35} />{appName}
              </div>
              <ScreenActivity shot={shot} compact />
            </div>
          ) : shot.screenContent && !shot.asset && !shot.clip ? <PhoneStates shot={shot} current={current} reveal={stateReveal} /> : <div style={{ position: 'absolute', inset: '84px 24px 96px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {shot.clip ? <Sequence from={opener} layout="none">
              <OffthreadVideo muted src={staticFile(shot.clip.asset)} style={media}
                playbackRate={Math.min(1, Math.max(1, shot.clip.seconds * fps - 1) / Math.max(1, shot.duration - opener))} />
            </Sequence> : shot.asset ? <Img src={staticFile(shot.asset)} style={media} /> : <>
              <div style={{ fontSize: 30, letterSpacing: 2, color: '#c3d5d1', marginBottom: 22 }}>{appName.toLocaleUpperCase()}</div>
              <div style={{ background: '#1d373b', borderRadius: 29, padding: 26, minHeight: 390, boxSizing: 'border-box',
                display: 'flex', flexDirection: 'column', justifyContent: 'end', gap: 19, opacity: 0.67 + stateReveal * 0.33 }}>
                <div style={{ height: 4, width: 110, background: accent, borderRadius: 4, marginBottom: 40 }} />
                <div style={{ fontSize: 40, fontWeight: 720, lineHeight: 1.08, overflowWrap: 'anywhere' }}>{state?.label ?? appName}</div>
                {state?.value && <div style={{ fontSize: 55, fontWeight: 820, lineHeight: 1.05, color: accent, overflowWrap: 'anywhere' }}>{state.value}</div>}
              </div>
              <div style={{ color: '#b2c7c1', fontSize: 20, marginTop: 30 }}>Illustrated screen</div>
            </>}
          </div>}
          {interaction > 0 && <div aria-hidden style={{ position: 'absolute', left: '50%', top: '47%',
            translate: '-50% -50%', fontSize: 145, color: '#ff6788', textShadow: '0 8px 45px #6b123d95',
            opacity: interaction, scale: 0.65 + interaction * 0.35 }}>♥</div>}
        </div>}
    </IPhoneMockup>
    {(shot.asset || shot.clip) && state?.value && open > 0.9 && <PremiumCard style={{ position: 'absolute', left: 179, right: 181, top: 1230,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, padding: '15px 24px', borderRadius: 26,
      color: accent, opacity: stateReveal }}>
      <span style={{ fontSize: 26, fontWeight: 650 }}>{state.label}</span>
      <span style={{ fontSize: 43, fontWeight: 830 }}>{state.value}</span>
    </PremiumCard>}
  </AbsoluteFill>;
}
