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
  accentColor = VideoDesignTokens.colors.accentCyan,
  misconceptionAlert,
  onScreenText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const ringPulse1 = 1 + Math.sin(frame / 8) * 0.12;
  const ringPulse2 = 1 + Math.cos(frame / 8) * 0.12;

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
      {/* Background Neon Energy Rings */}
      <div
        style={{
          position: 'absolute',
          right: -80,
          top: '30%',
          width: 380,
          height: 380,
          borderRadius: '50%',
          border: '2px solid rgba(0, 242, 254, 0.2)',
          transform: `scale(${ringPulse1})`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -40,
          top: '35%',
          width: 280,
          height: 280,
          borderRadius: '50%',
          border: '2px dashed rgba(168, 85, 247, 0.3)',
          transform: `scale(${ringPulse2})`,
          pointerEvents: 'none',
        }}
      />

      {/* Category Pill with Glowing Dot */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 24px',
          background: 'rgba(0, 242, 254, 0.12)',
          border: `2px solid ${accentColor}`,
          borderRadius: 40,
          boxShadow: `0 0 30px ${accentColor}40`,
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
            boxShadow: `0 0 14px ${accentColor}`,
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
            boxShadow: '0 10px 30px rgba(239, 68, 68, 0.15)',
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
