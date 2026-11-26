import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';
import { panelStyle } from '../PremiumVisuals.js';

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
  steps = [],
  cueFrames,
  onScreenText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const starts = steps.map((_, index) => cueFrames?.[index] ?? index * 7);
  const activeIndex = starts.reduce((last, start, index) => start <= frame ? index : last, -1);

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
        background: 'transparent',
      }}
    >
      <div style={{ marginBottom: 28 }}>
        {onScreenText && onScreenText !== title && <span
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 4,
            color: VideoDesignTokens.colors.accentGreen,
            textTransform: 'uppercase',
          }}
        >
          {onScreenText}
        </span>}
        <h2
          style={{
            fontSize: 50,
            fontWeight: 900,
            color: VideoDesignTokens.colors.textPrimary,
            margin: '8px 0 0',
          }}
        >
          {title === steps[0]?.label ? 'Request flow' : title}
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {steps.map((step, idx) => {
          const start = starts[idx];
          const active = idx === activeIndex;
          const visible = frame >= start;
          const transfer = interpolate(frame, [start - Math.max(1, Math.round(fps * 0.35)), start], [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const itemSpring = spring({
            frame: Math.max(0, frame - start),
            fps,
            config: { damping: 14, stiffness: 85 },
          });

          return (
            <React.Fragment key={idx}>
              {idx > 0 && <div style={{ height: 47, width: 1, marginLeft: 44,
                borderLeft: `2px dashed ${VideoDesignTokens.colors.border}`,
                opacity: frame >= starts[idx - 1] ? 1 : 0.24, position: 'relative' }}>
                <div style={{ width: '100%', background: VideoDesignTokens.colors.accentCyan, height: `${100 * transfer}%` }} />
                {transfer > 0 && transfer < 1 && <div style={{ position: 'absolute', top: `${100 * transfer}%`,
                  left: -5, width: 11, height: 11, borderRadius: '50%', background: VideoDesignTokens.colors.cyan }} />}
              </div>}
              <div
                style={{
                  ...panelStyle(active ? 'active' : 'default'),
                  scale: 0.96 + 0.04 * itemSpring,
                  padding: '22px 25px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 23,
                  opacity: visible ? 1 : 0.4,
                }}
              >
                <div style={{ display: 'grid', placeItems: 'center', border: '2px solid #3a6278', borderRadius: '50%',
                  width: 40, height: 40, flexShrink: 0, color: active ? VideoDesignTokens.colors.accentCyan : '#b2c9d9',
                  fontSize: 22, fontWeight: 800 }}>{idx + 1}</div>
                <div>
                  <div style={{ fontSize: 38, fontWeight: 800,
                    color: VideoDesignTokens.colors.ink }}>
                    {visible ? step.label : ''}
                  </div>
                  {visible && step.description && <div style={{
                    fontSize: 29, color: VideoDesignTokens.colors.textSecondary, marginTop: 6,
                  }}>{step.description}</div>}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
