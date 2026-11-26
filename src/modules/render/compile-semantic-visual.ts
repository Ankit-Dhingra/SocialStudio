import { compileVector } from './compile-vector.js';
import { vectorCompositionSchema, type TimedVector, type VectorComposition, type VectorGeometry } from '../video/vector-spec.js';
import type { SemanticSequence, SequenceDirection } from './semantic-visual-spec.js';
import type { VisualCue } from './visual-cues.js';

type Box = [number, number, number, number];
type Asset = { asset: string; credit?: string };
type SemanticObject = SemanticSequence['objects'][number];
const physicalKinds: ReadonlySet<string> = new Set(['parcel', 'conveyor', 'scanner', 'diverter', 'chute']);

export class SemanticVisualError extends Error {
  constructor(readonly stage: 'cues' | 'semantics' | 'layout' | 'asset', message: string) { super(message); }
}

function objectBoxes(objects: SemanticObject[], { layout, modes }: SequenceDirection) {
  const levels = [...new Set(objects.map(object => object.level))].sort((a, b) => a - b);
  const hero = modes?.includes('cinematic') ? objects.find(object => object.kind === 'asset') : undefined;
  const dedicated = (object: SemanticObject) => ['matrix', 'conveyor'].includes(object.kind);
  const horizontal = !hero && layout === 'horizontal' && levels.length <= 3
    && !objects.some(object => dedicated(object) || object.kind === 'tree');
  const rows = levels.flatMap(level => {
    const group = objects.filter(object => object.level === level && object !== hero);
    if (!group.length) return [];
    if (horizontal) return [group];
    const compact = group.filter(object => !dedicated(object));
    const rows = Array.from({ length: Math.ceil(compact.length / 3) }, (_, i) => compact.slice(i * 3, i * 3 + 3));
    return [...rows, ...group.filter(dedicated).map(object => [object])];
  });
  if (hero) rows.unshift([hero]);
  const weights = rows.map(group => group[0] === hero ? 2.8 : group.some(node => node.kind === 'tree') ? 2 : 1);
  const unit = 845 / weights.reduce((sum, weight) => sum + weight, 0);
  const boxes = new Map<string, Box>();
  const rowFor = new Map<string, number>();
  let rowTop = 209;
  rows.forEach((group, i) => {
    if (group.length > 4) throw new SemanticVisualError('layout', 'Use at most four objects at the same level.');
    const colWidth = Math.floor(810 / rows.length);
    const rowHeight = unit * weights[i];
    group.forEach((object, j) => {
      const slot = Math.floor((horizontal ? 680 : 804) / group.length);
      const x = horizontal ? 45 + i * colWidth : 48 + j * slot;
      const y = horizontal ? 242 + j * slot : rowTop;
      const slotWidth = horizontal ? colWidth - 34 : slot - 28;
      const slotHeight = horizontal ? Math.min(280, slot - 40) : Math.min(object === hero ? 375 : 340, rowHeight - 36);
      const narrow = object.kind === 'status' || object.kind === 'entry';
      const w = group.length === 1 && !horizontal && !dedicated(object) && object.kind !== 'asset'
        ? Math.min(slotWidth, narrow ? 476 : 620) : slotWidth;
      const h = Math.min(slotHeight, narrow ? 113 : object.kind === 'service' ? 148 : slotHeight);
      boxes.set(object.id, [x + Math.floor((slotWidth - w) / 2), y, w, h]);
      rowFor.set(object.id, i);
    });
    rowTop += rowHeight;
  });
  return { boxes, horizontal, rowFor };
}

function geometry(object: SemanticObject, box: Box, cinematic: boolean): VectorGeometry {
  if (object.kind === 'asset') return { kind: 'asset', assetId: object.id, box, fit: cinematic ? 'cover' : 'contain' };
  if (object.kind !== 'shape') return { kind: 'object', family: object.kind, box, label: object.label.replace(/_/g, ' '),
    detail: object.detail ?? null, cells: object.cells, values: object.values ?? null,
    tone: ['service', 'hash', 'scanner'].includes(object.kind) ? 'purple' : 'cyan' };
  const [x, y, w, h] = box;
  if (object.outline) return { kind: 'polygon', points: object.outline.map(([u, v]) => [x + w * u / 100, y + h * v / 100]) };
  if (object.shape === 'diamond' || object.shape === 'hex') {
    return { kind: 'polygon', points: object.shape === 'diamond'
      ? [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]]
      : [[x + w / 4, y], [x + w * .75, y], [x + w, y + h / 2], [x + w * .75, y + h], [x + w / 4, y + h], [x, y + h / 2]] };
  }
  return { kind: 'ellipse', center: [x + w / 2, y + h / 2], radii: [w * .48, h * .48] };
}

