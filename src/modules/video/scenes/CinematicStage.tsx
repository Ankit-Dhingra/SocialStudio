import React from 'react';
import { Easing, Img, getStaticFiles, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { MotionStage, StageNode } from '../motion-stage.js';

const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const;
const accents = ['#b0a6ff', '#82dacd', '#eeb68c', '#8db7ff', '#eea3c0'];
const slots = [
  { x: 182, y: 194 }, { x: 664, y: 194 }, { x: 182, y: 625 }, { x: 664, y: 625 }, { x: 423, y: 409 },
];
const glyphs: Record<StageNode['icon'], string> = {
  person: 'M16 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM7 27v-3a9 9 0 0 1 18 0v3',
  phone: 'M10 4h12a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm4 20h4',
  server: 'M5 5h22v9H5zm0 13h22v9H5zM9 9h2m-2 13h2m8-13h4m-4 13h4',
  database: 'M26 8c0 3-4.5 5-10 5S6 11 6 8m20 8c0 3-4.5 5-10 5S6 19 6 16M26 8v16c0 3-4.5 5-10 5S6 27 6 24V8c0-3 4.5-5 10-5S26 5 26 8Z',
  lock: 'M8 14h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2Zm2 0V9a6 6 0 0 1 12 0v5m-6 5v4',
  queue: 'M6 8h20M6 16h15M6 24h9M3 8h.1m-.1 8h.1m-.1 8h.1',
  map: 'm4 7 8-4 8 4 8-4v22l-8 4-8-4-8 4zm8-4v22m8-18v22',
  store: 'M5 14h22v13H5zM4 14l3-9h18l3 9M12 27v-8h8v8',
  package: 'm4 9 12-5 12 5v14l-12 5-12-5zm0 0 12 5 12-5M16 14v14M10 7l12 5v5',
  service: 'm16 3 11 6v14l-11 6-11-6V9zm-5 13 4 4 7-8',
};
const openLock = 'M8 14h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2Zm2 0V9a6 6 0 0 1 11-3m-5 13v4';
const brandKey = (label: string) => label.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');

export function BrandMark({ brand }: { brand?: string }) {
  const key = brand ? brandKey(brand) : '';
  const logo = key && getStaticFiles().find(file => {
    const name = /^visuals\/(.+)\.(?:svg|png|webp)$/i.exec(file.name);
    return name && brandKey(name[1]) === key;
  });
  return logo ? <Img src={logo.src} alt="" style={{ width: 52, height: 52, objectFit: 'contain' }} /> : null;
}

function colorFor(entity: string) {
  const index = Array.from(entity).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % accents.length, 0);
  return accents[index];
}

