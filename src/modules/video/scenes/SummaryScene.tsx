import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';
import { EclipseNeonRing, LayercutWordBehind } from '../MotionStyles.js';

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
  const isOutro = /follow|share|doston/i.test(finalCTA) || /follow/i.test(onScreenText || '');

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  const pulseBtn = interpolate(Math.sin(frame / 10), [-1, 1], [0.97, 1.03]);

  return (
    <AbsoluteFill
      style={{
        paddingTop: 60,
        paddingBottom: VideoDesignTokens.safeMargin.bottom,
        paddingLeft: 40,
        paddingRight: 40,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: VideoDesignTokens.typography.fontFamilySans,
        color: VideoDesignTokens.colors.ink,
        overflow: 'hidden',
      }}
    >
      {/* Background Rotating Cyber Ring & Cinematic Typography */}
      <EclipseNeonRing color={isOutro ? '#F59E0B' : '#00F2FE'} />
      <LayercutWordBehind word={isOutro ? 'FOLLOW' : 'SYSTEM'} topPercent={25} color="rgba(255, 255, 255, 0.05)" />

      {/* Header */}
      <div style={{ transform: `scale(${entrance})`, textAlign: 'center', zIndex: 10 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 24px',
            background: VideoDesignTokens.colors.elevated,
            border: `1.5px solid ${isOutro ? 'rgba(245, 158, 11, 0.5)' : 'rgba(56, 189, 248, 0.5)'}`,
            borderRadius: 30,
            marginBottom: 10,
            boxShadow: `0 0 25px ${isOutro ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.25)'}`,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: VideoDesignTokens.colors.cyan,
              boxShadow: `0 0 10px ${isOutro ? '#F59E0B' : '#38BDF8'}`,
            }}
          />
          <span
            style={{
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: 3,
              color: VideoDesignTokens.colors.ink,
              textTransform: 'uppercase',
            }}
          >
            {onScreenText || (isOutro ? 'FOLLOW FOR DEEP TECH' : 'MENTAL MODEL RECAP')}
          </span>
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: VideoDesignTokens.colors.ink, margin: '0 0 6px 0' }}>
          {headline}
        </h1>
      </div>

      {/* Main Content Area */}
      {isOutro ? (
        /* OUTRO CTA MOTION VISUAL (Zero boring note boxes!) */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, zIndex: 10 }}>
          {/* Holographic SDE Badge */}
          <div
            style={{
              transform: `scale(${entrance})`,
              width: 130,
              height: 130,
              borderRadius: 40,
              background: VideoDesignTokens.colors.surface,
              backdropFilter: 'blur(20px)',
              border: '2px solid rgba(245, 158, 11, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 60,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(245, 158, 11, 0.4)',
            }}
          >
            🚀
          </div>

          {/* Action Chips */}
          <div style={{ display: 'flex', gap: 14 }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 16,
                padding: '10px 20px',
                fontSize: 18,
                fontWeight: 800,
                color: '#E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              💾 Save for Interviews
            </div>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 16,
                padding: '10px 20px',
                fontSize: 18,
                fontWeight: 800,
                color: '#E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              🔄 Share with Friends
            </div>
          </div>

          {/* Glowing Pulsing Follow Button */}
          <div
            style={{
              transform: `scale(${pulseBtn})`,
              background: VideoDesignTokens.colors.elevated,
              color: VideoDesignTokens.colors.ink,
              borderRadius: 30,
              padding: '20px 54px',
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: 1.5,
              boxShadow: '0 15px 50px rgba(239, 68, 68, 0.5), 0 0 35px rgba(245, 158, 11, 0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <span>+ FOLLOW FOR MORE</span>
            <span>⚡</span>
          </div>
        </div>
      ) : (
        /* SUMMARY RECAP KINETIC TECH CHIPS (No boring checkmark cards) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, zIndex: 10 }}>
          {finalBullets.slice(0, 4).map((bullet, idx) => {
            const itemSpring = spring({
              frame: Math.max(0, frame - idx * 6),
              fps,
              config: { damping: 14, stiffness: 90 },
            });

            return (
              <div
                key={idx}
                style={{
                  transform: `translateX(${(1 - itemSpring) * 60}px)`,
                  opacity: itemSpring,
                  background: VideoDesignTokens.colors.surface,
                  backdropFilter: 'blur(20px)',
                  border: '1.5px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: 22,
                  padding: '18px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.15)',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'rgba(56, 189, 248, 0.2)',
                    border: '1.5px solid #38BDF8',
                    color: VideoDesignTokens.colors.cyan,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', lineHeight: 1.35 }}>
                  {bullet}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Subtext */}
      <div style={{ textAlign: 'center', zIndex: 10 }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: '#94A3B8', margin: 0 }}>
          {finalCTA}
        </p>
      </div>
    </AbsoluteFill>
  );
};
