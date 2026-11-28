import { setTimeout as delay } from 'node:timers/promises';
import { Tiktoken } from 'js-tiktoken/lite';
import ranks from 'js-tiktoken/ranks/o200k_base';
import { z } from 'zod';
import type { ScriptSession } from '../ai-script/master-script-service.js';
import { GroqProvider, GroqRateLimitError, GroqRequestError } from '../ai-script/groq-provider.js';
import { ProviderExecutionStopped } from '../jobs/provider-guard.js';
import { describeResponseSchema } from './describe-response-schema.js';
import { directiveRange, directiveSequenceSchema, type DirectiveSequence } from './visual-directive-compiler.js';
import { DirectiveError, prepareVisualImport, readVisualDirectiveJson, visualPromptContext, type DirectiveIssue, type VerifyNarration } from './visual-directives.js';
import { loadVisualDirectorReference } from './visual-director-reference.js';
import { verifiedDirectiveExample } from './visual-source-pack.js';

export const automaticVisualModel = 'openai/gpt-oss-120b';
const tokenizer = new Tiktoken(ranks);
const sequenceGrammar = describeResponseSchema(z.toJSONSchema(directiveSequenceSchema, { io: 'input', reused: 'ref' }), true);
const tokens = (s: string) => tokenizer.encode(s, [], []).length;
const system = 'You are the Visual Director and Scene Engineer. Return a raw JSON object with no Markdown. Follow the supplied rendering contract and do not emit executable code.';
type Range = { from: number; through: number };
type Context = Awaited<ReturnType<typeof visualPromptContext>>;
type CompletionUsage = { prompt_tokens?: number; completion_tokens?: number };
type ProviderAttempt = Range & { inputEstimate: number; outputLimit: number; elapsedMs: number;
  transport: string; usage?: CompletionUsage; finish?: string; responses: number[]; issues?: DirectiveIssue[]; error?: string };
export type AutomaticVisualReport = { model: string; artRevision: string; schemaHash: string;
  attempts: ProviderAttempt[]; tokenLimit: number; elapsedMs: number };
export type AutomaticProgress = { completed: number; total: number; message: string };
export type AutomaticVisualDraft = { key: string; sequences: DirectiveSequence[] };
type Draft = AutomaticVisualDraft & { report: AutomaticVisualReport };
const drafts = new Map<string, Draft>();
let groqQueue = Promise.resolve();
let availableTokens = Infinity;
let tokenResetAt = 0;

export class AutomaticVisualError extends DirectiveError {
  constructor(issues: DirectiveIssue[], readonly report: AutomaticVisualReport, status = 422) {
    super(issues, status);
  }
}

function durationHeader(value: string | null) {
  if (!value) return 0;
  const parts = [...value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)];
  return parts.reduce((sum, [, number, unit]) => sum + Number(number) *
    ({ ms: 1, s: 1000, m: 60000, h: 3600000 }[unit] ?? 0), 0);
}

