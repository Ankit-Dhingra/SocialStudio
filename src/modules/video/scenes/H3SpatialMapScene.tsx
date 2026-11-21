import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { LottieAsset } from '../LottieAsset.js';

interface H3SpatialMapSceneProps {
  title?: string;
  subtitle?: string;
  hotHexId?: string;
  orderCount?: number;
  riderCount?: number;
  surgeMultiplier?: string;
  mode?: 'hex-grid' | 'naive-radius' | 'stale-heartbeat';
  entityLabel?: string;
  providerLabel?: string;
  entityEmoji?: string;
  providerEmoji?: string;
}

export const H3SpatialMapScene: React.FC<H3SpatialMapSceneProps> = ({
  title = 'SPATIAL INDEXING & PARTITION MESH',
  subtitle = 'O(1) Spatial Lookup Narrows Search from Whole Region to Local Cell',
  hotHexId = '#ZONE_A4',
  orderCount = 52,
  riderCount = 4,
  surgeMultiplier = '1.8X',
  mode = 'hex-grid',
  entityLabel = 'Demand Units',
  providerLabel = 'Active Nodes',
  entityEmoji = '📍',
  providerEmoji = '⚡',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  // Animated radar wave pulses (3 concentric ripples)
  const wave1 = (frame % 50) / 50;
  const wave2 = ((frame + 17) % 50) / 50;
  const wave3 = ((frame + 34) % 50) / 50;

  // 3D camera float
  const tiltX = 18 + Math.sin(frame / 40) * 3;
  const rotateZ = Math.sin(frame / 60) * 2;
  const floatZ = interpolate(frame, [0, 120], [0, 40], { extrapolateRight: 'clamp' });

  // Hexagon positions in honeycomb lattice (1080x1920 full bleed coordinates)
  // Center hot hex is cx: 540, cy: 960
  const R = 155; // Radius of each hexagon
  const hexagons = [
    // Center hot hex
    { id: hotHexId, cx: 540, cy: 960, isHot: true, label: `${surgeMultiplier} SURGE`, orders: orderCount, riders: riderCount },
    // Ring 1 (6 neighbors)
    { id: '#88619A0A1', cx: 540, cy: 960 - R * 1.732, isHot: false, label: '1.0X', riders: 3, orders: 8 },
    { id: '#88619A0A2', cx: 540 + R * 1.5, cy: 960 - (R * 1.732) / 2, isHot: false, label: '1.1X', riders: 4, orders: 12 },
    { id: '#88619A0A3', cx: 540 + R * 1.5, cy: 960 + (R * 1.732) / 2, isHot: false, label: '1.2X', riders: 2, orders: 9 },
    { id: '#88619A0A4-s', cx: 540, cy: 960 + R * 1.732, isHot: false, label: '1.0X', riders: 5, orders: 6 },
    { id: '#88619A0A6', cx: 540 - R * 1.5, cy: 960 + (R * 1.732) / 2, isHot: false, label: '1.0X', riders: 4, orders: 7 },
    { id: '#88619A0A7', cx: 540 - R * 1.5, cy: 960 - (R * 1.732) / 2, isHot: false, label: '1.1X', riders: 3, orders: 10 },
    // Ring 2 (outer ambient hexagons to fill 1080x1920)
    { id: '#88619A0B1', cx: 540, cy: 960 - R * 3.464, isHot: false, label: '1.0X' },
    { id: '#88619A0B2', cx: 540 + R * 3, cy: 960, isHot: false, label: '1.0X' },
    { id: '#88619A0B3', cx: 540 - R * 3, cy: 960, isHot: false, label: '1.0X' },
    { id: '#88619A0B4', cx: 540, cy: 960 + R * 3.464, isHot: false, label: '1.0X' },
    { id: '#88619A0B5', cx: 540 + R * 1.5, cy: 960 - R * 2.598, isHot: false, label: '1.0X' },
    { id: '#88619A0B6', cx: 540 - R * 1.5, cy: 960 - R * 2.598, isHot: false, label: '1.0X' },
    { id: '#88619A0B7', cx: 540 + R * 1.5, cy: 960 + R * 2.598, isHot: false, label: '1.0X' },
    { id: '#88619A0B8', cx: 540 - R * 1.5, cy: 960 + R * 2.598, isHot: false, label: '1.0X' },
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

  // Hot Hex live heartbeat pulse
  const hotPulse = 1 + Math.sin(frame / 6) * 0.04;
  const deficitNumber = (orderCount / Math.max(1, riderCount)).toFixed(1);

  // Mode-aware header badge
  const badgeText = mode === 'naive-radius'
    ? 'BRUTE FORCE RADIUS SCAN: FAILED'
    : mode === 'stale-heartbeat'
    ? 'EDGE CASE: GHOST RIDER PROBLEM'
    : 'H3 SPATIAL INDEXING ENGINE';
  const badgeColor = mode === 'naive-radius' ? '#EF4444' : mode === 'stale-heartbeat' ? '#F59E0B' : '#00F2FE';

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      {/* Audio SFX on Bottleneck Cross Stamp */}
      {mode === 'naive-radius' && (
        <Sequence from={15} durationInFrames={30}>
          <Audio src={staticFile('sfx/buzzer.wav')} volume={0.4} />
        </Sequence>
      )}
      {/* Top Floating Sleek Title HUD */}
      <div
        style={{
          position: 'absolute',
          top: 60,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 40,
          transform: `scale(${entrance})`,
          padding: '0 40px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 28px',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(20px)',
            border: `1.5px solid ${badgeColor}88`,
            borderRadius: 999,
            boxShadow: `0 0 35px ${badgeColor}44`,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: badgeColor,
              boxShadow: `0 0 12px ${badgeColor}`,
            }}
          />
          <span
            style={{
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 3,
              color: badgeColor,
              textTransform: 'uppercase',
            }}
          >
            {badgeText}
          </span>
        </div>

        <h1
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.15,
            margin: '0 0 10px 0',
            textShadow: '0 4px 30px rgba(0, 0, 0, 0.9)',
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: '#94A3B8',
            margin: 0,
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* 3D FULL BLEED HEXAGON MAP CANVAS */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          perspective: 1200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 1080,
            height: 1920,
            transform: `rotateX(${tiltX}deg) rotateZ(${rotateZ}deg) translateZ(${floatZ}px)`,
            transformOrigin: '50% 50%',
            position: 'relative',
          }}
        >
          {/* Street Road Grid Pattern Underneath */}
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0.18,
            }}
          >
            <defs>
              <pattern id="streetMap" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#38BDF8" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="2.5" fill="#38BDF8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#streetMap)" />
          </svg>

          {/* Full SVG Canvas: Mode-aware visualization */}
          <svg
            viewBox="0 0 1080 1920"
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              inset: 0,
            }}
          >
            {mode === 'naive-radius' ? (
              <>
                {/* 1. Naive Approach: Massive pulsating search radius over entire city */}
                <circle
                  cx="540"
                  cy="960"
                  r={350 + Math.sin(frame / 8) * 35}
                  fill="rgba(239, 68, 68, 0.14)"
                  stroke="#EF4444"
                  strokeWidth="6"
                  strokeDasharray="18 10"
                  filter="drop-shadow(0 0 35px rgba(239, 68, 68, 0.6))"
                />
                <circle
                  cx="540"
                  cy="960"
                  r={180 + Math.sin(frame / 8) * 20}
                  fill="rgba(239, 68, 68, 0.2)"
                  stroke="#F87171"
                  strokeWidth="3"
                  strokeDasharray="10 6"
                />

                {/* 40 scattered city rider dots scanned sequentially */}
                {Array.from({ length: 36 }).map((_, i) => {
                  const angle = (i * 137.5 * Math.PI) / 180;
                  const rad = 60 + Math.sqrt(i) * 65;
                  const dotX = 540 + rad * Math.cos(angle);
                  const dotY = 960 + rad * Math.sin(angle);
                  const isScanned = (frame * 2) % 36 > i;
                  return (
                    <circle
                      key={i}
                      cx={dotX}
                      cy={dotY}
                      r={isScanned ? 8 : 5}
                      fill={isScanned ? '#EF4444' : '#64748B'}
                      opacity={isScanned ? 0.95 : 0.4}
                    />
                  );
                })}

                {/* Big Animated Red Cross Stamp for Naive Scan */}
                <g transform="translate(540, 960)">
                  <circle r="70" fill="rgba(239, 68, 68, 0.9)" filter="drop-shadow(0 0 35px #EF4444)" />
                  <line x1="-35" y1="-35" x2="35" y2="35" stroke="#FFFFFF" strokeWidth="12" strokeLinecap="round" />
                  <line x1="35" y1="-35" x2="-35" y2="35" stroke="#FFFFFF" strokeWidth="12" strokeLinecap="round" />
                </g>
              </>
            ) : (
              <>
                {/* 2. Concentric Radar Ripples from Hot Hexagon Center (540, 960) */}
                <circle
                  cx="540"
                  cy="960"
                  r={wave1 * 480}
                  fill="none"
                  stroke={mode === 'stale-heartbeat' ? '#F59E0B' : '#EF4444'}
                  strokeWidth="4"
                  opacity={1 - wave1}
                />
                <circle
                  cx="540"
                  cy="960"
                  r={wave2 * 480}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="3"
                  opacity={1 - wave2}
                />
                <circle
                  cx="540"
                  cy="960"
                  r={wave3 * 480}
                  fill="none"
                  stroke="#00F2FE"
                  strokeWidth="2"
                  opacity={1 - wave3}
                />

                {/* Hexagons Rendering */}
                {hexagons.map((hex, idx) => {
                  const hexPoints = getHexPoints(hex.cx, hex.cy, hex.isHot ? R * hotPulse : R);

                  return (
                    <g key={idx}>
                      {/* Hexagon Body */}
                      <polygon
                        points={hexPoints}
                        fill={
                          hex.isHot
                            ? mode === 'stale-heartbeat'
                              ? 'rgba(245, 158, 11, 0.35)'
                              : 'rgba(239, 68, 68, 0.38)'
                            : 'rgba(15, 23, 42, 0.72)'
                        }
                        stroke={hex.isHot ? (mode === 'stale-heartbeat' ? '#F59E0B' : '#EF4444') : 'rgba(56, 189, 248, 0.45)'}
                        strokeWidth={hex.isHot ? 6 : 2.5}
                        style={{
                          filter: hex.isHot
                            ? `drop-shadow(0 0 45px ${mode === 'stale-heartbeat' ? 'rgba(245, 158, 11, 0.85)' : 'rgba(239, 68, 68, 0.85)'})`
                            : 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.2))',
                        }}
                      />

                      {/* Hex ID Monospace Tag */}
                      <text
                        x={hex.cx}
                        y={hex.cy - (hex.isHot ? 55 : 30)}
                        textAnchor="middle"
                        fill={hex.isHot ? '#FECACA' : '#64748B'}
                        fontSize={hex.isHot ? '22' : '17'}
                        fontWeight="800"
                        fontFamily="monospace"
                      >
                        {hex.id}
                      </text>

                      {/* Multiplier / Status Label */}
                      <text
                        x={hex.cx}
                        y={hex.cy + (hex.isHot ? -10 : 15)}
                        textAnchor="middle"
                        fill={hex.isHot ? '#FFFFFF' : '#38BDF8'}
                        fontSize={hex.isHot ? '38' : '26'}
                        fontWeight="900"
                      >
                        {mode === 'stale-heartbeat' && hex.isHot ? 'OFFLINE NODE' : hex.label}
                      </text>

                      {/* Dynamic entity counts inside cells */}
                      {hex.riders && (
                        <text
                          x={hex.cx}
                          y={hex.cy + 45}
                          textAnchor="middle"
                          fill="#34D399"
                          fontSize="16"
                          fontWeight="800"
                        >
                          {providerEmoji} {hex.riders} {providerLabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </>
            )}
          </svg>

          {/* Center Holographic Telemetry */}
          <div
            style={{
              position: 'absolute',
              left: 540,
              top: 960 + 35,
              transform: 'translate(-50%, 0)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              pointerEvents: 'none',
              zIndex: 30,
            }}
          >
            {mode === 'naive-radius' ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 28px',
                    borderRadius: 999,
                    background: 'rgba(239, 68, 68, 0.95)',
                    boxShadow: '0 10px 40px rgba(239, 68, 68, 0.6), 0 0 20px #EF4444',
                    color: '#FFFFFF',
                    fontWeight: 900,
                    fontSize: 22,
                    letterSpacing: 1,
                  }}
                >
                  <span>⚠️ FULL CITY SCAN: O(N)</span>
                  <span style={{ opacity: 0.6 }}>|</span>
                  <span>⏱️ 480ms Latency Spike</span>
                </div>
                <div
                  style={{
                    padding: '8px 22px',
                    borderRadius: 14,
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '2px solid #EF4444',
                    boxShadow: '0 0 25px rgba(239, 68, 68, 0.5)',
                    color: '#F87171',
                    fontWeight: 900,
                    fontSize: 20,
                    letterSpacing: 1.5,
                  }}
                >
                  ❌ DATABASE LOCK CONTENTION • TOO SLOW
                </div>
              </>
            ) : mode === 'stale-heartbeat' ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 28px',
                    borderRadius: 999,
                    background: 'rgba(245, 158, 11, 0.95)',
                    boxShadow: '0 10px 40px rgba(245, 158, 11, 0.6)',
                    color: '#FFFFFF',
                    fontWeight: 900,
                    fontSize: 22,
                    letterSpacing: 1,
                  }}
                >
                  <span>📡 DISCONNECTED / HEARTBEAT TIMEOUT</span>
                </div>
                <div
                  style={{
                    padding: '8px 22px',
                    borderRadius: 14,
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '2px solid #10B981',
                    boxShadow: '0 0 25px rgba(16, 185, 129, 0.4)',
                    color: '#34D399',
                    fontWeight: 900,
                    fontSize: 20,
                    letterSpacing: 1.5,
                  }}
                >
                  🛡️ FRESHNESS FILTER: STALE NODE EXCLUDED
                </div>
              </>
            ) : (
              <>
                <LottieAsset
                  name="scooter-3d"
                  style={{
                    width: 250,
                    height: 150,
                    marginBottom: -8,
                    filter: 'hue-rotate(185deg) saturate(1.25) drop-shadow(0 15px 35px rgba(56, 189, 248, 0.6))',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '12px 28px',
                    borderRadius: 999,
                    background: 'rgba(239, 68, 68, 0.95)',
                    boxShadow: '0 10px 40px rgba(239, 68, 68, 0.6), 0 0 20px #EF4444',
                    color: '#FFFFFF',
                    fontWeight: 900,
                    fontSize: 22,
                    letterSpacing: 1,
                  }}
                >
                  <span>{entityEmoji} {orderCount} {entityLabel}</span>
                  <span style={{ opacity: 0.6 }}>|</span>
                  <span>{providerEmoji} {riderCount} {providerLabel}</span>
                </div>
                <div
                  style={{
                    padding: '8px 22px',
                    borderRadius: 14,
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '2px solid #F59E0B',
                    boxShadow: '0 0 25px rgba(245, 158, 11, 0.5)',
                    color: '#FCD34D',
                    fontWeight: 900,
                    fontSize: 20,
                    letterSpacing: 1.5,
                  }}
                >
                  ⚠️ {deficitNumber}X SUPPLY DEFICIT
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cut 2.2: The 3-Step Pricing Engine Pipeline Overlay (Triggers at frame 240+ / ~8s) */}
      {frame >= 240 && (
        <div
          style={{
            position: 'absolute',
            top: 340,
            bottom: 530,
            left: 60,
            right: 140,
            background: 'rgba(10, 15, 30, 0.94)',
            backdropFilter: 'blur(25px)',
            borderRadius: 32,
            border: '2px solid rgba(56, 189, 248, 0.6)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(56, 189, 248, 0.3)',
            padding: '30px 28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            zIndex: 50,
            transform: `scale(${spring({ frame: frame - 240, fps, config: { damping: 14, stiffness: 100 } })})`,
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 18px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1.5px solid #38BDF8',
                borderRadius: 999,
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#38BDF8', letterSpacing: 2 }}>
                PIPELINE ARCHITECTURE
              </span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF' }}>
              {title || 'HOW SPATIAL PARTITIONING OPTIMIZES LATENCY'}
            </div>
          </div>

          {/* 3 Connected Pipeline Stages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Step 1: Micro-Zone */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1.5px solid rgba(56, 189, 248, 0.4)',
                borderRadius: 18,
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(56, 189, 248, 0.2)',
                  border: '1.5px solid #38BDF8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#38BDF8',
                }}
              >
                1
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
                  Micro-Zone Hexagon Cells (H3)
                </div>
                <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 2 }}>
                  City partitioned into O(1) cells (#88619A0A4) instead of full-city scans.
                </div>
              </div>
              <span style={{ fontSize: 20 }}>🗺️</span>
            </div>

            {/* Connecting Arrow */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span style={{ fontSize: 20, color: '#38BDF8' }}>⬇️</span>
            </div>

            {/* Step 2: Telemetry */}
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1.5px solid rgba(239, 68, 68, 0.5)',
                borderRadius: 18,
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1.5px solid #EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#EF4444',
                }}
              >
                2
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
                  Partition Telemetry & Node State
                </div>
                <div style={{ fontSize: 14, color: '#FCA5A5', marginTop: 2 }}>
                  {orderCount} {entityLabel} tracked across {riderCount} active {providerLabel}.
                </div>
              </div>
              <span style={{ fontSize: 20 }}>📊</span>
            </div>

            {/* Connecting Arrow */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span style={{ fontSize: 20, color: '#10B981' }}>⬇️</span>
            </div>

            {/* Step 3: Pricing Engine */}
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1.5px solid rgba(16, 185, 129, 0.5)',
                borderRadius: 18,
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1.5px solid #10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 900,
                  color: '#10B981',
                }}
              >
                3
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
                  In-Memory State Resolution
                </div>
                <div style={{ fontSize: 14, color: '#6EE7B7', marginTop: 2 }}>
                  O(1) in-memory key lookup replaces slow geographic bounding box queries.
                </div>
              </div>
              <span style={{ fontSize: 20 }}>⚡</span>
            </div>
          </div>

          {/* Bottom Summary Pill */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 14,
              padding: '10px 16px',
              textAlign: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#38BDF8',
            }}
          >
            ✓ Sub-millisecond calculation executed in memory for each user request
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
