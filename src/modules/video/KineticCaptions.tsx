import React, { useMemo } from 'react';
import { useCurrentFrame } from 'remotion';
import { toHinglish } from './hinglish-text.js';
import { VideoDesignTokens as design } from './design-system.js';

interface KineticCaptionsProps {
  narration: string;
  durationInFrames: number;
  wordFrames?: number[];
  highlightColor?: string;
  useBackdrop?: boolean;
}

export const KineticCaptions: React.FC<KineticCaptionsProps> = ({
  narration,
  wordFrames,
  durationInFrames,
  highlightColor = design.colors.cyan,
  useBackdrop = false,
}) => {
  const frame = useCurrentFrame();

  // Strip any SSML tags (e.g. <break time="0.4s"/>) so only spoken words are displayed
  const words = useMemo(() => narration.replace(/<[^>]+>/g, ' ').trim().split(/\s+/)
    .filter(Boolean).map(toHinglish), [narration]);
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
        top: 1920 - design.safeMargin.bottom,
        left: design.safeMargin.left + 20,
        right: design.safeMargin.right,
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        gap: '8px 10px',
        pointerEvents: 'none',
        zIndex: 50,
        ...(useBackdrop ? { background: `${design.colors.canvas}eb`, borderRadius: design.radius.card, padding: '8px 14px' } : {}),
      }}
    >
      {activeChunk.map((word, idx) => {
        const isActive = idx === activeWordInChunkIndex;
        return (
          <span
            key={idx}
            style={{
              fontFamily: design.typography.fontFamilySans,
              fontSize: design.typography.caption,
              fontWeight: 750,
              lineHeight: 1.2,
              padding: '3px 7px',
              color: isActive ? highlightColor : design.colors.ink,
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
