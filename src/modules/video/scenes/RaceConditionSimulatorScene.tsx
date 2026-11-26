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
import { LottieAsset } from '../LottieAsset.js';

export interface RaceConditionSimulatorProps {
  title?: string;
  itemTitle?: string;
  user1Name?: string;
  user2Name?: string;
  atomicQuery?: string;
  onScreenText?: string;
  cueFrames?: number[];
}

export const RaceConditionSimulatorScene: React.FC<RaceConditionSimulatorProps> = ({
  title = 'CONCURRENCY • RACE CONDITION',
  itemTitle = 'Shared Resource Mutex',
  user1Name = 'Worker Thread A',
  user2Name = 'Worker Thread B',
  atomicQuery = '// Atomic lock acquisition query',
  onScreenText,
  cueFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Dynamic phase thresholds based on total duration (works for 10s, 15s, 20s+)
  const totalFrames = Math.max(durationInFrames || 300, 180);

  // Keyframe Milestones:
  // Step 1: 0% to 18% - Realistic Mutex card appears
  // Step 2: 18% to 35% - Two concurrent workers contending for same hex
  // Step 3: 35% to 50% - Both attempt lock acquisition
  // Step 4: 50% to 66% - Network packets travel to Redis
  // Step 5: 66% to 80% - Both threads attempt write (Race Hazard)
  // Step 6: 80% to 100% - SETNX atomic update resolves: Worker A wins lock (OK), Worker B rejected (nil)

  const fStep2 = Math.floor(totalFrames * 0.16);
  const fClickAman = Math.floor(totalFrames * 0.33);
  const fClickRiya = Math.floor(totalFrames * 0.36);
  const fNetworkStart = Math.floor(totalFrames * 0.48);
  const fReadDb = Math.floor(totalFrames * 0.65);
  const fResolveAman = cueFrames && cueFrames.length > 0 && cueFrames[0] > 0
    ? Math.min(cueFrames[0], totalFrames - 25)
    : Math.floor(totalFrames * 0.79);
  const fResolveRiya = fResolveAman + Math.min(18, Math.floor((totalFrames - fResolveAman) * 0.4));

  // States
  const isStep2 = frame >= fStep2;
  const isAmanClicked = frame >= fClickAman;
  const isRiyaClicked = frame >= fClickRiya;
  const isDbReading = frame >= fReadDb;
  const isAmanResolved = frame >= fResolveAman;
  const isRiyaResolved = frame >= fResolveRiya;

  // Spring animations
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const step2Entrance = spring({
    frame: Math.max(0, frame - fStep2),
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const dbEntrance = spring({
    frame: Math.max(0, frame - fNetworkStart),
    fps,
    config: { damping: 16, stiffness: 110 },
  });

  // Network packet progress (0 to 1) along SVG bezier curves
  const packetAProgress = interpolate(
    frame,
    [fNetworkStart, fReadDb],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const packetBProgress = interpolate(
    frame,
    [fNetworkStart + Math.floor(totalFrames * 0.02), fReadDb + Math.floor(totalFrames * 0.04)],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Precise Bezier curve coordinates inside the Stage box (992px wide)
  // Path A: (250, 240) -> Control: (320, 440) -> DB Entrance: (440, 620)
  const pA = packetAProgress;
  const packetAX = (1 - pA) * (1 - pA) * 250 + 2 * (1 - pA) * pA * 320 + pA * pA * 440;
  const packetAY = (1 - pA) * (1 - pA) * 240 + 2 * (1 - pA) * pA * 440 + pA * pA * 620;

  // Path B: (742, 240) -> Control: (672, 440) -> DB Entrance: (552, 620)
  const pB = packetBProgress;
  const packetBX = (1 - pB) * (1 - pB) * 742 + 2 * (1 - pB) * pB * 672 + pB * pB * 552;
  const packetBY = (1 - pB) * (1 - pB) * 240 + 2 * (1 - pB) * pB * 440 + pB * pB * 620;

  // Inventory count: 1 until Aman resolves, then 0
  const stockCount = isAmanResolved ? 0 : 1;

  // Pulsing glow for single seat left indicator
  const pulseOpacity = interpolate(
    Math.sin((frame / fps) * 8),
    [-1, 1],
    [0.7, 1.0]
  );

  return (
    <AbsoluteFill
      style={{
        paddingTop: 130, // Safe zone protection: 130px top padding
        paddingBottom: 440, // Generous 440px bottom padding leaves subtitles completely unhindered
        paddingLeft: 44,
        paddingRight: 44,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        fontFamily: VideoDesignTokens.typography.fontFamilySans,
        color: '#FFFFFF',
        boxSizing: 'border-box',
        zIndex: 5,
      }}
    >
      {/* SFX Audio Triggers */}
      {/* 1. Whoosh entrance */}
      <Sequence from={0} durationInFrames={25}>
        <Audio src={staticFile('sfx/whoosh.wav')} volume={0.45} />
      </Sequence>

      {/* 2. Pop when Aman clicks */}
      <Sequence from={fClickAman} durationInFrames={18}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.7} />
      </Sequence>

      {/* 3. Pop when Riya clicks */}
      <Sequence from={fClickRiya} durationInFrames={18}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.7} />
      </Sequence>

      {/* 4. Ding when Aman's booking succeeds */}
      <Sequence from={fResolveAman} durationInFrames={35}>
        <Audio src={staticFile('sfx/ding.wav')} volume={0.85} />
      </Sequence>

      {/* 5. Buzzer when Riya's booking is rejected */}
      <Sequence from={fResolveRiya} durationInFrames={35}>
        <Audio src={staticFile('sfx/buzzer.wav')} volume={0.75} />
      </Sequence>

      {/* ========================================================
          ZONE 1: HUD HEADER & REALISTIC CONCERT TICKET
          ======================================================== */}
      <div style={{ transform: `scale(${entrance})`, transformOrigin: 'top center', marginBottom: 16 }}>
        {/* Top category badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 20px',
              borderRadius: 24,
              background: 'rgba(250, 204, 21, 0.10)',
              border: '1.5px solid rgba(250, 204, 21, 0.5)',
              boxShadow: '0 0 16px rgba(250, 204, 21, 0.2)',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#FACC15',
                boxShadow: '0 0 8px #FACC15',
              }}
            />
            <span
              style={{
                color: '#FACC15',
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              {title}
            </span>
          </div>
        </div>

        {/* Realistic Concert Ticket Card */}
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #0F172A 0%, #0B1120 100%)',
            border: '1.5px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 20,
            padding: '16px 22px',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.65)',
            overflow: 'hidden',
          }}
        >
          {/* Mutex resource badge */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: 'linear-gradient(90deg, #38BDF8, #818CF8)',
              padding: '4px 16px',
              borderBottomLeftRadius: 14,
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 1.2,
              color: '#000000',
              textTransform: 'uppercase',
            }}
          >
            CRITICAL MUTEX
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
              }}
            >
              <LottieAsset name="lock" style={{ width: 44, height: 44 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', letterSpacing: -0.3 }}>
                {itemTitle}
              </div>
              <div style={{ fontSize: 15, color: '#94A3B8', marginTop: 3 }}>
                Shared Distributed Resource • Atomic Mutex Lock
              </div>
            </div>

            {/* Inventory / Lock Status Pill */}
            <div
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                background: stockCount > 0 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.2)',
                border: stockCount > 0 ? '1.5px solid #38BDF8' : '1.5px solid #EF4444',
                color: stockCount > 0 ? '#38BDF8' : '#F87171',
                fontWeight: 900,
                fontSize: 16,
                letterSpacing: 0.5,
                opacity: stockCount > 0 ? pulseOpacity : 1,
                boxShadow: stockCount > 0 ? '0 0 16px rgba(56, 189, 248, 0.3)' : '0 0 16px rgba(239, 68, 68, 0.3)',
              }}
            >
              {stockCount > 0 ? '🔓 MUTEX UNLOCKED' : '🔐 LOCK ACQUIRED'}
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          ZONE 2 & 3: INTEGRATED INTERACTIVE SIMULATOR STAGE
          (Dual Clients + SVG Bezier Highway + Database Engine)
          ======================================================== */}
      <div
        style={{
          position: 'relative',
          height: 1060,
          background: 'rgba(3, 7, 18, 0.88)',
          borderRadius: 24,
          border: '1.5px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.85)',
          padding: '16px 20px',
          overflow: 'hidden',
        }}
      >
        {/* SVG Bezier Connection Lanes */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          {/* Path A (Left User -> DB Entrance) */}
          <path
            d="M 250 240 Q 320 440 440 620"
            fill="none"
            stroke={isAmanClicked ? 'rgba(0, 242, 254, 0.7)' : 'rgba(0, 242, 254, 0.25)'}
            strokeWidth={isAmanClicked ? '3.5' : '2'}
            strokeDasharray="6 6"
          />
          {/* Path B (Right User -> DB Entrance) */}
          <path
            d="M 742 240 Q 672 440 552 620"
            fill="none"
            stroke={isRiyaClicked ? 'rgba(245, 158, 11, 0.7)' : 'rgba(245, 158, 11, 0.25)'}
            strokeWidth={isRiyaClicked ? '3.5' : '2'}
            strokeDasharray="6 6"
          />
        </svg>

        {/* Section Headline */}
        <div style={{ textAlign: 'center', marginBottom: 12, zIndex: 10, position: 'relative' }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: '#38BDF8',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              background: 'rgba(56, 189, 248, 0.1)',
              padding: '4px 14px',
              borderRadius: 12,
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            STEPS 2–6: 2 CONCURRENT REQUESTS • 4ms DELTA • ATOMIC ENGINE
          </span>
        </div>

        {/* Two User Phone Mockups */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            position: 'relative',
            zIndex: 10,
            transform: `scale(${step2Entrance})`,
          }}
        >
          {/* USER A (Aman) */}
          <div
            style={{
              width: 440,
              background: isAmanResolved
                ? 'rgba(16, 185, 129, 0.18)'
                : isAmanClicked
                ? 'rgba(15, 23, 42, 0.96)'
                : 'rgba(15, 23, 42, 0.90)',
              border: isAmanResolved
                ? '2.5px solid #10B981'
                : isAmanClicked
                ? '2px solid #00F2FE'
                : '1.5px solid rgba(56, 189, 248, 0.4)',
              borderRadius: 20,
              padding: 16,
              boxShadow: isAmanResolved
                ? '0 0 35px rgba(16, 185, 129, 0.45)'
                : '0 10px 25px rgba(0, 0, 0, 0.5)',

            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>👤</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF' }}>{user1Name}</span>
              </div>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 15,
                  fontWeight: 800,
                  color: isAmanClicked ? '#00F2FE' : '#94A3B8',
                  background: 'rgba(0, 0, 0, 0.6)',
                  padding: '3px 10px',
                  borderRadius: 6,
                  border: isAmanClicked ? '1px solid #00F2FE' : '1px solid #334155',
                }}
              >
                {isAmanClicked ? '20:00:00.120' : 'Idle'}
              </span>
            </div>

            {/* User A Screen Preview */}
            <div
              style={{
                marginTop: 12,
                background: '#0B0F19',
                borderRadius: 14,
                padding: '12px 14px',
                border: '1px solid #1E293B',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#94A3B8', marginBottom: 8 }}>
                <span>{itemTitle || 'Critical Resource'}</span>
                <span style={{ color: stockCount > 0 ? '#10B981' : '#EF4444', fontWeight: 800 }}>
                  {isAmanResolved ? 'LOCK ACQUIRED' : 'MUTEX AVAILABLE'}
                </span>
              </div>

              {/* Action Button */}
              <div
                style={{
                  background: isAmanResolved
                    ? '#10B981'
                    : isAmanClicked
                    ? '#0284C7'
                    : '#FACC15',
                  color: isAmanResolved ? '#FFFFFF' : '#000000',
                  fontWeight: 900,
                  fontSize: 17,
                  padding: '10px 12px',
                  borderRadius: 10,
                  textAlign: 'center',
                  boxShadow: isAmanResolved
                    ? '0 0 20px #10B981'
                    : isAmanClicked
                    ? '0 0 15px #0284C7'
                    : '0 0 15px rgba(250, 204, 21, 0.5)',
                  transform: isAmanClicked && !isAmanResolved ? 'scale(0.95)' : 'scale(1.0)',

                }}
              >
                {isAmanResolved
                  ? '✅ 200 OK • ACQUIRED'
                  : isAmanClicked
                  ? '⏳ ACQUIRING...'
                  : '⚡ DISPATCH REQUEST'}
              </div>
            </div>

            {isAmanResolved && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#10B981',
                  textAlign: 'center',
                  letterSpacing: 0.5,
                }}
              >
                🎉 1 ROW UPDATED • WINNER
              </div>
            )}
          </div>

          {/* USER B (Riya) */}
          <div
            style={{
              width: 440,
              background: isRiyaResolved
                ? 'rgba(239, 68, 68, 0.18)'
                : isRiyaClicked
                ? 'rgba(15, 23, 42, 0.96)'
                : 'rgba(15, 23, 42, 0.90)',
              border: isRiyaResolved
                ? '2.5px solid #EF4444'
                : isRiyaClicked
                ? '2px solid #F59E0B'
                : '1.5px solid rgba(245, 158, 11, 0.4)',
              borderRadius: 20,
              padding: 16,
              boxShadow: isRiyaResolved
                ? '0 0 35px rgba(239, 68, 68, 0.45)'
                : '0 10px 25px rgba(0, 0, 0, 0.5)',

            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>👤</span>
                <span style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF' }}>{user2Name}</span>
              </div>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 15,
                  fontWeight: 800,
                  color: isRiyaClicked ? '#F59E0B' : '#94A3B8',
                  background: 'rgba(0, 0, 0, 0.6)',
                  padding: '3px 10px',
                  borderRadius: 6,
                  border: isRiyaClicked ? '1px solid #F59E0B' : '1px solid #334155',
                }}
              >
                {isRiyaClicked ? '20:00:00.124' : 'Idle'}
              </span>
            </div>

            {/* User B Screen Preview */}
            <div
              style={{
                marginTop: 12,
                background: '#0B0F19',
                borderRadius: 14,
                padding: '12px 14px',
                border: '1px solid #1E293B',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#94A3B8', marginBottom: 8 }}>
                <span>{itemTitle || 'Critical Resource'}</span>
                <span style={{ color: stockCount > 0 ? '#10B981' : '#EF4444', fontWeight: 800 }}>
                  {isRiyaResolved ? 'CONFLICT (409)' : 'MUTEX AVAILABLE'}
                </span>
              </div>

              {/* Action Button */}
              <div
                style={{
                  background: isRiyaResolved
                    ? '#EF4444'
                    : isRiyaClicked
                    ? '#D97706'
                    : '#FACC15',
                  color: isRiyaResolved ? '#FFFFFF' : '#000000',
                  fontWeight: 900,
                  fontSize: 17,
                  padding: '10px 12px',
                  borderRadius: 10,
                  textAlign: 'center',
                  boxShadow: isRiyaResolved
                    ? '0 0 20px #EF4444'
                    : isRiyaClicked
                    ? '0 0 15px #D97706'
                    : '0 0 15px rgba(250, 204, 21, 0.5)',
                  transform: isRiyaClicked && !isRiyaResolved ? 'scale(0.95)' : 'scale(1.0)',

                }}
              >
                {isRiyaResolved
                  ? '❌ 409 CONFLICT'
                  : isRiyaClicked
                  ? '⏳ ACQUIRING...'
                  : '⚡ DISPATCH REQUEST'}
              </div>
            </div>

            {isRiyaResolved && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 14,
                  fontWeight: 800,
                  color: '#EF4444',
                  textAlign: 'center',
                  letterSpacing: 0.5,
                }}
              >
                ❌ 0 ROWS UPDATED • 4ms LATE
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Request Packet A traveling down */}
        {isAmanClicked && !isAmanResolved && (
          <div
            style={{
              position: 'absolute',
              left: packetAX,
              top: packetAY,
              padding: '6px 14px',
              borderRadius: 14,
              background: '#00F2FE',
              boxShadow: '0 0 25px #00F2FE, 0 0 50px rgba(0, 242, 254, 0.6)',
              color: '#000000',
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: 0.8,
              transform: 'translate(-50%, -50%)',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>⚡ REQ_A (.120)</span>
          </div>
        )}

        {/* Dynamic Request Packet B traveling down */}
        {isRiyaClicked && !isRiyaResolved && (
          <div
            style={{
              position: 'absolute',
              left: packetBX,
              top: packetBY,
              padding: '6px 14px',
              borderRadius: 14,
              background: '#F59E0B',
              boxShadow: '0 0 25px #F59E0B, 0 0 50px rgba(245, 158, 11, 0.6)',
              color: '#000000',
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: 0.8,
              transform: 'translate(-50%, -50%)',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>⚡ REQ_B (.124)</span>
          </div>
        )}

        {/* ========================================================
            INTEGRATED DATABASE & ATOMIC RESOLUTION CONTAINER
            ======================================================== */}
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            right: 20,
            background: 'rgba(7, 12, 24, 0.98)',
            border: '2px solid rgba(56, 189, 248, 0.45)',
            borderRadius: 22,
            padding: '18px 22px',
            boxShadow: '0 15px 45px rgba(0, 0, 0, 0.75)',
            zIndex: 15,
            transform: `scale(${dbEntrance})`,
          }}
        >
          {/* DB Header with Real-time Stock Counter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 32 }}>🗄️</span>
              <div>
                <div style={{ fontSize: 23, fontWeight: 900, color: '#38BDF8', letterSpacing: -0.2 }}>
                  PostgreSQL Transaction Engine
                </div>
                <div style={{ fontSize: 14, color: '#94A3B8' }}>
                  Single Source of Truth • ACID Concurrency Guard
                </div>
              </div>
            </div>

            {/* Atomic Stock Pill */}
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 22,
                fontWeight: 900,
                color: stockCount > 0 ? '#10B981' : '#EF4444',
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '6px 20px',
                borderRadius: 14,
                border: `2px solid ${stockCount > 0 ? '#10B981' : '#EF4444'}`,
                boxShadow: stockCount > 0 ? '0 0 20px rgba(16, 185, 129, 0.3)' : '0 0 20px rgba(239, 68, 68, 0.3)',
              }}
            >
              INVENTORY: {stockCount}
            </div>
          </div>

          {/* Step 5: Concurrency Read Inspection Box */}
          {isDbReading && !isAmanResolved && (
            <div
              style={{
                marginTop: 14,
                background: 'rgba(245, 158, 11, 0.14)',
                border: '1.5px solid rgba(245, 158, 11, 0.65)',
                borderRadius: 14,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <span style={{ color: '#FACC15', fontWeight: 800, fontSize: 16 }}>
                  STEP 5: BOTH THREADS INITIALLY READ STOCK = 1
                </span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#E2E8F0' }}>
                Thread A: 1 | Thread B: 1
              </div>
            </div>
          )}

          {/* Step 6: Atomic Conditional Write Execution */}
          <div
            style={{
              marginTop: 12,
              background: '#000000',
              padding: '12px 18px',
              borderRadius: 14,
              fontFamily: 'monospace',
              fontSize: 16,
              color: '#FACC15',
              border: '1px solid rgba(250, 204, 21, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              overflow: 'hidden',
            }}
          >
            <span style={{ color: '#10B981', fontWeight: 900 }}>SQL &gt;</span>
            <span style={{ letterSpacing: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {atomicQuery}
            </span>
          </div>

          {/* Bottom Educational Outcome */}
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 14,
              color: '#94A3B8',
            }}
          >
            <span>
              {isAmanResolved
                ? '✅ Atomic conditional check prevents double-allocation!'
                : '⚡ Reading rows without atomic update causes race conditions.'}
            </span>
            <span style={{ color: '#38BDF8', fontWeight: 700 }}>
              {isAmanResolved ? 'Winner: Thread A (+4ms advantage)' : 'Awaiting Commit...'}
            </span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
