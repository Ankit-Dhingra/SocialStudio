import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

/**
 * Eclipse Style: Cyberpunk Neon Halo Ring with Rotating HUD Accents
 */
export const EclipseNeonRing: React.FC<{
  pulse?: number;
  color?: string;
  glowColor?: string;
}> = ({ pulse = 1, color = '#00F2FE', glowColor = 'rgba(168, 85, 247, 0.35)' }) => {
  const frame = useCurrentFrame();
  const rotation = (frame * 1.2) % 360;
  const glow = interpolate(Math.sin(frame / 14), [-1, 1], [0.85, 1.15]) * pulse;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
      {/* Outer Radial Ambient Halo */}
      <div
        style={{
          position: 'absolute',
          top: '28%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 620,
          height: 620,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glowColor} 0%, rgba(0, 242, 254, 0.12) 50%, transparent 70%)`,
          filter: `blur(${40 * glow}px)`,
        }}
      />

      {/* Rotating Dashed Cyber Ring */}
      <svg
        style={{
          position: 'absolute',
          top: '28%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          width: 520,
          height: 520,
        }}
        viewBox="0 0 520 520"
      >
        <circle
          cx="260"
          cy="260"
          r="240"
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray="50 30 15 30 80 40"
          strokeOpacity="0.75"
        />
        <circle
          cx="260"
          cy="260"
          r="220"
          fill="none"
          stroke="#A855F7"
          strokeWidth="1.5"
          strokeDasharray="20 20"
          strokeOpacity="0.5"
        />
      </svg>
    </div>
  );
};

/**
 * Spiral Style: 3D Frosted Glass Ribbon with Chromatic Shimmer
 */
export const SpiralGlassRibbon: React.FC<{
  topPercent?: number;
  rotationDeg?: number;
}> = ({ topPercent = 42, rotationDeg = -16 }) => {
  const frame = useCurrentFrame();
  const wave = Math.sin(frame / 22) * 28;
  const shimmer = interpolate(Math.sin(frame / 35), [-1, 1], [0.2, 0.4]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      <div
        style={{
          position: 'absolute',
          top: `${topPercent}%`,
          left: '-20%',
          width: '140%',
          height: 160,
          borderRadius: 80,
          background: `linear-gradient(90deg, rgba(0, 242, 254, 0.12) 0%, rgba(168, 85, 247, ${shimmer}) 50%, rgba(255, 255, 255, 0.08) 100%)`,
          backdropFilter: 'blur(20px)',
          border: '1.5px solid rgba(255, 255, 255, 0.28)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), inset 0 1px 2px rgba(255, 255, 255, 0.4)',
          transform: `translateY(${wave}px) rotateZ(${rotationDeg}deg)`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  );
};

/**
 * Layercut Style: Massive Cinematic Background Typography Behind Content
 */
export const LayercutWordBehind: React.FC<{
  word: string;
  topPercent?: number;
  color?: string;
}> = ({ word, topPercent = 22, color = 'rgba(255, 255, 255, 0.12)' }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame % 180, [0, 90, 180], [1, 1.03, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        top: `${topPercent}%`,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '135px',
        fontWeight: 950,
        textTransform: 'uppercase',
        letterSpacing: '-0.05em',
        color,
        textShadow: '0 0 50px rgba(0, 242, 254, 0.18)',
        transform: `scale(${scale})`,
        pointerEvents: 'none',
        zIndex: 0,
        userSelect: 'none',
      }}
    >
      {word}
    </div>
  );
};

/**
 * Aurora Style: Gold Highlighted Accent Frame for Technical Focus
 */
export const AuroraAccentFrame: React.FC<{
  children?: React.ReactNode;
}> = ({ children }) => {
  return (
    <div
      style={{
        borderRadius: 28,
        border: '1.5px solid rgba(250, 204, 21, 0.35)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(250, 204, 21, 0.12)',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(16px)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
};
