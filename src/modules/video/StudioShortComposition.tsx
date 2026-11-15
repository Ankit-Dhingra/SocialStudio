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
import { renderRegisteredScene } from './SceneRegistry.js';
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

        return (
          <Sequence
            key={scene.id || i}
            from={seg.startFrame}
            durationInFrames={seg.durationInFrames}
          >
            {/* Render from typed scene component registry */}
            {renderRegisteredScene(scene, seg.cueFrames)}

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