function Node({ node, start, active, hasFocus }: { node: StageNode; start: number; active: boolean; hasFocus: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = start + frame;
  const status = node.updates.reduce((state, update) => update.frame <= now ? update : state, node.previous);
  const entered = node.entrance < 0 ? 1 : interpolate(frame, [node.entrance, node.entrance + fps * 0.32], [0, 1], ease);
  const color = status?.tone === 'success' ? '#7ef1b7' : status?.tone === 'warning' ? '#ff8693' : colorFor(node.entity);
  const impact = status ? interpolate(now, [status.frame, status.frame + fps * 0.42], [1, 0], ease) : 0;
  const pulse = status?.effect === 'countdown' ? 0.72 + 0.24 * Math.sin((now - status.frame) / fps * 6) : 0;
  const timer = status?.effect === 'countdown' && status.until !== undefined && status.until > status.frame
    ? interpolate(now, [status.frame, status.until], [1, 0], ease) : 1;
  const point = slots[node.slot];
  const offline = status?.effect === 'offline';
  const stateChange = impact * (offline ? Math.sin((now - (status?.frame ?? 0)) * 2.2) * 8 : 0);
  const faded = node.context ? 0.50 : hasFocus && !active ? 0.62 : 1;
  return <div style={{
    position: 'absolute', left: point.x, top: point.y, width: 332, minHeight: 157,
    transform: `translate(calc(-50% + ${stateChange}px), calc(-50% + ${(1 - entered) * 22}px)) scale(${0.95 + entered * 0.05 + impact * 0.04})`,
    opacity: entered * faded, boxSizing: 'border-box', borderRadius: 24, padding: '20px 22px',
    display: 'flex', flexDirection: 'column', justifyContent: 'center',
    background: 'linear-gradient(155deg, #202736 0%, #111723 84%)',
    border: `2px solid ${color}${active ? 'b5' : '48'}`,
    boxShadow: `0 20px 42px #030407aa, 0 0 ${16 + impact * 40}px ${color}${active ? '37' : '12'}`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 17, flex: '0 0 auto' }}>
      <div style={{
        minWidth: 70, height: 70, display: 'grid', placeItems: 'center',
        position: 'relative', borderRadius: 16, background: `linear-gradient(150deg, ${color}2c, ${color}08)`,
        border: `1px solid ${color}56`,
      }}>
        <svg width="43" height="43" viewBox="0 0 32 32" fill="none" style={{ gridArea: '1 / 1', opacity: offline ? 0.45 : 1 }} aria-hidden>
          <path d={node.icon === 'lock' && status?.effect === 'expire' ? openLock : glyphs[node.icon]} stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {node.brand && <div style={{ gridArea: '1 / 1', display: 'grid', background: '#141925', borderRadius: 9, zIndex: 1 }}><BrandMark brand={node.brand} /></div>}
        {pulse > 0 && <svg width="84" height="84" viewBox="0 0 84 84" style={{ position: 'absolute', inset: -7, opacity: pulse }} aria-hidden>
          <rect x="2" y="2" width="80" height="80" rx="18" pathLength={100} fill="none" stroke={color}
            strokeWidth="3" strokeDasharray={`${timer * 100} 100`} />
        </svg>}
      </div>
      <div style={{ color: '#f1f2fa', fontSize: 32, fontWeight: 780, lineHeight: 1.02, overflowWrap: 'anywhere' }}>{node.label}</div>
    </div>
    {status && <div style={{
      color, fontSize: 28, fontWeight: 750, lineHeight: 1.04, marginTop: 15, padding: '8px 11px',
      borderRadius: 8, background: `${color}15`, overflowWrap: 'anywhere',
      opacity: 1 - impact * 0.24, translate: `0 ${impact * 5}px`,
    }}>{status.value}</div>}
  </div>;
}

export function CinematicStage({ stage }: { stage: MotionStage }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = stage.start + frame;
  const timed = stage.nodes.flatMap(node => node.updates.filter(update => update.frame <= now)
    .map(update => ({ frame: update.frame, entities: [node.entity] })));
  const legs = stage.packets.filter(packet => packet.frame <= now);
  const latest = Math.max(stage.start, ...legs.map(packet => packet.frame), ...timed.map(update => update.frame));
  const active = new Set([
    ...timed.filter(update => update.frame === latest).flatMap(update => update.entities),
    ...legs.filter(packet => packet.frame === latest).flatMap(packet => [packet.source, packet.target]),
  ]);
  const paths = new Map(legs.map(packet => [`${packet.source}:${packet.target}`, packet]));
  const positions = new Map(stage.nodes.map(node => [node.entity, slots[node.slot]]));

  return <div style={{ position: 'absolute', left: 83, top: 407, width: 846, height: 819 }}>
    <div style={{ position: 'absolute', inset: 0, borderRadius: 34, background: 'radial-gradient(ellipse at center, #25264562, #10132116 70%)' }} />
    <svg width="846" height="819" viewBox="0 0 846 819" style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
      {[...paths.values()].map(packet => {
        const source = positions.get(packet.source)!;
        const target = positions.get(packet.target)!;
        const t = interpolate(now, [packet.frame, packet.frame + fps * 0.82], [0, 1], ease);
        const x = target.x - source.x;
        const y = target.y - source.y;
        const dx = x * 0.16 + (x === 0 ? 125 : 0);
        const dy = y * 0.50 + (y === 0 ? -180 : 0);
        const path = `M ${source.x} ${source.y} Q ${source.x + dx} ${source.y + dy} ${target.x} ${target.y}`;
        const stop = packet.blocked ? 0.60 : 0.92;
        const offset = 0.12 + (stop - 0.12) * t;
        const px = source.x + 2 * (1 - offset) * offset * dx + offset ** 2 * x;
        const py = source.y + 2 * (1 - offset) * offset * dy + offset ** 2 * y;
        const color = packet.blocked ? '#ff8693' : colorFor(packet.source);
        const opacity = packet.frame === latest ? 1 : 0.29;
        return <g key={`${packet.source}:${packet.target}`} opacity={opacity}>
          <path d={path} fill="none" stroke={color} strokeOpacity={0.50} strokeWidth="3" strokeDasharray="8 11" />
          <path d={path} pathLength={100} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${offset * 100} 100`} />
          <g transform={`translate(${px},${py})`}>
            {packet.blocked && t >= 1 ? <>
              <circle r="23" fill="#37202e" stroke={color} strokeWidth="2" />
              <path d="M-8 -8L8 8 M8 -8L-8 8" stroke={color} strokeWidth="4" strokeLinecap="round" />
            </> : t < 1 && <>
              <circle r="21" fill={color} fillOpacity="0.30" />
              <circle r="10" fill={color} stroke="#f8f9ff" strokeWidth="2" />
            </>}
          </g>
        </g>;
      })}
    </svg>
    {stage.nodes.map(node => <Node key={node.entity} node={node} start={stage.start} active={active.has(node.entity)} hasFocus={active.size > 0} />)}
  </div>;
}
