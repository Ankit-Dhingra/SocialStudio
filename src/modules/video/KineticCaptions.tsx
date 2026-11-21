import React from 'react';
import { useCurrentFrame } from 'remotion';

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
  highlightColor = '#64E99A',
}) => {
  const frame = useCurrentFrame();

  // Strip any SSML tags (e.g. <break time="0.4s"/>) so only spoken words are displayed
  const cleanNarration = narration.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = cleanNarration.split(/\s+/).filter(Boolean);
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
  return (
    <div
      style={{
        position: 'absolute',
        top: 1400,
        left: 80,
        right: 140,
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        gap: '8px 10px',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {activeChunk.map((word, idx) => {
        const isActive = idx === activeWordInChunkIndex;
        return (
          <span
            key={idx}
            style={{
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: 47,
              fontWeight: 750,
              lineHeight: 1.2,
              padding: '3px 7px',
              color: isActive ? highlightColor : '#f5f5f5',
              textShadow: isActive ? '0 0 16px #00f2fe70' : undefined,
              transform: isActive ? 'translateY(-3px)' : undefined,
              overflowWrap: 'anywhere',
              maxWidth: '100%',
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
