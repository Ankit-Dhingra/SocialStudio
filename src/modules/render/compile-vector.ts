import { getBoundingBox, getLength, getPointAtLength, getSubpaths, parsePath } from '@remotion/paths';
import type { TimedVector, VectorComposition, VectorGeometry } from '../video/vector-spec.js';
import { vectorTextAdvance } from './vector-text-metrics.js';

type Bounds = { x1: number; y1: number; x2: number; y2: number };
const bounds = (x: number, y: number, width: number, height: number): Bounds => ({ x1: x, y1: y, x2: x + width, y2: y + height });
const inside = (b: Bounds) => [b.x1, b.y1, b.x2, b.y2].every(Number.isFinite)
  && b.x1 >= 0 && b.y1 >= 0 && b.x2 <= 900 && b.y2 <= 1120;
const offset = (b: Bounds, x: number, y: number) => ({ x1: b.x1 + x, x2: b.x2 + x, y1: b.y1 + y, y2: b.y2 + y });
const union = (a: Bounds, b: Bounds) => ({ x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1),
  x2: Math.max(a.x2, b.x2), y2: Math.max(a.y2, b.y2) });
const intersects = (a: Bounds, b: Bounds) => a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1;
const contains = (outer: Bounds, inner: Bounds, padding = 0) =>
  outer.x1 + padding <= inner.x1 && outer.y1 + padding <= inner.y1
  && outer.x2 - padding >= inner.x2 && outer.y2 - padding >= inner.y2;
const widthOf = (b: Bounds) => b.x2 - b.x1;
const heightOf = (b: Bounds) => b.y2 - b.y1;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export const vectorSafeArea = { x1: 65, x2: 1005, y1: 124, y2: 1335 };
const stage = vectorSafeArea;

function polishFit(sweep: Bounds, focus: Bounds, fit: NonNullable<TimedVector['fit']>, minScale: number) {
  const gutter = 16;
  const preferred = Math.min((widthOf(stage) - gutter * 2) / widthOf(sweep), (heightOf(stage) - gutter * 2) / heightOf(sweep),
    830 / widthOf(focus), 960 / heightOf(focus));
  const scale = clamp(preferred, Math.min(fit.scale, Math.max(minScale, fit.scale * .94)), fit.scale);
  const place = (contentStart: number, contentEnd: number, focusStart: number, focusEnd: number, safeStart: number, safeEnd: number) => {
    const padding = Math.min(gutter, Math.max(0, (safeEnd - safeStart - (contentEnd - contentStart) * scale) / 2));
    const center = (safeStart + safeEnd - (contentStart + contentEnd) * scale) / 2;
    const bias = clamp(((contentStart + contentEnd) - (focusStart + focusEnd)) * scale * .12, -24, 24);
    return clamp(center + bias, safeStart + padding - contentStart * scale, safeEnd - padding - contentEnd * scale);
  };
  return { scale, x: place(sweep.x1, sweep.x2, focus.x1, focus.x2, stage.x1, stage.x2),
    y: place(sweep.y1, sweep.y2, focus.y1, focus.y2, stage.y1, stage.y2) };
}

function geometryBounds(shape: VectorGeometry, measureText = false): Bounds | undefined {
  switch (shape.kind) {
    case 'rect': case 'asset': case 'object': return bounds(...shape.box);
    case 'circle': return bounds(shape.center[0] - shape.radius, shape.center[1] - shape.radius, 2 * shape.radius, 2 * shape.radius);
    case 'ellipse': return bounds(shape.center[0] - shape.radii[0], shape.center[1] - shape.radii[1], 2 * shape.radii[0], 2 * shape.radii[1]);
    case 'path': {
      const count = parsePath(shape.d).length;
      if (!/^M\s*\d/.test(shape.d.trimStart()) || count < 2 || count > 75 || getLength(shape.d) <= 0) throw new Error('Invalid bounded path.');
      return getBoundingBox(shape.d);
    }
    case 'polygon': case 'polyline': case 'line': {
      const xs = shape.points.map(point => point[0]);
      const ys = shape.points.map(point => point[1]);
      return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
    }
    case 'text': {
      const estimate = (measureText ? vectorTextAdvance(shape.text) : Array.from(shape.text).length * .64) * shape.size;
      return bounds(shape.point[0] - estimate * (shape.anchor === 'middle' ? 0.5 : shape.anchor === 'end' ? 1 : 0),
        shape.point[1] - shape.size, estimate, shape.size * 1.25);
    }
    case 'group': return;
  }
}

