import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimedShot } from '../visual-story.js';
import { CheckoutReceipt } from './CheckoutFilm.js';

type Guide = NonNullable<TimedShot['paymentGuide']>;
type Node = Guide['nodes'][number];
const palette = { blue: '#8bd6e4', gold: '#f1bd80', green: '#99e0bb' };
const clamped = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const smooth = { ...clamped, easing: Easing.bezier(0.22, 0.61, 0.36, 1) };
const icon: Record<Node['icon'], string> = {
  phone: 'M8 3h16v26H8z M13 25h6',
  bank: 'M4 12l12-8 12 8z M7 14v11m6-11v11m6-11v11m6-11v11 M4 28h24',
  switch: 'M9 5h14v22H9z M3 11h6m14 0h6M3 21h6m14 0h6M13 12h6m-6 8h6',
  qr: 'M4 4h9v9H4z M19 4h9v9h-9z M4 19h9v9H4z M19 19h4v4h-4m9-4v9h-9',
  lock: 'M7 14h18v14H7z M11 14V9a5 5 0 1 1 10 0v5 M16 19v4',
  status: 'M4 17h5l5-9 5 17 4-8h5',
  ledger: 'M6 4h20v24H6z M11 10h10m-10 6h10m-10 6h7',
};

function routeBetween(source: Node, target: Node, side?: number) {
  const onRow = source.y === target.y;
  const onColumn = source.x === target.x;
  if (onRow) {
    const dir = Math.sign(target.x - source.x);
    return [{ x: source.x + dir * 173, y: source.y + (side || 0) }, { x: target.x - dir * 173, y: target.y + (side || 0) }];
  }
  const dir = Math.sign(target.y - source.y);
  const a = { x: source.x + (side || 0), y: source.y + dir * 89 };
  const b = { x: target.x + (side || 0), y: target.y - dir * 89 };
  const middle = (a.y + b.y) / 2;
  return onColumn ? [a, b] : [a, { x: a.x, y: middle }, { x: b.x, y: middle }, b];
}

function FlowEdge({ edge, source, target, frame, fps, lane }: {
  edge: NonNullable<Guide['edges']>[number]; source: Node; target: Node; frame: number; fps: number; lane: number;
}) {
  const age = frame - edge.at;
  const points = routeBetween(source, target, lane);
  const line = points.map(point => `${point.x},${point.y}`).join(' ');
  const segments = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const total = segments.reduce((sum, n) => sum + n, 0);
  const travel = interpolate(age, [0, fps * 1.12], [0, 1], smooth);
  let distance = travel * total;
  const last = points.length - 1;
  let dot = points[last];
  for (let i = 0; i < last; i++) {
    const segment = segments[i];
    if (distance <= segment && segment > 0) {
      const p = distance / segment;
      dot = { x: points[i].x + (points[i + 1].x - points[i].x) * p, y: points[i].y + (points[i + 1].y - points[i].y) * p };
      break;
    }
    distance -= segment;
  }
  const color = palette[edge.tone ?? 'blue'];
  const start = points[0];
  const end = points[last];
  const onRow = start.y === end.y;
  const label = { x: onRow ? (start.x + end.x) / 2 : Math.max(start.x, end.x) + 16, y: (start.y + end.y) / 2 - (onRow ? 18 : 4) };
  return <g opacity={interpolate(age, [0, fps * 0.18], [0, 1], clamped)}>
    <polyline points={line} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={3} strokeDasharray="7 8" strokeLinejoin="round" />
    {age < fps * 1.22 && <g>
      <circle cx={dot.x} cy={dot.y} r={17} fill={color} opacity={0.23} />
      <circle cx={dot.x} cy={dot.y} r={7} fill={color} />
    </g>}
    {edge.label && <text x={label.x} y={label.y} fill={color} fontSize={23} fontWeight={610} textAnchor={onRow ? 'middle' : 'start'}
      stroke="#0e2230" strokeWidth={8} paintOrder="stroke">{edge.label}</text>}
  </g>;
}

