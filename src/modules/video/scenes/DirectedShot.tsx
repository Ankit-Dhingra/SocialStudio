import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimedShot } from '../visual-story.js';
import type { MotionStage } from '../motion-stage.js';
import { CinematicStage } from './CinematicStage.js';
import { StoryFootage, StoryHandoff, type StoryHandoffShot } from './StoryFootage.js';
import { LocalFilm } from './LocalFilm.js';
import { CheckoutPilotShot } from './CheckoutFilm.js';
import { PaymentGuide } from './PaymentGuide.js';

const canvas = '#080a0d';
const ivory = '#f5f1e8';
const accents = ['#8bdcd0', '#f4bd82', '#a9bcff', '#f596aa', '#bfd783'];
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const;

function entityColor(entity: string): string {
  const hash = [...entity].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0);
  return accents[hash % accents.length];
}

function Compare({ shot }: { shot: Extract<TimedShot, { kind: 'comparison' }> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const figures = shot.actors.map(actor => actor.value?.replace(/[₹$€,£%\s]/g, '') ?? '');
  const canChart = figures.every(value => /^\d+(?:\.\d+)?$/.test(value));
  const maximum = Math.max(1, ...figures.map(Number));
  return <div style={{ position: 'absolute', left: 84, right: 148, top: 600, display: 'grid', gap: 41 }}>
    {shot.actors.map((actor, index) => {
      const cue = shot.reveals[index];
      const progress = frame < cue ? 0 : interpolate(frame, [cue, cue + fps * 0.55], [0, 1], clamp);
      const color = entityColor(actor.entity);
      return <div key={actor.entity}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 42, fontSize: 46, lineHeight: 1.05, fontWeight: 720 }}>
          <span style={{ overflowWrap: 'anywhere' }}>{actor.label}</span><span style={{ color, opacity: progress }}>{actor.value}</span>
        </div>
        {canChart && <div style={{ height: 13, marginTop: 21, background: '#26313a', borderRadius: 20 }}>
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
  const angle = interpolate(frame, [0, fps * 1.2], [-24, 0], clamp);
  const color = display ? entityColor(display.entity) : '#8bdcd0';
  const reveal = shot.reveals[visibleIndex] ?? 0;
  const entered = interpolate(frame, [reveal, reveal + fps * 0.40], [0, 1], clamp);
  const previous = shot.actors[visibleIndex - 1];
  const scanStart = shot.scanFrame ?? Number.POSITIVE_INFINITY;
  const nextScreen = shot.reveals.find(at => at > scanStart) ?? shot.duration;
  const scanning = frame >= scanStart && frame < nextScreen;
  const scanLine = scanning ? interpolate(frame, [scanStart, scanStart + fps * 0.9], [0, 1], clamp) : 0;
  const longestValue = Math.max(1, ...(display?.value ?? '').split(/\s+/u).map(word => Array.from(word).length));
  const valueFontSize = Math.max(28, Math.min(72, Math.floor(285 / (longestValue * 0.68))));
  return <div style={{
    position: 'absolute', left: 302, top: 421, width: 420, height: 779, boxSizing: 'border-box',
    padding: 24, borderRadius: 57, border: '5px solid #7e829a',
    transform: `perspective(1200px) rotateY(${angle}deg) rotateZ(${angle / 5}deg)`,
    background: `linear-gradient(150deg, ${color}43, #101218 66%)`,
    boxShadow: `15px 8px 0 #303244, 26px 45px 90px #000a, 0 0 100px ${color}32`,
  }}>
    <div style={{ width: 75, height: 16, borderRadius: 12, margin: '7px auto', background: '#101117' }} />
    {scanning ? <div style={{
      position: 'absolute', top: 190, left: 54, right: 54, padding: '21px 19px 25px',
      borderRadius: 26, background: '#141827', border: `2px solid ${color}85`, textAlign: 'center',
    }}>
      <div style={{ fontSize: 27, fontWeight: 730, color: '#e8e8fa', marginBottom: 18 }}>{display?.label || 'QR'}</div>
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, aspectRatio: '1' }}>
        <Img src={staticFile('visuals/demo-qr.png')} alt="" style={{ display: 'block', width: '100%', opacity: 0.87 }} />
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4, top: `${scanLine * 98}%`,
          background: '#91ffe1', boxShadow: '0 0 17px 4px #44f5bd',
        }} />
      </div>
    </div> : display && <div style={{
      position: 'absolute', top: 211, left: 28, right: 28, padding: '32px 24px', minHeight: 280,
      borderRadius: 26, border: `2px solid ${color}78`, background: '#191e30',
      lineHeight: 1.06, overflowWrap: 'anywhere', opacity: 0.60 + entered * 0.40, translate: `0 ${(1 - entered) * 24}px`,
    }}>
      <div style={{ width: 58, height: 6, borderRadius: 5, marginBottom: 46, background: color }} />
      <div style={{ fontSize: 36, marginBottom: 20, color: '#f0eef9', fontWeight: 740 }}>{display.label}</div>
      <div style={{ fontSize: valueFontSize, fontWeight: 820, color, fontVariantNumeric: 'tabular-nums' }}>{display.value}</div>
      {previous?.value && <div style={{ fontSize: 25, marginTop: 24, color: '#c5cada' }}>{previous.label} · {previous.value}</div>}
    </div>}
  </div>;
}

