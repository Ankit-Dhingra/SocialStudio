import React from 'react';
import { interpolate } from 'remotion';
import { VideoDesignTokens as design } from './design-system.js';
import { motionEase } from './PremiumVisuals.js';

export type RoutePoint = { x: number; y: number };
export type RouteShape = 'straight' | 'curve' | 'orthogonal';
export const nodeSize = { width: 328, height: 178 };

export function connectorRoute(source: RoutePoint, target: RoutePoint, shape: RouteShape, lane = 0, bounds = nodeSize) {
  const side = Math.sign(target.x - source.x);
  const vertical = Math.sign(target.y - source.y);
  const horizontal = side !== 0 && (!vertical || Math.abs(target.x - source.x) >= bounds.width + 24);
  const start = horizontal ? { x: source.x + side * bounds.width / 2, y: source.y + lane }
    : { x: source.x + lane, y: source.y + vertical * bounds.height / 2 };
  const end = horizontal ? { x: target.x - side * bounds.width / 2, y: target.y + lane }
    : { x: target.x + lane, y: target.y - vertical * bounds.height / 2 };
  const middleX = (start.x + end.x) / 2 + lane;
  const middleY = (start.y + end.y) / 2 + lane;
  if (side && vertical && shape !== 'straight') {
    const bends = horizontal ? [{ x: middleX, y: start.y }, { x: middleX, y: end.y }] as const
      : [{ x: start.x, y: middleY }, { x: end.x, y: middleY }] as const;
    return shape === 'curve' ? { start, end, controls: bends } : { start, end, points: [start, ...bends, end] };
  }
  return { start, end, points: [start, end] };
}

export function AnimatedConnector({ source, target, shape, lane, frame, fps, blocked, label, current, bounds }: {
  source: RoutePoint; target: RoutePoint; shape: RouteShape; lane: number;
  frame: number; fps: number; blocked: boolean; label?: string; current: boolean;
  bounds?: typeof nodeSize;
}) {
  const route = connectorRoute(source, target, shape, lane, bounds);
  const { start, end } = route;
  const { colors } = design;
  const progress = interpolate(frame, [0, fps * design.motion.packet], [0, 1], motionEase);
  const travel = (blocked ? 0.61 : 1) * progress;
  const active = frame >= 0 && frame <= fps * design.motion.packet;
  const strokeOpacity = active ? interpolate(frame, [0, fps * design.motion.draw], [0.35, 1], motionEase) : 0.7;
  const color = blocked ? colors.error : colors.cyan;
  const base = `M${start.x} ${start.y}`;
  let path: string;
  let packet: RoutePoint;
  let direction: RoutePoint;
  if (route.controls) {
    const [a, b] = route.controls;
    path = `${base} C${a.x} ${a.y} ${b.x} ${b.y} ${end.x} ${end.y}`;
    const t = travel;
    const u = 1 - t;
    packet = {
      x: u ** 3 * start.x + 3 * u ** 2 * t * a.x + 3 * u * t ** 2 * b.x + t ** 3 * end.x,
      y: u ** 3 * start.y + 3 * u ** 2 * t * a.y + 3 * u * t ** 2 * b.y + t ** 3 * end.y,
    };
    direction = { x: end.x - b.x, y: end.y - b.y };
  } else {
    const points = route.points!;
    path = `${base}${points.slice(1).map(point => ` L${point.x} ${point.y}`).join('')}`;
    const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
    let distance = travel * lengths.reduce((sum, length) => sum + length, 0);
    let segment = 0;
    while (segment < lengths.length - 1 && distance > lengths[segment]) distance -= lengths[segment++];
    const from = points[segment];
    const to = points[segment + 1];
    const fraction = lengths[segment] ? distance / lengths[segment] : 0;
    packet = { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
    const penultimate = points[points.length - 2];
    direction = { x: end.x - penultimate.x, y: end.y - penultimate.y };
  }
  const angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
  const labelX = (start.x + end.x) / 2;
  const labelY = (start.y + end.y) / 2 - 18;
  return <g>
    <path d={path} fill="none" stroke={active ? color : colors.border} strokeOpacity={strokeOpacity}
      strokeWidth={active ? 3 : 2} strokeDasharray={shape === 'orthogonal' ? '1 8' : '7 8'} strokeLinecap="round" />
    {!blocked && <path d="M-13 -6 L-3 0 L-13 6" fill="none" stroke={active ? color : colors.muted}
      strokeWidth="2" strokeLinecap="round" transform={`translate(${end.x} ${end.y}) rotate(${angle})`} />}
    {active && <g transform={`translate(${packet.x},${packet.y})`}>
      <circle r="14" fill={color} opacity="0.14" />
      <circle r="6" fill={color} />
    </g>}
    {blocked && current && !active && <g transform={`translate(${packet.x},${packet.y})`}>
      <circle r="15" fill={colors.background} stroke={color} strokeWidth="2" />
      <path d="M-5 -5L5 5 M5 -5L-5 5" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </g>}
    {label && current && active && <text x={labelX} y={labelY} textAnchor="middle"
      fontFamily={design.typography.fontFamilyMono} fontSize={19} fill={color}
      paintOrder="stroke" stroke={colors.canvas} strokeWidth={7} strokeLinejoin="round">{label}</text>}
  </g>;
}
