import React from 'react';
import { CollectionScene } from './CollectionScene.js';
import { InteractiveConsoleScene } from './InteractiveConsoleScene.js';
import { QueueTimelineScene } from './QueueTimelineScene.js';
import { RequestFlowScene } from './RequestFlowScene.js';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimedShot } from '../visual-story.js';
import type { MotionStage } from '../motion-stage.js';
import { CinematicStage } from './CinematicStage.js';
import { SemanticOperationScene } from './SemanticOperationScene.js';
import { VectorScene } from './VectorScene.js';
import { conciseVisualLabel } from '../semantic-operation.js';
import { VideoDesignTokens as design } from '../design-system.js';
import { IPhoneMockup, panelStyle } from '../PremiumVisuals.js';
import { StoryFootage, StoryHandoff, type StoryHandoffShot } from './StoryFootage.js';
import { LocalFilm } from './LocalFilm.js';
import { CheckoutPilotShot } from './CheckoutFilm.js';
import { PaymentGuide } from './PaymentGuide.js';
import { AppScreen } from './AppScreen.js';
import { MessagingScreen } from './MessagingScreen.js';
import { BrandOutro } from './BrandOutro.js';
import { DesktopDemo } from './DesktopDemo.js';

const { colors, typography } = design;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const;


function Compare({ shot }: { shot: Extract<TimedShot, { kind: 'comparison' }> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const figures = shot.actors.map(actor => actor.value?.replace(/[₹$€,£%\s]/g, '') ?? '');
  const units = shot.actors.map(actor => actor.value?.replace(/[\d.,\s]/g, '') ?? '');
  const canChart = figures.every(value => /^\d+(?:\.\d+)?$/.test(value)) && units.every(unit => unit === units[0]);
  const maximum = Math.max(1, ...figures.map(Number));
  if (shot.chartStyle === 'trend') {
    const metrics = shot.actors.map(actor => Number(actor.value?.match(/-?\d+(?:\.\d+)?/)?.[0]));
    if (metrics.every(Number.isFinite)) {
      const minimum = Math.min(0, ...metrics);
      const spread = Math.max(1, Math.max(0, ...metrics) - minimum);
      const points = metrics.map((value, index) => ({
        x: 100 + index * (576 / (metrics.length - 1)), y: 416 - (value - minimum) / spread * 322,
      }));
      return <svg viewBox="0 0 780 550" style={{ position: 'absolute', left: 100, top: 575, width: 780 }}>
        <line x1="50" x2="730" y1={416 + minimum / spread * 322} y2={416 + minimum / spread * 322}
          stroke="#778194" strokeWidth="2" />
        {points.map((point, index) => {
          const cue = shot.reveals[index];
          if (frame < cue) return null;
          const previous = points[index - 1];
          const progress = interpolate(frame, [cue, cue + fps * 0.42], [0, 1], clamp);
          return <g key={shot.actors[index].entity} fontFamily="inherit" textAnchor="middle">
            {previous && <line x1={previous.x} y1={previous.y}
              x2={previous.x + (point.x - previous.x) * progress} y2={previous.y + (point.y - previous.y) * progress}
              stroke={colors.cyan} strokeWidth="4" strokeLinecap="round" />}
            <g opacity={progress} fill="currentColor">
              <circle cx={point.x} cy={point.y} r="7" fill={colors.cyan} />
              <text x={point.x} y={point.y - 18} fontSize="31" fontWeight="700">{shot.actors[index].value}</text>
              <text x={point.x} y="476" fontSize="25">{shot.actors[index].label}</text>
            </g>
          </g>;
        })}
      </svg>;
    }
  }
  return <div style={{ position: 'absolute', left: 84, right: 148, top: 600, display: 'grid', gap: 41 }}>
    {shot.actors.map((actor, index) => {
      const cue = shot.reveals[index];
      const progress = frame < cue ? 0 : interpolate(frame, [cue, cue + fps * 0.55], [0, 1], clamp);
      const color = index === 0 ? colors.cyan : colors.ink;
      return <div key={actor.entity}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 42, fontSize: 46, lineHeight: 1.05, fontWeight: 720, opacity: progress }}>
          <span style={{ overflowWrap: 'anywhere' }}>{actor.label}</span><span style={{ color }}>{actor.value}</span>
        </div>
        {canChart && <div style={{ height: 10, marginTop: 21, background: colors.surface, borderRadius: 20 }}>
          <div style={{ width: `${Number(figures[index]) / maximum * progress * 100}%`, height: '100%', background: color, borderRadius: 20 }} />
        </div>}
      </div>;
    })}
  </div>;
}