function SceneImage({ asset, duration, mode }: { asset: string; duration: number; mode: 'plate' | 'handoff' | 'callback' }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = mode === 'handoff' ? interpolate(frame, [0, fps * 1.22], [0.84, 0], clamp)
    : mode === 'callback' ? interpolate(frame, [0, fps * 0.38], [0.20, 0.66], clamp) : 1;
  return <AbsoluteFill style={{ opacity }}>
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
    position: 'absolute', top: 556, left: 84, width: 846, boxSizing: 'border-box',
    border: '2px solid #646286', borderRadius: 26, background: 'linear-gradient(140deg, #272641, #111624)',
    padding: '28px 32px 40px', boxShadow: '0 28px 80px #0009, 0 0 105px #8a70de2d',
    opacity: entered, translate: `0 ${(1 - entered) * 26}px`,
  }}>
    <div style={{ display: 'flex', gap: 10, marginBottom: 31, borderBottom: '1px solid #555577', paddingBottom: 22 }}>
      {['#f0a0ad', '#edc587', '#93d8c8'].map(color => <span key={color} style={{ width: 11, height: 11, borderRadius: '50%', background: color }} />)}
    </div>
    <pre style={{
      margin: 0, fontSize: shot.code.length > 96 ? 31 : 42, lineHeight: 1.6,
      whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'Consolas, monospace',
    }}>{shot.code.split(/(\s+)/u).map((part, i) => {
      if (/^\s+$/u.test(part)) return part;
      index += 1;
      return <span key={i} style={{
        color: index === active ? '#eefbf9' : index > active && active >= 0 ? '#aaa6c7' : '#a8eedf',
        background: index === active ? '#2d555d' : undefined, borderRadius: 5,
      }}>{part}</span>;
    })}</pre>
  </div>;
}

