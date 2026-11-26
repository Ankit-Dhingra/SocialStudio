import React, { useEffect, type CSSProperties, type ReactNode } from 'react';
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame, useDelayRender, useVideoConfig } from 'remotion';
import { VideoDesignTokens as design } from './design-system.js';

const { colors, effects, radius, spacing } = design;
export const motionEase = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.22, 0.61, 0.36, 1) } as const;

let loadedFonts: Promise<unknown> | undefined;
export function EditorialFonts() {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  useEffect(() => {
    const handle = delayRender('Loading bundled editorial fonts');
    loadedFonts ??= Promise.all([
      new FontFace('BTS Inter', `url("${staticFile('fonts/Inter.ttf')}")`, { weight: '100 900' }).load(),
      new FontFace('BTS JetBrains Mono', `url("${staticFile('fonts/JetBrainsMono.ttf')}")`, { weight: '100 800' }).load(),
    ]).then(fonts => fonts.forEach(font => (document.fonts as FontFaceSet & Set<FontFace>).add(font)));
    void loadedFonts.then(() => continueRender(handle), cancelRender);
    return () => continueRender(handle);
  }, [delayRender, continueRender, cancelRender]);
  return null;
}

export function PremiumGridBackground() {
  return <AbsoluteFill aria-hidden style={{
    pointerEvents: 'none', backgroundColor: colors.canvas,
    backgroundImage: `radial-gradient(ellipse at 50% 38%, transparent 16%, ${colors.canvas}ce 91%), linear-gradient(${colors.grid} 1px, transparent 1px), linear-gradient(90deg, ${colors.grid} 1px, transparent 1px), radial-gradient(ellipse at 24% 29%, ${colors.cyan}17, transparent 40%), radial-gradient(ellipse at 76% 53%, ${colors.purple}19, transparent 39%), radial-gradient(ellipse at 50% 42%, ${colors.background}, transparent 68%)`,
    backgroundSize: 'auto, 56px 56px, 56px 56px, auto, auto, auto',
    backgroundPosition: 'center',
  }} />;
}

export type PanelState = 'default' | 'active' | 'processing' | 'success' | 'warning' | 'error';
export const panelAccents: Record<PanelState, string> = {
  default: colors.border, active: colors.cyan, processing: colors.purple, success: colors.success,
  warning: colors.warning, error: colors.error,
};

export function panelStyle(state: PanelState = 'default', emphasized = state === 'active'): CSSProperties {
  const accent = panelAccents[state];
  return { boxSizing: 'border-box', background: colors.surface, borderRadius: radius.card,
    border: `1.5px solid ${state === 'default' ? accent : `${accent}${emphasized ? 'c9' : '88'}`}`,
    padding: spacing.cardPadding, boxShadow: emphasized && state !== 'default'
      ? `${effects.panelShadow}, ${effects.focusGlow} ${accent}22` : effects.panelShadow };
}

export function PremiumCard({ children, style, state, emphasized }: {
  children: ReactNode; style?: CSSProperties; state?: PanelState; emphasized?: boolean;
}) {
  return <div style={{ ...panelStyle(state, emphasized), ...style }}>{children}</div>;
}

export function IPhoneMockup({ children, width = 542, top = 212, left, screen = 'dark', reveal = true, style }: {
  children: ReactNode; width?: number; top?: number; left?: number;
  screen?: 'light' | 'dark'; reveal?: boolean; style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = reveal ? interpolate(frame, [0, fps * design.motion.enter], [0, 1], motionEase) : 1;
  const chrome = screen === 'light' ? '#222830' : colors.ink;
  return <div style={{ position: 'absolute', width, height: Math.round(width * 2.045),
    left: left ?? (1020 - width) / 2, top, borderRadius: width * 0.105, padding: Math.round(width * 0.016), boxSizing: 'border-box',
    background: 'linear-gradient(118deg,#444950 0%,#747980 3%,#24272d 12%,#171a20 77%,#454a52 93%,#292d35 100%)',
    border: '1px solid #555960', boxShadow: '0 35px 65px #0009, inset 0 0 0 1px #b7c5d040',
    opacity: 0.78 + 0.22 * progress, translate: `0 ${(1 - progress) * 18}px`, scale: 0.985 + progress * 0.015, ...style }}>
    <div aria-hidden style={{ position: 'absolute', left: -3, top: '23%', width: 3, height: '7%', borderRadius: '3px 0 0 3px', background: '#41454c' }} />
    <div aria-hidden style={{ position: 'absolute', right: -3, top: '26%', width: 3, height: '9%', borderRadius: '0 3px 3px 0', background: '#41454c' }} />
    <div style={{ position: 'absolute', inset: Math.round(width * 0.016), borderRadius: width * 0.09,
      overflow: 'hidden', isolation: 'isolate', background: screen === 'light' ? '#f4f6f8' : colors.background,
      border: `${Math.max(4, Math.round(width * 0.011))}px solid ${colors.canvas}` }}>
      {children}
      <div aria-hidden style={{ position: 'absolute', zIndex: 3, pointerEvents: 'none', top: '2%', left: '37%', width: '26%', height: '2.55%',
        background: '#020304', borderRadius: 30, display: 'flex', justifyContent: 'end', alignItems: 'center', paddingRight: '2%' }}>
        <span style={{ width: '9%', aspectRatio: '1', borderRadius: '50%', background: '#19232d', boxShadow: 'inset 0 0 0 1px #232a36' }} />
      </div>
      <div aria-hidden style={{ position: 'absolute', pointerEvents: 'none', zIndex: 3, top: '2.4%', left: '9%', right: '9%',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: chrome, fontSize: Math.round(width * 0.033), fontWeight: 650 }}>
        <span>9:41</span>
        <span style={{ display: 'inline-block', width: width * 0.045, height: width * 0.018, padding: 2,
          borderRadius: 4, border: '1px solid currentColor' }}>
          <span style={{ display: 'block', width: '83%', height: '100%', borderRadius: 2, background: 'currentColor' }} />
        </span>
      </div>
      <div aria-hidden style={{ position: 'absolute', zIndex: 3, pointerEvents: 'none', left: '36%', width: '28%',
        bottom: '1.1%', height: 5, borderRadius: 4, background: chrome, opacity: 0.65 }} />
    </div>
  </div>;
}