function Device({ shot }: { shot: Extract<TimedShot, { kind: 'device' }> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const visibleIndex = shot.reveals.reduce((latest, reveal, index) => reveal <= frame ? index : latest, -1);
  const display = shot.actors[visibleIndex];
  const color = colors.cyan;
  const reveal = shot.reveals[visibleIndex] ?? 0;
  const entered = interpolate(frame, [reveal, reveal + fps * 0.40], [0, 1], clamp);
  const previous = shot.actors[visibleIndex - 1];
  const scanStart = shot.scanFrame ?? Number.POSITIVE_INFINITY;
  const nextScreen = shot.reveals.find(at => at > scanStart) ?? shot.duration;
  const scanning = frame >= scanStart && frame < nextScreen;
  const scanLine = scanning ? interpolate(frame, [scanStart, scanStart + fps * 0.9], [0, 1], clamp) : 0;
  const longestValue = Math.max(1, ...(display?.value ?? '').split(/\s+/u).map(word => Array.from(word).length));
  const valueFontSize = Math.max(28, Math.min(72, Math.floor(285 / (longestValue * 0.68))));
  return <IPhoneMockup width={444} top={390}>
    {scanning ? <div style={{
      position: 'absolute', top: 190, left: 54, right: 54, padding: '21px 19px 25px',
      ...panelStyle('active'), textAlign: 'center',
    }}>
      <div style={{ fontSize: 27, fontWeight: 730, color: '#e8e8fa', marginBottom: 18 }}>{display?.label || 'QR'}</div>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, aspectRatio: '1' }}>
        <Img src={staticFile('visuals/demo-qr.png')} alt="" style={{ display: 'block', width: '100%', opacity: 0.87 }} />
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4, top: `${scanLine * 98}%`,
          background: colors.cyan, boxShadow: `0 0 12px ${colors.cyan}40`,
        }} />
      </div>
    </div> : display && <div style={{
      position: 'absolute', top: 211, left: 28, right: 28, padding: '32px 24px', minHeight: 280,
      ...panelStyle(),
      lineHeight: 1.06, overflowWrap: 'anywhere', opacity: 0.60 + entered * 0.40, translate: `0 ${(1 - entered) * 24}px`,
    }}>
      <div style={{ width: 58, height: 6, borderRadius: 5, marginBottom: 46, background: color }} />
      <div style={{ fontSize: 36, marginBottom: 20, color: '#f0eef9', fontWeight: 740 }}>{display.label}</div>
      <div style={{ fontSize: valueFontSize, fontWeight: 820, color, fontVariantNumeric: 'tabular-nums' }}>{display.value}</div>
      {previous?.value && <div style={{ fontSize: 25, marginTop: 24, color: '#c5cada' }}>{previous.label} · {previous.value}</div>}
    </div>}
  </IPhoneMockup>;
}

function SceneImage({ asset, duration }: { asset: string; duration: number }) {
  const frame = useCurrentFrame();
  return <AbsoluteFill>
    <Img src={staticFile(asset)} style={{
      width: '100%', height: '100%', objectFit: 'cover', transformOrigin: '48% 54%',
      scale: interpolate(frame, [0, duration], [1.02, 1.12], clamp),
      translate: `0 ${interpolate(frame, [0, duration], [0, -20], clamp)}px`,
    }} />
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #080911bd, #0809116b 20%, transparent 50%, #080911bd 73%, #080911 96%)' }} />
  </AbsoluteFill>;
}