function FlowNode({ node, frame, fps }: { node: Node; frame: number; fps: number }) {
  const shown = interpolate(frame - node.at, [0, fps * 0.35], [0, 1], smooth);
  const update = node.updates?.filter(item => frame >= item.at).at(-1);
  const color = palette[update?.tone ?? 'blue'];
  const recent = update ? frame - update.at : frame - node.at;
  const pulse = interpolate(recent, [0, fps * 0.23, fps * 0.72], [0, 0.8, 0], clamped);
  return <div style={{
    position: 'absolute', left: node.x - 172, top: node.y - 87, width: 344, height: 174, boxSizing: 'border-box',
    border: '1.5px solid #466c7e', borderRadius: 21, padding: '24px 24px 21px',
    background: 'linear-gradient(150deg,#1a3442,#122734)', opacity: shown,
    transform: `translateY(${(1 - shown) * 16}px)`, boxShadow: pulse ? `0 0 ${34 * pulse}px ${color}48` : undefined,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, color }}>
      <svg width={37} height={37} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinejoin="round" aria-hidden>
        <path d={icon[node.icon]} />
      </svg>
      <span style={{ fontSize: 32, lineHeight: 1.03, fontWeight: 730, color: '#f0f7f8' }}>{node.label}</span>
    </div>
    <div style={{ marginTop: 8, color: '#aac6ce', fontSize: 23, lineHeight: 1.09 }}>{node.detail}</div>
    {!!update && <div style={{ marginTop: 9, color, fontSize: 29, fontWeight: 760, lineHeight: 1.04,
      opacity: interpolate(recent, [0, fps * 0.2], [0.4, 1], clamped) }}>{update.text}</div>}
  </div>;
}

export function PaymentGuide({ shot }: { shot: TimedShot & { paymentGuide: Guide } }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = shot.paymentGuide;
  if (data.receiptAt !== undefined && frame >= data.receiptAt && shot.checkout) {
    return <CheckoutReceipt
      shot={{ ...shot, duration: shot.duration - data.receiptAt, checkout: shot.checkout }}
      frame={frame - data.receiptAt}
    />;
  }

  const notes = data.notes?.filter(note => note.at <= frame).at(-1);
  const index = new Map(data.nodes.map(node => [node.id, node]));
  const reveal = interpolate(frame, [0, fps * 0.35], [0.22, 1], smooth);
  return <AbsoluteFill style={{
    color: '#eff8fa', fontFamily: 'Segoe UI, sans-serif',
    background: 'radial-gradient(ellipse at 45% 46%, #172e3c 5%, #0a1824 68%, #08121a 100%)',
  }}>
    <div aria-hidden style={{
      position: 'absolute', inset: 0,
      backgroundImage: 'radial-gradient(circle, #77a4b34a 1px, transparent 1.5px)',
      backgroundSize: '39px 39px', opacity: 0.25,
      maskImage: 'radial-gradient(ellipse at 50% 48%,black 3%,transparent 67%)',
    }} />
    <div style={{ position: 'absolute', left: 111, top: 305, width: 836, opacity: reveal, transform: `translateY(${(1 - reveal) * 14}px)` }}>
      <div style={{ color: '#83beca', fontSize: 25, letterSpacing: 2.6, fontWeight: 690 }}>{data.label.toUpperCase()}</div>
      <div style={{ marginTop: 18, fontSize: 71, fontWeight: 770, letterSpacing: -2.15, lineHeight: 1.02 }}>{data.title}</div>
    </div>
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }} aria-hidden>
      {data.edges?.map((edge, i) => {
        if (frame < edge.at) return null;
        const source = index.get(edge.from);
        const target = index.get(edge.to);
        if (!source || !target) return null;
        const reversed = data.edges?.some(other => other.to === edge.from && other.from === edge.to);
        return <FlowEdge key={i} edge={edge} source={source} target={target} frame={frame} fps={fps}
          lane={reversed ? (edge.from.localeCompare(edge.to) > 0 ? 19 : -19) : 0} />;
      })}
    </svg>
    {data.nodes.map(node => <FlowNode key={node.id} node={node} frame={frame} fps={fps} />)}
    {notes && <div style={{
      position: 'absolute', top: 1278, left: 111, width: 811, boxSizing: 'border-box', padding: '19px 24px',
      borderLeft: '3px solid #e2ae70', background: '#233644b5', color: '#f2dab7', fontSize: 35, lineHeight: 1.16,
      opacity: interpolate(frame - notes.at, [0, fps * 0.31], [0.1, 1], smooth),
    }}>{notes.text}</div>}
  </AbsoluteFill>;
}
