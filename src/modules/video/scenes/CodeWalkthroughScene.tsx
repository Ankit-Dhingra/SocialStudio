import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface CodeWalkthroughSceneProps {
  filename?: string;
  language?: string;
  code: string;
  highlightLines?: number[];
  explanationCallout?: string;
  onScreenText?: string;
}

export const CodeWalkthroughScene: React.FC<CodeWalkthroughSceneProps> = ({
  filename = 'index.js',
  language = 'javascript',
  code,
  highlightLines = [],
  explanationCallout,
  onScreenText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 85 },
  });

  const lines = code.split('\n');

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
      {/* On-screen Title */}
      {onScreenText && (
        <div style={{ marginBottom: 28 }}>
          <span
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: 3,
              color: VideoDesignTokens.colors.accentYellow,
              textTransform: 'uppercase',
            }}
          >
            {onScreenText}
          </span>
        </div>
      )}

      {/* Code Editor Window */}
      <div
        style={{
          transform: `scale(${entrance}) translateY(${(1 - entrance) * 50}px)`,
          background: VideoDesignTokens.colors.codeBg,
          border: `2px solid ${VideoDesignTokens.colors.bgCardBorder}`,
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        }}
      >
        {/* Window Titlebar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            background: '#0D1526',
            borderBottom: `2px solid ${VideoDesignTokens.colors.bgCardBorder}`,
          }}
        >
          {/* Traffic lights */}
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#EF4444' }} />
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#F59E0B' }} />
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#10B981' }} />
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: VideoDesignTokens.colors.textSecondary,
              fontFamily: VideoDesignTokens.typography.fontFamilyMono,
            }}
          >
            {filename}
          </div>

          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: VideoDesignTokens.colors.accentCyan,
              textTransform: 'uppercase',
              letterSpacing: 2,
            }}
          >
            {language}
          </div>
        </div>

        {/* Code Content */}
        <div style={{ padding: '28px 24px', fontFamily: VideoDesignTokens.typography.fontFamilyMono }}>
          {lines.map((lineText, idx) => {
            const lineNum = idx + 1;
            const isHighlighted = highlightLines.includes(lineNum);

            return (
              <div
                key={lineNum}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  lineHeight: 1.7,
                  fontSize: 27,
                  padding: '4px 12px',
                  borderRadius: 8,
                  background: isHighlighted ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
                  borderLeft: isHighlighted
                    ? `4px solid ${VideoDesignTokens.colors.accentCyan}`
                    : '4px solid transparent',
                  transition: 'background 0.2s ease',
                }}
              >
                {/* Line number */}
                <span
                  style={{
                    width: 40,
                    color: isHighlighted ? VideoDesignTokens.colors.accentCyan : '#475569',
                    userSelect: 'none',
                    fontWeight: 700,
                  }}
                >
                  {lineNum}
                </span>

                {/* Line text */}
                <span
                  style={{
                    color: isHighlighted ? '#FFFFFF' : '#CBD5E1',
                    fontWeight: isHighlighted ? 700 : 500,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {lineText}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Callout Badge */}
      {explanationCallout && (
        <div
          style={{
            marginTop: 28,
            padding: '20px 28px',
            background: 'rgba(157, 78, 221, 0.18)',
            border: `2px solid ${VideoDesignTokens.colors.accentPurple}`,
            borderRadius: 16,
            boxShadow: '0 8px 25px rgba(157, 78, 221, 0.25)',
          }}
        >
          <span
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: '#E9D5FF',
              lineHeight: 1.3,
            }}
          >
            💡 {explanationCallout}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
