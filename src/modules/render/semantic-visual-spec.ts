import { z } from 'zod';
import { technicalFamilies } from '../video/vector-spec.js';

const id = z.string().regex(/^[a-z][a-z0-9-]{0,23}$/i);
const cue = z.string().regex(/^s\d+c\d+$/);
const short = z.string().trim().min(1).max(32);
const cellValue = z.union([z.string().min(1).max(4), z.number().int().min(-999).max(999).transform(String)]);
const cellIndex = z.union([z.number().int().min(1).max(8), z.string().regex(/^[1-8]$/).transform(Number)]);
export const semanticLayouts = ['vertical', 'horizontal', 'branching', 'comparison', 'spatial', 'detail'] as const;
export const semanticModes = ['architecture', 'custom-vector', 'procedural', 'cinematic', 'application', 'data'] as const;
export const semanticDirectionSchema = z.strictObject({
  sequences: z.array(z.strictObject({
    from: z.number().int().nonnegative(), through: z.number().int().nonnegative(),
    subject: short, objective: z.string().trim().min(5).max(150), layout: z.enum(semanticLayouts),
    modes: z.array(z.enum(semanticModes)).min(1).max(3).optional(),
  })).min(1).max(30),
});
const object = z.strictObject({
  id, kind: z.enum([...technicalFamilies, 'asset', 'shape']),
  label: short, detail: short.optional(), level: z.number().int().min(0).max(4), at: cue.optional(),
  cells: z.array(cellValue).min(2).max(8).optional(),
  values: z.array(z.number().min(-1).max(1)).min(2).max(4).optional(),
  asset: z.string().min(1).max(64).optional(), illustration: z.string().min(15).max(260).optional(),
  shape: z.enum(['disc', 'ring', 'hex', 'diamond']).optional(),
  outline: z.array(z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)])).min(3).max(10).optional(),
});
const event = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('flow'), cue, from: id, to: id, cargo: z.literal('parcel').optional() }),
  z.strictObject({ kind: z.literal('mark'), cue, target: id, state: z.enum(['active', 'success', 'warning', 'error']) }),
  z.strictObject({ kind: z.literal('set'), cue, target: id, cells: z.array(cellIndex).min(1).max(8),
    value: cellValue }),
  z.strictObject({ kind: z.literal('inspect'), cue, target: id, cells: z.array(cellIndex).min(1).max(8).nullish() }),
  z.strictObject({ kind: z.literal('focus'), cue, target: id }),
]);
export const semanticSequenceSchema = z.strictObject({
  subject: short,
  objects: z.array(object).min(2).max(9),
  events: z.array(event).min(1).max(15),
});
export type SemanticSequence = z.infer<typeof semanticSequenceSchema>;
export type SequenceDirection = z.infer<typeof semanticDirectionSchema>['sequences'][number];
