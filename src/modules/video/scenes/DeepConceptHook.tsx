import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface DeepConceptHookProps {
  headline: string;
  questionKicker?: string;
  badgeText?: string;
  accentColor?: string;
  misconceptionAlert?: string;
  onScreenText?: string;
}

export const DeepConceptHook: React.FC<DeepConceptHookProps> = ({
  headline,
  questionKicker = 'Most developers get the output wrong!',
  badgeText = 'JS INTERNALS DEEP DIVE',
  misconceptionAlert,
  onScreenText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 100 },
  });

  const accentColor = VideoDesignTokens.colors.cyan;

  return (
    <AbsoluteFill
      style={{
        paddingTop: VideoDesignTokens.safeMargin.top,
        paddingBottom: VideoDesignTokens.safeMargin.bottom,
        paddingLeft: VideoDesignTokens.safeMargin.left,
        paddingRight: VideoDesignTokens.safeMargin.right,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Category Pill with Glowing Dot */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 24px',
          background: 'rgba(103, 232, 249, 0.08)',
          border: `2px solid ${accentColor}`,
          borderRadius: 40,
          marginBottom: 32,
          width: 'fit-content',
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: accentColor,
          }}
        />
        <span
          style={{
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: 3,
            color: accentColor,
            textTransform: 'uppercase',
          }}
        >
          {badgeText}
        </span>
      </div>

      {/* Main Shocking Question / Hook Headline */}
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            fontSize: 76,
            fontWeight: 950,
            lineHeight: 1.15,
            color: '#FFFFFF',
            margin: 0,
            letterSpacing: -1.5,
            textShadow: '0 8px 30px rgba(0, 0, 0, 0.8)',
          }}
        >
          {headline}
        </h1>
      </div>

      {/* Misconception Debunk Card */}
      {misconceptionAlert && (
        <div
          style={{
            marginTop: 18,
            padding: '20px 26px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(15, 23, 42, 0.8))',
            border: '2px solid rgba(239, 68, 68, 0.5)',
            borderRadius: 18,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: '#EF4444', letterSpacing: 2, marginBottom: 4 }}>
            🚨 THE COMMON MISCONCEPTION
          </div>
          <div style={{ fontSize: 28, fontWeight: 750, color: '#FEE2E2', lineHeight: 1.3 }}>
            {misconceptionAlert}
          </div>
        </div>
      )}

      {/* Question Kicker */}
      {questionKicker && (
        <div
          style={{
            marginTop: 20,
            padding: '16px 22px',
            background: 'rgba(56, 189, 248, 0.1)',
            borderLeft: `6px solid ${VideoDesignTokens.colors.accentBlue}`,
            borderRadius: 12,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 700, color: '#BAE6FD' }}>
            ⚡ {questionKicker}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
