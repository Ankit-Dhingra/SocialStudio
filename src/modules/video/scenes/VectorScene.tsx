import React, { useId, useMemo } from 'react';
import { cutPath, getLength, getPointAtLength } from '@remotion/paths';
import { Img, interpolate, interpolateColors, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens as design } from '../design-system.js';
import { motionEase } from '../PremiumVisuals.js';
import type { TimedVector, VectorGeometry, VectorTrack } from '../vector-spec.js';
import { TechnicalObject } from './TechnicalObject.js';
import { ParcelGlyph } from './MechanismGlyph.js';

const colors = { ...design.colors, none: 'none' };
const polishedSurfaces = {
  chassis: ['#343B46', '#151920', '#080B11'],
  screen: ['#171D27', '#10151D', '#0B0F16'],
  card: ['#1C222C', '#151B24', '#10151D'],
} as const;
const neutralSurface = new Set(['surface', 'elevated', 'structure', 'background', 'canvas']);
const bodyName = /(?:^|[-_])(?:phone|handset|mobile|device|chassis)(?:[-_]|$)/i;
const displayName = /(?:^|[-_])(?:screen|display)(?:[-_]|$)/i;
const coordinates = (points: number[][]) => points.map(point => point.join(',')).join(' ');
type PaintAttributes = {
  fill?: string; stroke?: string; strokeWidth?: number;
  strokeLinejoin?: 'round'; strokeLinecap?: 'round';
  pathLength?: number; strokeDasharray?: string; strokeDashoffset?: number;
};

function Geometry({ shape, attributes, polished = false }: { shape: VectorGeometry; attributes?: PaintAttributes; polished?: boolean }) {
  switch (shape.kind) {
    case 'rect': return <rect {...attributes} x={shape.box[0]} y={shape.box[1]} width={shape.box[2]} height={shape.box[3]} rx={shape.radius} />;
    case 'circle': return <circle {...attributes} cx={shape.center[0]} cy={shape.center[1]} r={shape.radius} />;
    case 'ellipse': return <ellipse {...attributes} cx={shape.center[0]} cy={shape.center[1]} rx={shape.radii[0]} ry={shape.radii[1]} />;
    case 'polygon': return <polygon {...attributes} points={coordinates(shape.points)} />;
    case 'polyline': return <polyline {...attributes} points={coordinates(shape.points)} />;
    case 'line': return <line {...attributes} x1={shape.points[0][0]} y1={shape.points[0][1]} x2={shape.points[1][0]} y2={shape.points[1][1]} />;
    case 'path': return <path {...attributes} d={shape.d} />;
    case 'text': return <text {...attributes} x={shape.point[0]} y={shape.point[1]} textAnchor={shape.anchor}
      fontFamily={design.typography.fontFamilySans} fontSize={shape.size}
      fontWeight={polished ? shape.size >= 40 ? 740 : shape.size >= 34 ? 650 : 570 : 680}
      style={polished ? { fontVariantNumeric: 'tabular-nums', letterSpacing: shape.size >= 40 ? '-0.02em' : undefined } : undefined}>{shape.text}</text>;
    case 'object': return <TechnicalObject shape={shape} />;
    case 'group': case 'asset': return null;
  }
}

// SVG image URLs are staged locally before render. Remotion's Img manages asset readiness.
function VectorAsset({ asset, box, fit = 'contain' }: { asset: string; box: [number, number, number, number]; fit?: 'contain' | 'cover' }) {
  return <foreignObject x={box[0]} y={box[1]} width={box[2]} height={box[3]}>
    <Img src={staticFile(asset)} alt="" style={{ width: '100%', height: '100%', display: 'block', objectFit: fit,
      borderRadius: fit === 'cover' ? 18 : undefined }} />
  </foreignObject>;
}