function NarrationFocus({ focus, duration }: { focus: NonNullable<TimedShot['focus']>; duration: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const active = focus.beats.reduce((current, beat) => beat.from <= frame ? beat : current, focus.beats[0]);
  if (!active) return null;
  const highlightedWords = new Set(active.text.match(/[\p{L}\p{N}_]+/gu) ?? []);
  return <div style={{ position: 'absolute', top: 527, left: 84, width: 848 }}>
    {focus.code && <pre style={{
      margin: '0 0 40px', padding: '28px 32px', borderRadius: 24, border: '2px solid #344653',
      background: '#101822', fontSize: 34, lineHeight: 1.3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
    }}>{focus.code.split(/([\p{L}\p{N}_]+)/u).map((part, index) => <span key={index} style={{
      color: highlightedWords.has(part) ? '#a8e9dc' : '#a3abb6',
      background: highlightedWords.has(part) ? '#24514b' : undefined,
    }}>{part}</span>)}</pre>}
    <div style={{
      position: 'relative', padding: '26px 32px 34px', borderLeft: '4px solid #8bdcd0',
      background: 'linear-gradient(90deg, #1d342f, #131c26)', borderRadius: 18,
      fontSize: 50, lineHeight: 1.13, fontWeight: 690, overflowWrap: 'anywhere',
      opacity: interpolate(frame, [active.from, active.from + fps * 0.18], [0.45, 1], clamp),
      translate: `0 ${interpolate(frame, [active.from, active.from + fps * 0.24], [12, 0], clamp)}px`,
    }}>{active.text}</div>
    <div aria-hidden="true" style={{ height: 4, marginTop: 24, borderRadius: 3, background: '#263b40', overflow: 'hidden' }}>
      <div style={{ height: '100%', background: '#8bdcd0', width: `${interpolate(frame, [0, duration], [0, 100], clamp)}%` }} />
    </div>
  </div>;
}

export function DirectedShot({ shot, stage, artwork, handoff }: {
  shot: TimedShot; stage?: MotionStage; artwork?: string; handoff?: StoryHandoffShot;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const focus = (shot.kind === 'focus' && !shot.focus) || shot.kind === 'cta';
  const headlineSize = shot.kind === 'cta' && shot.headline.length > 80
    ? Math.max(54, 82 - (shot.headline.length - 80) / 3)
    : focus ? 83 : 67;
  if (shot.kind === 'image' && !shot.asset) throw new Error(`Shot ${shot.id} is missing required artwork.`);
  return <AbsoluteFill style={{
    background: 'radial-gradient(ellipse at 52% 42%, #222846 0%, #121827 43%, #080a12 79%)',
    color: ivory, fontFamily: 'Segoe UI, Nirmala UI, sans-serif', overflow: 'hidden',
  }}>
    {shot.kind === 'image' && (shot.camera || shot.clip
      ? <StoryFootage shot={shot} />
      : <SceneImage asset={shot.asset!} duration={shot.duration} mode="plate" />)}
    {shot.paymentGuide && <PaymentGuide shot={{ ...shot, paymentGuide: shot.paymentGuide }} />}
    {shot.kind === 'film' && !shot.paymentGuide && (shot.checkout
      ? <CheckoutPilotShot shot={{ ...shot, checkout: shot.checkout }} /> : <LocalFilm shot={shot} />)}
    {artwork && <SceneImage asset={artwork} duration={shot.duration} mode={shot.kind === 'cta' ? 'callback' : 'handoff'} />}
    {stage && <CinematicStage stage={stage} />}
    {shot.kind === 'comparison' && <Compare shot={shot} />}
    {shot.kind === 'device' && <Device shot={shot} />}
    {shot.focus && <NarrationFocus focus={shot.focus} duration={shot.duration} />}
    {shot.kind === 'code' && <CodeShot shot={shot} />}
    {shot.headline && shot.kind !== 'film' && !(shot.kind === 'image' && (shot.camera || shot.clip)) && <div style={{
      position: 'absolute', top: focus ? 535 : 226, left: 84, width: 848,
      fontSize: headlineSize, lineHeight: 1.04, fontWeight: 790, letterSpacing: -2.1,
      ...(shot.kind === 'cta' ? {
        boxSizing: 'border-box', padding: '35px 39px', borderRadius: 26, border: '2px solid #8b88c5',
        background: '#161829dd', boxShadow: '0 20px 75px #05070bba',
      } : {}),
      overflowWrap: 'anywhere', textWrap: 'balance', textShadow: `0 12px 45px ${canvas}`,
      translate: `0 ${interpolate(frame, [0, fps * 0.37], [21, 0], clamp)}px`,
    }}>{shot.headline}</div>}
    {shot.takeaway && frame >= shot.takeawayFrame && <div style={{
      position: 'absolute', top: 1235, left: 84, width: 848, color: '#ffe0ba', fontSize: 36,
      lineHeight: 1.13, fontWeight: 660, overflowWrap: 'anywhere',
    }}>{shot.takeaway}</div>}
    {handoff && <StoryHandoff previous={handoff} />}
  </AbsoluteFill>;
}
