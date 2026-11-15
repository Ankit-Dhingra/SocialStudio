import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
} from 'remotion';
import { Storyboard } from '../contracts/storyboard.js';
import { VideoTimeline } from './timeline.js';
import { VideoDesignTokens } from './design-system.js';
import { DeepConceptHook } from './scenes/DeepConceptHook.js';
import { InteractiveConsoleScene } from './scenes/InteractiveConsoleScene.js';
import { QueueTimelineScene } from './scenes/QueueTimelineScene.js';
import { EventLoopStateSimulator } from './scenes/EventLoopStateSimulator.js';
import { ComparisonScene } from './scenes/ComparisonScene.js';
import { SummaryScene } from './scenes/SummaryScene.js';
import { RequestFlowScene } from './scenes/RequestFlowScene.js';
import { RaceConditionSimulatorScene } from './scenes/RaceConditionSimulatorScene.js';
import { CollectionScene } from './scenes/CollectionScene.js';
import { SmartphoneMockupScene } from './scenes/SmartphoneMockupScene.js';
import { H3SpatialMapScene } from './scenes/H3SpatialMapScene.js';
import { ArchitectureFlowPipelineScene } from './scenes/ArchitectureFlowPipelineScene.js';
import { TradeoffDecisionHUDScene } from './scenes/TradeoffDecisionHUDScene.js';
import { KineticCaptions } from './KineticCaptions.js';
import { EclipseNeonRing, SpiralGlassRibbon, LayercutWordBehind } from './MotionStyles.js';

export interface StudioShortProps {
  storyboard: Storyboard;
  timeline: VideoTimeline;
}

function resolveAudioSource(src: string): string {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  const normalized = src.replace(/\\/g, '/');
  if (normalized.includes('/public/')) {
    const rel = normalized.split('/public/')[1];
    return staticFile(rel);
  }
  if (normalized.includes(':') || (normalized.startsWith('/') && !normalized.startsWith('/audio'))) {
    const filename = normalized.split('/').pop() || '';
    return staticFile(`audio/${filename}`);
  }
  return staticFile(normalized);
}

function safeClean(val: any, fallback = ''): string {
  if (!val) return fallback;
  if (typeof val === 'string') {
    let s = val.trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        return safeClean(parsed, fallback);
      } catch {
        s = s.replace(/[\{\}\[\]"']/g, '').replace(/\b(text|position|color|size|delay|type|id|side)\b\s*:\s*/gi, '').trim();
      }
    }
    return s || fallback;
  }
  if (Array.isArray(val)) {
    const list = val.map((x) => safeClean(x, '')).filter(Boolean);
    return list.slice(0, 3).join(' • ') || fallback;
  }
  if (typeof val === 'object') {
    return val.text || val.title || val.headline || val.label || val.name || fallback;
  }
  return String(val).trim() || fallback;
}

