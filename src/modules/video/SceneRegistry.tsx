import React from 'react';
import { StoryboardScene } from '../contracts/storyboard.js';
import { RaceConditionSimulatorScene } from './scenes/RaceConditionSimulatorScene.js';
import { ArchitectureFlowPipelineScene } from './scenes/ArchitectureFlowPipelineScene.js';
import { ComparisonScene } from './scenes/ComparisonScene.js';
import { TradeoffDecisionHUDScene } from './scenes/TradeoffDecisionHUDScene.js';
import { SmartphoneMockupScene } from './scenes/SmartphoneMockupScene.js';
import { H3SpatialMapScene } from './scenes/H3SpatialMapScene.js';
import { DeepConceptHook } from './scenes/DeepConceptHook.js';
import { InteractiveConsoleScene } from './scenes/InteractiveConsoleScene.js';
import { SummaryScene } from './scenes/SummaryScene.js';
import { QueueTimelineScene } from './scenes/QueueTimelineScene.js';
import { RequestFlowScene } from './scenes/RequestFlowScene.js';
import { CollectionScene } from './scenes/CollectionScene.js';

export type RegisteredSceneProps<T extends StoryboardScene = StoryboardScene> = {
  scene: T;
  cueFrames?: number[];
};

export const SceneRegistry: {
  [K in StoryboardScene['type']]: React.FC<RegisteredSceneProps<Extract<StoryboardScene, { type: K }>>>;
} = {
  raceCondition: ({ scene }) => (
    <RaceConditionSimulatorScene
      title={scene.visualProps?.title || scene.onScreenText || 'CONCURRENCY • RACE CONDITION'}
      itemTitle={scene.visualProps?.itemTitle || 'Coldplay VIP Lounge (Seat A-12)'}
      user1Name={scene.visualProps?.user1Name || 'Aman (Client A)'}
      user2Name={scene.visualProps?.user2Name || 'Riya (Client B)'}
      atomicQuery={scene.visualProps?.atomicQuery || 'UPDATE seats SET stock = stock - 1 WHERE id = 101 AND stock > 0;'}
      onScreenText={scene.onScreenText}
    />
  ),
  architecturePipeline: ({ scene }) => (
    <ArchitectureFlowPipelineScene
      title={scene.visualProps?.title || scene.onScreenText || 'ARCHITECTURE PIPELINE'}
      subtitle={scene.visualProps?.subtitle || scene.technicalKeyPoint || 'In-memory coordination engine'}
      redisLatencyMs={scene.visualProps?.redisLatencyMs ?? 0.8}
    />
  ),
  comparison: ({ scene }) => (
    <ComparisonScene
      leftTitle={scene.visualProps?.leftTitle || 'Naive Direct Query'}
      leftCode={scene.visualProps?.leftCode || 'SELECT * FROM seats WHERE id = 1'}
      leftPoints={scene.visualProps?.leftPoints || ['Parallel requests collide', 'Inventory drops below zero (-1)']}
      rightTitle={scene.visualProps?.rightTitle || 'Distributed Lock Engine'}
      rightCode={scene.visualProps?.rightCode || 'SET lock:seat_1 user_id NX EX 10'}
      rightPoints={scene.visualProps?.rightPoints || ['Atomic single-turn guarantee', 'Safe auto-release on crash (TTL)']}
      verdict={scene.visualProps?.verdict || scene.technicalKeyPoint || 'Winner: Redis Atomic Lock'}
      onScreenText={scene.onScreenText}
    />
  ),
  tradeoffHUD: ({ scene }) => (
    <TradeoffDecisionHUDScene
      title={scene.visualProps?.title || scene.onScreenText || 'SENIOR SDE TRADEOFF MATRIX'}
      subtitle={scene.visualProps?.subtitle || scene.technicalKeyPoint || 'Which architecture strategy would you defend?'}
      optionA_Title={scene.visualProps?.optionA_Title || 'OPTION A: SHORT TTL (5-10s)'}
      optionA_Pros={scene.visualProps?.optionA_Pros || 'Quick recovery from crashes, minimal deadlock downtime'}
      optionA_Cons={scene.visualProps?.optionA_Cons || 'Premature expiry risk if query latency spikes'}
      optionB_Title={scene.visualProps?.optionB_Title || 'OPTION B: LONG TTL (60s+)'}
      optionB_Pros={scene.visualProps?.optionB_Pros || 'Safe for heavy computations and complex transactions'}
      optionB_Cons={scene.visualProps?.optionB_Cons || 'Prolonged deadlocks if client process dies'}
      interviewPoints={
        scene.visualProps?.interviewPoints || [
          'Acquire lock atomically using SET NX EX with unique client token',
          'Release lock safely via Lua script verifying token ownership',
          'Use TTL to guard against process crashes and network partitions',
          'Tradeoff: Fast crash recovery (Short TTL) vs Process safety (Long TTL)',
        ]
      }
      callToAction={scene.visualProps?.callToAction || 'Save this reel for your System Design Interview & follow for more!'}
    />
  ),
  smartphoneMockup: ({ scene }) => (
    <SmartphoneMockupScene
      headline={scene.visualProps?.headline || scene.onScreenText || 'HIGH CONCURRENCY DEMAND'}
      subtext={scene.visualProps?.subtext || scene.technicalKeyPoint || 'Real-time surge and lock management'}
      appName={scene.visualProps?.appName || 'TicketMaster'}
      locationText={scene.visualProps?.locationText || 'Live Arena'}
      itemName={scene.visualProps?.itemName || 'VIP Ticket Pass'}
      itemPrice={scene.visualProps?.itemPrice || 4999}
      surgeAmount={scene.visualProps?.surgeAmount}
      surgeMultiplier={scene.visualProps?.surgeMultiplier}
    />
  ),
  h3SpatialMap: ({ scene }) => (
    <H3SpatialMapScene
      title={scene.visualProps?.title || scene.onScreenText || 'GEOSPATIAL H3 INDEXING'}
      subtitle={scene.visualProps?.subtitle || scene.technicalKeyPoint || 'Hexagonal spatial partitioning'}
    />
  ),
  hook: ({ scene }) => (
    <DeepConceptHook
      headline={scene.visualProps?.headline || scene.onScreenText || 'SYSTEM DESIGN HOOK'}
      questionKicker={scene.visualProps?.questionKicker || scene.narration || 'How does concurrent booking work?'}
      badgeText={scene.visualProps?.badgeText || 'SYSTEM DESIGN'}
      accentColor={scene.visualProps?.accentColor || '#00F2FE'}
      misconceptionAlert={scene.visualProps?.misconceptionAlert}
      onScreenText={scene.onScreenText}
    />
  ),
  code: ({ scene }) => (
    <InteractiveConsoleScene
      filename={scene.visualProps?.filename || 'atomic_lock.sql'}
      code={scene.visualProps?.code || scene.technicalKeyPoint || 'UPDATE inventory SET stock = stock - 1 WHERE id = 101 AND stock > 0;'}
      highlightLines={scene.visualProps?.highlightLines || [1]}
      terminalOutputs={scene.visualProps?.terminalOutputs || []}
      explanationCallout={scene.visualProps?.explanationCallout || scene.technicalKeyPoint || 'Atomic conditional check'}
      onScreenText={scene.onScreenText}
    />
  ),
  summary: ({ scene }) => (
    <SummaryScene
      headline={scene.visualProps?.headline || scene.onScreenText || 'MENTAL MODEL RECAP'}
      takeaways={
        scene.visualProps?.takeaways || [
          'SET NX EX ensures single-turn atomicity across all nodes',
          'Unique request token prevents accidental lock releases',
          'TTL expiration provides guaranteed deadlock safety on crash',
        ]
      }
      callToAction={scene.visualProps?.callToAction || 'Follow for more senior backend engineering breakdowns!'}
      onScreenText={scene.onScreenText}
    />
  ),
  queueTimeline: ({ scene, cueFrames }) => (
    <QueueTimelineScene
      title={scene.visualProps?.title || scene.onScreenText || 'QUEUE TIMELINE'}
      items={scene.visualProps?.items || []}
      activeItemIndex={scene.visualProps?.activeItemIndex || 0}
      cueFrames={cueFrames}
      onScreenText={scene.onScreenText}
    />
  ),
  requestFlow: ({ scene, cueFrames }) => (
    <RequestFlowScene
      title={scene.visualProps?.title || scene.onScreenText || 'REQUEST FLOW'}
      steps={scene.visualProps?.steps || []}
      cueFrames={cueFrames}
      onScreenText={scene.onScreenText}
    />
  ),
  collection: ({ scene, cueFrames }) => (
    <CollectionScene
      title={scene.visualProps?.title || scene.onScreenText || 'SYSTEM COMPONENTS'}
      items={scene.visualProps?.items || []}
      result={scene.visualProps?.result || 'Connected Pipeline'}
      revealFrame={cueFrames?.[0] ?? 0}
    />
  ),
};

export function renderRegisteredScene(scene: StoryboardScene, cueFrames?: number[]) {
  const Component = SceneRegistry[scene.type] as React.FC<RegisteredSceneProps<any>> | undefined;
  if (!Component) {
    throw new Error(
      `[SceneRegistry] Unknown scene type '${(scene as any).type}'. Every scene must be registered in the SceneRegistry.`
    );
  }
  return <Component scene={scene} cueFrames={cueFrames} />;
}
