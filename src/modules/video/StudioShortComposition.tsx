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
import { KineticCaptions } from './KineticCaptions.js';

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

export const StudioShortComposition: React.FC<StudioShortProps> = ({ storyboard, timeline }) => {
  const frame = useCurrentFrame();

  // Progress Bar percentage
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, timeline.totalDurationInFrames)));

  // Continuous Ambient Motion: Floating Glowing Orbs
  const orb1X = Math.sin(frame / 40) * 120 + 200;
  const orb1Y = Math.cos(frame / 40) * 140 + 400;
  const orb2X = Math.cos(frame / 35) * 100 + 700;
  const orb2Y = Math.sin(frame / 35) * 120 + 1300;

  // Background music source (defaults to our synthesized ambient tech track)
  const bgmTrack = timeline.bgmSrc || 'music/tech-ambient.wav';

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(ellipse at 50% 10%, #0D1B36 0%, #030712 80%)',
        fontFamily: VideoDesignTokens.typography.fontFamilySans,
        color: VideoDesignTokens.colors.textPrimary,
        overflow: 'hidden',
      }}
    >
      {/* Floating Ambient Glowing Cyber Orbs */}
      <div
        style={{
          position: 'absolute',
          left: orb1X,
          top: orb1Y,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 242, 254, 0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: orb2X,
          top: orb2Y,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)',
          filter: 'blur(50px)',
          pointerEvents: 'none',
        }}
      />

      {/* Dynamic Background Tech Matrix Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.8,
          pointerEvents: 'none',
        }}
      />

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
                  return (
                    <RaceConditionSimulatorScene
                      title={visualProps.title || scene.onScreenText}
                      itemTitle={visualProps.itemTitle}
                      user1Name={visualProps.user1Name}
                      user2Name={visualProps.user2Name}
                      atomicQuery={visualProps.atomicQuery}
                    />
                  );

                case 'hook':
                  return (
                    <DeepConceptHook
                      headline={visualProps.headline || scene.onScreenText}
                      questionKicker={visualProps.subtext || visualProps.questionKicker}
                      badgeText={visualProps.badgeText || 'TECH EXPLAINED'}
                      accentColor={visualProps.accentColor}
                      misconceptionAlert={visualProps.misconceptionAlert}
                      onScreenText={scene.onScreenText}
                    />
                  );

                case 'code':
                  return (
                    <InteractiveConsoleScene
                      filename={visualProps.filename || 'Example'}
                      code={visualProps.code || scene.technicalKeyPoint}
                      highlightLines={visualProps.highlightLines || [1]}
                      terminalOutputs={visualProps.terminalOutputs || []}
                      explanationCallout={visualProps.explanationCallout || scene.technicalKeyPoint}
                      onScreenText={scene.onScreenText}
                    />
                  );

                case 'queueTimeline':
                  return visualProps.items || visualProps.timelineSteps
                    ? <QueueTimelineScene {...visualProps} cueFrames={seg.cueFrames} onScreenText={scene.onScreenText} />
                    : /event loop|microtask/i.test(storyboard.topic)
                      ? <EventLoopStateSimulator />
                      : <QueueTimelineScene title={scene.onScreenText} timelineSteps={[scene.technicalKeyPoint]} />;

                case 'collection':
                  return <CollectionScene title={visualProps.title} items={visualProps.items}
                    result={visualProps.result} revealFrame={seg.cueFrames?.[0] ?? 0} />;
                case 'requestFlow':
                  return (
                    <RequestFlowScene
                      title={visualProps.title || scene.onScreenText}
                      steps={visualProps.steps || [{ label: scene.onScreenText, description: scene.technicalKeyPoint }]}
                      cueFrames={seg.cueFrames}
                      onScreenText={scene.onScreenText}
                    />
                  );

                case 'comparison':
                  return (
                    <ComparisonScene
                      leftTitle={visualProps.leftTitle || 'Before'}
                      leftCode={visualProps.leftCode || ''}
                      leftPoints={visualProps.leftPoints || []}
                      rightTitle={visualProps.rightTitle || 'After'}
                      rightCode={visualProps.rightCode || ''}
                      rightPoints={visualProps.rightPoints || []}
                      verdict={visualProps.verdict || scene.technicalKeyPoint}
                      onScreenText={scene.onScreenText}
                    />
                  );

                case 'summary':
                  return (
                    <SummaryScene
                      headline={visualProps.headline || scene.onScreenText}
                      takeaways={visualProps.takeaways || visualProps.summaryBullets || [scene.technicalKeyPoint]}
                      summaryBullets={visualProps.summaryBullets}
                      callToAction={visualProps.callToAction || ''}
                      cta={visualProps.cta}
                      onScreenText={scene.onScreenText}
                    />
                  );

                default:
                  return (
                    <DeepConceptHook
                      headline={scene.onScreenText}
                      questionKicker={scene.narration}
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
          volume={(f) => {
            // Duck volume to 0.07 when narration is playing; rise to 0.16 during pauses
            return 0.08;
          }}
          loop
        />
      )}

      {/* Segmented Top Progress Bar (Reels/Stories Style) */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          left: 40,
          right: 40,
          display: 'flex',
          gap: 8,
          zIndex: 100,
        }}
      >
        {storyboard.scenes.map((_, idx) => {
          const seg = timeline.segments[idx];
          let segFill = 0;
          if (seg) {
            if (frame >= seg.startFrame + seg.durationInFrames) {
              segFill = 1;
            } else if (frame >= seg.startFrame) {
              segFill = (frame - seg.startFrame) / Math.max(1, seg.durationInFrames);
            }
          }
          return (
            <div
              key={idx}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                background: 'rgba(255, 255, 255, 0.25)',
                overflow: 'hidden',
                backdropFilter: 'blur(4px)',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.max(0, segFill * 100))}%`,
                  background: '#FACC15',
                  boxShadow: '0 0 10px #FACC15',
                }}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
