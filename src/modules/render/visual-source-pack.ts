import type { DirectiveSequence } from './visual-directive-compiler.js';
import { compileVisualDirectiveSequence } from './visual-directive-compiler.js';
import { directiveJsonSchema, directiveRules, rendererCapabilities, visualContractHash, visualContractVersion, visualSchemaHash } from './visual-directives.js';
import { loadVisualDirectorReference } from './visual-director-reference.js';

export function exampleComposition(subject = 'Input', cue = 's1c2'): Extract<DirectiveSequence, { kind: 'vector' }>['composition'] {
  return { subject, framing: 'architecture', focal: ['input', 'output'], definitions: [], repeats: [], treatments: [], camera: null,
    layers: [
      { id: 'input', parent: null, at: null, fill: 'surface', stroke: 'cyan',
        shape: { kind: 'rect', box: [86, 275, 273, 177], radius: 22 }, label: 'Input' },
      { id: 'output', parent: null, at: null, fill: 'surface', stroke: 'purple',
        shape: { kind: 'polygon', points: [[560, 275], [749, 275], [815, 363], [749, 452], [560, 452], [498, 363]] }, label: 'Output' },
      { id: 'heading', parent: null, at: null, fill: 'ink', stroke: 'none',
        shape: { kind: 'text', point: [88, 214], text: subject, size: 42, anchor: 'start' } },
    ],
    tracks: [], connectors: [{ id: 'transfer', cue, from: { target: 'input', side: 'right' }, to: { target: 'output', side: 'left' },
      via: [], seconds: 0.8, tone: 'cyan', packets: 1 }],
  };
}

export async function verifiedDirectiveExample() {
  const sequence = { kind: 'vector', from: 0, through: 0, composition: exampleComposition(), assets: {} } as const;
  const cues = [{ id: 's1c2', scene: 0, text: 'Input becomes output.', startFrame: 30, endFrame: 70,
    startMs: 1000, endMs: 2333, wordFrom: 0, wordTo: 3 }];
  await compileVisualDirectiveSequence(sequence, cues, { fps: 30, start: 0, duration: 90,
    title: 'Input', context: 'Input becomes output.', resolve: async () => { throw new Error('Example has no staged assets.'); } });
  return { description: 'Compiler-verified illustrative fixture. Use the current job binding and cues for an import.',
    fixture: { fps: 30, durationInFrames: 90, cues }, directive: { version: visualContractVersion,
      schemaHash: visualSchemaHash, inputRevision: '0'.repeat(64), sequences: [sequence] } };
}

export async function visualSourcePack() {
  const { files, revision } = await loadVisualDirectorReference();
  const json = (data: unknown) => Buffer.from(`${JSON.stringify(data, null, 2)}\n`);
  const compiledExample = await verifiedDirectiveExample();
  return new Map<string, Buffer>([...files,
    ['SCENE_SCHEMA.json', json(directiveJsonSchema)], ['RENDERER_CAPABILITIES.json', json(rendererCapabilities)],
    ['ANIMATION_RULES.md', Buffer.from(`# Production animation and validation rules\n\n${directiveRules.map(rule => `- ${rule}`).join('\n')}\n`)],
    ['VALID_EXAMPLE.json', json(compiledExample)], ['CONTRACT_VERSION.json', json({ version: visualContractVersion, schemaHash: visualSchemaHash, contractHash: visualContractHash, artDirectionRevision: revision })],
  ]);
}
