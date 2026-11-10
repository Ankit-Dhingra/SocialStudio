import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface QueueItem {
  name: string;
  priority?: string;
  detail: string;
}

interface QueueTimelineSceneProps {
  title?: string;
  items?: QueueItem[];
  timelineSteps?: string[];
  activeItemIndex?: number;
  cueFrames?: number[];
  accentColor?: string;
  onScreenText?: string;
}

export const QueueTimelineScene: React.FC<QueueTimelineSceneProps> = ({
  title = 'Execution Flow',
  items = [],
  timelineSteps = [],
  activeItemIndex = 0,
  cueFrames,
  accentColor = VideoDesignTokens.colors.accentOrange,
  onScreenText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Normalize data if provided as simple strings (timelineSteps)
  const displayItems: QueueItem[] =
    items.length > 0
      ? items
      : timelineSteps.map((step, idx) => ({
          name: step,
          priority: idx === 0 ? 'high' : 'medium',
          detail: 'Next in cycle',
        }));

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
      {/* Title */}
      <div style={{ marginBottom: 30 }}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 4,
            color: accentColor,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {onScreenText || 'ARCHITECTURE FLOW'}
        </div>
        <h2
          style={{
            fontSize: 54,
            fontWeight: 900,
            color: VideoDesignTokens.colors.textPrimary,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
      </div>

      {/* Queue Lanes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {displayItems.slice(0, 4).map((item, idx) => {
          const itemSpring = spring({
            frame: frame - (cueFrames?.[idx] ?? idx * 6),
            fps,
            config: { damping: 14, stiffness: 90 },
          });

          const isActive = idx === activeItemIndex;
          const isHigh = item.priority === 'high' || item.name.toLowerCase().includes('microtask');

          return (
            <div
              key={idx}
              style={{
                transform: `translateX(${(1 - itemSpring) * 100}px)`,
                opacity: interpolate(itemSpring, [0, 1], [0, 1]),
                background: isActive
                  ? 'linear-gradient(90deg, #162447, #1F305E)'
                  : VideoDesignTokens.colors.bgCard,
                border: `2px solid ${
                  isHigh ? VideoDesignTokens.colors.accentCyan : VideoDesignTokens.colors.bgCardBorder
                }`,
                borderRadius: 18,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: isHigh ? '0 0 25px rgba(0, 242, 254, 0.2)' : '0 4px 15px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: isHigh ? VideoDesignTokens.colors.accentCyan : '#334155',
                    color: '#0A0F1D',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 20,
                  }}
                >
                  {idx + 1}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 30,
                      fontWeight: 750,
                      color: VideoDesignTokens.colors.textPrimary,
                      lineHeight: 1.3,
                    }}
                  >
                    {item.name}
                  </div>
                  {item.detail && (
                    <div style={{ fontSize: 22, color: VideoDesignTokens.colors.textSecondary, marginTop: 4 }}>
                      {item.detail}
                    </div>
                  )}
                </div>
              </div>

              {isHigh && (
                <div
                  style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    background: 'rgba(0, 242, 254, 0.2)',
                    color: VideoDesignTokens.colors.accentCyan,
                    fontSize: 18,
                    fontWeight: 800,
                    letterSpacing: 1.5,
                  }}
                >
                  PRIORITY
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
