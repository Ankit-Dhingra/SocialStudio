import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens as design } from '../design-system.js';
import { panelStyle, type PanelState } from '../PremiumVisuals.js';
import { AnimatedConnector } from '../AnimatedConnector.js';
import type { TimedShot } from '../visual-story.js';
import { CheckoutReceipt } from './CheckoutFilm.js';

type Guide = NonNullable<TimedShot['paymentGuide']>;
type Node = Guide['nodes'][number];
const palette = { blue: design.colors.cyan, gold: design.colors.warning, green: design.colors.success, red: design.colors.error };
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

function FlowNode({ node, frame, fps }: { node: Node; frame: number; fps: number }) {
  const shown = interpolate(frame - node.at, [0, fps * 0.35], [0, 1], smooth);
  const update = node.updates?.filter(item => frame >= item.at).at(-1);
  const color = palette[update?.tone ?? 'blue'];
  const recent = update ? frame - update.at : frame - node.at;
  const state: PanelState = update?.tone === 'red' ? 'error' : update?.tone === 'gold' ? 'warning'
    : update?.tone === 'green' ? 'success' : 'default';
  return <div style={{
    position: 'absolute', left: node.x - 172, top: node.y - 87, width: 344, height: 174, boxSizing: 'border-box',
    ...panelStyle(state, recent >= 0 && recent < fps * design.motion.highlight), opacity: shown, padding: '24px 24px 21px',

  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, color }}>
      <svg width={37} height={37} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={1.65} strokeLinejoin="round" aria-hidden>
        <path d={icon[node.icon]} />
      </svg>
      <span style={{ fontSize: node.label.length > 25 ? 28 : 32, lineHeight: 1.03, fontWeight: 730, color: '#f0f7f8' }}>{node.label}</span>
    </div>
    {node.detail && <div style={{ marginTop: 8, color: '#aac6ce', fontSize: 23, lineHeight: 1.09 }}>{node.detail}</div>}
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
  const latest = Math.max(-Infinity, ...(data.edges ?? []).filter(edge => edge.at <= frame).map(edge => edge.at));
  const reveal = interpolate(frame, [0, fps * 0.35], [0.22, 1], smooth);
  return <AbsoluteFill style={{ color: design.colors.ink, fontFamily: design.typography.fontFamilySans }}>
    <div style={{ position: 'absolute', left: 111, top: 305, width: 836, opacity: reveal, transform: `translateY(${(1 - reveal) * 14}px)` }}>
      {data.label && <div style={{ color: '#83beca', fontSize: 25, letterSpacing: 2.6, fontWeight: 690 }}>{data.label.toUpperCase()}</div>}
      {data.title && <div style={{ marginTop: 18, fontSize: 71, fontWeight: 770, letterSpacing: -2.15, lineHeight: 1.02 }}>{data.title}</div>}
    </div>
    <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }} aria-hidden>
      {data.edges?.map((edge, i) => {
        if (frame < edge.at) return null;
        const source = index.get(edge.from);
        const target = index.get(edge.to);
        if (!source || !target) return null;
        const reversed = data.edges?.some(other => other.to === edge.from && other.from === edge.to);
        return <AnimatedConnector key={i} source={source} target={target} shape="orthogonal"
          lane={reversed ? (edge.from.localeCompare(edge.to) > 0 ? 19 : -19) : 0}
          frame={frame - edge.at} fps={fps} blocked={Boolean(edge.blocked)} current={edge.at === latest}
          label={edge.label} bounds={{ width: 344, height: 174 }} />;
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
