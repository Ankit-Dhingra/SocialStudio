import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { StoryboardSchema } from '../src/modules/contracts/storyboard.js';
import { StudioShortComposition } from '../src/modules/video/StudioShortComposition.js';
import { buildVideoTimeline } from '../src/modules/video/timeline.js';
import type { TimedShot, VisualPlan } from '../src/modules/video/visual-story.js';
import { reelBrand } from '../src/modules/video/brand.js';

const storyboard = StoryboardSchema.parse({
  title: `${reelBrand.name} visual showcase`, topic: 'Order confirmation',
  hook: 'Pickup counter par naya order aata hai.', learningObjective: 'Follow an order from checkout to confirmation.',
  scenes: [
    { type: 'hook', sceneIndex: 0, id: 'intro', durationTargetSec: 3, onScreenText: 'Pickup counter',
      technicalKeyPoint: 'A physical order becomes a digital event.', narration: 'Pickup counter par naya order aata hai.' },
    { type: 'smartphoneMockup', sceneIndex: 1, id: 'phone', durationTargetSec: 4, onScreenText: 'Order confirm',
      technicalKeyPoint: 'The screen follows the transaction.', narration: 'Zomato pe pickup note likho. Order bhejo. Phir confirmation dikhega.' },
    { type: 'architecturePipeline', sceneIndex: 2, id: 'graph', durationTargetSec: 8, onScreenText: 'Request se confirmation',
      technicalKeyPoint: 'Routing, retries and event delivery.', narration: 'HTTP request gateway tak jaati hai. Redis cache hit deta hai. Kafka event published karta hai. API response wapas jaata hai. Duplicate request block hoti hai.' },
    { type: 'comparison', sceneIndex: 3, id: 'metric', durationTargetSec: 4, onScreenText: 'Latency badli',
      technicalKeyPoint: 'Use explicit comparable values.', narration: 'Pehle 80 ms lagte the. Cache ke baad 24 ms lagte hain.' },
  ],
});

const timeline = buildVideoTimeline(storyboard, [], { fps: 30 });
const base = (index: number, headline: string) => ({
  id: storyboard.scenes[index].id, from: 0, duration: timeline.segments[index].durationInFrames,
  cue: '', evidence: storyboard.scenes[index].narration, headline,
  reveals: [], movements: [], takeawayFrame: 0, premium: true,
});

function DesignShowcase({ cinematicAsset }: { cinematicAsset: string }) {
  const intro: TimedShot = cinematicAsset ? {
    ...base(0, ''), kind: 'image', asset: cinematicAsset, camera: 'push-in',
    brief: 'An editorial illustration of the pickup counter', continuity: 'Pickup counter',
  } : { ...base(0, ''), kind: 'focus', focus: { beats: [{ from: 0, text: 'Pickup counter par naya order' }] } };
  const visualPlan: VisualPlan = [
    [intro],
    [{ ...base(1, 'Order confirm'), kind: 'device', screenLayout: 'phone', screenContent: 'checkout', appName: 'Zomato',
      openFrame: 10, screenActions: ['input', 'progress', 'result'], reveals: [22, 56, 92], actors: [
        { entity: 'note', label: 'Pickup note', value: 'Counter 2' },
        { entity: 'order', label: 'Order bheja', value: 'Confirmation aa raha hai' },
        { entity: 'confirmation', label: 'Order confirm', value: 'Pickup ke liye ready' },
      ] }],
    [{ ...base(2, 'Request se confirmation'), kind: 'motion', reveals: [0, 22, 64, 119],
      eventFrames: [28, 70, 104, 124, 163, 205], actors: [
        { entity: 'device', label: 'Zomato', icon: 'phone', brand: 'Zomato' },
        { entity: 'gateway', label: 'API Gateway', icon: 'server' },
        { entity: 'cache', label: 'Redis', icon: 'database', brand: 'Redis' },
        { entity: 'events', label: 'Kafka', icon: 'queue', brand: 'Kafka' },
      ], events: [
        { kind: 'send', source: 'device', target: 'gateway', cue: 'HTTP request' },
        { kind: 'send', source: 'gateway', target: 'cache', cue: 'cache hit', route: 'orthogonal' },
        { kind: 'update', entity: 'cache', cue: 'cache hit', value: '96', tone: 'success' },
        { kind: 'send', source: 'gateway', target: 'events', cue: 'event published', route: 'curve' },
        { kind: 'send', source: 'gateway', target: 'device', cue: 'API response' },
        { kind: 'send', source: 'cache', target: 'events', cue: 'Duplicate request', outcome: 'blocked' },
      ] }],
    [{ ...base(3, 'Latency badli'), kind: 'comparison', chartStyle: 'trend', reveals: [8, 53], actors: [
      { entity: 'before', label: 'Pehle', value: '80 ms' },
      { entity: 'after', label: 'Cache ke baad', value: '24 ms' },
    ] }],
  ];
  return <StudioShortComposition storyboard={storyboard} timeline={timeline} visualPlan={visualPlan} />;
}

function ShowcaseRoot() {
  return <Composition id="PremiumDesignShowcase" component={DesignShowcase} defaultProps={{ cinematicAsset: '' }}
    width={1080} height={1920} fps={timeline.fps} durationInFrames={timeline.totalDurationInFrames} />;
}

registerRoot(ShowcaseRoot);
