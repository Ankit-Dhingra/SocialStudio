import { z } from 'zod';
import { canonicalBrandText, reelBrand } from '../video/brand.js';
import { vectorCompositionSchema, type TimedVector } from '../video/vector-spec.js';
import { compileSemanticVisual } from './compile-semantic-visual.js';
import { compileVector, type VectorLayoutWarning } from './compile-vector.js';
import { semanticDirectionSchema, semanticSequenceSchema } from './semantic-visual-spec.js';
import type { VisualCue } from './visual-cues.js';

export const directiveAssetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('approved'), id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/) }),
  z.strictObject({ kind: z.literal('illustration'), brief: z.string().trim().min(15).max(260) }),
]);
const range = { from: z.number().int().nonnegative(), through: z.number().int().nonnegative() };
export const directiveSequenceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('semantic'), direction: semanticDirectionSchema.shape.sequences.element, plan: semanticSequenceSchema }),
  z.strictObject({ kind: z.literal('vector'), ...range, composition: vectorCompositionSchema.required({ framing: true, focal: true }),
    assets: z.record(z.string().regex(/^[a-z][a-z0-9-]{0,31}$/i), directiveAssetSchema) }),
]);
export type DirectiveSequence = z.infer<typeof directiveSequenceSchema>;
export type DirectiveAsset = z.infer<typeof directiveAssetSchema>;
type ResolvedAsset = { asset: string; credit?: string };
const vectorTerms = 'input output request response data value result root parent leaf index status processing hash bit array slot packet lookup success error active warning count step example';
const standardVectorWords = new Set(vectorTerms.split(' '));

export const vectorGroundingRule = 'For vector composition.subject, prefer a short phrase (at most 36 characters) from job.title, job.storyboardTitle, the project brand, or the narration of the scenes covered by that sequence. Use Roman letters and ASCII punctuation. A faithful paraphrase must retain a meaningful word from that context. Standard terms include: ' + vectorTerms + '. Visible labels may translate or summarize the narration in Roman Hinglish or use English technical terms, timestamps and clearly illustrative examples. Keep them concise and faithful, with no markup or links.';
const commonWords = new Set('how what why the a an for of and or not no is it as if be to on in by at with that this after before but from are was were ka ki ke ko hai mein aur se par'.split(' '));

export class VectorSubjectError extends Error {
  constructor(readonly resolution: string, message: string) {
    super(message);
  }
}

export function directiveRange(sequence: DirectiveSequence) {
  return sequence.kind === 'semantic' ? sequence.direction : sequence;
}

export async function compileVisualDirectiveSequence(sequence: DirectiveSequence, cues: VisualCue[], options: {
  fps: number; start: number; duration: number; title: string; context: string;
  polish?: boolean;
  repairImport?: boolean;
  reportLayoutWarning?: (warning: VectorLayoutWarning) => void;
  resolve: (id: string, request: DirectiveAsset) => Promise<ResolvedAsset>;
}): Promise<TimedVector> {
  if (sequence.kind === 'semantic') {
    return compileSemanticVisual(sequence.plan, sequence.direction, cues, {
      ...options,
      resolveAsset: object => {
        if (Boolean(object.asset) === Boolean(object.illustration)) {
          throw new Error(`Asset ${object.id} must request exactly one approved ID or illustration.`);
        }
        return options.resolve(object.id, object.asset ? { kind: 'approved', id: object.asset }
          : { kind: 'illustration', brief: object.illustration! });
      },
    });
  }
  const { composition, assets } = sequence;
  const used = new Set(composition.layers.flatMap(layer => layer.shape.kind === 'asset' ? [layer.shape.assetId] : []));
  if ([...used].some(id => !Object.hasOwn(assets, id)) || Object.keys(assets).some(id => !used.has(id))) {
    throw new Error('Each asset layer must reference a declared asset, and every declared asset must be used.');
  }
  const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const known = new Set(words(`${options.title} ${options.context} ${reelBrand.name} ${vectorTerms}`));
  const topic = new Set(words(`${options.title} ${options.context}`).filter(word => word.length >= 3
    && !commonWords.has(word) && !standardVectorWords.has(word)
    && (/^[a-z]+$/.test(word) || /^\d+$/.test(word))));
  const unknownWords = (label: string) => [...new Set(words(canonicalBrandText(label)).filter(word => !known.has(word) && !/^\d{1,4}$/.test(word)))];
  const hasRomanWords = (label: string) => /^[\x20-\x7e]+$/.test(label) && !/[<>]|\b(?:https?|javascript|data|file):|www\./i.test(label) && words(label).length > 0;
  const grounded = (label: string) => hasRomanWords(label) && (unknownWords(label).length === 0
    || options.repairImport === true && words(label).some(word => topic.has(word)));
  if (!grounded(composition.subject)) {
    const missing = unknownWords(composition.subject);
    const message = hasRomanWords(composition.subject)
      ? `Vector subject contains words outside the approved title and this sequence's narration: ${missing.join(', ')}.`
      : 'Vector subject must use Roman-script text and contain at least one word or number.';
    const titleSuggestion = options.title.match(/^[\x20-\x7e]{1,36}(?= |$)/)?.[0].trim();
    const suggestion = titleSuggestion && grounded(titleSuggestion) ? ` For example, use "${titleSuggestion}".` : '';
    throw new VectorSubjectError('Replace composition.subject with a phrase of at most 36 characters from the approved title or the narration of these scenes.' + suggestion, message);
  }
  const frames = new Map(cues.map(cue => [cue.id, cue.startFrame - options.start]));
  return compileVector(composition, {
    fps: options.fps, duration: options.duration, cueFrame: cue => frames.get(cue),
    labelGrounded: label => /^[\x20-\x7e\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026]+$/.test(label)
      && !/[<>]|\b(?:https?|javascript|data|file):|www\./i.test(label) && /[a-z0-9]/i.test(label),
    subjectGrounded: grounded, asset: id => options.resolve(id, assets[id]), polish: options.polish, repairImport: options.repairImport,
    reportLayoutWarning: options.reportLayoutWarning,
  });
}
