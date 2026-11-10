import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface HookSceneProps {
  headline: string;
  subtext?: string;
  badgeText?: string;
  accentColor?: string;
  onScreenText?: string;
}

export const HookScene: React.FC<HookSceneProps> = ({
  headline,
  subtext,
  badgeText = 'TECH EXPLAINED',
  accentColor = VideoDesignTokens.colors.accentCyan,
  onScreenText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Smooth entrance spring
  const scale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90, mass: 0.8 },
  });

  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: 'clamp' });
  const pulse = Math.sin(frame / 6) * 6;

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
        alignItems: 'flex-start',
        opacity,
      }}
    >
      {/* Category Tag */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 28px',
          background: 'rgba(0, 242, 254, 0.12)',
          border: `2px solid ${accentColor}`,
          borderRadius: 40,
          boxShadow: `0 0 25px ${accentColor}40`,
          marginBottom: 36,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: accentColor,
            boxShadow: `0 0 12px ${accentColor}`,
            transform: `scale(${1 + pulse * 0.05})`,
          }}
        />
        <span
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 4,
            color: accentColor,
            textTransform: 'uppercase',
          }}
        >
          {badgeText}
        </span>
      </div>

      {/* Main Punchy Headline */}
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          marginBottom: 30,
        }}
      >
        <h1
          style={{
            fontSize: 78,
            fontWeight: 900,
            lineHeight: 1.15,
            color: VideoDesignTokens.colors.textPrimary,
            margin: 0,
            letterSpacing: -1,
            textShadow: '0 4px 20px rgba(0,0,0,0.6)',
          }}
        >
          {headline}
        </h1>
      </div>

      {/* Curiosity Subtext or Punchline */}
      {(subtext || onScreenText) && (
        <div
          style={{
            padding: '24px 32px',
            background: VideoDesignTokens.colors.bgCard,
            borderLeft: `8px solid ${accentColor}`,
            borderRadius: 16,
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            marginTop: 20,
            maxWidth: '95%',
          }}
        >
          <p
            style={{
              fontSize: 38,
              fontWeight: 650,
              color: VideoDesignTokens.colors.textSecondary,
              lineHeight: 1.35,
              margin: 0,
            }}
          >
            {subtext || onScreenText}
          </p>
        </div>
      )}
    </AbsoluteFill>
  );
};
