import { z } from 'zod';

const id = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/i);
const x = z.number().min(0).max(900);
const y = z.number().min(0).max(1120);
const point = z.tuple([x, y]);
const box = z.tuple([x, y, z.number().gt(0).max(900), z.number().gt(0).max(1120)]);
const radius = z.number().gt(0).max(560);
const opacity = z.number().min(0).max(1);
const cue = z.string().trim().min(1).max(220);
const paint = z.enum(['none', 'ink', 'secondary', 'muted', 'surface', 'elevated', 'border',
  'structure', 'detail', 'documentLine', 'vectorValue', 'pdfBadge', 'databaseTop',
  'cyan', 'purple', 'success', 'warning', 'error']);
const pathData = z.string().min(4).max(1600).regex(/^[MLHVCQZ0-9.\-+,\s]+$/);
const rect = z.strictObject({ kind: z.literal('rect'), box, radius: z.number().min(0).max(120) });
const circle = z.strictObject({ kind: z.literal('circle'), center: point, radius });
const pathShape = z.strictObject({ kind: z.literal('path'), d: pathData });
const polygon = z.strictObject({ kind: z.literal('polygon'), points: z.array(point).min(3).max(32) });
const area = z.discriminatedUnion('kind', [rect, circle, pathShape, polygon]);
export const technicalFamilies = ['document', 'chunk', 'vector', 'database', 'rack', 'service', 'application', 'entry', 'status', 'matrix', 'parcel',
  'tree', 'hash', 'queue', 'conveyor', 'scanner', 'sensor', 'tag', 'diverter', 'chute'] as const;
const technicalObject = z.strictObject({
  kind: z.literal('object'), family: z.enum(technicalFamilies), box,
  label: z.string().trim().min(1).max(34),
  detail: z.string().trim().max(36).nullable(),
  values: z.array(z.number().min(-1).max(1)).min(2).max(4).nullable(),
  cells: z.array(z.string().max(4)).min(2).max(8).optional(),
  tone: z.enum(['cyan', 'purple', 'structure', 'success', 'warning', 'error']),
});
const geometry = z.discriminatedUnion('kind', [
  rect, circle, pathShape, polygon,
  z.strictObject({ kind: z.literal('ellipse'), center: point, radii: z.tuple([radius, radius]) }),
  z.strictObject({ kind: z.literal('polyline'), points: z.array(point).min(2).max(32) }),
  z.strictObject({ kind: z.literal('line'), points: z.tuple([point, point]) }),
  z.strictObject({ kind: z.literal('text'), point, text: z.string().trim().min(1).max(48),
    size: z.number().int().min(12).max(70), anchor: z.enum(['start', 'middle', 'end']) }),
  z.strictObject({ kind: z.literal('group') }),
  z.strictObject({ kind: z.literal('asset'), assetId: id, box, fit: z.enum(['cover', 'contain']).optional() }),
  technicalObject,
]);
const definition = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('gradient'), id, from: paint, to: paint, axis: z.enum(['vertical', 'horizontal']) }),
  z.strictObject({ kind: z.literal('pattern'), id, spacing: z.number().int().min(12).max(120), tone: paint,
    mark: z.enum(['dot', 'grid']) }),
  z.strictObject({ kind: z.literal('clip'), id, shape: area }),
  z.strictObject({ kind: z.literal('mask'), id, shape: area }),
]);
const signed = z.number().min(-900).max(900);
const transition = { target: id, cue, seconds: z.number().min(0.2).max(4) };
const track = z.discriminatedUnion('kind', [
  z.strictObject({ ...transition, kind: z.literal('move'), from: z.tuple([signed, signed]), to: z.tuple([signed, signed]) }),
  z.strictObject({ ...transition, kind: z.literal('scale'), from: z.number().min(0.2).max(2), to: z.number().min(0.2).max(2) }),
  z.strictObject({ ...transition, kind: z.literal('rotate'), from: signed, to: signed }),
  z.strictObject({ ...transition, kind: z.literal('opacity'), from: opacity, to: opacity }),
  z.strictObject({ ...transition, kind: z.literal('stroke'), from: paint, to: paint }),
  z.strictObject({ ...transition, kind: z.literal('draw') }),
  z.strictObject({ ...transition, kind: z.literal('follow'), path: id }),
]);
export const compositionStrategies = ['cinematic', 'hero', 'device', 'vertical', 'horizontal', 'branching', 'canvas',
  'comparison', 'transformation', 'layered', 'spatial', 'data', 'architecture', 'detail', 'continuous'] as const;

