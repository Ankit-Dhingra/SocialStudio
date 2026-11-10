import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface ComparisonSceneProps {
  leftTitle?: string;
  leftCode?: string;
  leftPoints?: string[];
  rightTitle?: string;
  rightCode?: string;
  rightPoints?: string[];
  verdict?: string;
  onScreenText?: string;
}

export const ComparisonScene: React.FC<ComparisonSceneProps> = ({
  leftTitle = '❌ 15 LPA Approach (Junior)',
  leftCode = 'if (stock > 0) {\n  order();\n  stock--;\n}',
  leftPoints = ['Two separate operations', 'Both threads pass check', 'Overselling bug!'],
  rightTitle = '✅ 45 LPA Approach (Senior)',
  rightCode = 'UPDATE products\nSET stock = stock - 1\nWHERE id = 1 AND stock > 0;',
  rightPoints = ['Single Atomic Query', 'DB row-level lock', '100% Concurrency Safe'],
  verdict = 'Atomic execution eliminates race conditions at database kernel level.',
  onScreenText = '15 LPA vs 45 LPA ARCHITECTURE',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Camera Punch-In Motion (1.0 -> 1.03)
  const cameraZoom = interpolate(frame, [0, 60], [1.0, 1.03], {
    extrapolateRight: 'clamp',
  });

  // Entrance spring for top card (frame 0)
  const card1Entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Entrance spring for bottom card (starts at frame 18)
  const card2Entrance = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${cameraZoom})`,
        transformOrigin: 'center center',
        paddingTop: 90,
        paddingBottom: 220,
        paddingLeft: 44,
        paddingRight: 44,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: VideoDesignTokens.typography.fontFamilySans,
        color: '#FFFFFF',
      }}
    >
      {/* SFX Triggers */}
      <Sequence from={0} durationInFrames={20}>
        <Audio src={staticFile('sfx/buzzer.wav')} volume={0.6} />
      </Sequence>
      <Sequence from={18} durationInFrames={25}>
        <Audio src={staticFile('sfx/ding.wav')} volume={0.75} />
      </Sequence>

      {/* Header Category Pill */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 24px',
            borderRadius: 30,
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1.5px solid rgba(239, 68, 68, 0.6)',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.25)',
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 8px #EF4444' }} />
          <span
            style={{
              color: '#F87171',
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {onScreenText}
          </span>
        </div>
      </div>

      {/* Card 1: 15 LPA Flawed Approach (Red Glow) */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '2px solid #EF4444',
          borderRadius: 24,
          padding: '20px 24px',
          boxShadow: '0 10px 40px rgba(239, 68, 68, 0.25)',
          transform: `scale(${card1Entrance})`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#F87171' }}>
            {leftTitle}
          </span>
          <span
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#EF4444',
              padding: '4px 14px',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 800,
              border: '1px solid #EF4444',
            }}
          >
            FLAWED
          </span>
        </div>

        {/* Code Snippet Box */}
        <div
          style={{
            background: '#0B0F19',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 14,
            padding: '12px 18px',
            fontFamily: 'monospace',
            fontSize: 22,
            color: '#FCA5A5',
            lineHeight: 1.4,
            marginBottom: 12,
            whiteSpace: 'pre-wrap',
          }}
        >
          {leftCode}
        </div>

        {/* Bullets */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {leftPoints.map((pt, i) => (
            <div
              key={i}
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#FCA5A5',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>⚠️</span>
              <span>{pt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Card 2: 45 LPA Atomic Approach (Green Glow) */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '2px solid #10B981',
          borderRadius: 24,
          padding: '20px 24px',
          boxShadow: '0 10px 40px rgba(16, 185, 129, 0.3)',
          transform: `scale(${card2Entrance})`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 28, fontWeight: 900, color: '#34D399' }}>
            {rightTitle}
          </span>
          <span
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10B981',
              padding: '4px 14px',
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 800,
              border: '1px solid #10B981',
            }}
          >
            PRODUCTION READY
          </span>
        </div>

        {/* Code Snippet Box */}
        <div
          style={{
            background: '#0B0F19',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 14,
            padding: '12px 18px',
            fontFamily: 'monospace',
            fontSize: 22,
            color: '#6EE7B7',
            lineHeight: 1.4,
            marginBottom: 12,
            whiteSpace: 'pre-wrap',
          }}
        >
          {rightCode}
        </div>

        {/* Bullets */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {rightPoints.map((pt, i) => (
            <div
              key={i}
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: '#6EE7B7',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>🔒</span>
              <span>{pt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Verdict / Takeaway Punchline Box */}
      {verdict && (
        <div
          style={{
            background: 'rgba(250, 204, 21, 0.1)',
            border: '2px solid #FACC15',
            borderRadius: 20,
            padding: '16px 22px',
            boxShadow: '0 0 30px rgba(250, 204, 21, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ fontSize: 32 }}>💡</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#FEF08A', lineHeight: 1.35 }}>
            {verdict}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