function buildInput(context: Context, svg: string, range: Range, previous: DirectiveSequence | undefined,
  feedback: unknown, budget: number, proposedOutput: number) {
  const { job, specification: spec, artDirection: guide } = context;
  const shared = [guide.master, guide.design, guide.motion, guide.benchmark.description, guide.brand].join('\n\n');
  const binding = { version: spec.version, schemaHash: spec.schemaHash, inputRevision: job.inputRevision };
  const suggestedSubject = job.title.match(/^[\x20-\x7e]{1,36}(?= |$)/)?.[0].trim();
  const scope = job.scenes.slice(range.from, range.through + 1);
  const instruction = `Generate one complete directive for only the inclusive zero-based range ${range.from}–${range.through}. Use sequences with from/through directly for vector, or within direction for semantic. Cover the requested range exactly with ordered non-overlapping sequences of at most four scenes each. Aim for a detailed custom vector composition with a staged mechanism, distinct objects and readable layers. Use semantic objects when appropriate. Give labels breathing room and animate geometry on saved cues. Connector ports belong on stationary painted objects. Use via:[] and outward-facing sides unless deliberately routing a clear bend. Show persistent meaningful geometry from frame zero. Keep each rect or ellipse fully within x=0–900 and y=0–1120. Move tracks take relative [dx,dy] offset pairs, never destination coordinates or nested arrays. Keep both translated extents inside the artboard. Prefer connector packets for long transfers.${suggestedSubject ? ` Suggested valid subject: ${JSON.stringify(suggestedSubject)}.` : ''}`;
  const output = `Return exactly four root keys: version, schemaHash, inputRevision, sequences. Use the exact binding shown, never the example's bindings. Each vector sequence has exactly kind, from, through, composition, assets. Use assets:{} and all required composition keys. Keep definitions:[], treatments:[], repeats:[], tracks:[], and camera:null when unused. Every layer needs at:null or a saved cue. Use shape.text without a separate label on text layers. Select animation cues from safeCueIds when listed. Return raw JSON only.`;
  const continuity = previous?.kind === 'vector'
    ? { subject: previous.composition.subject, objects: previous.composition.layers.slice(0, 12).map(layer => ({
      id: layer.id, shape: layer.shape.kind, fill: layer.fill, stroke: layer.stroke, label: layer.label,
      ...('box' in layer.shape ? { box: layer.shape.box } : {}),
    })) }
    : previous?.plan.objects.map(({ id, kind, label }) => ({ id, kind, label }));
  const production = JSON.stringify({ job: { ...job, scenes: scope }, narrative: job.scenes.map(scene => scene.narration),
    specification: spec, binding, continuity, feedback });
  const compact = JSON.stringify({ binding, title: job.title, storyboardTitle: job.storyboardTitle,
    composition: job.composition, narrative: job.scenes.map(scene => scene.narration),
    scenes: scope.map(scene => ({ i: scene.sceneIndex, id: scene.sceneId, start: scene.startFrame, end: scene.endFrameExclusive,
      cues: scene.cues.map(cue => [cue.id, cue.startFrame, cue.endFrame, cue.wordFrom, cue.wordTo, cue.text]),
      safeCueIds: scene.cues.filter(cue => scene.endFrameExclusive - cue.startFrame >= Math.ceil(job.composition.fps * 0.27))
        .map(cue => cue.id),
      words: scene.whisper.map(([word]) => word), whisperSeconds: scene.whisper.flatMap(([, start, end]) => [start, end]),
    })),
    assets: spec.assets.map(asset => [asset.id, asset.description]), illustrationEnabled: spec.illustrationEnabled, continuity, feedback });
  const shortRules = 'Vector artboard 900×1120. Keep an outer margin of 35 on all four sides, including box height and width. Use absolute SVG M/L/H/V/C/Q/Z, fit above captions, and reserve 30px rendered text. Use unique IDs, groups before children, at:null for initial layers. Use a painted object or group for each focal ID. Track seconds and cue frame units are distinct; leave at least .27s from the cue to the end. For two horizontally separated objects choose right to left when moving right, and left to right on the return. For vertically stacked objects choose bottom to top when moving down, and top to bottom on the return. Keep the route corridor clear. Connector packets are 1–3. Use maximum 8 primitive repeats and 34 layers. Use Roman Hinglish or English labels. Copy composition.subject exactly from the title or narration in at most 36 characters. Asset map keys reference asset layers; values are {kind:"approved",id} or, when enabled, {kind:"illustration",brief}. Use {} when empty. Semantic coordinates use the normalized 0–100 grid.';
  const example = (spec.example as { directive: { sequences: unknown[] } }).directive.sequences[0];
  const compactPrompt = `${shared}\n${instruction}\n${shortRules}\nProduction schema in compact type notation. ? marks optional keys, | marks alternatives, [min..max] bounds values or lengths.\n${sequenceGrammar}\nCompiler-verified example sequence (example cue is illustrative only): ${JSON.stringify(example)}\nCue tuple = [id,startFrame,endFrame,wordFrom,wordTo,text]. Whisper seconds lists the exact [start,end] pairs in word order, relative to scene audio.\n${compact}`;
  const geometry = svg.replace(/<svg\b[^>]*>/, root => `<svg ${root.match(/\bviewBox="[^"]+"/)?.[0] ?? ''}>`)
    .replace(/<text\b[^>]*>[^<]*<\/text>/g, '').replace(/\s(?:stroke-opacity|stroke-width|font-size)="[^"]*"/g, '');
  for (const [transport, prompt] of [
    ['canonical-schema-and-svg', `${shared}\n${instruction}\nGolden SVG reference, illustrative only:\n${svg}\n${production}`],
    ['compact-schema-and-svg', `${compactPrompt}\nGolden SVG, illustrative only:\n${svg}`],
    ['compact-schema-and-svg-geometry', `${compactPrompt}\nGolden SVG design geometry, illustrative only:\n${geometry}`],
    ['compact-schema-and-svg-details', `${compactPrompt}\nGolden SVG details. Use the description for layout and these reference shapes for the visual language.\n${[...geometry.matchAll(/<(?:path|rect|circle|polygon)\b[^>]*>/g)].slice(1, 9).map(([part]) => part).join('')}`],
  ]) {
    const message = `${prompt}\n${output}`;
    const inputEstimate = tokens(system) + tokens(message) + 96;
    if (inputEstimate + proposedOutput <= budget) return { transport, prompt: message, inputEstimate, outputLimit: proposedOutput };
  }
}