interface Options {
  fps: number;
  duration: number;
  cueFrame: (cue: string) => number | undefined;
  labelGrounded: (label: string) => boolean;
  subjectGrounded?: (label: string) => boolean;
  technicalLabelGrounded?: (label: string) => boolean;
  asset: (id: string) => Promise<{ asset: string; credit?: string }>;
  timedStateFrames?: readonly number[];
  polish?: boolean;
  repairImport?: boolean;
  reportLayoutWarning?: (warning: VectorLayoutWarning) => void;
}

export class VectorFocalError extends Error {
  constructor(readonly entries: { index?: number; message: string }[]) {
    super(entries[0].message);
  }
}

export class VectorConnectorPortError extends Error {
  constructor(readonly index: number, readonly end: 'from' | 'to', message: string) {
    super(message);
  }
}

export class VectorLayoutError extends Error {
  constructor(readonly path: string, message: string, readonly resolution: string) {
    super(message);
  }
}

export type VectorLayoutWarning = { path: string; message: string; resolution: string };

export async function compileVector(composition: VectorComposition, options: Options): Promise<TimedVector> {
  const { fps, duration } = options;
  const frameAt = (cue: string) => {
    const frame = options.cueFrame(cue);
    if (frame === undefined || frame >= duration - Math.round(fps * 0.26)) throw new Error(`Unknown or late cue: ${cue}`);
    return frame;
  };
  const requireUnique = (items: string[]) => {
    if (new Set(items).size !== items.length) throw new Error('Duplicate vector identifiers or bindings.');
  };
  if (!(options.subjectGrounded ?? options.labelGrounded)(composition.subject)) throw new Error('Vector subject must be grounded in the narration or approved title.');
  requireUnique(composition.layers.map(layer => layer.id));
  requireUnique(composition.definitions.map(item => item.id));
  requireUnique(composition.treatments.map(item => item.target));
  requireUnique(composition.repeats.map(item => item.target));
  requireUnique(composition.tracks.map(item => `${item.target}:${item.kind}`));
  const definitions = new Map(composition.definitions.map(item => [item.id, item]));
  const source = new Map(composition.layers.map(layer => [layer.id, layer]));
  const treatments = new Map(composition.treatments.map(item => [item.target, item]));
  const repeats = new Map(composition.repeats.map(item => [item.target, item]));
  const extents = new Map<string, Bounds>();
  const regions = new Map<string, Bounds>();
  const depth = new Map<string, number>();
  for (const item of composition.definitions) {
    if ('shape' in item) {
      const region = geometryBounds(item.shape);
      if (!region || !inside(region)) throw new Error('Mask or clip exceeds the canvas.');
      regions.set(item.id, region);
    }
  }
  for (const item of composition.treatments) {
    if (!source.has(item.target)) throw new Error('Invalid vector style target.');
    if (item.fill && !['gradient', 'pattern'].includes(definitions.get(item.fill)?.kind ?? '')) throw new Error('Invalid paint reference.');
    if (item.clip && definitions.get(item.clip)?.kind !== 'clip') throw new Error('Invalid clip reference.');
    if (item.mask && definitions.get(item.mask)?.kind !== 'mask') throw new Error('Invalid mask reference.');
  }
  if (composition.repeats.reduce((sum, item) => sum + item.count, composition.layers.length) > 125) {
    throw new Error('Vector scene exceeds the repetition budget.');
  }
  const layers: TimedVector['layers'] = [];
  const repeatPaint = new Map<string, Bounds>();
  for (const [index, { at, ...layer }] of composition.layers.entries()) {
    const parentDepth = layer.parent ? depth.get(layer.parent) : 0;
    if (parentDepth === undefined || parentDepth >= 4 || (layer.parent && source.get(layer.parent)?.shape.kind !== 'group')) {
      throw new Error('Vector groups must precede their children and use bounded nesting.');
    }
    depth.set(layer.id, parentDepth + 1);
    let shape = layer.shape;
    if (options.repairImport && shape.kind === 'text') {
      const maxSize = Math.floor(898 / vectorTextAdvance(shape.text));
      if (maxSize < shape.size && maxSize >= Math.max(28, shape.size * .88)) {
        shape = { ...shape, size: maxSize };
        layer.shape = shape;
      }
      const [x, y] = shape.point;
      const measured = geometryBounds(shape, true)!;
      const dx = Math.max(0, -measured.x1) - Math.max(0, measured.x2 - 900);
      const dy = Math.max(0, -measured.y1) - Math.max(0, measured.y2 - 1120);
      if ((dx || dy) && Math.abs(dx) <= 90 && Math.abs(dy) <= 40) {
        shape = { ...shape, point: [x + dx, y + dy] };
        layer.shape = shape;
      }
    }
    if (shape.kind === 'text' && (!options.labelGrounded(shape.text) && !options.technicalLabelGrounded?.(shape.text)
      || options.technicalLabelGrounded && /\p{Script=Devanagari}/u.test(shape.text))) {
      throw new Error(`Vector labels must use short Roman-script text and meet the source's label rules. Check layer ${layer.id}.`);
    }
    if (shape.kind === 'object') {
      const grounded = options.technicalLabelGrounded ?? options.labelGrounded;
      if (!grounded(shape.label) || (shape.detail && !grounded(shape.detail))) throw new Error('Object labels and details must be grounded.');
      if (shape.box[2] < 110 || shape.box[3] < (['document', 'database', 'rack', 'application'].includes(shape.family) ? 150 : 61)) {
        throw new Error('Technical object is too small for its internal detail.');
      }
      if ((shape.family === 'vector') !== Boolean(shape.values)) throw new Error('Only numerical vector objects use illustrative values.');
    }
    let box = geometryBounds(shape, options.repairImport);
    if (layer.label && (!box || shape.kind === 'text' || shape.kind === 'object'
      || (!options.labelGrounded(layer.label) && !options.technicalLabelGrounded?.(layer.label)))) {
      throw new Error(`Layer ${layer.id} needs a grounded label on a primitive with a measurable box.`);
    }
    const annotation = layer.label && box ? { x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2,
      size: Math.min(44, heightOf(box) * .62, widthOf(box) / Math.max(3, layer.label.length * .62)) } : undefined;
    const repeat = repeats.get(layer.id);
    if (repeat) {
      if (!box || ['asset', 'text', 'object'].includes(shape.kind)
        || (Math.min(repeat.count, repeat.columns) > 1 && !repeat.dx)
        || (repeat.count > repeat.columns && !repeat.dy)) throw new Error('Invalid vector repeat.');
      box = { ...box, x2: box.x2 + (Math.min(repeat.count, repeat.columns) - 1) * repeat.dx,
        y2: box.y2 + Math.floor((repeat.count - 1) / repeat.columns) * repeat.dy };
      if (options.repairImport && layer.stroke !== 'none' && !treatments.get(layer.id)?.clip && !treatments.get(layer.id)?.mask) {
        const radius = (treatments.get(layer.id)?.strokeWidth ?? 3) / 2;
        const painted = bounds(box.x1 - radius, box.y1 - radius, widthOf(box) + radius * 2, heightOf(box) + radius * 2);
        if (!inside(painted)) {
          throw new VectorLayoutError(`repeats.${composition.repeats.indexOf(repeat)}`, `Repeated layer "${layer.id}" extends beyond the artboard, including its stroke.`,
            'Reduce repeat spacing or count, or move the repeated geometry inward. Check all rows and columns.');
        }
        repeatPaint.set(layer.id, painted);
      }
    }
    if (box && !inside(box)) throw new VectorLayoutError(`layers.${index}.shape`, `Vector layer "${layer.id}" exceeds the 900 × 1120 artboard.`,
      shape.kind === 'text' ? 'Shorten the label or adjust its anchor point and size. Leave a gutter at the artboard edge.'
        : 'Move or resize this geometry within the artboard. Preserve the intended alignment.');
    if (box) extents.set(layer.id, box);
    layers.push({ ...layer, annotation, start: at === null ? 0 : frameAt(at),
      ...(shape.kind === 'asset' ? await options.asset(shape.assetId) : {}) });
  }
  if (composition.repeats.some(item => !source.has(item.target))) throw new Error('Unknown repeated layer.');
  for (const layer of [...layers].reverse()) {
    const extent = extents.get(layer.id);
    if (!layer.parent || !extent) continue;
    const parentExtent = extents.get(layer.parent);
    extents.set(layer.parent, parentExtent ? union(parentExtent, extent) : extent);
  }
  const tracks = composition.tracks.map(track => {
    const layer = layers.find(layer => layer.id === track.target);
    if (!layer) throw new Error('Unknown animation target.');
    const extent = extents.get(layer.id);
    if (track.kind === 'move' && extent && [track.from, track.to].some(([x, y]) => !inside(offset(extent, x, y)))) {
      throw new Error('Translation exceeds the safe canvas.');
    }
    if (track.kind === 'draw' && (!['line', 'polyline', 'path'].includes(layer.shape.kind) || layer.stroke === 'none')) {
      throw new Error('Only visible stroked paths, lines and polylines can be drawn.');
    }
    if (track.kind === 'follow') {
      const route = source.get(track.path);
      if (route?.shape.kind !== 'path' || route.parent !== layer.parent || track.path === track.target
        || getSubpaths(route.shape.d).length !== 1
        || composition.tracks.some(candidate => candidate.target === route.id && ['move', 'scale', 'rotate', 'follow'].includes(candidate.kind))) {
        throw new Error('Follow requires a separate stationary continuous path in the same group.');
      }
      if (composition.tracks.some(other => other.target === layer.id && other.kind === 'move')) throw new Error('Follow and move cannot animate the same layer.');
      const first = getPointAtLength(route.shape.d, 0);
      const sweep = getBoundingBox(route.shape.d);
      if (!first || !extent || !inside(union(offset(extent, sweep.x1 - first.x, sweep.y1 - first.y),
        offset(extent, sweep.x2 - first.x, sweep.y2 - first.y)))) throw new Error('Path follower exceeds the safe canvas.');
    }
    const start = frameAt(track.cue);
    const frames = Math.max(1, Math.min(duration - start - 1, Math.round(fps * track.seconds)));
    return { ...track, start, frames };
  });
  const camera = composition.camera && { ...composition.camera, start: frameAt(composition.camera.cue),
    frames: Math.round(fps * composition.camera.seconds) };
  const cameraTrack = composition.cameraTrack?.map(key => ({ ...key, start: frameAt(key.cue), frames: Math.round(fps * key.seconds) }));
  if (cameraTrack && (camera || cameraTrack.some((key, index) => index > 0 && key.start < cameraTrack[index - 1].start + cameraTrack[index - 1].frames))) {
    throw new Error('Use a single camera or a non-overlapping camera track in narration order.');
  }
  requireUnique((composition.connectors ?? []).map(route => route.id));
  const movingTargets = new Set(tracks.filter(track => ['move', 'scale', 'rotate', 'follow'].includes(track.kind)).map(track => track.target));
  const isStationary = (target: string) => {
    let id: string | null = target;
    while (id) {
      if (movingTargets.has(id)) return false;
      id = source.get(id)?.parent ?? null;
    }
    return true;
  };
  const portPoint = ({ target, side }: NonNullable<VectorComposition['connectors']>[number]['from']): [number, number] => {
    const box = extents.get(target)!;
    return [side === 'left' ? box.x1 : side === 'right' ? box.x2 : (box.x1 + box.x2) / 2,
      side === 'top' ? box.y1 : side === 'bottom' ? box.y2 : (box.y1 + box.y2) / 2];
  };
  const connectors = composition.connectors?.map((submitted, index) => {
    const start = frameAt(submitted.cue);
    const frames = Math.max(1, Math.min(duration - 1 - start, Math.round(fps * submitted.seconds)));
    const resolvePort = (end: 'from' | 'to') => {
      const port = submitted[end];
      const layer = source.get(port.target);
      const box = extents.get(port.target);
      if (layer && box && layer.shape.kind !== 'text') {
        if (!isStationary(port.target)) throw new Error('Use a custom path for moving connector endpoints.');
        return port;
      }
      if (options.repairImport && layer?.shape.kind === 'text' && box) {
        const visibleBy = end === 'from' ? start : start + frames;
        const candidates = layers.filter(item => {
          const bounds = extents.get(item.id);
          return item.parent === layer.parent && bounds
            && ['rect', 'object', 'asset', 'ellipse', 'circle'].includes(item.shape.kind)
            && (item.fill !== 'none' || item.stroke !== 'none' || item.asset || item.shape.kind === 'object' || treatments.get(item.id)?.fill)
            && treatments.get(item.id)?.opacity !== 0 && item.start <= visibleBy && isStationary(item.id);
        });
        const enclosing = candidates.filter(item => contains(extents.get(item.id)!, box));
        const innermost = enclosing.filter(item => enclosing.every(other => other === item
          || contains(extents.get(other.id)!, extents.get(item.id)!)));
        // A caption directly outside a port can label that object without overlapping it.
        const nearby = enclosing.length ? [] : candidates.filter(item => {
          const bounds = extents.get(item.id)!;
          const x = (box.x1 + box.x2) / 2;
          const y = (box.y1 + box.y2) / 2;
          const gap = port.side === 'bottom' ? y - bounds.y2 : port.side === 'top' ? bounds.y1 - y
            : port.side === 'right' ? x - bounds.x2 : bounds.x1 - x;
          const aligned = port.side === 'bottom' || port.side === 'top' ? x >= bounds.x1 && x <= bounds.x2 : y >= bounds.y1 && y <= bounds.y2;
          return aligned && gap >= 0 && gap <= 96;
        });
        const matches = enclosing.length ? innermost : nearby;
        if (matches.length === 1) {
          const target = matches[0].id;
          if (target !== submitted[end === 'from' ? 'to' : 'from'].target) return { ...port, target };
        }
      }
      const reason = layer?.shape.kind === 'text' ? 'points to a text label without an unambiguous object port'
        : 'does not point to an existing object port';
      throw new VectorConnectorPortError(index, end, `Connector "${submitted.id}" ${end} target "${port.target}" ${reason}.`);
    };
    const from = resolvePort('from');
    const to = resolvePort('to');
    const repaired = from !== submitted.from || to !== submitted.to;
    const route = repaired ? { ...submitted, from, to } : submitted;
    if (route.from.target === route.to.target) throw new Error('Connector endpoints must be distinct.');
    const startPoint = portPoint(route.from);
    const endPoint = portPoint(route.to);
    const horizontalFrom = ['left', 'right'].includes(route.from.side);
    const horizontalTo = ['left', 'right'].includes(route.to.side);
    const midX = (startPoint[0] + endPoint[0]) / 2;
    const midY = (startPoint[1] + endPoint[1]) / 2;
    const bends = horizontalFrom === horizontalTo ? horizontalFrom
      ? [[midX, startPoint[1]], [midX, endPoint[1]]] : [[startPoint[0], midY], [endPoint[0], midY]]
      : horizontalFrom ? [[endPoint[0], startPoint[1]]] : [[startPoint[0], endPoint[1]]];
    const routePoints = (via: number[][]) => [startPoint, ...via, endPoint]
      .filter((point, i, list) => !i || point[0] !== list[i - 1][0] || point[1] !== list[i - 1][1]);
    const isOrthogonal = (points: number[][]) => points.length >= 2
      && points.every((point, i) => i === 0 || point[0] === points[i - 1][0] || point[1] === points[i - 1][1]);
    const leavesPort = ([x, y]: number[], [nextX, nextY]: number[], side: typeof route.from.side) =>
      side === 'top' ? x === nextX && nextY < y : side === 'bottom' ? x === nextX && nextY > y
        : side === 'left' ? y === nextY && nextX < x : y === nextY && nextX > x;
    const followsPorts = (points: number[][]) => leavesPort(points[0], points[1], route.from.side)
      && leavesPort(points.at(-1)!, points.at(-2)!, route.to.side);
    const sourceBounds = extents.get(from.target)!;
    const targetBounds = extents.get(to.target)!;
    const staysOutsidePorts = (path: number[][]) => path.every(([x, y], j) => {
      if (!j) return true;
      const [lastX, lastY] = path[j - 1];
      return [sourceBounds, targetBounds].every(box => x === lastX
        ? x <= box.x1 || x >= box.x2 || Math.max(y, lastY) <= box.y1 || Math.min(y, lastY) >= box.y2
        : y <= box.y1 || y >= box.y2 || Math.max(x, lastX) <= box.x1 || Math.min(x, lastX) >= box.x2);
    });
    const routeIsValid = (path: number[][]) => isOrthogonal(path) && followsPorts(path) && staysOutsidePorts(path);
    let via = route.via;
    let points = routePoints(via.length ? via : bends);
    if (options.repairImport && via.length && !routeIsValid(points)) {
      via = [];
      points = routePoints(bends);
    }
    if (options.repairImport && !routeIsValid(points)) {
      const stub = ([x, y]: [number, number], side: typeof route.from.side): [number, number] => [
        x + (side === 'right' ? 16 : side === 'left' ? -16 : 0), y + (side === 'bottom' ? 16 : side === 'top' ? -16 : 0),
      ];
      const a = stub(startPoint, from.side), b = stub(endPoint, to.side);
      const around = union(sourceBounds, targetBounds);
      const alternatives: [number, number][][] = [
        [a, [a[0], b[1]], b], [a, [b[0], a[1]], b],
        ...[around.x1 - 16, around.x2 + 16].map(x => [a, [x, a[1]], [x, b[1]], b] as [number, number][]),
        ...[around.y1 - 16, around.y2 + 16].map(y => [a, [a[0], y], [b[0], y], b] as [number, number][]),
      ];
      const fallback = alternatives.find(candidate => {
        if (!candidate.every(([x, y]) => x >= 0 && x <= 900 && y >= 0 && y <= 1120)) return false;
        return routeIsValid(routePoints(candidate));
      });
      if (fallback) { via = fallback; points = routePoints(via); }
    }
    if (options.repairImport && !routeIsValid(points)) throw new VectorLayoutError(`connectors.${index}.via`,
      `Connector "${route.id}" cannot leave and approach both ports without crossing an endpoint.`,
      'Choose outward-facing sides on both objects and leave a clear corridor for the route.');
    if (!isOrthogonal(points)) throw new Error('Connector via points must form an orthogonal route between the ports.');
    if (!followsPorts(points)) throw new Error('Each connector must follow its port direction.');
    const bendsOnly = points.filter(([x, y], i) => {
      if (i === 0 || i === points.length - 1) return true;
      const [px, py] = points[i - 1];
      const [nx, ny] = points[i + 1];
      return !(px === x && x === nx && (y - py) * (ny - y) > 0)
        && !(py === y && y === ny && (x - px) * (nx - x) > 0);
    });
    const path = bendsOnly.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
    if (layers.find(layer => layer.id === route.from.target)!.start > start
      || layers.find(layer => layer.id === route.to.target)!.start > start + frames) {
      throw new Error('Show the source before transfer and the receiver by arrival.');
    }
    return { ...route, via, path, start, frames };
  });
  for (const style of composition.treatments) {
    const extent = extents.get(style.target);
    for (const id of [style.clip, style.mask]) {
      const region = id && regions.get(id);
      if (extent && region && !intersects(extent, region)) throw new Error('Vector clip or mask hides its entire layer.');
      if (extent && region && !contains(region, extent) && source.get(style.target)?.shape.kind === 'text') {
        options.reportLayoutWarning?.({ path: `treatments.${composition.treatments.indexOf(style)}`,
          message: `Clip or mask "${id}" can cut off label "${style.target}".`,
          resolution: 'Check the visible text in the preview. Expand the clipping region if the effect is unintended.' });
      }
    }
  }
  const foreground = layers.filter(layer => {
    const box = extents.get(layer.id);
    return layer.shape.kind !== 'group' && layer.shape.kind !== 'text' && box && (layer.asset || layer.shape.kind === 'object' ||
      ((box.x2 - box.x1 > 20 || box.y2 - box.y1 > 20) &&
        (box.x2 - box.x1) * (box.y2 - box.y1) < 900 * 1120 * 0.56 &&
        (layer.stroke !== 'none' || layer.fill !== 'none' || treatments.get(layer.id)?.fill)));
  });
  const visibleFrames = new Set([0, duration - 1, ...tracks.flatMap(track => [track.start, track.start + track.frames])]);
  const visible = (layer: TimedVector['layers'][number], frame: number, stable = false): boolean => {
    if (layer.start > frame || treatments.get(layer.id)?.opacity === 0) return false;
    const animation = tracks.find(track => track.kind === 'opacity' && track.target === layer.id);
    if (animation?.kind === 'opacity' && (frame <= animation.start ? animation.from === 0
      : frame >= animation.start + animation.frames ? animation.to === 0 : animation.from === 0 && animation.to === 0)) return false;
    if (stable && animation?.kind === 'opacity') {
      if (frame > animation.start && frame < animation.start + animation.frames) return false;
      if ((frame <= animation.start ? animation.from : animation.to) < .5) return false;
    }
    const draw = tracks.find(track => track.kind === 'draw' && track.target === layer.id);
    if (draw && frame <= draw.start && layer.fill === 'none' && !treatments.get(layer.id)?.fill) return false;
    const apparentStroke = tracks.find(track => track.kind === 'stroke' && track.target === layer.id);
    if (apparentStroke?.kind === 'stroke' && layer.fill === 'none' && !treatments.get(layer.id)?.fill
      && (frame < apparentStroke.start + apparentStroke.frames ? apparentStroke.from === 'none' : apparentStroke.to === 'none')) return false;
    const parent = layer.parent && layers.find(item => item.id === layer.parent);
    return !parent || visible(parent, frame, stable);
  };
  for (const frame of visibleFrames) {
    if (!foreground.some(layer => visible(layer, frame))) throw new Error('Vector scene has no persistent teaching content at a keyframe.');
  }
  let fit: TimedVector['fit'];
  let focal = composition.focal;
  if (composition.framing) {
    const { framing } = composition;
    focal ??= [];
    if (!options.repairImport) requireUnique(focal);
    if (!camera && !cameraTrack?.length && !tracks.length && !connectors?.length && !options.timedStateFrames?.length
      && !layers.some(layer => layer.start > 0) && duration > fps * 3) {
      throw new Error('Plan a narration-timed visual change for this mechanism.');
    }
    const isDescendant = (id: string, ancestor: string): boolean => {
      const parent = source.get(id)?.parent;
      return Boolean(parent && (parent === ancestor || isDescendant(parent, ancestor)));
    };
    if (!focal.length) {
      if (!options.repairImport) throw new Error('Composition requires real geometry for every focal layer.');
      throw new VectorFocalError([{ message: 'Choose at least one visible foreground object for composition.focal.' }]);
    }
    const focalIssues = focal.flatMap((id, index) => {
      const layer = source.get(id);
      const reason = !layer ? 'does not match a layer ID'
        : layer.shape.kind === 'text' ? 'points to a text label'
          : extents.has(id) && foreground.some(item => item.id === id || isDescendant(item.id, id)) ? undefined
            : 'has no qualifying foreground geometry. Use a painted object or a group that contains one';
      return reason ? [{ index, message: `Focal ID "${id}" ${reason}.` }] : [];
    });
    if (options.repairImport) {
      const rejected = new Set(focalIssues.map(issue => issue.index));
      const valid = [...new Set(focal.filter((_, index) => !rejected.has(index)))];
      if (!valid.length) throw new VectorFocalError(focalIssues);
      if (valid.length !== focal.length) focal = valid;
    } else if (focalIssues.length) throw new Error('Composition requires real geometry for every focal layer.');
    const visibleGeometry = layers.filter(layer => layer.shape.kind !== 'group' && extents.has(layer.id)
      && (layer.shape.kind === 'object' || layer.fill !== 'none' || layer.stroke !== 'none' || layer.asset || treatments.get(layer.id)?.fill));
    const content = visibleGeometry.map(layer => repeatPaint.get(layer.id) ?? extents.get(layer.id)!).reduce(union);
    for (const layer of visibleGeometry) {
      const box = extents.get(layer.id)!;
      if (layer.shape.kind !== 'rect' || widthOf(box) < widthOf(content) * .82 || heightOf(box) < heightOf(content) * .72
        || widthOf(box) * heightOf(box) < 390_000) continue;
      const container = focal.includes(layer.id) && ['device', 'data', 'spatial'].includes(framing);
      if (!container && visibleGeometry.filter(other => other.id !== layer.id && contains(box, extents.get(other.id)!, 5)).length >= 3) {
        throw new Error('Remove the outer scene panel. Place teaching objects directly on the shared grid.');
      }
    }
    const focus = focal.map(id => extents.get(id)!).reduce(union);
    let sweep = connectors?.reduce((box, route) => union(box, getBoundingBox(route.path)), content) ?? content;
    const childSweeps = new Map<string, Bounds>();
    for (const layer of [...layers].reverse()) {
      let box = layer.shape.kind === 'group' ? childSweeps.get(layer.id)
        : visibleGeometry.includes(layer) ? repeatPaint.get(layer.id) ?? extents.get(layer.id) : undefined;
      if (!box) continue;
      for (const track of tracks.filter(track => track.target === layer.id).reverse()) {
        if (track.kind === 'move') box = union(box, union(offset(box, ...track.from), offset(box, ...track.to)));
        if (track.kind === 'follow') {
          const route = source.get(track.path)?.shape;
          if (route?.kind !== 'path') continue;
          const first = getPointAtLength(route.d, 0);
          if (!first) continue;
          const path = getBoundingBox(route.d);
          box = union(box, union(offset(box, path.x1 - first.x, path.y1 - first.y), offset(box, path.x2 - first.x, path.y2 - first.y)));
        }
        if (track.kind === 'rotate') {
          const { x1, y1, x2, y2 } = box;
          const corners = [x1, x2].flatMap(x => [y1, y2].map(y => Math.hypot(x - 450, y - 560)));
          const r = Math.max(...corners);
          box = bounds(450 - r, 560 - r, r * 2, r * 2);
        }
        if (track.kind === 'scale') {
          const { x1, y1 } = box;
          const width = widthOf(box);
          const height = heightOf(box);
          for (const scale of [track.from, track.to]) {
            box = union(box, bounds(450 + (x1 - 450) * scale, 560 + (y1 - 560) * scale, width * scale, height * scale));
          }
        }
      }
      if (layer.parent) {
        const prior = childSweeps.get(layer.parent);
        childSweeps.set(layer.parent, prior ? union(prior, box) : box);
      } else sweep = union(sweep, box);
    }
    const movement = sweep;
    for (const key of camera ? [camera] : []) {
      sweep = union(sweep, bounds(key.center[0] + (movement.x1 - key.center[0]) * key.zoom,
        key.center[1] + (movement.y1 - key.center[1]) * key.zoom, widthOf(movement) * key.zoom, heightOf(movement) * key.zoom));
    }
    const scale = framing === 'continuous' ? 1.04 : Math.min(2.35, widthOf(stage) / widthOf(sweep), heightOf(stage) / heightOf(sweep));
    const focalSize = Math.max(widthOf(focus), heightOf(focus));
    if (focalSize * scale < 310) throw new Error('Enlarge the focal object or extend the mechanism across the canvas.');
    if (options.repairImport && 30 / scale <= 70) {
      const minimumSize = Math.ceil(30 / scale);
      const textLayers = layers.filter(layer => layer.shape.kind === 'text');
      for (const layer of textLayers) {
        const shape = layer.shape;
        if (shape.kind !== 'text' || shape.size >= minimumSize || minimumSize - shape.size > 4
          || !isStationary(layer.id)) continue;
        const resized = { ...shape, size: minimumSize };
        const original = extents.get(layer.id)!;
        const measured = geometryBounds(resized, true)!;
        const collides = textLayers.some(other => {
          if (other === layer) return false;
          const box = extents.get(other.id)!;
          return intersects(measured, box) && !intersects(original, box);
        });
        if (inside(measured) && contains(content, measured) && !collides) {
          layer.shape = resized;
          extents.set(layer.id, measured);
        }
      }
    }
    const textSize = Math.min(...layers.map(layer => layer.shape.kind === 'text' ? layer.shape.size : layer.annotation?.size ?? 70));
    if (textSize * scale < 30) {
      const index = layers.findIndex(layer => (layer.shape.kind === 'text' ? layer.shape.size : layer.annotation?.size ?? 70) === textSize);
      throw new VectorLayoutError(`layers.${index}.${layers[index].shape.kind === 'text' ? 'shape.size' : 'label'}`,
        `Technical label "${layers[index].id}" fits at ${(textSize * scale).toFixed(1)} px. Use at least 30 px in the full-size frame.`,
        'Increase the label size or give it more width. Shorten the text if it would overflow.');
    }
    fit = framing === 'continuous' ? { scale, x: 65, y: 155 } : {
      scale, x: (stage.x1 + stage.x2 - scale * (sweep.x1 + sweep.x2)) / 2,
      y: (stage.y1 + stage.y2 - scale * (sweep.y1 + sweep.y2)) / 2,
    };
    if (framing === 'continuous' && !contains(stage, bounds(fit.x + sweep.x1 * scale, fit.y + sweep.y1 * scale,
      widthOf(sweep) * scale, heightOf(sweep) * scale))) throw new Error('Continuous scene leaves the stable safe area.');
    if (options.polish && framing !== 'continuous' && !cameraTrack) {
      fit = polishFit(sweep, focus, fit, Math.max(310 / focalSize, 30 / textSize));
    }
  } else if (!camera && !tracks.some(track => ['move', 'scale', 'rotate', 'follow'].includes(track.kind))) {
    const visibleBounds = Array.from(extents.values()).reduce(union);
    const width = visibleBounds.x2 - visibleBounds.x1;
    const height = visibleBounds.y2 - visibleBounds.y1;
    const scale = Math.min(1.45, 830 / width, 1000 / height);
    if (scale > 1.1) fit = { scale, x: 450 - scale * (visibleBounds.x1 + width / 2),
      y: 550 - scale * (visibleBounds.y1 + height / 2) };
  }
  if (options.reportLayoutWarning) {
    const labels = layers.filter(layer => layer.shape.kind === 'text' && isStationary(layer.id)
      && (layer.fill !== 'none' || layer.stroke !== 'none' || treatments.get(layer.id)?.fill));
    const samples = [...new Set([...visibleFrames, ...labels.map(layer => layer.start)])].sort((a, b) => a - b);
    for (const [index, layer] of labels.entries()) {
      const a = extents.get(layer.id)!;
      for (const other of labels.slice(index + 1)) {
        if (layer.shape.kind !== 'text' || other.shape.kind !== 'text' || layer.shape.text === other.shape.text) continue;
        const b = extents.get(other.id)!;
        const width = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
        const height = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
        const area = Math.min(widthOf(a) * heightOf(a), widthOf(b) * heightOf(b));
        if (width < 6 || height < 6 || width * height < area * .25) continue;
        const frame = samples.find(value => visible(layer, value, true) && visible(other, value, true));
        if (frame === undefined) continue;
        options.reportLayoutWarning({ path: `layers.${layers.indexOf(other)}.shape.point`,
          message: `Labels "${layer.id}" and "${other.id}" may overlap at sequence frame ${frame}.`,
          resolution: 'Review both labels in the preview. Adjust their authored positions or reveal timing if they overlap.' });
      }
    }
  }
  const events = [...tracks, ...(connectors ?? [])].map(track => track.start).filter(frame => frame > 0);
  return { ...composition, ...(focal === composition.focal ? {} : { focal }), layers, tracks, camera, cameraTrack, connectors, fit,
    ...(options.polish ? { presentation: 'polished' as const } : {}), focus: events.length ? Math.min(...events) : undefined };
}
