import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface SummarySceneProps {
  headline?: string;
  takeaways?: string[];
  summaryBullets?: string[];
  callToAction?: string;
  cta?: string;
  onScreenText?: string;
}

export const SummaryScene: React.FC<SummarySceneProps> = ({
  headline = 'Quick Recap',
  takeaways = [],
  summaryBullets = [],
  callToAction = 'Follow for more deep tech breakdowns!',
  cta,
  onScreenText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const finalBullets = takeaways.length > 0 ? takeaways : summaryBullets;
  const finalCTA = cta || callToAction;

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

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
      }}
    >
      <div style={{ marginBottom: 30 }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 4,
            color: VideoDesignTokens.colors.accentYellow,
            textTransform: 'uppercase',
          }}
        >
          {onScreenText || 'SUMMARY'}
        </span>
        <h2
          style={{
            fontSize: 60,
            fontWeight: 900,
            color: VideoDesignTokens.colors.textPrimary,
            margin: '8px 0 0',
          }}
        >
          {headline}
        </h2>
      </div>

      {/* Bullet Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 36 }}>
        {finalBullets.map((bullet, idx) => {
          const itemSpring = spring({
            frame: frame - idx * 7,
            fps,
            config: { damping: 14, stiffness: 90 },
          });

          return (
            <div
              key={idx}
              style={{
                transform: `translateX(${(1 - itemSpring) * 80}px)`,
                opacity: interpolate(itemSpring, [0, 1], [0, 1]),
                background: VideoDesignTokens.colors.bgCard,
                border: `2px solid ${VideoDesignTokens.colors.bgCardBorder}`,
                borderRadius: 16,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: VideoDesignTokens.colors.accentCyan,
                  color: '#070D1B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 18,
                }}
              >
                ✓
              </div>
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: VideoDesignTokens.colors.textPrimary,
                  lineHeight: 1.3,
                }}
              >
                {bullet}
              </span>
            </div>
          );
        })}
      </div>

      {/* CTA Card */}
      {finalCTA && (
        <div
          style={{
            transform: `scale(${entrance})`,
            padding: '24px 30px',
            background: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
            borderRadius: 20,
            boxShadow: '0 12px 35px rgba(0, 242, 254, 0.35)',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: '#070D1B',
              letterSpacing: 0.5,
            }}
          >
            🔥 {finalCTA}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
