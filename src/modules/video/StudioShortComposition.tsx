import React, { useMemo } from 'react';
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
import { renderRegisteredScene } from './SceneRegistry.js';
import { KineticCaptions } from './KineticCaptions.js';
import { AnimatedBlackCyberGrid } from './MotionStyles.js';
import { CinematicStoryShot, GeneratedOpening } from './scenes/CinematicStoryShot.js';
import { planSceneShots, readVisualContext, type ReelPlates, type VisualContext } from './visual-story.js';

export interface StudioShortProps {
  storyboard: Storyboard;
  timeline: VideoTimeline;
  plates?: ReelPlates;
}

function resolveAudioSource(src: string): string {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  const normalized = src.replace(/\\/g, '/');
  if (normalized.includes('/public/')) {
    const rel = normalized.split('/public/')[1].replace(/^\/+/, '');
    return staticFile(rel);
  }
  if (normalized.startsWith('sfx/') || normalized.startsWith('music/') || normalized.startsWith('audio/')) {
    return staticFile(normalized);
  }
  if (normalized.includes(':') || (normalized.startsWith('/') && !normalized.startsWith('/audio'))) {
    const filename = normalized.split('/').pop() || '';
    return staticFile(`audio/${filename}`);
  }
  return staticFile(normalized.replace(/^\/+/, ''));
}

const SceneSequenceRenderer: React.FC<{
  scene: Storyboard['scenes'][number];
  seg: VideoTimeline['segments'][number];
  fps: number;
  isFirst: boolean;
  context: VisualContext;
  plates?: ReelPlates;
  title: string;
}> = ({ scene, seg, fps, isFirst, context, plates, title }) => {
  const sceneFrame = useCurrentFrame();
  const shots = useMemo(() => planSceneShots(scene, seg, context, fps), [scene, seg, context, fps]);
  const opening = isFirst ? plates?.opening : undefined;
  const usesCinematicShots = Boolean(opening) || shots.some(shot => shot.kind !== 'scene');

  // Continuous Cinematic Push / Drift (1.00 -> 1.036 scale, -14px subtle upward drift)
  const cameraScale = interpolate(sceneFrame, [0, seg.durationInFrames], [1.0, 1.036], {
    extrapolateRight: 'clamp',
  });
  const cameraTranslateY = interpolate(sceneFrame, [0, seg.durationInFrames], [0, -14], {
    extrapolateRight: 'clamp',
  });

  return (
    <>
      {shots.some(shot => shot.kind === 'scene' && sceneFrame >= shot.from && sceneFrame < shot.from + shot.duration) && <AbsoluteFill
        style={{
          transform: `scale(${cameraScale}) translateY(${cameraTranslateY}px)`,
          transformOrigin: '50% 45%',
        }}
      >
        {opening ? <GeneratedOpening file={opening} title={title} /> : renderRegisteredScene(scene, seg.cueFrames, seg.wordFrames, Math.ceil(seg.audioDurationMs * fps / 1000))}
      </AbsoluteFill>}
      {shots.map(shot => shot.kind !== 'scene' && (
        <Sequence key={shot.from} name={shot.kind} from={shot.from} durationInFrames={shot.duration}>
          <CinematicStoryShot kind={shot.kind} context={context} plates={plates} />
        </Sequence>
      ))}

      {/* Per-scene Narration Audio */}
      {seg.audioSrc && <Audio src={resolveAudioSource(seg.audioSrc)} />}

      {/* Cinematic Transition UI SFX */}
      <Audio src={resolveAudioSource('sfx/whoosh.wav')} volume={0.15} />
      {isFirst && <Audio src={resolveAudioSource('sfx/pop.wav')} volume={0.16} />}

      {/* Semantic Cue-Synchronized Sound Effects (Ding / Buzzer / Pop) */}
      {seg.cueFrames?.map((cueF, cIdx) => {
        if (cueF <= 5 || cueF >= seg.durationInFrames - 5) return null;
        const isError = /reject|fail|crash|bottleneck|slow|error|drop|deadlock|stale|timeout|nahi/i.test(scene.narration);
        const sfxTrack = isError ? 'sfx/buzzer.wav' : 'sfx/ding.wav';
        const vol = isError ? 0.32 : 0.38;
        return (
          <Sequence key={`cue-sfx-${cIdx}`} from={cueF} durationInFrames={35}>
            <Audio src={resolveAudioSource(sfxTrack)} volume={vol} />
          </Sequence>
        );
      })}

      {/* Kinetic Dynamic Word-by-Word Subtitles */}
      <KineticCaptions
        wordFrames={seg.wordFrames}
        narration={scene.narration}
        durationInFrames={Math.max(1, Math.ceil(seg.audioDurationMs * fps / 1000))}
        highlightColor={usesCinematicShots ? '#ffd2a6' : '#00F2FE'}
        useBackdrop={usesCinematicShots}
      />
    </>
  );
};

