import type { VideoTimeline } from './timeline.js';
import type { motionIcons, motionEffects, TimedShot, VisualPlan } from './visual-story.js';

type Icon = (typeof motionIcons)[number];
type Tone = 'neutral' | 'warning' | 'success' | 'error';
type Effect = (typeof motionEffects)[number];
type MotionShot = Extract<TimedShot, { kind: 'motion' | 'flow' | 'state' }>;

export interface StageStatus {
  value: string;
  tone: Tone;
  effect?: Effect;
  frame: number;
  until?: number;
}

export interface StageNode {
  entity: string;
  label: string;
  icon: Icon;
  brand?: string;
  slot: number;
  entrance: number;
  context: boolean;
  previous?: StageStatus;
  updates: StageStatus[];
}

export interface StagePacket {
  source: string;
  target: string;
  frame: number;
  blocked: boolean;
  shape?: import('./AnimatedConnector.js').RouteShape;
  label?: string;
}

export interface MotionStage {
  start: number;
  nodes: StageNode[];
  packets: StagePacket[];
}

function isGraph(shot: TimedShot): shot is MotionShot {
  return shot.kind === 'motion' || shot.kind === 'flow' || shot.kind === 'state';
}

/** Resolve stable positions and carry forward only facts already shown on screen. */
export function buildMotionStages(plan: VisualPlan, timeline: VideoTimeline) {
  const stages = new Map<string, MotionStage>();
  let previous: MotionStage | undefined;
  const previousValues = new Map<string, StageStatus>();

  plan.forEach((shots, index) => {
    for (const entry of shots) {
      if (!isGraph(entry)) continue;
      const shot = entry;
      const start = timeline.segments[index].startFrame + shot.from;
      const continues = !(shot.kind === 'motion' && shot.reset) &&
        shot.actors.some(actor => previous?.nodes.some(node => node.entity === actor.entity));
      if (!continues) {
        previous = undefined;
        previousValues.clear();
      }
      const earlierNodes = new Map(previous?.nodes.map(node => [node.entity, node]));
      const reserved = new Set(shot.actors.map(actor => earlierNodes.get(actor.entity)?.slot));
      const slotOrder = shot.actors.length === 1 ? [4, 0, 3, 1, 2] : [0, 3, 1, 2, 4];
      const firstActor = shot.actors.reduce((best, _, index) =>
        (shot.reveals[index] ?? 0) < (shot.reveals[best] ?? 0) ? index : best, 0);
      const nodes: StageNode[] = shot.actors.map((actor, actorIndex) => {
        const earlier = earlierNodes.get(actor.entity);
        const slot = earlier?.slot ?? slotOrder.find(position => !reserved.has(position))!;
        reserved.add(slot);
        const reveal = shot.reveals[actorIndex] ?? 0;
        const node: StageNode = {
          entity: actor.entity, label: actor.label, slot, context: false,
          icon: 'icon' in actor ? actor.icon : earlier?.icon ?? 'service',
          brand: 'brand' in actor ? actor.brand : earlier?.brand,
          entrance: earlier || actorIndex === firstActor ? -1 : reveal,
          previous: previousValues.get(actor.entity),
          updates: [],
        };
        if ('value' in actor && actor.value) {
          node.updates.push({ value: actor.value, tone: actor.tone ?? 'neutral', frame: start + reveal });
        }
        return node;
      });
      for (const node of earlierNodes.values()) {
        if (nodes.length >= 4 || reserved.has(node.slot)) continue;
        nodes.push({ ...node, context: true, entrance: -1, previous: previousValues.get(node.entity), updates: [] });
      }
      const nodesById = new Map(nodes.map(node => [node.entity, node]));
      const packets: StagePacket[] = [];
      if (shot.kind === 'motion') {
        shot.events.forEach((event, eventIndex) => {
          const frame = start + (shot.eventFrames?.[eventIndex] ?? 0);
          if (event.kind === 'send') {
            const label = event.cue.match(/\b(?:HTTP request|API response|cache hit|cache miss|database query|payment request|200 OK|event published)\b/i)?.[0];
            packets.push({ source: event.source, target: event.target, frame, blocked: event.outcome === 'blocked',
              ...(event.route ? { shape: event.route } : {}), ...(label ? { label } : {}) });
          } else {
            nodesById.get(event.entity)?.updates.push({
              value: event.value, tone: event.tone ?? 'neutral', effect: event.effect, frame,
            });
          }
        });
      } else {
        shot.transfers.forEach((transfer, transferIndex) => {
          packets.push({
            source: transfer.source, target: transfer.target,
            frame: start + shot.movements[transferIndex], blocked: false,
          });
        });
      }
      for (const node of nodes) {
        node.updates.sort((a, b) => a.frame - b.frame);
        let status = node.previous;
        for (const update of node.updates) {
          if (status?.effect === 'countdown') status.until = update.frame;
          status = update;
        }
        if (status) previousValues.set(node.entity, status);
      }
      const earlierPaths = new Map(previous?.packets.filter(path => nodesById.has(path.source) && nodesById.has(path.target))
        .map(path => [`${path.source}:${path.target}`, path]));
      const stage: MotionStage = { start, nodes, packets: [...earlierPaths.values(), ...packets] };
      stages.set(shot.id, stage);
      previous = stage;
    }
  });
  return stages;
}