export const StudioShortComposition: React.FC<StudioShortProps> = ({ storyboard, timeline }) => {
  const frame = useCurrentFrame();

  // Background music source (defaults to our synthesized ambient tech track)
  const bgmTrack = timeline.bgmSrc || 'music/tech-ambient.wav';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#080A0F',
        backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px)',
        backgroundSize: '36px 36px',
        boxShadow: 'inset 0 0 220px rgba(0, 0, 0, 0.95)',
        fontFamily: VideoDesignTokens.typography.fontFamilySans,
        color: VideoDesignTokens.colors.textPrimary,
        overflow: 'hidden',
      }}
    >
      {/* Top Header Safe Zone Status Bar */}
      <div
        style={{
          position: 'absolute',
          top: 36,
          left: 48,
          right: 48,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 100,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 18px',
            background: 'rgba(255, 255, 255, 0.06)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 999,
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981' }} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '1.5px', color: '#F1F5F9', textTransform: 'uppercase' }}>
            SYSTEM DESIGN DEEP DIVE
          </span>
        </div>

        {/* Progress Segments */}
        <div style={{ display: 'flex', gap: 6 }}>
          {storyboard.scenes.map((_, idx) => {
            const seg = timeline.segments[idx];
            const isCompleted = seg && frame >= seg.startFrame + seg.durationInFrames;
            const isCurrent = seg && frame >= seg.startFrame && frame < seg.startFrame + seg.durationInFrames;
            return (
              <div
                key={idx}
                style={{
                  width: 32,
                  height: 5,
                  borderRadius: 3,
                  background: isCompleted ? '#3B82F6' : isCurrent ? '#FACC15' : 'rgba(255, 255, 255, 0.2)',
                  transition: 'background 0.2s',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Render Scenes by Timeline Segments */}
      {storyboard.scenes.map((scene, i) => {
        const seg = timeline.segments[i];
        if (!seg) return null;

        const visualProps = (scene.visualProps || {}) as Record<string, any>;
        const sceneType = (visualProps.type || scene.type) as string;

        return (
          <Sequence
            key={scene.id || i}
            from={seg.startFrame}
            durationInFrames={seg.durationInFrames}
          >
            {/* Render appropriate scene component based on sceneType */}
            {(() => {
              switch (sceneType) {
                case 'raceCondition':
                  const isTicketOrSeat = /seat|ticket|concert|flight|booking/i.test(storyboard.topic + ' ' + scene.narration);
                  return (
                    <RaceConditionSimulatorScene
                      title={safeClean(visualProps.title || scene.onScreenText, 'CONCURRENCY • RACE CONDITION')}
                      itemTitle={isTicketOrSeat ? 'Concert Ticket (Seats: 1)' : 'iPhone 16 Pro (Stock: 1)'}
                      user1Name="You"
                      user2Name="Friend"
                      atomicQuery="SET lock:seat_101 token_id NX EX 10"
                    />
                  );

                case 'smartphoneMockup':
                  return (
                    <SmartphoneMockupScene
                      {...visualProps}
                      headline={safeClean(visualProps.headline || scene.onScreenText, 'HOW APPS HANDLE HIGH DEMAND')}
                      subtext={safeClean(visualProps.subtext || scene.technicalKeyPoint, 'Why prices and status update dynamically')}
                    />
                  );

                case 'h3SpatialMap':
                  return (
                    <H3SpatialMapScene
                      {...visualProps}
                      title={safeClean(visualProps.title || scene.onScreenText, 'GEOSPATIAL H3 INDEXING')}
                      subtitle={safeClean(visualProps.subtitle || scene.technicalKeyPoint, 'O(1) Hexagonal lookup narrows query radius')}
                    />
                  );

                case 'architecturePipeline':
                  return (
                    <ArchitectureFlowPipelineScene
                      {...visualProps}
                      title={safeClean(visualProps.title || scene.onScreenText, 'DISTRIBUTED ARCHITECTURE PIPELINE')}
                      subtitle={safeClean(visualProps.subtitle || scene.technicalKeyPoint, 'In-memory coordination prevents database race conditions')}
                    />
                  );

                case 'tradeoffHUD':
                  const isRedisLock = /lock|redis/i.test(storyboard.topic);
                  return (
                    <TradeoffDecisionHUDScene
                      title={safeClean(visualProps.title || scene.onScreenText, 'SENIOR SDE TRADEOFF MATRIX')}
                      subtitle={safeClean(visualProps.subtitle || scene.technicalKeyPoint, 'Which architecture strategy would you defend in an interview?')}
                      optionA_Title={safeClean(visualProps.optionA_Title, isRedisLock ? 'OPTION A: SHORT TTL (5-10s)' : 'OPTION A: OPTIMISTIC LOCKING')}
                      optionA_Pros={safeClean(visualProps.optionA_Pros, 'Quick recovery from crashes, minimal deadlock downtime')}
                      optionA_Cons={safeClean(visualProps.optionA_Cons, 'Premature expiry risk if query latency spikes')}
                      optionB_Title={safeClean(visualProps.optionB_Title, isRedisLock ? 'OPTION B: LONG TTL (60s+)' : 'OPTION B: PESSIMISTIC LOCKING')}
                      optionB_Pros={safeClean(visualProps.optionB_Pros, 'Safe for heavy computations and complex transactions')}
                      optionB_Cons={safeClean(visualProps.optionB_Cons, 'Prolonged deadlocks if client process dies')}
                      interviewPoints={[
                        'Acquire lock atomically using SET NX EX with unique client token',
                        'Release lock safely via Lua script verifying token ownership',
                        'Use TTL to guard against process crashes and network partitions',
                        'Tradeoff: Fast crash recovery (Short TTL) vs Process safety (Long TTL)',
                      ]}
                      callToAction="Save this reel for your System Design Interview & follow for more!"
                    />
                  );

                case 'hook':
                  if (visualProps.type === 'smartphoneMockup' || /zomato|swiggy|uber|phonepe|blinkit|zepto/i.test(storyboard.topic)) {
                    return (
                      <SmartphoneMockupScene
                        {...visualProps}
                        headline={safeClean(visualProps.headline || scene.onScreenText, 'SYSTEM DESIGN HOOK')}
                        subtext={safeClean(visualProps.subtext || scene.technicalKeyPoint, 'Real-world problem breakdown')}
                      />
                    );
                  }
                  return (
                    <>
                      <EclipseNeonRing />
                      <DeepConceptHook
                        headline={safeClean(visualProps.headline || scene.onScreenText, 'SYSTEM DESIGN HOOK')}
                        questionKicker={safeClean(visualProps.subtext || visualProps.questionKicker || scene.narration, 'How does the architecture handle concurrent requests?')}
                        badgeText={safeClean(visualProps.badgeText, 'TECH EXPLAINED')}
                        accentColor={visualProps.accentColor || '#00F2FE'}
                        misconceptionAlert={safeClean(visualProps.misconceptionAlert, '')}
                        onScreenText={safeClean(scene.onScreenText, '')}
                      />
                    </>
                  );

                case 'code':
                  return (
                    <>
                      <SpiralGlassRibbon topPercent={38} />
                      <InteractiveConsoleScene
                        filename={safeClean(visualProps.filename, 'Example')}
                        code={safeClean(visualProps.code || scene.technicalKeyPoint, 'SET lock:resource token NX EX 10')}
                        highlightLines={visualProps.highlightLines || [1]}
                        terminalOutputs={visualProps.terminalOutputs || []}
                        explanationCallout={safeClean(visualProps.explanationCallout || scene.technicalKeyPoint, 'Atomic check & lock acquisition')}
                        onScreenText={safeClean(scene.onScreenText, 'CODE IMPLEMENTATION')}
                      />
                    </>
                  );

                case 'queueTimeline':
                  return (
                    <ArchitectureFlowPipelineScene
                      title={safeClean(visualProps.title || scene.onScreenText, 'QUEUE & STREAM PIPELINE')}
                      subtitle={safeClean(visualProps.subtitle || scene.technicalKeyPoint, 'Decoupled worker architecture')}
                    />
                  );

                case 'collection':
                  return (
                    <CollectionScene
                      title={safeClean(visualProps.title, 'SYSTEM COMPONENTS')}
                      items={Array.isArray(visualProps.items) ? visualProps.items : ['App Gateway', 'Redis Engine', 'PostgreSQL DB']}
                      result={safeClean(visualProps.result, 'Connected Pipeline')}
                      revealFrame={seg.cueFrames?.[0] ?? 0}
                    />
                  );

                case 'requestFlow':
                  return (
                    <RequestFlowScene
                      title={safeClean(visualProps.title || scene.onScreenText, 'REQUEST PIPELINE')}
                      steps={visualProps.steps || [{ label: safeClean(scene.onScreenText, 'Step 1'), description: safeClean(scene.technicalKeyPoint, 'Processing') }]}
                      cueFrames={seg.cueFrames}
                      onScreenText={safeClean(scene.onScreenText, 'FLOW')}
                    />
                  );

                case 'comparison':
                  return (
                    <ComparisonScene
                      leftTitle={safeClean(visualProps.leftTitle, 'Naive Direct Query')}
                      leftCode={safeClean(visualProps.leftCode, 'SELECT * FROM seats WHERE id = 1')}
                      leftPoints={Array.isArray(visualProps.leftPoints) ? visualProps.leftPoints.map((x: any) => safeClean(x)) : ['Parallel requests collide', 'Inventory drops below zero (-1)']}
                      rightTitle={safeClean(visualProps.rightTitle, 'Distributed Lock Engine')}
                      rightCode={safeClean(visualProps.rightCode, 'SET lock:seat_1 user_id NX EX 10')}
                      rightPoints={Array.isArray(visualProps.rightPoints) ? visualProps.rightPoints.map((x: any) => safeClean(x)) : ['Atomic single-turn guarantee', 'Safe auto-release on crash (TTL)']}
                      verdict={safeClean(visualProps.verdict || scene.technicalKeyPoint, 'Winner: Redis Atomic Lock')}
                      onScreenText={safeClean(scene.onScreenText, 'PARALLEL REALITY')}
                    />
                  );

                case 'summary':
                  return (
                    <>
                      <LayercutWordBehind word="RECAP" topPercent={16} />
                      <SummaryScene
                        headline={safeClean(visualProps.headline || scene.onScreenText, 'MENTAL MODEL RECAP')}
                        takeaways={[
                          'SET NX EX ensures single-turn atomicity across all nodes',
                          'Unique request token prevents accidental lock releases',
                          'TTL expiration provides guaranteed deadlock safety on crash',
                        ]}
                        callToAction={safeClean(visualProps.callToAction, 'Follow for more senior backend engineering breakdowns!')}
                        onScreenText="KEY TAKEAWAYS"
                      />
                    </>
                  );

                default:
                  return (
                    <DeepConceptHook
                      headline={safeClean(scene.onScreenText, 'SYSTEM DESIGN CONCEPT')}
                      questionKicker={safeClean(scene.narration, '')}
                    />
                  );
              }
            })()}

            {/* Per-scene Narration Audio */}
            {seg.audioSrc && <Audio src={resolveAudioSource(seg.audioSrc)} />}

            {/* Kinetic Dynamic Word-by-Word Subtitles */}
            <KineticCaptions
              wordFrames={seg.wordFrames}
              narration={scene.narration}
              durationInFrames={Math.max(1, Math.ceil(seg.audioDurationMs * timeline.fps / 1000))}
              highlightColor="#FACC15"
            />
          </Sequence>
        );
      })}

      {/* Continuous Tech Background Music with Audio Ducking */}
      {bgmTrack && (
        <Audio
          src={resolveAudioSource(bgmTrack)}
          volume={() => 0.08}
          loop
        />
      )}
    </AbsoluteFill>
  );
};