const port = z.strictObject({ target: id, side: z.enum(['top', 'right', 'bottom', 'left']) });
const connector = z.strictObject({
  id, from: port, to: port, via: z.array(point).max(5), cue, seconds: z.number().min(.4).max(3),
  tone: z.enum(['cyan', 'purple', 'warning', 'error']), packets: z.number().int().min(0).max(3),
  cargo: z.literal('parcel').optional(),
});
const camera = z.strictObject({ cue, center: point, zoom: z.number().min(1).max(1.25),
  seconds: z.number().min(0.35).max(3) });
const cameraKey = camera.extend({ zoom: z.number().min(1).max(1.8) });
export const vectorCompositionSchema = z.strictObject({
  subject: z.string().trim().min(1).max(36),
  framing: z.enum(compositionStrategies).optional(),
  focal: z.array(id).min(1).max(6).optional(),
  layers: z.array(z.strictObject({
    id, parent: id.nullable(), shape: geometry, at: cue.nullable(), fill: paint, stroke: paint,
    label: z.string().trim().min(1).max(34).optional(),
  })).min(3).max(34),
  definitions: z.array(definition).max(9),
  treatments: z.array(z.strictObject({ target: id, fill: id.nullable(), clip: id.nullable(), mask: id.nullable(),
    effect: z.enum(['none', 'glow', 'shadow']), opacity, strokeWidth: z.number().min(1).max(12) })).max(14),
  repeats: z.array(z.strictObject({ target: id, count: z.number().int().min(2).max(36), columns: z.number().int().min(1).max(12),
    dx: z.number().min(0).max(450), dy: z.number().min(0).max(450) })).max(8),
  tracks: z.array(track).max(16),
  connectors: z.array(connector).max(12).optional(),
  camera: camera.nullable(),
  cameraTrack: z.array(cameraKey).min(1).max(4).optional(),
});

export type VectorComposition = z.infer<typeof vectorCompositionSchema>;
export type VectorGeometry = VectorComposition['layers'][number]['shape'];
export type VectorTrack = VectorComposition['tracks'][number] & { start: number; frames: number };

type TimedCamera = z.infer<typeof camera> & { start: number; frames: number };
export type TimedVector = Omit<VectorComposition, 'layers' | 'tracks' | 'camera' | 'cameraTrack' | 'connectors'> & {
  layers: Array<Omit<VectorComposition['layers'][number], 'at'> & { start: number; asset?: string; credit?: string;
    annotation?: { x: number; y: number; size: number } }>;
  tracks: VectorTrack[];
  camera: TimedCamera | null;
  cameraTrack?: TimedCamera[];
  connectors?: Array<z.infer<typeof connector> & { path: string; start: number; frames: number }>;
  sequenceOffset?: number;
  sequenceStart?: number;
  sequenceEnd?: number;
  states?: Array<{ id: string; frame: number; tone?: 'cyan' | 'success' | 'warning' | 'error'; cells?: number[]; value?: string; inspection?: boolean; queueDelta?: 1 | -1 }>;
  fit?: { scale: number; x: number; y: number };
  presentation?: 'polished';
  focus?: number;
};

export const vectorCapabilities = {
  artboard: [900, 1120],
  compositionStrategies,
  safeArea: 'Draw directly on the transparent artboard. Name the primary layer IDs in focal. Use rectangles only for actual objects. Remotion fits the composition above captions.',
  primitives: ['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'text', 'group', 'asset', 'object'],
  technicalFamilies,
  connectors: 'Bind from/to to a visible layer ID and a side. Use orthogonal via points to route around objects, with 0–3 packets. The destination highlights on arrival.',
  sequence: 'A vector proposal may set throughSceneIndex to include adjacent requested scenes. One persistent vector runs through them. Prefix exact cues with the one-based scene number and | when repeated.',
  definitions: ['gradient', 'pattern', 'clip', 'mask'],
  effects: ['glow', 'shadow'],
  animation: ['move', 'scale', 'rotate', 'opacity', 'stroke', 'draw', 'follow', 'camera'],
  cues: 'Use exact narrated phrases. Use null at for one persistent focal subject visible from the first frame.',
  repeat: 'Duplicate geometry in rows using bounded count, columns, dx and dy. Link the repeat to a layer ID.',
  geometry: 'Use absolute SVG commands M L H V Q C Z. Routes used for follow are single continuous paths.',
  assets: 'Use IDs from approvedAssets. Never supply source URLs or markup.',
  palette: paint.options,
};