export async function prepareAutomaticVisuals(session: ScriptSession, options: {
  scope?: number[]; feedback?: string; recompile?: boolean; progress?: (progress: AutomaticProgress) => void;
  current?: () => boolean; saveDraft?: (draft: AutomaticVisualDraft) => void;
  verifyNarration?: VerifyNarration;
} = {}) {
  const started = Date.now();
  const context = await visualPromptContext(session, await verifiedDirectiveExample(), options.verifyNarration);
  const reference = await loadVisualDirectorReference();
  const svg = reference.files.get('GOLDEN_REFERENCE.svg')!.toString('utf8');
  const { job, specification } = context;
  const binding = { version: specification.version, schemaHash: specification.schemaHash, inputRevision: job.inputRevision };
  const envelope = (sequences: DirectiveSequence[]) => JSON.stringify({ ...binding, sequences });
  const key = `${job.inputRevision}:${specification.contractHash}:${context.artDirection.revision}`;
  const saved = session.visualAssets?.automaticImport;
  const savedSequences = saved?.artifactRevision === job.inputRevision && saved.schemaHash === binding.schemaHash
    ? saved.normalized.sequences : [];
  const requested = new Set(options.scope ?? (options.feedback ? job.scenes.map(scene => scene.sceneIndex) : []));
  const excludeRequested = (sequence: DirectiveSequence) => {
    const { from, through } = directiveRange(sequence);
    return ![...requested].some(index => index >= from && index <= through);
  };
  const configured = Number(process.env.REEL_GROQ_VISUAL_TPM || 8000);
  const budget = Math.min(130000, Number.isFinite(configured) && configured > 0 ? configured : 8000);
  const stored = requested.size ? undefined : drafts.get(session.id);
  const persisted = requested.size ? undefined : session.automaticVisualDraft;
  const baseline = persisted?.key === key ? persisted.sequences : savedSequences;
  const draft = stored?.key === key ? stored : { key, sequences: baseline.filter(excludeRequested),
    report: { model: automaticVisualModel, artRevision: context.artDirection.revision, schemaHash: binding.schemaHash,
      attempts: [], tokenLimit: budget, elapsedMs: 0 } };
  drafts.set(session.id, draft);
  if (drafts.size > 32) drafts.delete(drafts.keys().next().value!);
  const ordered = () => [...draft.sequences].sort((a, b) => directiveRange(a).from - directiveRange(b).from);
  const covered = () => new Set(ordered().flatMap(sequence => {
    const { from, through } = directiveRange(sequence);
    return Array.from({ length: through - from + 1 }, (_, i) => from + i);
  }));
  const update = (message: string) => {
    if (options.current && !options.current()) throw new DirectiveError([{ path: '$.inputRevision', message: 'The script or audio changed while planning.' }], 409);
    options.progress?.({ completed: covered().size, total: job.scenes.length, message });
  };
  const keys = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',').map(key => key.trim()).filter(Boolean);
  const provider = new GroqProvider(keys, automaticVisualModel);
  const initialAttempts = draft.report.attempts.length;
  const failures: DirectiveIssue[] = [];
  const issue = (range: Range, message: string): DirectiveIssue => ({
    path: '$.sequences', scenes: Array.from({ length: range.through - range.from + 1 }, (_, i) => range.from + i), message,
  });
  let requestBudget = Math.min(budget, draft.report.tokenLimit);
  const reserveFor = (scenes: number) => scenes > 4 ? Math.min(65536, scenes * 1900) : scenes > 1 ? 2650 : 2500;
  const inputFor = (range: Range, prior: DirectiveSequence | undefined, feedback: unknown) => {
    const length = range.through - range.from + 1;
    return buildInput(context, svg, range, prior, feedback, requestBudget, reserveFor(length))
      ?? (length <= 2 ? buildInput(context, svg, range, prior, feedback, requestBudget, length === 1 ? 1700 : 2150) : undefined);
  };
  const call = async (range: Range, feedback: unknown) => {
    if (!keys.length) throw new GroqRequestError(503, 'Configure a Groq API key to use Automatic mode.');
    const prior = ordered().filter(sequence => directiveRange(sequence).through < range.from).at(-1);
    const input = inputFor(range, prior, feedback);
    if (!input) throw new GroqRequestError(413, 'The shared visual context and output do not fit the configured Groq token budget.');
    const expected = input.inputEstimate + input.outputLimit;
    const attempt: ProviderAttempt = { ...range, inputEstimate: input.inputEstimate, outputLimit: input.outputLimit,
      elapsedMs: 0, transport: input.transport, responses: [] };
    const pending = groqQueue;
    let release!: () => void;
    groqQueue = new Promise<void>(resolve => { release = resolve; });
    await pending;
    let start = Date.now();
    try {
      if (availableTokens < expected && tokenResetAt > Date.now()) {
        update('Waiting for the Groq token budget to reset…');
        await delay(Math.min(65000, tokenResetAt - Date.now() + 300));
      }
      update(`Planning scenes ${range.from + 1}–${range.through + 1} with Groq…`);
      start = Date.now();
      draft.report.attempts.push(attempt);
      const raw = await provider.generateJSON(input.prompt, system, 85000, undefined, {
        jsonObjectMode: true, maxCompletionTokens: input.outputLimit, reasoningEffort: 'low', failFastOnTransportError: true,
        onUsage: (usage, finish) => { attempt.usage = usage as CompletionUsage; attempt.finish = finish; },
        onResponse: (status, headers) => {
          attempt.responses.push(status);
          const limit = Number(headers.get('x-ratelimit-limit-tokens'));
          if (limit > 0) {
            draft.report.tokenLimit = limit;
            requestBudget = Math.min(requestBudget, limit);
          }
          if (headers.has('x-ratelimit-remaining-tokens')) availableTokens = Number(headers.get('x-ratelimit-remaining-tokens'));
          const reset = durationHeader(headers.get('x-ratelimit-reset-tokens'));
          if (reset > 0) tokenResetAt = Date.now() + reset;
        },
      });
      update(`Validating scenes ${range.from + 1}–${range.through + 1}…`);
      const { value, strippedFence } = readVisualDirectiveJson(raw);
      const parsed = value as Record<string, unknown> | null;
      if (strippedFence || !parsed || Object.keys(parsed).length !== 4 ||
        parsed.version !== binding.version || parsed.schemaHash !== binding.schemaHash
        || parsed.inputRevision !== binding.inputRevision || !Array.isArray(parsed.sequences)) throw new Error('Groq must return the exact envelope bindings and sequences array.');
      const issues: DirectiveIssue[] = [];
      const sequenceCount = draft.sequences.length;
      for (const [index, rawSequence] of parsed.sequences.entries()) {
        const parsedSequence = directiveSequenceSchema.safeParse(rawSequence);
        if (!parsedSequence.success) {
          issues.push(...parsedSequence.error.issues.slice(0, 3).map(problem => ({
            ...issue(range, problem.message), path: `$.sequences.${index}.${problem.path.join('.')}`,
          })));
          continue;
        }
        const sequence = parsedSequence.data;
        const span = directiveRange(sequence);
        if (span.from < range.from || span.through > range.through || span.through < span.from
          || Array.from({ length: span.through - span.from + 1 }, (_, offset) => span.from + offset).some(i => covered().has(i))) {
          issues.push(issue(range, 'Sequence range is outside this request or overlaps already accepted scenes.'));
          continue;
        }
        try {
          await prepareVisualImport(session, envelope([sequence]), true, span, options.verifyNarration);
          draft.sequences.push(sequence);
        } catch (error) {
          if (!(error instanceof DirectiveError)) throw error;
          issues.push(...error.issues);
        }
      }
      if (draft.sequences.length > sequenceCount) {
        update('Saving validated sequences…');
        options.saveDraft?.({ key, sequences: draft.sequences });
      }
      attempt.issues = issues;
      return issues;
    } catch (error) {
      attempt.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      release();
      attempt.elapsedMs = Date.now() - start;
      draft.report.elapsedMs = Date.now() - started;
    }
  };

  const generate = async (range: Range, feedback: unknown, depth = 0): Promise<void> => {
    const length = range.through - range.from + 1;
    let issues: DirectiveIssue[] = [];
    try {
      issues = await call(range, feedback);
    } catch (error) {
      if (error instanceof DirectiveError && error.status === 409) throw error;
      if (error instanceof ProviderExecutionStopped) {
        const status = error.reason === 'quote' || error.reason === 'window' ? 429 : 503;
        throw new AutomaticVisualError([issue(range, error.message)], draft.report, status);
      }
      if (error instanceof GroqRateLimitError && depth < 2 && (error.retryAfterMs ?? 5000) <= 65000) {
        update('Groq is rate limited. Waiting before retrying…');
        await delay((error.retryAfterMs ?? 5000) + 250);
        return generate(range, feedback, depth + 1);
      }
      if (error instanceof GroqRateLimitError) throw new AutomaticVisualError(
        [issue(range, 'Groq is rate limited. Retry later to resume from the validated scenes.')], draft.report, 429);
      if ((error instanceof TypeError && error.message === 'fetch failed') || (error instanceof DOMException && error.name === 'TimeoutError')) {
        throw new AutomaticVisualError([issue(range, 'Groq could not be reached. Retry to resume from the validated scenes.')], draft.report, 503);
      }
      if (error instanceof GroqRequestError && [401, 403, 404, 500, 502, 503, 504].includes(error.status)) {
        throw new AutomaticVisualError([issue(range, error.message)], draft.report, 503);
      }
      issues = [issue(range, error instanceof Error ? error.message : String(error))];
      if (error instanceof GroqRequestError && error.status === 413 && length === 1) {
        if (depth === 0 && draft.report.attempts.at(-1)?.responses.includes(413)) {
          requestBudget = Math.floor(requestBudget * 0.9);
          return generate(range, feedback, 1);
        }
        failures.push(...issues);
        return;
      }
    }
    const missing: Range[] = [];
    const set = covered();
    for (let index = range.from; index <= range.through; index++) {
      if (set.has(index)) continue;
      const last = missing.at(-1);
      const maxSpan = length > 4 ? 2 : Math.max(1, Math.floor(length / 2));
      if (last && last.through + 1 === index && last.through - last.from + 1 < maxSpan) last.through = index;
      else missing.push({ from: index, through: index });
    }
    if (!missing.length) return;
    const repair = issues.length ? issues.slice(0, 4) : [issue(range, 'Return every missing scene in the assigned span.')];
    if (length === 1 && depth >= 2 || draft.report.attempts.length - initialAttempts >= Math.min(100, job.scenes.length * 4 + 4)) {
      failures.push(...repair);
      return;
    }
    update(`Repairing scenes ${missing[0].from + 1}–${missing.at(-1)!.through + 1}: ${repair[0].message}`);
    for (const span of missing) await generate(span, { editorFeedback: options.feedback, repair }, length > 1 ? 0 : depth + 1);
  };

  if (options.recompile) {
    if (!savedSequences.length) throw new DirectiveError([{ path: '$.sequences',
      message: 'Generate and accept an Automatic Groq plan before recompiling it.' }], 409);
    draft.sequences = savedSequences;
  }
  if (covered().size !== job.scenes.length) {
    const scope = { from: 0, through: job.scenes.length - 1 };
    const completeFits = draft.sequences.length === 0 && inputFor(scope, undefined, options.feedback);
    if (completeFits) await generate(scope, options.feedback);
    else for (let from = 0; from < job.scenes.length; from++) {
      if (covered().has(from)) continue;
      const pair = { from, through: from + 1 };
      const through = pair.through < job.scenes.length && !covered().has(pair.through)
        && inputFor(pair, ordered().at(-1), options.feedback) ? pair.through : from;
      await generate({ from, through }, options.feedback);
      from = through;
    }
  }
  if (failures.length || covered().size !== job.scenes.length) {
    throw new AutomaticVisualError(failures.slice(0, 24), draft.report);
  }
  update('Compiling accepted directives and resolving visual assets…');
  const imported = await prepareVisualImport(session, envelope(ordered()), false, undefined, options.verifyNarration);
  const { manualImport, ...visuals } = imported.visuals!;
  drafts.delete(session.id);
  return { visuals: { ...visuals, source: 'automatic' as const, automaticImport: manualImport },
    report: { ...draft.report, elapsedMs: Date.now() - started, vectorSequences: ordered().filter(sequence => sequence.kind === 'vector').length,
      coveredScenes: covered().size, focalRepairs: imported.focalRepairs, connectorRepairs: imported.connectorRepairs, layoutWarnings: imported.layoutWarnings } };
}
