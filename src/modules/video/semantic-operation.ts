import { z } from 'zod';

const label = z.string().trim().min(1).max(36);
const cue = z.string().trim().min(1).max(96);

export const operationProposal = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('group'), group: label, shape: z.enum(['hexagon', 'region']), cue,
    measures: z.array(z.strictObject({ label, cue, amount: z.number().int().min(0).max(1000000),
      spokenAmount: label, symbol: z.enum(['people', 'documents', 'jobs']) })).min(2).max(3) }),
  z.strictObject({ kind: z.literal('expiry'), resource: label, cue, expiresAt: cue, replacesAt: cue }),
  z.strictObject({ kind: z.literal('selection'), query: label, cue, candidates: z.array(label).min(2).max(4),
    selected: label, selectsAt: cue, processor: label.nullable(), sendsAt: cue.nullable(),
    result: label, resultAt: cue, outcome: z.enum(['match', 'miss']) }),
]);

export type SemanticOperation =
  | { kind: 'group'; label: string; shape: 'hexagon' | 'region'; from: number;
      measures: Array<{ label: string; amount: number; from: number; symbol: 'people' | 'documents' | 'jobs' }> }
  | { kind: 'expiry'; label: string; from: number; expires: number; replaces: number }
  | { kind: 'selection'; query: string; from: number; candidates: string[]; selected: string;
      selects: number; processor?: { label: string; from: number }; result: string; ends: number; outcome: 'match' | 'miss' }
  | { kind: 'queue'; label: string; steps: Array<{ from: number; action: 'enqueue' | 'dispatch' | 'complete' }> };

const clauseWords = /\b(?:is|are|was|were|has|have|does|then|when|because|hota|hoti|hai|hain|tha|thi|karta|karti|karo|raha|rhe|gaya|gayi|waits|enters|takes|sends|receives|reaches|checks|writes|reads|stores)\b/iu;
export function conciseVisualLabel(value: string) {
  return Boolean(value.trim()) && value.length <= 36 && value.trim().split(/\s+/u).length <= 4
    && !/[!?;]|\.\s/u.test(value) && !clauseWords.test(value)
    && !/(?:^|\s)(?:है|हैं|था|करता|करती|पहुँचता)(?:\s|$)/u.test(value);
}