function CodeShot({ shot }: { shot: Extract<TimedShot, { kind: 'code' }> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = shot.reveals[0];
  const entered = interpolate(frame, [reveal, reveal + fps * 0.45], [0, 1], clamp);
  const codeFrames = shot.codeFrames ?? [];
  const active = codeFrames.reduce((current, at, i) => at <= frame ? i : current, -1);
  let index = -1;
  return <div style={{
    ...panelStyle(),
    position: 'absolute', top: 556, left: 84, width: 846, boxSizing: 'border-box',
    padding: '28px 32px 40px',
    opacity: entered, translate: `0 ${(1 - entered) * 26}px`,
  }}>
    <div style={{ display: 'flex', gap: 10, marginBottom: 31, borderBottom: `1px solid ${colors.border}`, paddingBottom: 22 }}>
      {[0, 1, 2].map(index => <span key={index} style={{ width: 11, height: 11, borderRadius: '50%', background: colors.muted }} />)}
    </div>
    <pre style={{
      margin: 0, fontSize: shot.code.length > 96 ? typography.code : 38, lineHeight: 1.5,
      whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: typography.fontFamilyMono,
    }}>{shot.code.split(/(\s+)/u).map((part, i) => {
      if (/^\s+$/u.test(part)) return part;
      index += 1;
      return <span key={i} style={{
        color: index === active ? colors.cyan : colors.secondary,
        background: index === active ? `${colors.cyan}18` : undefined, borderRadius: 5,
      }}>{part}</span>;
    })}</pre>
  </div>;
}

function NarrationFocus({ focus, duration }: { focus: NonNullable<TimedShot['focus']>; duration: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beats = focus.beats.filter(beat => conciseVisualLabel(beat.text));
  const active = beats.reduce((current, beat) => beat.from <= frame ? beat : current, beats[0]);
  if (!active && !focus.code) return null;
  const highlightedWords = new Set(active?.text.match(/[\p{L}\p{N}_]+/gu) ?? []);
  return <div style={{ position: 'absolute', top: 527, left: 84, width: 848 }}>
    {focus.code && <pre style={{
      ...panelStyle(), margin: '0 0 40px', padding: '28px 32px',
      fontSize: typography.code, fontFamily: typography.fontFamilyMono, lineHeight: 1.3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
    }}>{focus.code.split(/([\p{L}\p{N}_]+)/u).map((part, index) => <span key={index} style={{
      color: highlightedWords.has(part) ? colors.cyan : colors.secondary,
      background: highlightedWords.has(part) ? `${colors.cyan}18` : undefined,
    }}>{part}</span>)}</pre>}
    {active && <div style={{
      ...panelStyle(), position: 'relative', padding: '26px 32px 34px', borderLeft: `3px solid ${colors.cyan}`,
      fontSize: 50, lineHeight: 1.13, fontWeight: 690, overflowWrap: 'anywhere',
      opacity: interpolate(frame, [active.from, active.from + fps * 0.18], [0.45, 1], clamp),
      translate: `0 ${interpolate(frame, [active.from, active.from + fps * 0.24], [12, 0], clamp)}px`,
    }}>{active.text}</div>}
    <div aria-hidden="true" style={{ height: 4, marginTop: 24, borderRadius: 3, background: colors.surface, overflow: 'hidden' }}>
      <div style={{ height: '100%', background: colors.cyan, width: `${interpolate(frame, [0, duration], [0, 100], clamp)}%` }} />
    </div>
  </div>;
}

export function DirectedShot({ shot, stage, handoff }: {
  shot: TimedShot; stage?: MotionStage; handoff?: StoryHandoffShot;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const native = shot.nativeScene;
  if (native?.kind === 'flow' && !stage && native.steps.every(step => conciseVisualLabel(step.label))) {
    return <RequestFlowScene title={shot.headline} steps={native.steps} cueFrames={shot.reveals} />;
  }
  if (native?.kind === 'queue' && !stage && !shot.operation && native.steps.every(step => conciseVisualLabel(step.label))) {
    return <QueueTimelineScene title={shot.headline} items={native.steps.map(step => ({
      name: step.label, detail: step.description,
    }))} cueFrames={shot.reveals} narrationCued />;
  }
  if (native?.kind === 'collection') {
    return <CollectionScene title={shot.headline} items={native.items} result={native.result} revealFrame={native.from} />;
  }
  if (native?.kind === 'code') {
    return frame < native.from ? null
      : <InteractiveConsoleScene code={native.code} filename={native.filename ?? ''} terminalOutputs={[]}
        highlightLines={[]} explanationCallout="" onScreenText={shot.headline} />;
  }
  const focus = (shot.kind === 'focus' && !shot.focus) || shot.kind === 'cta';
  if (shot.kind === 'cta' && shot.premium) return <BrandOutro narration={shot.headline} />;
  const headlineSize = shot.kind === 'cta' && shot.headline.length > 80
    ? Math.max(54, 82 - (shot.headline.length - 80) / 3)
    : focus ? typography.title : 46;
  const headline = shot.kind === 'cta' || conciseVisualLabel(shot.headline) ? shot.headline : '';
  if (shot.kind === 'device' && shot.messaging && !shot.asset && !shot.clip) return <MessagingScreen shot={shot} />;
  if (shot.kind === 'image' && !shot.asset) throw new Error(`Shot ${shot.id} is missing required artwork.`);
  return <AbsoluteFill style={{
    color: colors.ink, fontFamily: typography.fontFamilySans, overflow: 'hidden',
  }}>
    {shot.kind === 'image' && (shot.camera || shot.clip
      ? <StoryFootage shot={shot} />
      : <SceneImage asset={shot.asset!} duration={shot.duration} />)}
    {shot.paymentGuide && <PaymentGuide shot={{ ...shot, paymentGuide: shot.paymentGuide }} />}
    {shot.kind === 'film' && !shot.paymentGuide && (shot.checkout
      ? <CheckoutPilotShot shot={{ ...shot, checkout: shot.checkout }} /> : <LocalFilm shot={shot} />)}
    {stage && !shot.paymentGuide && <CinematicStage stage={stage} />}
    {shot.operation && <SemanticOperationScene operation={shot.operation} />}
    {shot.vector && <VectorScene vector={shot.vector} />}
    {shot.kind === 'comparison' && <Compare shot={shot} />}
    {shot.kind === 'device' && !shot.paymentGuide && (shot.screenLayout === 'desktop' && !shot.asset && !shot.clip
      ? <DesktopDemo shot={shot} /> : (shot.appName || shot.screenContent) && shot.scanFrame === undefined ? <AppScreen shot={shot} /> : <Device shot={shot} />)}
    {shot.focus && !stage && !shot.paymentGuide && <NarrationFocus focus={shot.focus} duration={shot.duration} />}
    {shot.kind === 'code' && <CodeShot shot={shot} />}
    {headline && !shot.operation && (!shot.focus || stage) && !shot.paymentGuide && shot.kind !== 'film' && !(shot.kind === 'device' && (shot.screenLayout === 'desktop' || ((shot.appName || shot.screenContent) && shot.scanFrame === undefined))) && !(shot.kind === 'image' && (shot.camera || shot.clip)) && <div style={{
      position: 'absolute', top: focus ? 535 : 226, left: 84, width: 848,
      fontSize: headlineSize, lineHeight: 1.04, fontWeight: 790, letterSpacing: -2.1,
      ...(shot.kind === 'cta' ? {
        boxSizing: 'border-box', padding: '35px 39px', borderRadius: 26, border: '2px solid #8b88c5',
        background: colors.surface, boxShadow: design.effects.panelShadow,
      } : {}),
      overflowWrap: 'anywhere', textWrap: 'balance',
      translate: `0 ${interpolate(frame, [0, fps * 0.37], [21, 0], clamp)}px`,
    }}>{headline}</div>}
    {!shot.paymentGuide && shot.takeaway && frame >= shot.takeawayFrame && <div style={{
      position: 'absolute', top: 1235, left: 84, width: 848, color: '#ffe0ba', fontSize: 36,
      lineHeight: 1.13, fontWeight: 660, overflowWrap: 'anywhere',
    }}>{shot.takeaway}</div>}
    {handoff && <StoryHandoff previous={handoff} />}
  </AbsoluteFill>;
}
