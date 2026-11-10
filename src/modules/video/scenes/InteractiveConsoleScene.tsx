import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

export interface TerminalOutputItem {
  text: string;
  badge?: string;
  delayFrames?: number;
  highlight?: boolean;
}

export interface InteractiveConsoleSceneProps {
  filename?: string;
  code: string;
  highlightLines?: number[];
  terminalOutputs?: TerminalOutputItem[];
  explanationCallout?: string;
  onScreenText?: string;
}

export const InteractiveConsoleScene: React.FC<InteractiveConsoleSceneProps> = ({
  filename = 'main.js',
  code,
  highlightLines = [2, 3],
  terminalOutputs = [
    { text: 'Start', badge: 'Stack', delayFrames: 10 },
    { text: 'End', badge: 'Stack', delayFrames: 30 },
    { text: 'Promise (3)', badge: 'Microtask Queue', highlight: true, delayFrames: 60 },
    { text: 'Timeout (2)', badge: 'Macrotask Queue', delayFrames: 95 },
  ],
  explanationCallout = 'Microtask drains BEFORE Macrotask!',
  onScreenText = 'LIVE CODE EXECUTION TRACE',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const lines = code.split('\n');
  const cursorBlink = Math.floor(frame / 12) % 2 === 0;

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
        gap: 20,
      }}
    >
      {/* Category Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            padding: '6px 16px',
            background: 'rgba(0, 242, 254, 0.15)',
            border: `1.5px solid ${VideoDesignTokens.colors.accentCyan}`,
            borderRadius: 20,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 2.5,
            color: VideoDesignTokens.colors.accentCyan,
            textTransform: 'uppercase',
          }}
        >
          {onScreenText}
        </div>
      </div>

      {/* Code Editor Window */}
      <div
        style={{
          transform: `scale(${entrance})`,
          background: VideoDesignTokens.colors.codeBg,
          border: `2px solid rgba(56, 189, 248, 0.3)`,
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Editor Titlebar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            background: '#0B132B',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10B981' }} />
          </div>
          <div
            style={{
              fontSize: 19,
              fontWeight: 700,
              color: VideoDesignTokens.colors.textSecondary,
              fontFamily: VideoDesignTokens.typography.fontFamilyMono,
            }}
          >
            {filename}
          </div>
          <div style={{ width: 40 }} />
        </div>

        {/* Code Content */}
        <div style={{ padding: '20px', fontFamily: VideoDesignTokens.typography.fontFamilyMono }}>
          {lines.map((lineText, idx) => {
            const lineNum = idx + 1;
            const isHighlighted = highlightLines.includes(lineNum);

            return (
              <div
                key={lineNum}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 24,
                  lineHeight: 1.6,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: isHighlighted ? 'rgba(0, 242, 254, 0.14)' : 'transparent',
                  borderLeft: isHighlighted
                    ? `4px solid ${VideoDesignTokens.colors.accentCyan}`
                    : '4px solid transparent',
                }}
              >
                <span
                  style={{
                    width: 32,
                    color: isHighlighted ? VideoDesignTokens.colors.accentCyan : '#475569',
                    fontWeight: 700,
                    userSelect: 'none',
                  }}
                >
                  {lineNum}
                </span>

                <span
                  style={{
                    color: isHighlighted ? '#FFFFFF' : '#CBD5E1',
                    fontWeight: isHighlighted ? 700 : 500,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {lineText}
                </span>

                {isHighlighted && (
                  <span
                    style={{
                      marginLeft: 12,
                      fontSize: 16,
                      color: VideoDesignTokens.colors.accentCyan,
                      animation: 'pulse 1s infinite',
                    }}
                  >
                    ◀
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Interactive Terminal Window */}
      {terminalOutputs.length > 0 && <div
        style={{
          transform: `scale(${entrance})`,
          background: VideoDesignTokens.colors.terminalBg,
          border: '2px solid rgba(16, 185, 129, 0.35)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 12px 35px rgba(0, 242, 254, 0.12)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            background: '#0B1622',
            borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, color: '#10B981' }}>●</span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 2,
                color: '#10B981',
                textTransform: 'uppercase',
                fontFamily: VideoDesignTokens.typography.fontFamilyMono,
              }}
            >
              CONSOLE OUTPUT (TERMINAL)
            </span>
          </div>
          <span style={{ fontSize: 14, color: '#64748B', fontFamily: VideoDesignTokens.typography.fontFamilyMono }}>
            node {filename}
          </span>
        </div>

        <div
          style={{
            padding: '18px 20px',
            fontFamily: VideoDesignTokens.typography.fontFamilyMono,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 140,
          }}
        >
          {terminalOutputs.map((item, idx) => {
            const itemDelay = item.delayFrames ?? idx * 25;
            const isVisible = frame >= itemDelay;
            if (!isVisible) return null;

            const itemSpring = spring({
              frame: frame - itemDelay,
              fps,
              config: { damping: 15, stiffness: 120 },
            });

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transform: `translateX(${(1 - itemSpring) * 30}px)`,
                  opacity: interpolate(itemSpring, [0, 1], [0, 1]),
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: item.highlight ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  border: item.highlight ? '1px solid rgba(0, 242, 254, 0.5)' : '1px solid transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: item.highlight ? '#00F2FE' : '#10B981', fontWeight: 900 }}>❯</span>
                  <span
                    style={{
                      fontSize: 23,
                      fontWeight: 800,
                      color: item.highlight ? '#FFFFFF' : '#E2E8F0',
                    }}
                  >
                    {item.text}
                  </span>
                </div>

                {item.badge && (
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      letterSpacing: 1,
                      padding: '3px 10px',
                      borderRadius: 6,
                      background: item.highlight ? 'rgba(0, 242, 254, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                      color: item.highlight ? '#00F2FE' : '#94A3B8',
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            );
          })}

          {/* Blinking Prompt Cursor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{ color: '#10B981', fontWeight: 900 }}>❯</span>
            <span
              style={{
                width: 10,
                height: 20,
                background: cursorBlink ? '#10B981' : 'transparent',
                display: 'inline-block',
              }}
            />
          </div>
        </div>
      </div>}

      {/* Callout Rule Pill */}
      {explanationCallout && (
        <div
          style={{
            padding: '16px 22px',
            background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.25), rgba(0, 242, 254, 0.15))',
            border: '1.5px solid rgba(168, 85, 247, 0.5)',
            borderRadius: 14,
            boxShadow: '0 8px 25px rgba(168, 85, 247, 0.2)',
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 800, color: '#F3E8FF' }}>
            {explanationCallout}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
