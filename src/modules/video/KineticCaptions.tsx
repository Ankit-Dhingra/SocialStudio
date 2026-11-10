import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

interface KineticCaptionsProps {
  narration: string;
  durationInFrames: number;
  wordFrames?: number[];
  highlightColor?: string;
}

export const KineticCaptions: React.FC<KineticCaptionsProps> = ({
  narration,
  wordFrames,
  durationInFrames,
  highlightColor = '#FACC15', // Vibrant Gold / Yellow
}) => {
  const frame = useCurrentFrame();

  const words = narration.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  // Group into chunks of 3-4 words for optimal mobile reading speed
  const CHUNK_SIZE = 4;
  if (frame >= durationInFrames) return null;
  const timed = wordFrames?.length === words.length && wordFrames.every(Number.isFinite);
  const nextWord = timed ? wordFrames.findIndex(start => start > frame) : -1;
  const activeIndex = timed
    ? (nextWord === -1 ? words.length - 1 : nextWord - 1)
    : Math.min(words.length - 1, Math.floor(frame * words.length / durationInFrames));
  if (activeIndex < 0) return null;
  const firstIndex = Math.floor(activeIndex / CHUNK_SIZE) * CHUNK_SIZE;
  const activeChunk = words.slice(firstIndex, firstIndex + CHUNK_SIZE);
  const activeWordInChunkIndex = activeIndex - firstIndex;
  const frameInChunk = frame - (timed ? wordFrames[firstIndex] : firstIndex * durationInFrames / words.length);

  // Subtle entrance bounce for active chunk
  const chunkScale = interpolate(frameInChunk, [0, 4], [0.95, 1.0], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 240,
        left: 40,
        right: 40,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '12px 14px',
          background: 'rgba(0, 0, 0, 0.65)',
          padding: '16px 28px',
          borderRadius: 24,
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
          transform: `scale(${chunkScale})`,
          maxWidth: 960,
        }}
      >
        {activeChunk.map((word, idx) => {
          const isActive = idx === activeWordInChunkIndex;
          return (
            <span
              key={idx}
              style={{
                fontFamily: 'Montserrat, system-ui, -apple-system, sans-serif',
                fontSize: 48,
                fontWeight: 900,
                letterSpacing: '-0.5px',
                textTransform: 'uppercase',
                color: isActive ? highlightColor : '#FFFFFF',
                textShadow: isActive
                  ? `0 0 20px ${highlightColor}AA, 0 4px 10px rgba(0,0,0,0.9)`
                  : '0 4px 10px rgba(0,0,0,0.9)',
                transform: isActive ? 'scale(1.12)' : 'scale(1.0)',
                transition: 'transform 0.08s ease, color 0.08s ease',
                display: 'inline-block',
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
