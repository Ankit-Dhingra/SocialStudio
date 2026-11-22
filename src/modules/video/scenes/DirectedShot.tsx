import React from 'react';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimedShot } from '../visual-story.js';

const canvas = '#080a0d';
const ivory = '#f5f1e8';
const accents = ['#8bdcd0', '#f4bd82', '#a9bcff', '#f596aa', '#bfd783'];
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const;
type Group = Extract<TimedShot, { actors: unknown }>;

function entityColor(entity: string): string {
  const hash = [...entity].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 0);
  return accents[hash % accents.length];
}

function ActionGraph({ shot }: { shot: Extract<Group, { kind: 'state' | 'flow' }> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const points = shot.actors.map((actor, index) => {
    // In a state shot, an entity with multiple incoming actions is the common resource.
    const shared = shot.transfers.find(transfer => shot.transfers.filter(link => link.target === transfer.target).length > 1)?.target;
    if (shot.kind === 'state' && shared) {
      if (actor.entity === shared) return { x: 640, y: 305 };
      const position = shot.actors.filter(a => a.entity !== shared).findIndex(a => a.entity === actor.entity);
      return { x: 192, y: 126 + position * 166 };
    }
    return { x: index % 2 ? 620 : 200, y: 148 + index * (420 / shot.actors.length) };
  });
  return <div style={{ position: 'absolute', left: 84, top: 585, width: 848, height: 585 }}>
    <svg width="848" height="585" viewBox="0 0 848 585" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      {shot.transfers.map(({ source, target }, index) => {
        const from = points[shot.actors.findIndex(a => a.entity === source)];
        const to = points[shot.actors.findIndex(a => a.entity === target)];
        const start = shot.movements[index];
        const progress = interpolate(frame, [start, start + fps * 0.64], [0, 1], clamp);
        const color = entityColor(source);
        const x = from.x + (to.x - from.x) * progress;
        const y = from.y + (to.y - from.y) * progress;
        return <g key={index}>
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#35424d" strokeWidth="4" strokeDasharray="7 11" />
          {frame >= start && <line x1={from.x} y1={from.y} x2={x} y2={y} stroke={color} strokeWidth="6" />}
          {frame >= start && progress < 1 && <circle cx={x} cy={y} r="13" fill={color} stroke="#f8fafb" strokeWidth="4" />}
        </g>;
      })}
    </svg>
    {shot.actors.map((actor, index) => {
      const point = points[index];
      const cue = shot.reveals[index];
      const revealed = frame >= cue;
      const color = actor.tone === 'success' && revealed ? '#a3ebbf'
        : actor.tone === 'warning' && revealed ? '#ff9b9b' : entityColor(actor.entity);
      return <div key={actor.entity} style={{
        position: 'absolute', left: point.x, top: point.y, width: 295, minHeight: 89,
        transform: 'translate(-50%, -50%)', borderRadius: 24, border: `2px solid ${color}`,
        background: 'linear-gradient(142deg, #25303b, #121820)', boxShadow: `0 15px 60px #0009, inset 0 0 38px ${color}18`,
        padding: '20px 16px', textAlign: 'center', boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 34, fontWeight: 750, overflowWrap: 'anywhere' }}>{actor.label}</div>
        {actor.value && <div style={{
          fontSize: 30, lineHeight: 1.15, color, marginTop: 8, overflowWrap: 'anywhere',
          opacity: interpolate(frame, [cue - 1, cue + fps * 0.2], [0, 1], clamp) * Number(revealed),
        }}>{actor.value}</div>}
      </div>;
    })}
  </div>;
}

function Compare({ shot }: { shot: Extract<Group, { kind: 'comparison' }> }) {
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
  const angle = interpolate(frame, [0, fps * 1.2], [-21, -9], clamp);
  const color = display ? entityColor(display.entity) : '#8bdcd0';
  return <div style={{
    position: 'absolute', left: 327, top: 520, width: 362, height: 650, boxSizing: 'border-box',
    padding: 24, borderRadius: 57, border: '5px solid #786f73',
    transform: `perspective(1200px) rotateY(${angle}deg) rotateZ(-6deg)`,
    background: 'linear-gradient(148deg, #242a35, #101218)',
    boxShadow: `17px 10px 0 #383740, 30px 35px 90px #000a, inset 0 0 45px ${color}27`,
  }}>
    <div style={{ width: 75, height: 16, borderRadius: 12, margin: '7px auto', background: '#101117' }} />
    <div style={{ position: 'absolute', top: '43%', left: 30, right: 30, lineHeight: 1.03, overflowWrap: 'anywhere' }}>
      {display && <><div style={{ fontSize: 33, marginBottom: 20, color: '#c7ced5' }}>{display.label}</div>
        <div style={{ fontSize: (display.value?.length ?? 0) > 10 ? 44 : 68, fontWeight: 780, color }}>{display.value}</div></>}
    </div>
  </div>;
}

function SceneImage({ shot }: { shot: Extract<TimedShot, { kind: 'image' }> }) {
  const frame = useCurrentFrame();
  if (!shot.asset) throw new Error(`Shot ${shot.id} is missing required artwork.`);
  return <>
    <Img src={staticFile(shot.asset)} style={{
      width: '100%', height: '100%', objectFit: 'cover', transformOrigin: '48% 54%',
      scale: interpolate(frame, [0, shot.duration], [1, 1.09], clamp),
    }} />
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #07090dec, #07090d64 23%, transparent 47%, #07090de8 70%, #07090d 83%)' }} />
  </>;
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

export function DirectedShot({ shot }: { shot: TimedShot }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const focus = (shot.kind === 'focus' && !shot.focus) || shot.kind === 'cta';
  return <AbsoluteFill style={{
    background: 'radial-gradient(ellipse at 48% 50%, #17212b 0%, #0c1016 43%, #080a0d 79%)',
    color: ivory, fontFamily: 'Segoe UI, Nirmala UI, sans-serif', overflow: 'hidden',
  }}>
    {shot.kind === 'image' && <SceneImage shot={shot} />}
    {(shot.kind === 'state' || shot.kind === 'flow') && <ActionGraph shot={shot} />}
    {shot.kind === 'comparison' && <Compare shot={shot} />}
    {shot.kind === 'device' && <Device shot={shot} />}
    {shot.focus && <NarrationFocus focus={shot.focus} duration={shot.duration} />}
    {shot.kind === 'code' && frame >= shot.reveals[0] && <pre style={{
      position: 'absolute', left: 84, top: 579, width: 848, boxSizing: 'border-box',
      padding: '40px 43px', borderRadius: 30, background: '#101822', border: '2px solid #344653',
      color: '#a8e9dc', fontSize: shot.code.length > 96 ? 31 : 44, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
    }}>{shot.code}</pre>}
    <div style={{
      position: 'absolute', top: focus ? 535 : 229, left: 84, width: 848,
      fontSize: focus ? 100 : 76, lineHeight: 1.04, fontWeight: 790, letterSpacing: -2.8,
      overflowWrap: 'anywhere', textWrap: 'balance', textShadow: `0 12px 45px ${canvas}`,
      translate: `0 ${interpolate(frame, [0, fps * 0.37], [21, 0], clamp)}px`,
    }}>{shot.headline}</div>
    {shot.takeaway && frame >= shot.takeawayFrame && <div style={{
      position: 'absolute', top: 1235, left: 84, width: 848, color: '#ffe0ba', fontSize: 36,
      lineHeight: 1.13, fontWeight: 660, overflowWrap: 'anywhere',
    }}>{shot.takeaway}</div>}
  </AbsoluteFill>;
}
