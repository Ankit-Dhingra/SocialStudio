import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface ComparisonSceneProps {
  leftTitle?: string;
  leftCode?: string;
  leftPoints?: string[];
  rightTitle?: string;
  rightCode?: string;
  rightPoints?: string[];
  verdict?: string;
  onScreenText?: string;
  metricAName?: string;
  metricACount?: number | string;
  metricBName?: string;
  metricBCount?: number | string;
  deficitRatio?: string;
  stampTitle?: string;
  stampSubtitle?: string;
}

export const ComparisonScene: React.FC<ComparisonSceneProps> = ({
  leftTitle = 'NAIVE IMPLEMENTATION',
  leftCode = 'SELECT * FROM resource WHERE id = 101 FOR UPDATE;',
  leftPoints = ['Direct synchronous disk lock', 'Contention spikes exponentially under load', 'Fails under high concurrent traffic'],
  rightTitle = 'ATOMIC IN-MEMORY MUTEX',
  rightCode = 'SET lock:resource uuid NX PX 10000',
  rightPoints = ['Sub-millisecond Redis coordination', 'Prevents race conditions & double-allocation', 'Automatic lease TTL prevents deadlocks'],
  verdict = 'Atomic in-memory checks eliminate race conditions without database locks.',
  onScreenText = 'NAIVE SQL SCAN vs DISTRIBUTED MUTEX',
  metricAName = 'Requests',
  metricACount = 100,
  metricBName = 'Workers',
  metricBCount = 20,
  deficitRatio,
  stampTitle = '❌ CONCURRENCY COLLISION',
  stampSubtitle = 'Database Lock Contention & Bottleneck!',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  const vsPulse = 1 + Math.sin(frame / 6) * 0.08;
  const computedRatio = deficitRatio || `${(Number(metricACount) / Math.max(1, Number(metricBCount))).toFixed(1)}X DEFICIT`;

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      {/* Top Floating Sleek Title HUD */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 40,
          transform: `scale(${entrance})`,
          padding: '0 140px 0 60px',
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
            border: '1.5px solid rgba(239, 68, 68, 0.5)',
            borderRadius: 999,
            boxShadow: '0 0 35px rgba(239, 68, 68, 0.35)',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#EF4444',
              boxShadow: '0 0 12px #EF4444',
            }}
          />
          <span
            style={{
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 3,
              color: '#F87171',
              textTransform: 'uppercase',
            }}
          >
            SYSTEM DESIGN DEBUNKED
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
          {onScreenText || 'DISTANCE vs SUPPLY & DEMAND'}
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
          Why naive distance calculations fail under real-world demand
        </p>
      </div>

      {/* Mode Switch: Cut 1.1 (Area Shortage Map + Failed Brute Force Scan) vs Cut 1.2 (Comparison Matrix) */}
      {frame < 190 ? (
        /* CUT 1.1: AREA SHORTAGE MAP & FAILED BRUTE FORCE CITY SCAN */
        <div
          style={{
            position: 'absolute',
            top: 360,
            bottom: 530,
            left: 60,
            right: 140,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 30,
          }}
        >
          {/* Critical Imbalance Card */}
          <div
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(15, 23, 42, 0.95) 100%)',
              border: '2px solid rgba(239, 68, 68, 0.6)',
              borderRadius: 28,
              padding: '24px 30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 15px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(239, 68, 68, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '1.5px solid #EF4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                }}
              >
                🚨
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 900, color: '#FCA5A5', letterSpacing: 2 }}>
                  LOCAL SUPPLY BOTTLENECK
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', marginTop: 2 }}>
                  {metricACount} {metricAName} vs {metricBCount} {metricBName}
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#EF4444',
                color: '#FFFFFF',
                padding: '8px 20px',
                borderRadius: 999,
                fontWeight: 900,
                fontSize: 18,
                letterSpacing: 1,
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)',
              }}
            >
              {computedRatio}
            </div>
          </div>

          {/* Central Radar Simulation Canvas */}
          <div
            style={{
              width: '100%',
              height: 380,
              borderRadius: 28,
              background: 'rgba(10, 15, 30, 0.85)',
              border: '1.5px solid rgba(56, 189, 248, 0.25)',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Grid Pattern */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'radial-gradient(rgba(56, 189, 248, 0.15) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />

            {/* Expanding Brute-Force Search Radar Wave */}
            <div
              style={{
                position: 'absolute',
                width: 320,
                height: 320,
                borderRadius: '50%',
                border: '3px dashed #EF4444',
                background: 'rgba(239, 68, 68, 0.08)',
                transform: `scale(${1 + ((frame % 60) / 60) * 1.5})`,
                opacity: 1 - (frame % 60) / 60,
                boxShadow: '0 0 35px rgba(239, 68, 68, 0.4)',
              }}
            />

            {/* 20 Glowing Distributed Worker Nodes */}
            {Array.from({ length: 20 }).map((_, i) => {
              const angle = (i / 20) * Math.PI * 2;
              const dist = 70 + (i % 3) * 35;
              const x = Math.cos(angle) * dist;
              const y = Math.sin(angle) * dist;
              return (
                <div
                  key={`worker-node-${i}`}
                  style={{
                    position: 'absolute',
                    transform: `translate(${x}px, ${y}px)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#34D399',
                      boxShadow: '0 0 12px #34D399, 0 0 24px rgba(52, 211, 153, 0.5)',
                      border: '1.5px solid #FFFFFF',
                    }}
                  />
                </div>
              );
            })}

            {/* Center Hot Demand Cluster */}
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(239, 68, 68, 0.5) 0%, rgba(239, 68, 68, 0.1) 70%)',
                border: '2px solid #EF4444',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 35px #EF4444',
                zIndex: 10,
              }}
            >
              <span style={{ fontSize: 24 }}>⚡</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#FFFFFF' }}>{metricACount} {String(metricAName).toUpperCase()}</span>
            </div>

            {/* Giant Red Stamp at frame 90: FAILED BRUTE FORCE SCAN */}
            {frame >= 90 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.88)',
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 40,
                  transform: `scale(${spring({ frame: frame - 90, fps, config: { damping: 12, stiffness: 120 } })}) rotate(-4deg)`,
                }}
              >
                <div
                  style={{
                    border: '5px solid #EF4444',
                    borderRadius: 20,
                    padding: '16px 28px',
                    textAlign: 'center',
                    background: 'rgba(239, 68, 68, 0.25)',
                    boxShadow: '0 0 50px rgba(239, 68, 68, 0.8)',
                  }}
                >
                  <div style={{ fontSize: 32, fontWeight: 900, color: '#FFFFFF', letterSpacing: 2 }}>
                    {stampTitle}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#FCA5A5', marginTop: 4 }}>
                    {stampSubtitle}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Alert Pill */}
          <div
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1.5px solid rgba(239, 68, 68, 0.4)',
              borderRadius: 20,
              padding: '14px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <span style={{ fontSize: 24 }}>💡</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#E2E8F0' }}>
              {verdict || `${metricACount} ${metricAName} competing for ${metricBCount} ${metricBName} causes severe lock contention.`}
            </span>
          </div>
        </div>
      ) : (
        /* CUT 1.2: SIDE-BY-SIDE ARCHITECTURAL COMPARISON MATRIX */
        <div
          style={{
            position: 'absolute',
            top: 350,
            bottom: 530,
            left: 60,
            right: 140,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 30,
          }}
        >
          {/* OPTION 1: THE FLAWED DISTANCE MYTH (Top Section) */}
          <div
            style={{
              width: '100%',
              borderRadius: 28,
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, rgba(15, 23, 42, 0.92) 100%)',
              border: '2px solid rgba(239, 68, 68, 0.5)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 35px rgba(239, 68, 68, 0.25)',
              padding: '22px 28px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 32 }}>❌</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#EF4444', letterSpacing: 2 }}>
                    NAIVE FORMULA
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', marginTop: 2 }}>
                    {leftTitle}
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: '6px 16px',
                  borderRadius: 999,
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                BLIND TO SHORTAGE
              </div>
            </div>

            {/* Code Formula Box */}
            <div
              style={{
                marginTop: 14,
                background: 'rgba(0, 0, 0, 0.65)',
                borderLeft: '5px solid #EF4444',
                borderRadius: 14,
                padding: '12px 18px',
                fontFamily: 'monospace',
                fontSize: 19,
                color: '#FCA5A5',
                fontWeight: 700,
              }}
            >
              {leftCode}
            </div>

            {/* Point Pills */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              {leftPoints.map((pt, i) => (
                <span
                  key={i}
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#FECACA',
                    padding: '6px 14px',
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  • {pt}
                </span>
              ))}
            </div>
          </div>

          {/* Central VS Pulser */}
          <div
            style={{
              transform: `scale(${vsPulse})`,
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #EF4444 0%, #10B981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: 18,
              color: '#FFFFFF',
              boxShadow: '0 0 30px rgba(255, 255, 255, 0.4)',
              zIndex: 35,
            }}
          >
            VS
          </div>

          {/* OPTION 2: REAL-TIME SPATIAL PRICING (Bottom Section) */}
          <div
            style={{
              width: '100%',
              borderRadius: 28,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(15, 23, 42, 0.92) 100%)',
              border: '2px solid rgba(16, 185, 129, 0.6)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.3)',
              padding: '22px 28px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 32 }}>✅</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#34D399', letterSpacing: 2 }}>
                    REAL TELEMETRY
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', marginTop: 2 }}>
                    {rightTitle}
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: '6px 16px',
                  borderRadius: 999,
                  background: '#10B981',
                  color: '#FFFFFF',
                  fontSize: 14,
                  fontWeight: 900,
                }}
              >
                SUPPLY-AWARE
              </div>
            </div>

            {/* Code Formula Box */}
            <div
              style={{
                marginTop: 14,
                background: 'rgba(0, 0, 0, 0.65)',
                borderLeft: '5px solid #10B981',
                borderRadius: 14,
                padding: '12px 18px',
                fontFamily: 'monospace',
                fontSize: 19,
                color: '#6EE7B7',
                fontWeight: 700,
              }}
            >
              {rightCode}
            </div>

            {/* Point Pills */}
            <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
              {rightPoints.map((pt, i) => (
                <span
                  key={i}
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#A7F3D0',
                    padding: '6px 14px',
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  ✓ {pt}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
