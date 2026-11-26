import React, { useMemo } from 'react';
import { Img, getStaticFiles, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { MotionStage, StageNode } from '../motion-stage.js';
import { AnimatedConnector, nodeSize, type RouteShape } from '../AnimatedConnector.js';
import { PremiumCard, motionEase, panelAccents, type PanelState } from '../PremiumVisuals.js';
import { VideoDesignTokens as design } from '../design-system.js';

const slots = [
  { x: 173, y: 151 }, { x: 673, y: 151 }, { x: 173, y: 590 }, { x: 673, y: 590 }, { x: 423, y: 372 },
];
const { colors, typography } = design;
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
  document: 'M7 3h12l6 6v20H7zM19 3v7h6M11 15h10m-10 5h10m-10 5h7',
  chunks: 'M3 4h12v10H3zm14 0h12v10H17zM3 18h12v10H3zm14 0h12v10H17z',
  search: 'M21 14a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-2 6 8 8',
  answer: 'M4 5h24v17H15l-7 6v-6H4zm6 6h12m-12 5h8',
};
const openLock = 'M8 14h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2Zm2 0V9a6 6 0 0 1 11-3m-5 13v4';
const brandKey = (label: string) => label.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
const brandWords = (label: string) => label.normalize('NFKC').toLowerCase().match(/[a-z0-9]+/g) ?? [];

export function findBrandLogo(brand?: string) {
  const key = brand ? brandKey(brand) : '';
  if (!key || key === 'demoqr') return;
  const words = brandWords(brand ?? '').join(' ');
  const logos = getStaticFiles().flatMap(file => {
    const name = /^visuals\/(?:brands\/)?([^/]+)\.(?:svg|png|webp)$/i.exec(file.name)?.[1];
    return name && name !== 'demo-qr' ? [{ name, src: file.src }] : [];
  });
  return logos.find(logo => brandKey(logo.name) === key)?.src
    ?? logos.filter(logo => ` ${words} `.includes(` ${brandWords(logo.name).join(' ')} `))
      .sort((first, second) => second.name.length - first.name.length)[0]?.src;
}

export function BrandMark({ brand, size = 52 }: { brand?: string; size?: number }) {
  const src = useMemo(() => findBrandLogo(brand), [brand]);
  return src ? <Img src={src} alt="" style={{ width: size, height: size, objectFit: 'contain' }} /> : null;
}

