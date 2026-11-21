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
  wordFrames?: number[];
  audioFrames?: number;
};

export const SceneRegistry: {
  [K in StoryboardScene['type']]: React.FC<RegisteredSceneProps<Extract<StoryboardScene, { type: K }>>>;
} = {
  raceCondition: ({ scene, cueFrames }) => (
    <RaceConditionSimulatorScene
      title={scene.visualProps?.title || scene.onScreenText || 'CONCURRENCY • RACE CONDITION'}
      itemTitle={scene.visualProps?.itemTitle || `${scene.onScreenText || 'Shared Resource'} Mutex`}
      user1Name={scene.visualProps?.user1Name || 'Worker Node A'}
      user2Name={scene.visualProps?.user2Name || 'Worker Node B'}
      atomicQuery={scene.visualProps?.atomicQuery || 'SET lock:resource "worker_uuid" NX EX 5;'}
      onScreenText={scene.onScreenText}
      cueFrames={cueFrames}
    />
  ),
  architecturePipeline: ({ scene }) => (
    <ArchitectureFlowPipelineScene
      title={scene.visualProps?.title || scene.onScreenText || 'ARCHITECTURE PIPELINE'}
      subtitle={scene.visualProps?.subtitle || scene.technicalKeyPoint || 'In-memory coordination engine'}
      redisLatencyMs={scene.visualProps?.redisLatencyMs ?? 2.1}
      steps={scene.visualProps?.steps}
    />
  ),
  comparison: ({ scene }) => (
    <ComparisonScene
      leftTitle={scene.visualProps?.leftTitle || 'Naive Approach'}
      leftCode={scene.visualProps?.leftCode || 'SELECT * FROM resource_table WHERE id = 101 FOR UPDATE;'}
      leftPoints={scene.visualProps?.leftPoints || ['Unindexed full-scan search', 'High contention under heavy load']}
      rightTitle={scene.visualProps?.rightTitle || 'Optimized Architecture'}
      rightCode={scene.visualProps?.rightCode || 'SET lock:resource uuid NX EX 5'}
      rightPoints={scene.visualProps?.rightPoints || ['Sub-millisecond latency in memory', 'Scales across distributed nodes']}
      verdict={scene.visualProps?.verdict || scene.technicalKeyPoint || 'Winner: Scalable Architecture'}
      onScreenText={scene.onScreenText}
    />
  ),
  tradeoffHUD: ({ scene }) => (
    <TradeoffDecisionHUDScene
      title={scene.visualProps?.title || scene.onScreenText || 'SENIOR SDE TRADEOFF MATRIX'}
      subtitle={scene.visualProps?.subtitle || scene.technicalKeyPoint || 'Which architecture strategy would you defend?'}
      optionA_Title={scene.visualProps?.optionA_Title || 'OPTION A: LOW LATENCY / IN-MEMORY CACHE'}
      optionA_Pros={scene.visualProps?.optionA_Pros || 'Sub-millisecond response time & zero disk I/O bottleneck'}
      optionA_Cons={scene.visualProps?.optionA_Cons || 'Potential cache invalidation lag & cluster memory footprint'}
      optionB_Title={scene.visualProps?.optionB_Title || 'OPTION B: STRONG CONSISTENCY / DIRECT STORE'}
      optionB_Pros={scene.visualProps?.optionB_Pros || 'Guaranteed atomic durability across all transactions'}
      optionB_Cons={scene.visualProps?.optionB_Cons || 'Higher query latency & database connection pool contention'}
      interviewPoints={
        scene.visualProps?.interviewPoints || [
          scene.technicalKeyPoint || 'Decouple read hot-paths using in-memory state',
          'Use atomic locks with TTL guards to prevent deadlocks',
          'Design graceful degradation for edge-case network partitions',
          'Balance latency budgets against strict consistency requirements',
        ]
      }
      callToAction={scene.visualProps?.callToAction || 'Save this reel for your System Design Interview & follow for more!'}
    />
  ),
  smartphoneMockup: ({ scene, cueFrames }) => (
    <SmartphoneMockupScene
      headline={scene.visualProps?.headline || scene.onScreenText || 'REAL-TIME CLIENT TRIGGER'}
      subtext={scene.visualProps?.subtext || scene.technicalKeyPoint || 'State change observed on consumer client'}
      appName={scene.visualProps?.appName}
      appCategory={scene.visualProps?.appCategory}
      locationText={scene.visualProps?.locationText}
      itemName={scene.visualProps?.itemName}
      itemEmoji={scene.visualProps?.itemEmoji}
      itemPrice={scene.visualProps?.itemPrice}
      feeLabel={scene.visualProps?.feeLabel}
      baseDeliveryFee={scene.visualProps?.baseDeliveryFee}
      surgeDeliveryFee={scene.visualProps?.surgeDeliveryFee}
      surgeMultiplier={scene.visualProps?.surgeMultiplier}
      surgeReason={scene.visualProps?.surgeReason}
      algorithmName={scene.visualProps?.algorithmName}
      ctaText={scene.visualProps?.ctaText}
      lottieAsset={scene.visualProps?.lottieAsset}
      onScreenText={scene.onScreenText}
      cueFrames={cueFrames}
    />
  ),
  h3SpatialMap: ({ scene }) => (
    <H3SpatialMapScene
      title={scene.visualProps?.title || scene.onScreenText || 'SPATIAL INDEXING & PARTITION MESH'}
      subtitle={scene.visualProps?.subtitle || scene.technicalKeyPoint || 'O(1) Cell resolution narrows search candidate radius'}
      hotHexId={scene.visualProps?.hotHexId}
      orderCount={scene.visualProps?.orderCount}
      riderCount={scene.visualProps?.riderCount}
      surgeMultiplier={scene.visualProps?.surgeMultiplier}
      mode={scene.visualProps?.mode}
      entityLabel={scene.visualProps?.entityLabel}
      providerLabel={scene.visualProps?.providerLabel}
      entityEmoji={scene.visualProps?.entityEmoji}
      providerEmoji={scene.visualProps?.providerEmoji}
    />
  ),
  hook: ({ scene }) => (
    <DeepConceptHook
      headline={scene.visualProps?.headline || scene.onScreenText || 'SYSTEM DESIGN HOOK'}
      questionKicker={scene.visualProps?.questionKicker || scene.narration || 'How does this architecture work under the hood?'}
      badgeText={scene.visualProps?.badgeText || 'SYSTEM DESIGN'}
      accentColor={scene.visualProps?.accentColor || '#00F2FE'}
      misconceptionAlert={scene.visualProps?.misconceptionAlert}
      onScreenText={scene.onScreenText}
    />
  ),
  code: ({ scene }) => (
    <InteractiveConsoleScene
      filename={scene.visualProps?.filename || 'system_handler.ts'}
      code={scene.visualProps?.code || scene.technicalKeyPoint || 'const lock = await acquireLock(resourceId, 5000);'}
      highlightLines={scene.visualProps?.highlightLines || [1]}
      terminalOutputs={scene.visualProps?.terminalOutputs ?? []}
      explanationCallout={scene.visualProps?.explanationCallout || scene.technicalKeyPoint || 'Atomic conditional check'}
      onScreenText={scene.onScreenText}
    />
  ),
  summary: ({ scene }) => (
    <SummaryScene
      headline={scene.visualProps?.headline || scene.onScreenText || 'MENTAL MODEL RECAP'}
      takeaways={
        scene.visualProps?.takeaways || [
          scene.technicalKeyPoint || 'Partition state to enable O(1) candidate lookup',
          'Offload hot read paths from disk to in-memory buffers',
          'Use atomic leases with auto-expiry to safeguard concurrency',
          'Filter stale node heartbeats from live availability pools',
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
      technicalKeyPoint={scene.technicalKeyPoint}
      visualProps={scene.visualProps}
      mode={scene.visualProps?.mode}
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

export function renderRegisteredScene(scene: StoryboardScene, cueFrames?: number[], wordFrames?: number[], audioFrames?: number) {
  const Component = SceneRegistry[scene.type] as React.FC<RegisteredSceneProps<any>> | undefined;
  if (!Component) {
    throw new Error(
      `[SceneRegistry] Unknown scene type '${(scene as any).type}'. Every scene must be registered in the SceneRegistry.`
    );
  }
  return <Component scene={scene} cueFrames={cueFrames} wordFrames={wordFrames} audioFrames={audioFrames} />;
}