export function musicVolumeAtFrame(timeline: VideoTimeline, frame: number) {
  const sec = frame / timeline.fps;
  let presence = 0;
  for (const seg of timeline.segments) {
    if (!seg.audioSrc) continue;
    const local = sec - seg.startFrame / timeline.fps;
    const ranges = seg.speechRanges ?? [{start: 0, end: seg.audioDurationMs / 1000}];
    for (const range of ranges) {
      presence = Math.max(presence, Math.min(1, 1 + (local - range.start) / 0.10, 1 + (range.end - local) / 0.32));
    }
  }
  const fade = Math.min(1, sec / 0.15, Math.max(0, (timeline.totalDurationInFrames-frame) / timeline.fps / 0.35));
  return Math.min(0.085, timeline.bgmVolumeDucked) * (1 - presence * 0.72) * fade;
}

export const StudioShortComposition: React.FC<StudioShortProps> = ({ storyboard, timeline, plates }) => {
  const frame = useCurrentFrame();
  const visualContext = useMemo(() => readVisualContext(storyboard), [storyboard]);

  // Background music source (defaults to our synthesized ambient tech track)
  const bgmTrack = timeline.bgmSrc || 'music/tech-ambient.wav';

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#050507',
        fontFamily: VideoDesignTokens.typography.fontFamilySans,
        color: VideoDesignTokens.colors.textPrimary,
        overflow: 'hidden',
      }}
    >
      {/* Root Animated Black Cyber Grid Background */}
      <AnimatedBlackCyberGrid />

      {/* Ultra-sleek Instagram-Story Style Progress Bar (Top Edge Only) */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 36,
          right: 36,
          display: 'flex',
          gap: 6,
          zIndex: 100,
        }}
      >
        {storyboard.scenes.map((_, idx) => {
          const seg = timeline.segments[idx];
          const isCompleted = seg && frame >= seg.startFrame + seg.durationInFrames;
          const isCurrent = seg && frame >= seg.startFrame && frame < seg.startFrame + seg.durationInFrames;
          const currentProgress = isCurrent
            ? Math.max(0, Math.min(1, (frame - seg.startFrame) / Math.max(1, seg.durationInFrames)))
            : 0;
          return (
            <div
              key={idx}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: 'rgba(255, 255, 255, 0.15)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: isCompleted ? '100%' : isCurrent ? `${currentProgress * 100}%` : '0%',
                  background: isCurrent ? 'linear-gradient(90deg, #38BDF8, #FACC15)' : '#38BDF8',
                  boxShadow: isCurrent ? '0 0 8px #38BDF8' : 'none',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Render Scenes by Timeline Segments */}
      {storyboard.scenes.map((scene, i) => {
        const seg = timeline.segments[i];
        if (!seg) return null;

        return (
          <Sequence
            key={scene.id || i}
            from={seg.startFrame}
            durationInFrames={seg.durationInFrames}
          >
            <SceneSequenceRenderer
              scene={scene}
              seg={seg}
              fps={timeline.fps}
              isFirst={i === 0}
              context={visualContext}
              plates={plates}
              title={storyboard.title}
            />
          </Sequence>
        );
      })}

      {/* Continuous Tech Background Music with Audio Ducking & Smooth End Fade */}
      {bgmTrack && (
        <Audio
          src={resolveAudioSource(bgmTrack)}
          loopVolumeCurveBehavior="extend"
          volume={(f) => musicVolumeAtFrame(timeline, f)}
          loop
        />
      )}
    </AbsoluteFill>
  );
};