export function ArchitectureNode({ node, start, activity, hasFocus }: {
  node: StageNode; start: number; activity: PanelState; hasFocus: boolean;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = start + frame;
  const status = node.updates.reduce((state, update) => update.frame <= now ? update : state, node.previous);
  const entered = node.entrance < 0 ? 1 : interpolate(frame,
    [node.entrance, node.entrance + fps * design.motion.enter], [0, 1], motionEase);
  const emphasized = activity !== 'default';
  const timer = status?.effect === 'countdown' && status.until !== undefined && status.until > status.frame
    ? interpolate(now, [status.frame, status.until], [1, 0], motionEase) : 1;
  const resolved: PanelState = activity === 'error' || status?.tone === 'error' || status?.effect === 'offline' ? 'error'
    : status?.tone === 'success' ? 'success' : status?.tone === 'warning' ? 'warning'
    : status?.effect === 'countdown' ? 'processing' : activity;
  const color = resolved === 'default' ? colors.secondary : panelAccents[resolved];
  const point = slots[node.slot];
  const logo = useMemo(() => findBrandLogo(node.brand), [node.brand]);
  const statusValue = status?.value;
  const value = statusValue && /^[-+₹$€£\d][\d ,.₹$€£]*\s*[a-z%]*$/i.test(statusValue) ? parseFloat(statusValue.replace(/^[^\d+-]*/, '')) : NaN;
  const animateCounter = Number.isFinite(value) && /^\d+$/.test(statusValue ?? '') && !node.previous &&
    node.updates.length === 1 && node.updates[0].frame === status?.frame;
  const stateValue = animateCounter && status ? Math.round(interpolate(now,
    [status.frame, status.frame + fps * design.motion.highlight], [0, value], motionEase)) : statusValue;
  return <PremiumCard state={resolved} emphasized={emphasized} style={{
    position: 'absolute', left: point.x - nodeSize.width / 2, top: point.y - nodeSize.height / 2,
    width: nodeSize.width, height: nodeSize.height, opacity: entered * (node.context ? 0.73 : hasFocus && !emphasized ? 0.86 : 1),
    padding: '21px 22px',
    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 11,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
      <div style={{ flex: '0 0 66px', height: 66, display: 'grid', placeItems: 'center',
        position: 'relative', borderRadius: design.radius.badge, background: colors.elevated,
        border: `1px solid ${colors.mutedBorder}` }}>
        {logo ? <Img src={logo} alt="" style={{ width: 50, height: 50, objectFit: 'contain' }} />
          : <svg width="40" height="40" viewBox="0 0 32 32" fill="none" aria-hidden>
            <path d={node.icon === 'lock' && status?.effect === 'expire' ? openLock : glyphs[node.icon]} stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>}
        {status?.effect === 'countdown' && <svg width="74" height="74" viewBox="0 0 74 74" style={{ position: 'absolute', inset: -4 }} aria-hidden>
          <rect x="2" y="2" width="70" height="70" rx="14" pathLength={100} fill="none" stroke={colors.purple}
            strokeWidth="2" strokeDasharray={`${timer * 100} 100`} />
        </svg>}
      </div>
      <div style={{ color: colors.ink, minWidth: 0, fontSize: node.label.length > 24 ? 26 : typography.node,
        fontWeight: 700, lineHeight: 1.14, overflowWrap: 'anywhere' }}>{node.label}</div>
    </div>
    {stateValue !== undefined && <div style={{
      color: status?.tone === 'success' ? colors.success : status?.tone === 'error' ? colors.error
        : status?.tone === 'warning' ? colors.warning : colors.secondary,
      fontSize: typography.annotation, fontFamily: typography.fontFamilyMono, lineHeight: 1.14, fontWeight: 600,
      overflowWrap: 'anywhere',
    }}>{stateValue}</div>}
  </PremiumCard>;
}

export function CinematicStage({ stage }: { stage: MotionStage }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = stage.start + frame;
  const latestUpdate = Math.max(-Infinity, ...stage.nodes.flatMap(node => node.updates.filter(update =>
    update.frame <= now && now - update.frame <= fps * design.motion.focus).map(update => update.frame)));
  const paths = new Map(stage.packets.filter(packet => packet.frame <= now).map(packet => [`${packet.source}:${packet.target}`, packet]));
  const latest = [...paths.values()].at(-1);
  const activity = new Map<string, PanelState>();
  const positions = new Map(stage.nodes.map(node => [node.entity, slots[node.slot]]));
  const travel = fps * design.motion.packet;
  for (const packet of paths.values()) {
    const age = now - packet.frame;
    if (age < travel) {
      activity.set(packet.source, 'active');
      if (!packet.blocked) activity.set(packet.target, 'processing');
    } else if (age < travel + fps * design.motion.highlight) {
      activity.set(packet.blocked ? packet.source : packet.target, packet.blocked ? 'error' : 'active');
    }
  }
  for (const node of stage.nodes) {
    if (node.updates.some(update => update.frame === latestUpdate)) activity.set(node.entity, 'active');
  }

  return <div style={{ position: 'absolute', left: 80, top: 422, width: 846, height: 760 }}>
    <svg width="846" height="760" viewBox="0 0 846 760" style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
      {[...paths.values()].map(packet => {
        const source = positions.get(packet.source);
        const target = positions.get(packet.target);
        if (!source || !target || packet.source === packet.target) return null;
        const reverse = stage.packets.some(other => other.source === packet.target && other.target === packet.source);
        const lane = reverse ? (packet.source < packet.target ? -24 : 24) : 0;
        const diagonal = source.x !== target.x && source.y !== target.y;
        const shape: RouteShape = packet.shape ?? (diagonal ? reverse ? 'orthogonal' : 'curve' : 'straight');
        return <AnimatedConnector key={`${packet.source}:${packet.target}`} source={source} target={target}
          shape={shape} lane={lane} blocked={packet.blocked} label={packet.label} current={packet === latest}
          frame={now - packet.frame} fps={fps} />;
      })}
    </svg>
    {stage.nodes.map(node => <ArchitectureNode key={node.entity} node={node} start={stage.start}
      activity={activity.get(node.entity) ?? 'default'} hasFocus={activity.size > 0} />)}
  </div>;
}
