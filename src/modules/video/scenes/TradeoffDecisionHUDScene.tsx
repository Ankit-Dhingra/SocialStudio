import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';
import { LayercutWordBehind, SpiralGlassRibbon } from '../MotionStyles.js';

interface TradeoffDecisionHUDSceneProps {
  title?: string;
  subtitle?: string;
  optionA_Title?: string;
  optionA_Pros?: string;
  optionA_Cons?: string;
  optionB_Title?: string;
  optionB_Pros?: string;
  optionB_Cons?: string;
  interviewPoints?: string[];
  callToAction?: string;
}

export const TradeoffDecisionHUDScene: React.FC<TradeoffDecisionHUDSceneProps> = ({
  title = 'THE SYSTEM DESIGN TRADEOFF',
  subtitle = 'Which spatial partitioning strategy would you defend in an interview?',
  optionA_Title = 'OPTION A: MICRO-HEX BINS (100m)',
  optionA_Pros = 'Hyper-local pricing & instant fleet response',
  optionA_Cons = 'High Redis RAM & 150k key-writes per second',
  optionB_Title = 'OPTION B: MACRO ZONES (3km)',
  optionB_Pros = 'Ultra-lightweight in-memory footprint',
  optionB_Cons = 'Border pricing anomalies at boundary edges',
  interviewPoints = [
    'H3 Spatial Indexing converts geometric polygons to O(1) string hashes',
    'Redis in-memory caching serves dynamic surge pricing under 4ms',
  ],
  callToAction = 'Save this reel for your System Design Interview & follow for more!',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  const cardEntranceA = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const cardEntranceB = spring({
    frame: Math.max(0, frame - 16),
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // SVG Circular Gauge Animation (0 to 1)
  const dialA = interpolate(spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 16 } }), [0, 1], [0, 0.95]);
  const dialB = interpolate(spring({ frame: Math.max(0, frame - 22), fps, config: { damping: 16 } }), [0, 1], [0, 0.65]);

  const circumference = 2 * Math.PI * 46;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 120,
        paddingBottom: VideoDesignTokens.safeMargin.bottom,
        paddingLeft: 40,
        paddingRight: 40,
        justifyContent: 'space-between',
        fontFamily: VideoDesignTokens.typography.fontFamilySans,
        color: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      {/* Cinematic Layercut & 3D Glass Ribbon */}
      <LayercutWordBehind word="TRADEOFF" topPercent={24} color="rgba(250, 204, 21, 0.05)" />
      <SpiralGlassRibbon topPercent={40} rotationDeg={-12} />

      {/* Header Pill & Title */}
      <div style={{ transform: `scale(${entrance})`, textAlign: 'center', zIndex: 10 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 24px',
            background: 'rgba(234, 179, 8, 0.15)',
            border: '1.5px solid rgba(234, 179, 8, 0.5)',
            borderRadius: 30,
            marginBottom: 10,
            boxShadow: '0 0 25px rgba(234, 179, 8, 0.25)',
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EAB308', boxShadow: '0 0 10px #EAB308' }} />
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, color: '#FDE047', textTransform: 'uppercase' }}>
            SENIOR SDE-3 DECISION MATRIX
          </span>
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px 0' }}>
          {title}
        </h1>
        <p style={{ fontSize: 22, fontWeight: 600, color: '#94A3B8', margin: 0 }}>
          {subtitle}
        </p>
      </div>

      {/* Futuristic Radial Gauge Columns (No Boring Note Boxes!) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, zIndex: 10 }}>
        {/* OPTION A: MICRO-HEX */}
        <div
          style={{
            transform: `translateY(${(1 - cardEntranceA) * 60}px)`,
            opacity: cardEntranceA,
            background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.16) 0%, rgba(15, 23, 42, 0.9) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1.5px solid rgba(16, 185, 129, 0.45)',
            borderRadius: 28,
            padding: '24px 20px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* Radial Circular Dial */}
          <div style={{ position: 'relative', width: 110, height: 110, marginBottom: 12 }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle
                cx="55"
                cy="55"
                r="46"
                fill="none"
                stroke="#10B981"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - dialA)}
                strokeLinecap="round"
                transform="rotate(-90 55 55)"
                filter="drop-shadow(0 0 8px #10B981)"
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#34D399' }}>95%</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8' }}>ACCURACY</span>
            </div>
          </div>

          <div style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF', marginBottom: 6 }}>
            {optionA_Title.replace(/^OPTION A:\s*/i, '')}
          </div>
          <div style={{ fontSize: 14, color: '#34D399', fontWeight: 700, marginBottom: 12 }}>
            ✓ {optionA_Pros}
          </div>

          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#FCA5A5',
              padding: '6px 12px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ⚠️ High RAM Footprint
          </div>
        </div>

        {/* OPTION B: MACRO-ZONES */}
        <div
          style={{
            transform: `translateY(${(1 - cardEntranceB) * 60}px)`,
            opacity: cardEntranceB,
            background: 'linear-gradient(145deg, rgba(56, 189, 248, 0.16) 0%, rgba(15, 23, 42, 0.9) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1.5px solid rgba(56, 189, 248, 0.45)',
            borderRadius: 28,
            padding: '24px 20px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(56, 189, 248, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* Radial Circular Dial */}
          <div style={{ position: 'relative', width: 110, height: 110, marginBottom: 12 }}>
            <svg width="110" height="110" viewBox="0 0 110 110">
              <circle cx="55" cy="55" r="46" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
              <circle
                cx="55"
                cy="55"
                r="46"
                fill="none"
                stroke="#38BDF8"
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - dialB)}
                strokeLinecap="round"
                transform="rotate(-90 55 55)"
                filter="drop-shadow(0 0 8px #38BDF8)"
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: '#38BDF8' }}>65%</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: '#94A3B8' }}>ACCURACY</span>
            </div>
          </div>

          <div style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF', marginBottom: 6 }}>
            {optionB_Title.replace(/^OPTION B:\s*/i, '')}
          </div>
          <div style={{ fontSize: 14, color: '#38BDF8', fontWeight: 700, marginBottom: 12 }}>
            ✓ {optionB_Pros}
          </div>

          <div
            style={{
              background: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              color: '#FDE047',
              padding: '6px 12px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ⚠️ Border Price Jitter
          </div>
        </div>
      </div>

      {/* SDE-3 Architectural Verdict Banner */}
      <div style={{ zIndex: 10 }}>
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(234, 179, 8, 0.2) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1.5px solid rgba(234, 179, 8, 0.6)',
            borderRadius: 22,
            padding: '18px 24px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(234, 179, 8, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 28 }}>⚖️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#FDE047', letterSpacing: 2 }}>
              THE SENIOR SDE ANSWER
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.3, marginTop: 2 }}>
              Micro-hex in dense urban cores; fallback to macro-zones in rural corridors.
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