export function VectorScene({ vector }: { vector: TimedVector }) {
  const polished = vector.presentation === 'polished';
  const frame = useCurrentFrame() + (vector.sequenceOffset ?? 0);
  const { fps } = useVideoConfig();
  const id = useId().replace(/[^a-z0-9_-]/gi, '');
  const ref = (name: string) => `url(#${id}-def-${name})`;
  const cache = useMemo(() => {
    const routes = new Map<string, { d: string; length: number; origin: { x: number; y: number } }>();
    for (const track of vector.tracks) {
      if (track.kind !== 'follow' || routes.has(track.path)) continue;
      const route = vector.layers.find(layer => layer.id === track.path)?.shape;
      if (route?.kind !== 'path') continue;
      const origin = getPointAtLength(route.d, 0);
      if (origin) routes.set(track.path, { d: route.d, length: getLength(route.d), origin });
    }
    const tracks = new Map<string, VectorTrack[]>();
    const children = new Map<string | null, TimedVector['layers']>();
    const layersById = new Map(vector.layers.map(layer => [layer.id, layer]));
    for (const track of vector.tracks) tracks.set(track.target, [...(tracks.get(track.target) ?? []), track]);
    for (const layer of vector.layers) children.set(layer.parent, [...(children.get(layer.parent) ?? []), layer]);
    const bodies = new Set<string>();
    const displays = new Set<string>();
    if (polished) for (const layer of vector.layers) {
      if (layer.shape.kind !== 'rect' || layer.shape.radius < 16 || vector.repeats.some(item => item.target === layer.id)) continue;
      const [x, y, width, height] = layer.shape.box;
      if (width < 120 || height < 160) continue;
      const matching = vector.layers.filter(body => {
        const siblings = layer.parent === body.parent;
        const nestedDisplay = layer.parent !== null && layersById.get(layer.parent)?.parent === body.parent
          && bodyName.test(body.id) && displayName.test(layer.id);
        if (body.shape.kind !== 'rect' || body.shape.radius < 24 || (!siblings && !nestedDisplay)) return false;
        const [left, top, bodyWidth, bodyHeight] = body.shape.box;
        if (!bodyName.test(body.id) && !(displayName.test(layer.id) && bodyHeight >= bodyWidth * 1.2)) return false;
        return [x - left, y - top, left + bodyWidth - x - width, top + bodyHeight - y - height]
          .every(inset => inset >= 4 && inset <= 32);
      });
      if (matching.length !== 1) continue;
      bodies.add(matching[0].id);
      displays.add(layer.id);
    }
    return { routes, tracks, children,
      styles: new Map(vector.treatments.map(item => [item.target, item])),
      paints: new Map(vector.definitions.map(item => [item.id, item])),
      bodies, displays,
      repeats: new Map(vector.repeats.map(item => [item.target, item])),
      connectors: vector.connectors?.map(route => ({ ...route, length: getLength(route.path) })) ?? [] };
  }, [vector, polished]);
  const progress = (track: { start: number; frames: number }) => interpolate(frame, [track.start, track.start + track.frames], [0, 1], motionEase);
  const renderLayer = (layer: TimedVector['layers'][number]): React.ReactNode => {
    if (frame < layer.start) return null;
    const style = cache.styles.get(layer.id);
    const updates = vector.states?.filter(update => update.id === layer.id && update.frame <= frame) ?? [];
    const semanticTone = updates.filter(update => update.tone).at(-1)?.tone;
    let opacity = style?.opacity ?? 1;
    let stroke: string = colors[semanticTone ?? layer.stroke];
    let accent = layer.stroke === 'cyan' || layer.stroke === 'purple' ? layer.stroke
      : layer.fill === 'cyan' || layer.fill === 'purple' ? layer.fill : undefined;
    let accentActive = false;
    let offset = 0;
    let draw = false;
    const transforms: string[] = [];
    for (const track of cache.tracks.get(layer.id) ?? []) {
      const t = progress(track);
      if (track.kind === 'opacity') opacity *= track.from + (track.to - track.from) * t;
      if (track.kind === 'move') transforms.push(`translate(${track.from.map((n, i) => n + (track.to[i] - n) * t).join(' ')})`);
      if (track.kind === 'rotate') transforms.push(`rotate(${track.from + (track.to - track.from) * t} 450 560)`);
      if (track.kind === 'scale') transforms.push(`translate(450 560) scale(${track.from + (track.to - track.from) * t}) translate(-450 -560)`);
      if (track.kind === 'stroke') {
        if (track.from !== 'none' && track.to !== 'none') stroke = interpolateColors(t, [0, 1], [colors[track.from], colors[track.to]]);
        else stroke = colors[t < 1 ? track.from : track.to];
        if (frame >= track.start) {
          const tone = t < .5 ? track.from : track.to;
          accent = tone === 'cyan' || tone === 'purple' ? tone : undefined;
          accentActive ||= t < 1;
        }
      }
      if (track.kind === 'draw') { draw = true; offset = 1 - t; accentActive ||= t > 0 && t < 1; }
      if (track.kind === 'follow') {
        const route = cache.routes.get(track.path);
        const point = route && getPointAtLength(route.d, route.length * t);
        if (point && route) transforms.push(`translate(${point.x - route.origin.x} ${point.y - route.origin.y})`);
      }
    }
    if (!opacity) return null;
    const shape = layer.shape;
    const insetDisplay = cache.displays.has(layer.id);
    const surface = polished && shape.kind === 'rect' && shape.box[2] >= 120 && shape.box[3] >= 65 && shape.radius >= 8
      ? insetDisplay ? 'screen' : cache.bodies.has(layer.id) ? 'chassis'
        : layer.fill === 'surface' && shape.box[3] >= 145 ? 'screen' : 'card'
      : undefined;
    const authoredPaint = style?.fill ? cache.paints.get(style.fill) : undefined;
    const useSurface = surface && (authoredPaint
      ? surface === 'chassis' && authoredPaint.kind === 'gradient'
        && neutralSurface.has(authoredPaint.from) && neutralSurface.has(authoredPaint.to)
      : layer.fill === 'surface' || layer.fill === 'elevated' || surface === 'chassis' && layer.fill === 'structure'
        || insetDisplay && (layer.fill === 'secondary' || layer.fill === 'structure'));
    const effect = polished && (style?.effect === 'glow' || (accent && accentActive && shape.kind !== 'group' && style?.effect !== 'shadow'))
      ? `glow-${accent ?? 'cyan'}` : style?.effect;
    const attrs: PaintAttributes = {
      fill: useSurface ? `url(#${id}-surface-${surface})` : style?.fill ? ref(style.fill) : colors[layer.fill],
      stroke, strokeWidth: style?.strokeWidth ?? 3,
      strokeLinejoin: 'round', strokeLinecap: 'round',
      ...(draw ? { pathLength: 1, strokeDasharray: '1 1', strokeDashoffset: offset } : {}),
    };
    const repeat = cache.repeats.get(layer.id);
    return <g key={layer.id} opacity={opacity} transform={transforms.join(' ') || undefined}
      clipPath={style?.clip ? ref(style.clip) : undefined} mask={style?.mask ? ref(style.mask) : undefined}
      filter={effect && effect !== 'none' ? `url(#${id}-effect-${effect})` : undefined}>
      {layer.shape.kind === 'group' ? (cache.children.get(layer.id) ?? []).map(renderLayer)
        : layer.shape.kind === 'asset' && layer.asset ? <VectorAsset asset={layer.asset} box={layer.shape.box} fit={layer.shape.fit} />
          : layer.shape.kind === 'object' ? (() => {
            const values = new Map<number, string>();
            for (const update of updates) if (update.value !== undefined) for (const cell of update.cells ?? []) values.set(cell, update.value);
            const lastUpdate = updates.at(-1);
            const activity = lastUpdate ? interpolate(frame, [lastUpdate.frame, lastUpdate.frame + Math.max(1, fps * .6)], [1, 0], motionEase) : 0;
            const queueItems = updates.reduce((count, update) => Math.max(0, count + (update.queueDelta ?? 0)), 0);
            return <TechnicalObject shape={layer.shape} state={semanticTone} cells={values} activity={activity}
              inspection={updates.filter(update => update.inspection).at(-1)?.cells} queueItems={queueItems}
              applicationSurface={polished ? `url(#${id}-surface-screen)` : undefined} />;
          })()
          : repeat ? Array.from({ length: repeat.count }, (_, index) => <g key={index}
            transform={`translate(${index % repeat.columns * repeat.dx} ${Math.floor(index / repeat.columns) * repeat.dy})`}>
            <Geometry shape={layer.shape} attributes={attrs} polished={polished} />
          </g>) : <Geometry shape={layer.shape} attributes={attrs} polished={polished} />}
      {layer.annotation && <text x={layer.annotation.x} y={layer.annotation.y} dominantBaseline="central" textAnchor="middle"
        fontFamily={design.typography.fontFamilySans} fontSize={layer.annotation.size} fontWeight="700" fill={colors.ink}>{layer.label}</text>}
    </g>;
  };
  let viewpoint = { scale: 1, x: 0, y: 0 };
  for (const camera of vector.cameraTrack ?? (vector.camera ? [vector.camera] : [])) {
    if (camera.start > frame) break;
    const t = progress(camera);
    const fitted = vector.cameraTrack && vector.fit && camera.zoom > 1;
    const targetX = fitted ? (535 - vector.fit!.x) / vector.fit!.scale - camera.center[0] * camera.zoom : camera.center[0] * (1 - camera.zoom);
    const targetY = fitted ? (729.5 - vector.fit!.y) / vector.fit!.scale - camera.center[1] * camera.zoom : camera.center[1] * (1 - camera.zoom);
    viewpoint = { scale: viewpoint.scale + (camera.zoom - viewpoint.scale) * t,
      x: viewpoint.x + (targetX - viewpoint.x) * t,
      y: viewpoint.y + (targetY - viewpoint.y) * t };
  }
  const zoomTransform = viewpoint.scale !== 1 || viewpoint.x !== 0 || viewpoint.y !== 0
    ? `translate(${viewpoint.x} ${viewpoint.y}) scale(${viewpoint.scale})`
    : undefined;
  const fitTransform = vector.fit && `translate(${vector.fit.x} ${vector.fit.y}) scale(${vector.fit.scale})`;
  const full = Boolean(vector.framing && vector.fit);
  const transform = full ? [fitTransform, zoomTransform].filter(Boolean).join(' ') : zoomTransform ?? fitTransform;
  const credits = [...new Set(vector.layers.map(layer => layer.credit).filter(Boolean))];
  return <svg viewBox={full ? '0 0 1080 1920' : '0 0 900 1120'} aria-label={vector.subject} role="img"
    style={{ position: 'absolute', left: full ? 0 : 65, top: full ? 0 : 215,
      width: full ? 1080 : 900, height: full ? 1920 : 1120, overflow: 'hidden', pointerEvents: 'none' }}>
    <defs>
      {full && vector.cameraTrack && <clipPath id={`${id}-viewport`} clipPathUnits="userSpaceOnUse">
        <rect x="50" y="106" width="965" height="1250" />
      </clipPath>}
      <filter id={`${id}-effect-glow`} x="-12%" y="-12%" width="124%" height="124%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={colors.cyan} floodOpacity=".24" />
      </filter>
      <filter id={`${id}-effect-shadow`} x="-12%" y="-12%" width="124%" height="124%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor={colors.canvas} floodOpacity=".65" />
      </filter>
      {polished && Object.entries(polishedSurfaces).map(([name, [highlight, base, shade]]) =>
        <linearGradient key={name} id={`${id}-surface-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="34%" stopColor={base} />
          <stop offset="100%" stopColor={shade} />
        </linearGradient>)}
      {polished && (['cyan', 'purple'] as const).map(tone =>
        <filter key={tone} id={`${id}-effect-glow-${tone}`} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor={colors[tone]} floodOpacity=".48" />
        </filter>)}
      {vector.definitions.map(item => {
        const name = `${id}-def-${item.id}`;
        if (item.kind === 'gradient') return <linearGradient key={item.id} id={name}
          x2={item.axis === 'horizontal' ? '100%' : '0%'} y2={item.axis === 'vertical' ? '100%' : '0%'}>
          <stop offset="0%" stopColor={item.from === 'none' ? colors.canvas : colors[item.from]} stopOpacity={item.from === 'none' ? 0 : 1} />
          <stop offset="100%" stopColor={item.to === 'none' ? colors.canvas : colors[item.to]} stopOpacity={item.to === 'none' ? 0 : 1} />
        </linearGradient>;
        if (item.kind === 'pattern') return <pattern key={item.id} id={name} width={item.spacing} height={item.spacing} patternUnits="userSpaceOnUse">
          {item.mark === 'dot' ? <circle cx={item.spacing / 2} cy={item.spacing / 2} r="1.8" fill={colors[item.tone]} opacity=".35" />
            : <path d={`M0 ${item.spacing} V0 H${item.spacing}`} stroke={colors[item.tone]} strokeWidth="1" opacity=".4" />}
        </pattern>;
        if (item.kind === 'clip') return <clipPath key={item.id} id={name} clipPathUnits="userSpaceOnUse"><Geometry shape={item.shape} /></clipPath>;
        return <mask key={item.id} id={name} maskUnits="userSpaceOnUse" x={0} y={0} width={900} height={1120}>
          <Geometry shape={item.shape} attributes={{ fill: 'white' }} />
        </mask>;
      })}
    </defs>
    <g clipPath={full && vector.cameraTrack ? `url(#${id}-viewport)` : undefined}>
    <g transform={transform}>
      {cache.connectors.map(route => {
        if (frame <= route.start) return null;
        const draw = interpolate(frame, [route.start, route.start + Math.max(1, route.frames * .45)], [0, 1], motionEase);
        const d = draw >= 1 ? route.path : cutPath(route.path, route.length * draw);
        const active = frame <= route.start + route.frames;
        return <g key={route.id} fill="none" stroke={colors[route.tone]} strokeDasharray="9 8" strokeLinecap="round" strokeLinejoin="round">
          {polished && active && (route.tone === 'cyan' || route.tone === 'purple') &&
            <path d={d} strokeWidth="7" opacity=".22" />}
          <path d={d} strokeWidth={active ? 3.2 : 2.7} opacity={active ? .97 : .58} />
        </g>;
      })}
      {(cache.children.get(null) ?? []).map(renderLayer)}
      {cache.connectors.map(route => {
        const relative = (frame - route.start) / route.frames;
        if (relative < 0 || relative > 1 + fps * .43 / route.frames) return null;
        const pulse = relative < 1 ? 0 : interpolate(frame, [route.start + route.frames, route.start + route.frames + fps * .43], [.7, 0], motionEase);
        const end = getPointAtLength(route.path, route.length);
        return <g key={route.id}>
          {Array.from({ length: route.packets }, (_, i) => {
            const fraction = (relative - .12 - i * .12) / (.88 - i * .12);
            const point = fraction >= 0 && fraction < 1 ? getPointAtLength(route.path, fraction * route.length) : null;
            if (!point) return null;
            return route.cargo === 'parcel'
              ? <g key={i} transform={`translate(${point.x - 32} ${point.y - 32}) scale(.64)`}><ParcelGlyph /></g>
              : polished && (route.tone === 'cyan' || route.tone === 'purple')
                ? <g key={i} transform={`translate(${point.x} ${point.y})`}>
                  <circle r="10" fill={colors[route.tone]} opacity=".20" />
                  <circle r="5.8" fill={colors[route.tone]} />
                  <circle r="2.5" fill={colors.ink} opacity=".86" />
                </g>
                : <circle key={i} cx={point.x} cy={point.y} r="6" fill={colors[route.tone]} />;
          })}
          {pulse > 0 && end && <circle cx={end.x} cy={end.y} r={12 + (1 - pulse) * 12}
            fill="none" stroke={colors[route.tone]} strokeWidth="2.5" opacity={pulse} />}
        </g>;
      })}
    </g>
    </g>
    {credits.length > 0 && <text x={full ? 1005 : 892} y={full ? 1360 : 1100} textAnchor="end" fontSize="21" fill={colors.secondary}>{credits.join(' · ')}</text>}
  </svg>;
}
