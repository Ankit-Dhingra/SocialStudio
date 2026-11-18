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
import { LayercutWordBehind, EclipseHUDChip } from '../MotionStyles.js';

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
  leftTitle = '❌ NAIVE DIRECT QUERY',
  leftCode = 'fee = distance_km * 10 // Static calculation',
  leftPoints = ['Assumes static conditions', 'Fails during peak rush', 'Riders get no incentive'],
  rightTitle = '✅ REAL-TIME SPATIAL PRICING',
  rightCode = 'fee = base_fee * surge_multiplier(hex_bin)',
  rightPoints = ['In-memory spatial ratio', 'Dynamic 1.2X to 2.5X multiplier', 'Directly balances fleet availability'],
  verdict = 'In-memory dynamic fleet balancing attracts riders to high-demand areas.',
  onScreenText = 'DISTANCE MYTH vs SPATIAL RATIO',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Active camera drift
  const cameraScale = interpolate(frame, [0, 90], [1.0, 1.03], { extrapolateRight: 'clamp' });

  // Spring entrances
  const entranceLeft = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 95 },
  });

  const entranceRight = spring({
    frame: Math.max(0, frame - 12),
    fps,
    config: { damping: 14, stiffness: 95 },
  });

  const vsPulse = interpolate(Math.sin(frame / 8), [-1, 1], [0.95, 1.05]);

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${cameraScale})`,
        transformOrigin: 'center center',
        paddingTop: 120,
        paddingBottom: VideoDesignTokens.safeMargin.bottom,
        paddingLeft: 40,
        paddingRight: 40,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: VideoDesignTokens.typography.fontFamilySans,
        color: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      {/* Cinematic Layercut Word Behind */}
      <LayercutWordBehind word="VERSUS" topPercent={28} color="rgba(255, 255, 255, 0.05)" />

      {/* SFX */}
      <Sequence from={0} durationInFrames={20}>
        <Audio src={staticFile('sfx/buzzer.wav')} volume={0.4} />
      </Sequence>
      <Sequence from={12} durationInFrames={25}>
        <Audio src={staticFile('sfx/ding.wav')} volume={0.6} />
      </Sequence>

      {/* Header Pill */}
      <div style={{ textAlign: 'center', zIndex: 10 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 24px',
            borderRadius: 30,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1.5px solid rgba(239, 68, 68, 0.6)',
            boxShadow: '0 0 25px rgba(239, 68, 68, 0.3)',
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444', boxShadow: '0 0 10px #EF4444' }} />
          <span
            style={{
              color: '#F87171',
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {onScreenText}
          </span>
        </div>
      </div>

      {/* Main Dynamic Split Layout (No Boring Note Cards) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, zIndex: 10 }}>
        {/* OPTION 1: Flawed / Junior Approach (Floating Glass Capsule) */}
        <div
          style={{
            transform: `translateX(${(1 - entranceLeft) * -80}px)`,
            opacity: entranceLeft,
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(15, 23, 42, 0.85) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1.5px solid rgba(239, 68, 68, 0.45)',
            borderRadius: 28,
            padding: '24px 28px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.2)',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 32 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#EF4444', letterSpacing: 2 }}>FLAWED APPROACH</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF' }}>{leftTitle.replace(/^[❌✅]\s*/, '')}</div>
              </div>
            </div>
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.25)',
                color: '#FCA5A5',
                padding: '6px 14px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 900,
                border: '1px solid #EF4444',
              }}
            >
              1450ms LATENCY
            </div>
          </div>

          {/* Code Highlight Capsule */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.65)',
              borderRadius: 16,
              padding: '14px 18px',
              fontFamily: 'monospace',
              fontSize: 20,
              color: '#FCA5A5',
              borderLeft: '4px solid #EF4444',
            }}
          >
            {leftCode}
          </div>

          {/* Quick Impact Tags */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {leftPoints.slice(0, 2).map((pt, i) => (
              <span
                key={i}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#FECACA',
                  padding: '4px 12px',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                }}
              >
                ✕ {pt}
              </span>
            ))}
          </div>
        </div>

        {/* Central Energy Divider with Floating VS Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-10px 0', zIndex: 20 }}>
          <div
            style={{
              transform: `scale(${vsPulse})`,
              background: 'linear-gradient(135deg, #EF4444 0%, #10B981 100%)',
              padding: '6px 20px',
              borderRadius: 20,
              fontWeight: 900,
              fontSize: 20,
              letterSpacing: 3,
              boxShadow: '0 0 25px rgba(255, 255, 255, 0.4)',
              color: '#FFFFFF',
            }}
          >
            VS
          </div>
        </div>

        {/* OPTION 2: Senior / Production Approach (Floating Glass Capsule) */}
        <div
          style={{
            transform: `translateX(${(1 - entranceRight) * 80}px)`,
            opacity: entranceRight,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(15, 23, 42, 0.85) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1.5px solid rgba(16, 185, 129, 0.5)',
            borderRadius: 28,
            padding: '24px 28px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 35px rgba(16, 185, 129, 0.25)',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 32 }}>⚡</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#34D399', letterSpacing: 2 }}>PRODUCTION READY</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF' }}>{rightTitle.replace(/^[❌✅]\s*/, '')}</div>
              </div>
            </div>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.25)',
                color: '#6EE7B7',
                padding: '6px 14px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 900,
                border: '1px solid #10B981',
              }}
            >
              &lt; 2ms O(1)
            </div>
          </div>

          {/* Code Highlight Capsule */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.65)',
              borderRadius: 16,
              padding: '14px 18px',
              fontFamily: 'monospace',
              fontSize: 20,
              color: '#6EE7B7',
              borderLeft: '4px solid #10B981',
            }}
          >
            {rightCode}
          </div>

          {/* Quick Impact Tags */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {rightPoints.slice(0, 2).map((pt, i) => (
              <span
                key={i}
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#A7F3D0',
                  padding: '4px 12px',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                ✓ {pt}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Verdict Chip */}
      <div style={{ zIndex: 10 }}>
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 20,
            padding: '16px 22px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ fontSize: 24 }}>💡</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#E0F2FE', lineHeight: 1.3 }}>
            {verdict}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