const terms = new Set('technical process array bit bits input output source target request response state lookup check status data record records value result entry node root leaf leaves index indexed initial illustrative illustration example bucket slot slots key keys hash hashes function functions vector vectors step path left right active ready pending processing checks flow compare comparison inspect inspection verify verification sensor bag baggage lane route routing reroute rerouted item server storage store document file database matches matched missing absent present possible replica membership'.split(' '));
const words = (text: string): string[] => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const statusWords = new Set(['success', 'error', 'warning', 'complete', 'verified', 'inserted', 'checked', 'query', 'packet', 'recompute', 'recomputation', 'recalculation', 'jammed', 'alternate', 'bypass']);
const numberWords: Record<string, string> = { zero: '0', one: '1', ek: '1', two: '2', do: '2', dono: '2', three: '3', teen: '3',
  four: '4', char: '4', five: '5', paanch: '5' };

export async function compileSemanticVisual(plan: SemanticSequence, direction: SequenceDirection, cues: VisualCue[],
  options: { fps: number; start: number; duration: number; context: string; title?: string; resolveAsset: (object: SemanticObject) => Promise<Asset> },
): Promise<TimedVector> {
  const { fps, start, duration } = options;
  const saved = new Map(cues.map(cue => [cue.id, cue.startFrame - start]));
  const frame = (id: string) => {
    const found = saved.get(id);
    if (found === undefined || found < 0 || found >= duration - Math.round(fps * .27)) {
      throw new SemanticVisualError('cues', `Unknown or late cue ID ${id}. Use one of the phase cue IDs.`);
    }
    return found;
  };
  const vocabulary = new Set(words(options.context).map(word => numberWords[word] ?? word));
  const eventsInOrder = plan.events.map(event => ({ event, at: frame(event.cue) })).sort((a, b) => a.at - b.at);
  const grounded = (label: string) => /^[\x20-\x7e]+$/.test(label) && words(label).length > 0
    && words(label).every((word, index, list) => vocabulary.has(numberWords[word] ?? word) || terms.has(word) || statusWords.has(word)
      || index === list.length - 1 && index > 0 && /^[1-9]$/.test(word));
  const spoken = cues.map(cue => cue.text).join(' ');
  const authority = /\b(?:original store|authoritative source)\b/i.exec(spoken)?.[0];
  const lookupTargets = authority && !plan.objects.some(object => /\b(?:store|source|database)\b/i.test(object.label))
    ? plan.objects.filter(object => object.kind === 'service' && /^lookup$/i.test(object.label)
      && plan.events.some(event => event.kind === 'flow' && event.to === object.id)) : [];
  const objects = new Map(plan.objects.map(input => {
    const concreteLookup = lookupTargets.length === 1 && lookupTargets[0].id === input.id;
    let label = concreteLookup ? authority! : input.kind === 'matrix' && /^bitarray$/i.test(input.label) ? 'Bit array'
      : input.label.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/[‐‑–—]/g, '-');
    const marks = input.kind === 'status'
      ? eventsInOrder.flatMap(({ event }) => event.kind === 'mark' && event.target === input.id ? [event] : []) : [];
    const firstStatus = marks[0];
    if (firstStatus && marks.every(event => event.state === 'success') && /\b(?:mismatch|error|failure|failed|missing)\b/i.test(label)) {
      const outcome = cues.find(cue => cue.id === firstStatus.cue)?.text.match(/\b(?:[a-z]+ complete|verified|resolved|match(?:es)?|cleared)\b/i)?.[0];
      if (outcome && grounded(outcome)) label = outcome;
    }
    const object = { ...input, label, at: input.at ?? firstStatus?.cue, detail: input.detail && grounded(input.detail) ? input.detail : undefined };
    if (object.kind !== 'matrix' || object.cells) return [object.id, object] as const;
    const cells = plan.events.flatMap(event => ['set', 'inspect'].includes(event.kind) && 'cells' in event
      && event.target === object.id ? event.cells ?? [] : []);
    const length = Math.max(4, ...cells);
    const explicitlyZero = /\b(?:bits?|cells?)\b[^.!?]{0,35}\bzero\b/i.test(options.context);
    return [object.id, { ...object, cells: Array.from({ length }, () => explicitlyZero ? '0' : '–') }] as const;
  }));
  const normalizedObjects = [...objects.values()];
  if (objects.size !== plan.objects.length) throw new SemanticVisualError('semantics', 'Object IDs must be unique.');
  for (const object of normalizedObjects) {
    if (!grounded(object.label)) {
      throw new SemanticVisualError('semantics', `Use a short English label grounded in the script for ${object.id}.`);
    }
    if (object.at) frame(object.at);
    if (object.kind === 'matrix' && !object.cells || object.kind === 'vector' && !object.values) {
      throw new SemanticVisualError('semantics', `${object.id} needs ${object.kind === 'matrix' ? 'cells' : 'values'}.`);
    }
  }
  if (!plan.events.some(event => event.kind !== 'focus')) throw new SemanticVisualError('semantics', 'Show a technical operation beyond camera focus.');
  if (authority
    && !normalizedObjects.some(object => /\b(?:store|source|database)\b/i.test(object.label)
      && plan.events.some(event => event.kind === 'flow' && event.to === object.id))) {
    throw new SemanticVisualError('semantics', 'Represent the spoken store or source as the destination of the authoritative lookup.');
  }
  if (/\b(?:bits?|cells?|slots?)\b/i.test(spoken) && /\b(?:set|toggle|flip|write|update)\b/i.test(spoken)
    && !plan.events.some(event => event.kind === 'set')) {
    throw new SemanticVisualError('semantics', 'Show an actual matrix of values and a cue-timed set event for the spoken cell update.');
  }
  if (/\b(?:root|subtree)\b/i.test(spoken) && /\b(?:leaf|leaves|branches?|child|parent|subtree)\b/i.test(spoken)
    && /\bhash(?:es)?\b/i.test(spoken)) {
    const trees = normalizedObjects.filter(object => object.kind === 'tree');
    const hierarchyNodes = normalizedObjects.filter(object => object.kind !== 'status'
      && /\b(?:root|leaf|leaves|parent|child|branch|subtree)\b/i.test(object.label));
    const crossLevelLinks = plan.events.some(event => event.kind === 'flow'
      && hierarchyNodes.some(source => source.id === event.from && hierarchyNodes.some(target =>
        target.id === event.to && target.level !== source.level)));
    const activeTree = trees.some(tree => plan.events.some(event => event.kind === 'flow'
      ? event.from === tree.id || event.to === tree.id : event.target === tree.id && event.kind !== 'focus'));
    if (!crossLevelLinks && !activeTree) {
      throw new SemanticVisualError('semantics', 'Show labeled nodes from the spoken hierarchy, including an actual flow link between different levels.');
    }
    if (/\bleft subtree\b/i.test(spoken) && /\bright subtree\b/i.test(spoken)
      && !trees.length && !['left', 'right'].every(side => hierarchyNodes.some(object => words(object.label).includes(side)))) {
      throw new SemanticVisualError('semantics', 'Show left and right subtrees as separate visible nodes.');
    }
  }
  const { boxes, horizontal, rowFor } = objectBoxes(normalizedObjects, direction);
  const states: NonNullable<TimedVector['states']> = [];
  const connectors: NonNullable<VectorComposition['connectors']> = [];
  let camera: VectorComposition['camera'] = null;
  for (const { event, at: when } of eventsInOrder) {
    if (event.kind === 'flow') {
      if (connectors.some(route => route.cue === event.cue && route.from.target === event.from && route.to.target === event.to)) continue;
      const source = objects.get(event.from);
      const target = objects.get(event.to);
      if (!source || !target || source === target) throw new SemanticVisualError('semantics', 'A flow requires different existing objects.');
      if (source.at && frame(source.at) > when) throw new SemanticVisualError('semantics', `Show ${source.id} before it sends data.`);
      const [sx, sy, sw, sh] = boxes.get(source.id)!;
      const [tx, ty, tw, th] = boxes.get(target.id)!;
      let sides: ['left' | 'right' | 'top' | 'bottom', 'left' | 'right' | 'top' | 'bottom'];
      let via: Array<[number, number]> = [];
      const distance = Math.abs(rowFor.get(source.id)! - rowFor.get(target.id)!);
      if (distance === 0) {
        if (horizontal) {
          const outside = sx - 15;
          via = [[outside, sy + sh / 2], [outside, ty + th / 2]];
          sides = ['left', 'left'];
        } else {
          const outside = sy - 24;
          via = [[sx + sw / 2, outside], [tx + tw / 2, outside]];
          sides = ['top', 'top'];
        }
      } else if (distance > 1 && !horizontal) {
        const outside = 22;
        via = [[outside, sy + sh / 2], [outside, ty + th / 2]];
        sides = ['left', 'left'];
      } else if (horizontal) sides = sx < tx ? ['right', 'left'] : ['left', 'right'];
      else sides = sy < ty ? ['bottom', 'top'] : ['top', 'bottom'];
      const arrival = target.at ? frame(target.at) : when;
      const seconds = Math.max(.7, Math.min(3, (arrival - when) / fps + .12));
      if (arrival > when + Math.round(seconds * fps)) throw new SemanticVisualError('semantics', `Reveal ${target.id} no later than its incoming packet.`);
      if (source.kind === 'queue') states.push({ id: source.id, frame: when, queueDelta: -1 });
      if (target.kind === 'queue') states.push({ id: target.id, frame: Math.min(duration - 1, when + Math.round(seconds * fps)), queueDelta: 1 });
      connectors.push({ id: `route-${connectors.length + 1}`, from: { target: source.id, side: sides[0] },
        to: { target: target.id, side: sides[1] }, via, cue: event.cue, seconds, tone: 'cyan', packets: 1,
        ...((event.cargo || physicalKinds.has(source.kind) && physicalKinds.has(target.kind)) &&
          normalizedObjects.some(object => object.kind === 'parcel') ? { cargo: 'parcel' as const } : {}) });
      continue;
    }
    const object = objects.get(event.target);
    if (!object) throw new SemanticVisualError('semantics', `Unknown object ${event.target}.`);
    if (object.at && frame(object.at) > when) throw new SemanticVisualError('semantics', `Reveal ${object.id} before its state change.`);
    if (event.kind === 'set') {
      if (object.kind !== 'matrix' || event.cells.some(cell => cell > (object.cells?.length ?? 0))) {
        throw new SemanticVisualError('semantics', 'Set events require valid one-based matrix cell indices.');
      }
      const spokenUpdate = cues.find(cue => cue.id === event.cue)?.text ?? '';
      const isUpdate = (text: string) => /\b(?:set|toggle|flip|writes?|updates?|insert|replace|change|clear)\b|सेट|बदल|लिख/iu.test(text)
        || event.value === '0' && /\b(?:start|initial|begin)\b[^.!?]{0,45}\bzero\b/i.test(text);
      if (!isUpdate(spokenUpdate)) {
        const scene = cues.find(cue => cue.id === event.cue)?.scene;
        const suitable = cues.filter(cue => cue.scene === scene && isUpdate(cue.text)).map(cue => cue.id);
        throw new SemanticVisualError('cues', `Cue ${event.cue} does not describe a cell update. Use a spoken change cue${suitable.length ? ` such as ${suitable.join(', ')}` : ''}.`);
      }
      if (/\b(?:dono|both)\s+(?:bits?|cells?|slots?)\b/i.test(spokenUpdate) && new Set(event.cells).size !== 2) {
        throw new SemanticVisualError('semantics', `At ${event.cue}, update exactly two distinct cells because the narrator says both.`);
      }
      states.push({ id: object.id, frame: when, cells: event.cells, value: event.value, tone: 'cyan', inspection: true });
    } else if (event.kind === 'inspect') {
      if (object.kind === 'matrix' && (!event.cells?.length || event.cells.some(cell => cell > (object.cells?.length ?? 0)))) {
        throw new SemanticVisualError('semantics', 'Inspect events require valid one-based matrix cell indices.');
      }
      const lookupCue = cues.find(cue => cue.id === event.cue)?.text ?? '';
      if (object.kind === 'tree') {
        const branch = /\b(left|right)\s+(?:subtree|branch)\b/i.exec(lookupCue)?.[1].toLowerCase();
        const priorBranch = /\b(?:descend|follow)\b/i.test(lookupCue)
          ? states.filter(state => state.frame < when && state.inspection && state.tone === 'error' && state.cells).at(-1) : undefined;
        const tone = /\bmismatch(?:es)?\b/i.test(lookupCue) ? 'error' : /\bmatch(?:es)?\b/i.test(lookupCue) ? 'success' : priorBranch?.tone ?? 'cyan';
        const cells = branch === 'left' ? [1, 2] : branch === 'right' ? [3, 4] : event.cells ?? priorBranch?.cells;
        states.push({ id: priorBranch?.id ?? object.id, frame: when, cells, inspection: true, tone });
      } else if (object.kind === 'matrix') states.push({ id: object.id, frame: when, cells: event.cells ?? undefined, inspection: true });
      else {
        if (event.cells?.length && !/\b(?:lookup|read|inspect|verify|miss(?:es)?|match(?:es)?|check)\b/i.test(lookupCue)) {
          throw new SemanticVisualError('semantics', 'Only matrix inspections can use cell indices.');
        }
        states.push({ id: object.id, frame: when, tone: /\b(?:miss(?:es)?|absent|not found)\b/i.test(lookupCue) ? 'error' : 'cyan' });
      }
    } else if (event.kind === 'mark') {
      states.push({ id: object.id, frame: when, tone: event.state === 'active' ? 'cyan' : event.state });
    } else if (!camera) {
      const [x, y, w, h] = boxes.get(object.id)!;
      camera = { cue: event.cue, center: [x + w / 2, y + h / 2], seconds: .6, zoom: 1.08 };
    }
  }
  const subject = [plan.subject, direction.subject, options.title?.slice(0, 36).trim() ?? '']
    .map(text => text.replace(/[‐‑–—]/g, '-')).find(grounded) ?? 'Technical process';
  const layers: VectorComposition['layers'] = normalizedObjects.map(object => ({
    id: object.id, parent: null, at: object.at ?? null, fill: object.kind === 'shape' && object.shape === 'ring' ? 'none' : 'surface',
    stroke: 'cyan', shape: geometry(object, boxes.get(object.id)!, direction.modes?.includes('cinematic') ?? false),
    ...(object.kind === 'shape' ? { label: object.label } : {}),
  }));
  layers.unshift({ id: 'visual-heading', parent: null, at: null, fill: 'ink', stroke: 'none',
    shape: { kind: 'text', point: [53, 168], size: Math.min(44, Math.floor(757 / (subject.length * .64))), text: subject, anchor: 'start' } });
  const framing = direction.layout === 'detail' ? 'hero' : direction.layout;
  const spec = vectorCompositionSchema.safeParse({
    subject, framing, focal: plan.objects.map(object => object.id).slice(0, 5), layers,
    definitions: [], repeats: [], treatments: [], tracks: [], connectors, camera,
  });
  if (!spec.success) throw new SemanticVisualError('layout', spec.error.issues.slice(0, 2).map(issue => issue.path.join('.')).join(', '));
  try {
    const vector = await compileVector(spec.data, { fps, duration, cueFrame: frame,
      labelGrounded: grounded, subjectGrounded: grounded, timedStateFrames: states.map(state => state.frame),
      asset: async id => {
        try { return await options.resolveAsset(objects.get(id)!); }
        catch (error) { throw new SemanticVisualError('asset', `Resolve ${id}: ${error instanceof Error ? error.message : 'unavailable'}`); }
      } });
    return { ...vector, states: states.sort((a, b) => a.frame - b.frame) };
  } catch (error) {
    if (error instanceof SemanticVisualError) throw error;
    throw new SemanticVisualError('layout', error instanceof Error ? error.message : 'Invalid compiled layout.');
  }
}
