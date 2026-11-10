import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface RequestFlowStep {
  label: string;
  description: string;
  status?: string;
}

interface RequestFlowSceneProps {
  title?: string;
  steps?: RequestFlowStep[];
  cueFrames?: number[];
  onScreenText?: string;
}

export const RequestFlowScene: React.FC<RequestFlowSceneProps> = ({
  title = 'System Architecture Flow',
  steps = [
    { label: 'Client', description: 'Sends HTTP Request', status: 'completed' },
    { label: 'Redis Cache', description: 'TTL Expiration Check', status: 'active' },
    { label: 'Database', description: 'Fallback on Cache Miss', status: 'bypassed' },
  ],
  cueFrames,
  onScreenText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

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
      <div style={{ marginBottom: 28 }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 4,
            color: VideoDesignTokens.colors.accentGreen,
            textTransform: 'uppercase',
          }}
        >
          {onScreenText || 'SYSTEM FLOW'}
        </span>
        <h2
          style={{
            fontSize: 50,
            fontWeight: 900,
            color: VideoDesignTokens.colors.textPrimary,
            margin: '8px 0 0',
          }}
        >
          {title}
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {steps.map((step, idx) => {
          const itemSpring = spring({
            frame: frame - (cueFrames?.[idx] ?? idx * 7),
            fps,
            config: { damping: 14, stiffness: 85 },
          });

          return (
            <div
              key={idx}
              style={{
                transform: `scale(${itemSpring})`,
                background: VideoDesignTokens.colors.bgCard,
                border: `2px solid ${
                  idx === 1 ? VideoDesignTokens.colors.accentCyan : VideoDesignTokens.colors.bgCardBorder
                }`,
                borderRadius: 18,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 800,
                    color: idx === 1 ? VideoDesignTokens.colors.accentCyan : VideoDesignTokens.colors.textPrimary,
                  }}
                >
                  {step.label}
                </div>
                <div style={{ fontSize: 22, color: VideoDesignTokens.colors.textSecondary, marginTop: 4 }}>
                  {step.description}
                </div>
              </div>

              <div
                style={{
                  fontSize: 26,
                  color: VideoDesignTokens.colors.accentGreen,
                  fontWeight: 900,
                }}
              >
                ➔
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
