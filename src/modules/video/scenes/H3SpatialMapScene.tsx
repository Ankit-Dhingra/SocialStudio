import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface H3SpatialMapSceneProps {
  title?: string;
  subtitle?: string;
  hotHexId?: string;
  orderCount?: number;
  riderCount?: number;
  surgeMultiplier?: string;
}

export const H3SpatialMapScene: React.FC<H3SpatialMapSceneProps> = ({
  title = 'SPATIAL INDEXING: H3 HEX BINS',
  subtitle = 'Converting 2D Earth Coordinates to In-Memory Hexagon IDs',
  hotHexId = '#88619A0A4',
  orderCount = 52,
  riderCount = 5,
  surgeMultiplier = '1.8X',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  // Pulsing radar animation for the hot surge hex
  const radarWave1 = (frame % 40) / 40; // 0 to 1
  const radarWave2 = ((frame + 20) % 40) / 40;

  // Subtle floating map motion
  const mapTilt = Math.sin(frame / 30) * 3;

  // Hexagon positions in honeycomb lattice (relative coordinates)
  // Center is hot hex (cx: 480, cy: 520)
  const hexagons = [
    { id: hotHexId, cx: 480, cy: 520, isHot: true, label: 'SURGE 1.8X', orders: orderCount, riders: riderCount },
    { id: '#88619A0A1', cx: 480, cy: 300, isHot: false, label: '1.0X' },
    { id: '#88619A0A2', cx: 670, cy: 410, isHot: false, label: '1.1X' },
    { id: '#88619A0A3', cx: 670, cy: 630, isHot: false, label: '1.0X' },
    { id: '#88619A0A5', cx: 480, cy: 740, isHot: false, label: '1.0X' },
    { id: '#88619A0A6', cx: 290, cy: 630, isHot: false, label: '1.2X' },
    { id: '#88619A0A7', cx: 290, cy: 410, isHot: false, label: '1.0X' },
    // Outer ring
    { id: '#88619A0A8', cx: 860, cy: 520, isHot: false, label: '1.0X' },
    { id: '#88619A0A9', cx: 100, cy: 520, isHot: false, label: '1.0X' },
  ];

  function getHexPoints(cx: number, cy: number, r: number) {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  }

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        paddingTop: VideoDesignTokens.safeMargin.top,
        paddingBottom: VideoDesignTokens.safeMargin.bottom,
        paddingLeft: 40,
        paddingRight: 40,
        overflow: 'hidden',
      }}
    >
      {/* Header Pill & Title */}
      <div style={{ transform: `scale(${entrance})`, marginBottom: 20, textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 22px',
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 30,
            marginBottom: 14,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#38BDF8', boxShadow: '0 0 10px #38BDF8' }} />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3, color: '#38BDF8', textTransform: 'uppercase' }}>
            UBER / ZOMATO SPATIAL ARCHITECTURE
          </span>
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: '#FFFFFF', margin: '0 0 8px 0' }}>
          {title}
        </h1>
        <p style={{ fontSize: 24, fontWeight: 600, color: '#94A3B8', margin: 0 }}>
          {subtitle}
        </p>
      </div>

      {/* Cyber City Map Canvas with Hexagons */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          background: 'radial-gradient(ellipse at center, #0F172A 0%, #050914 85%)',
          borderRadius: 32,
          border: '2px solid rgba(56, 189, 248, 0.25)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), inset 0 0 80px rgba(15, 23, 42, 0.8)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `perspective(1000px) rotateX(${mapTilt}deg)`,
        }}
      >
        {/* Ambient Map Street Grid Background */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0.2,
          }}
        >
          <defs>
            <pattern id="streetGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#38BDF8" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#streetGrid)" />
        </svg>

        {/* Honeycomb Hexagon Mesh */}
        <svg
          viewBox="0 0 960 1040"
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            inset: 0,
          }}
        >
          {/* Radar ripple waves from hot hexagon */}
          <circle
            cx="480"
            cy="520"
            r={radarWave1 * 260}
            fill="none"
            stroke="#EF4444"
            strokeWidth="3"
            opacity={1 - radarWave1}
          />
          <circle
            cx="480"
            cy="520"
            r={radarWave2 * 260}
            fill="none"
            stroke="#F59E0B"
            strokeWidth="2"
            opacity={1 - radarWave2}
          />

          {/* Draw each hexagon */}
          {hexagons.map((hex, idx) => {
            const hexPoints = getHexPoints(hex.cx, hex.cy, 120);
            return (
              <g key={idx}>
                {/* Hexagon Body */}
                <polygon
                  points={hexPoints}
                  fill={
                    hex.isHot
                      ? 'rgba(239, 68, 68, 0.35)'
                      : 'rgba(56, 189, 248, 0.08)'
                  }
                  stroke={hex.isHot ? '#EF4444' : 'rgba(56, 189, 248, 0.35)'}
                  strokeWidth={hex.isHot ? 4 : 2}
                  style={{
                    filter: hex.isHot ? 'drop-shadow(0 0 20px rgba(239,68,68,0.7))' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                />

                {/* Hex ID Label */}
                <text
                  x={hex.cx}
                  y={hex.cy - 20}
                  textAnchor="middle"
                  fill={hex.isHot ? '#FECACA' : '#64748B'}
                  fontSize="15"
                  fontWeight="800"
                  fontFamily="monospace"
                >
                  {hex.id}
                </text>

                {/* Status / Multiplier Tag */}
                <text
                  x={hex.cx}
                  y={hex.cy + 15}
                  textAnchor="middle"
                  fill={hex.isHot ? '#FFFFFF' : '#38BDF8'}
                  fontSize={hex.isHot ? '26' : '18'}
                  fontWeight="900"
                >
                  {hex.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Telemetry HUD Card over Hot Hex */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 30,
            right: 30,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '2px solid #EF4444',
            borderRadius: 24,
            padding: '20px 24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 40px rgba(239, 68, 68, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#EF4444', letterSpacing: 2 }}>
                CRITICAL DEMAND IMBALANCE
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', marginTop: 4 }}>
                Hex Bin: {hotHexId}
              </div>
            </div>
            <div
              style={{
                background: '#EF4444',
                color: '#FFF',
                fontWeight: 900,
                fontSize: 24,
                padding: '6px 18px',
                borderRadius: 14,
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.8)',
              }}
            >
              {surgeMultiplier} SURGE
            </div>
          </div>

          {/* Telemetry Numbers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: 12 }}>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>ACTIVE ORDERS</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#F87171' }}>{orderCount} req/min</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: 12 }}>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>AVAILABLE RIDERS</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#38BDF8' }}>{riderCount} online</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: 12 }}>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>LOOKUP LATENCY</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#34D399' }}>&lt; 8ms O(1)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Architectural Takeaway Bar */}
      <div
        style={{
          marginTop: 18,
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1.5px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 18,
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 22 }}>⚡</span>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#A7F3D0' }}>
          H3 converts expensive lat/lng polygon checks into simple Redis key lookups!
        </span>
      </div>
    </AbsoluteFill>
  );
};
