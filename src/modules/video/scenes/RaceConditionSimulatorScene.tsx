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

interface RaceConditionSimulatorProps {
  title?: string;
  itemTitle?: string;
  user1Name?: string;
  user2Name?: string;
  atomicQuery?: string;
}

export const RaceConditionSimulatorScene: React.FC<RaceConditionSimulatorProps> = ({
  title = 'SYSTEM DESIGN • CONCURRENCY',
  itemTitle = 'iPhone 16 Pro (Stock: 1)',
  user1Name = 'Aman',
  user2Name = 'Riya',
  atomicQuery = 'UPDATE products SET stock = stock - 1 WHERE id = 1 AND stock > 0;',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Camera Punch-In Motion (Retention zoom: 1.00 -> 1.04)
  const cameraZoom = interpolate(frame, [0, 80], [1.0, 1.03], {
    extrapolateRight: 'clamp',
  });

  // Entrance spring for cards
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Timings for actions:
  // Frame 0-15: Interviewer question appears
  // Frame 15: Aman clicks "Buy Now" (t=18:00:00.412)
  // Frame 22: Riya clicks "Buy Now" (t=18:00:00.415)
  // Frame 15-45: Aman's packet travels along bezier curve down to DB
  // Frame 22-55: Riya's packet travels along bezier curve down to DB
  // Frame 45: DB decrements stock from 1 -> 0 (Aman succeeds!) -> Ding SFX
  // Frame 55: Riya's request hits 0 rows -> Fails! -> Buzzer SFX
  // Frame 65+: Solution / Atomic query highlight

  const amanClickFrame = 15;
  const riyaClickFrame = 22;
  const amanArrivalFrame = 45;
  const riyaArrivalFrame = 55;

  const isAmanClicked = frame >= amanClickFrame;
  const isRiyaClicked = frame >= riyaClickFrame;
  const isAmanArrived = frame >= amanArrivalFrame;
  const isRiyaArrived = frame >= riyaArrivalFrame;

  // Aman packet progress: 0 to 1
  const amanProgress = interpolate(frame, [amanClickFrame, amanArrivalFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Riya packet progress: 0 to 1
  const riyaProgress = interpolate(frame, [riyaClickFrame, riyaArrivalFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Bezier curve interpolation for packets:
  // Left path: From (240, 480) down through control point (320, 680) to DB (480, 880)
  const amanX = (1 - amanProgress) * 240 + amanProgress * 480;
  const amanY =
    (1 - amanProgress) * (1 - amanProgress) * 480 +
    2 * (1 - amanProgress) * amanProgress * 680 +
    amanProgress * amanProgress * 880;

  // Right path: From (840, 480) down through control point (760, 680) to DB (600, 880)
  const riyaX = (1 - riyaProgress) * 840 + riyaProgress * 600;
  const riyaY =
    (1 - riyaProgress) * (1 - riyaProgress) * 480 +
    2 * (1 - riyaProgress) * riyaProgress * 680 +
    riyaProgress * riyaProgress * 880;

  const currentStock = isAmanArrived ? 0 : 1;

  // Typewriter effect for question
  const questionText = '1 iPhone bacha hai. 2 log. Same second. Order kisko milega?';
  const charsToShow = Math.min(questionText.length, Math.floor(frame * 1.5));
  const displayedQuestion = questionText.slice(0, charsToShow);

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${cameraZoom})`,
        transformOrigin: 'center center',
        paddingTop: 80,
        paddingBottom: 220,
        paddingLeft: 40,
        paddingRight: 40,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: VideoDesignTokens.typography.fontFamilySans,
        color: '#FFFFFF',
      }}
    >
      {/* SFX Audio Triggers */}
      {/* 1. Whoosh entrance at start */}
      <Sequence from={0} durationInFrames={20}>
        <Audio src={staticFile('sfx/whoosh.wav')} volume={0.5} />
      </Sequence>

      {/* 2. Pop when Aman clicks */}
      <Sequence from={amanClickFrame} durationInFrames={15}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.7} />
      </Sequence>

      {/* 3. Pop when Riya clicks */}
      <Sequence from={riyaClickFrame} durationInFrames={15}>
        <Audio src={staticFile('sfx/pop.wav')} volume={0.7} />
      </Sequence>

      {/* 4. Ding when Aman's order confirms */}
      <Sequence from={amanArrivalFrame} durationInFrames={30}>
        <Audio src={staticFile('sfx/ding.wav')} volume={0.8} />
      </Sequence>

      {/* 5. Buzzer when Riya's order fails */}
      <Sequence from={riyaArrivalFrame} durationInFrames={30}>
        <Audio src={staticFile('sfx/buzzer.wav')} volume={0.65} />
      </Sequence>

      {/* Top Header Category Pill */}
      <div style={{ textAlign: 'center', transform: `scale(${entrance})` }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 24px',
            borderRadius: 30,
            background: 'rgba(250, 204, 21, 0.12)',
            border: '1.5px solid rgba(250, 204, 21, 0.6)',
            boxShadow: '0 0 20px rgba(250, 204, 21, 0.25)',
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#FACC15', boxShadow: '0 0 8px #FACC15' }} />
          <span
            style={{
              color: '#FACC15',
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </span>
        </div>
      </div>

      {/* Interviewer Prompt Speech Card */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.92)',
          border: '1.5px solid rgba(56, 189, 248, 0.4)',
          borderRadius: 24,
          padding: '20px 28px',
          boxShadow: '0 15px 40px rgba(0, 0, 0, 0.6)',
          marginTop: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #00F2FE 0%, #38BDF8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 900,
              color: '#000',
            }}
          >
            💼
          </div>
          <span
            style={{
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: 1.5,
              color: '#38BDF8',
              textTransform: 'uppercase',
            }}
          >
            Interviewer Ne Poocha
          </span>
        </div>
        <div
          style={{
            fontSize: 34,
            fontWeight: 800,
            lineHeight: 1.35,
            color: '#FFFFFF',
          }}
        >
          {displayedQuestion}
        </div>
      </div>

      {/* Central Visual Stage: Aman vs Riya + Center Phone + Database */}
      <div
        style={{
          position: 'relative',
          height: 820,
          background: 'rgba(3, 7, 18, 0.75)',
          borderRadius: 28,
          border: '2px solid rgba(255, 255, 255, 0.08)',
          boxShadow: 'inset 0 0 60px rgba(0, 0, 0, 0.8)',
          padding: 20,
          overflow: 'hidden',
        }}
      >
        {/* SVG Bezier Connection Lines */}
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
          {/* Aman line */}
          <path
            d="M 240 220 Q 320 450 480 620"
            fill="none"
            stroke="rgba(56, 189, 248, 0.4)"
            strokeWidth="3"
            strokeDasharray="6 6"
          />
          {/* Riya line */}
          <path
            d="M 760 220 Q 680 450 520 620"
            fill="none"
            stroke="rgba(245, 158, 11, 0.4)"
            strokeWidth="3"
            strokeDasharray="6 6"
          />
        </svg>

        {/* Top Row: Aman (Left) | Center iPhone (Stock:1) | Riya (Right) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            position: 'relative',
            zIndex: 10,
          }}
        >
          {/* Aman User Card */}
          <div
            style={{
              width: 300,
              background: isAmanArrived ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.95)',
              border: isAmanArrived ? '2px solid #10B981' : '1.5px solid #38BDF8',
              borderRadius: 22,
              padding: 18,
              boxShadow: isAmanArrived ? '0 0 30px rgba(16, 185, 129, 0.4)' : '0 10px 30px rgba(0,0,0,0.5)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 26 }}>👤</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF' }}>{user1Name}</span>
              </div>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 16,
                  color: '#38BDF8',
                  background: 'rgba(56, 189, 248, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                18:00:00.412
              </span>
            </div>

            {/* Mobile Phone Mockup Button */}
            <div
              style={{
                marginTop: 16,
                background: '#0B0F19',
                borderRadius: 14,
                padding: '12px 14px',
                textAlign: 'center',
                border: '1px solid #1E293B',
              }}
            >
              <div
                style={{
                  background: isAmanClicked ? '#10B981' : '#FACC15',
                  color: '#000000',
                  fontWeight: 900,
                  fontSize: 18,
                  padding: '10px 14px',
                  borderRadius: 10,
                  boxShadow: isAmanClicked ? '0 0 15px #10B981' : '0 0 15px rgba(250, 204, 21, 0.5)',
                  transform: isAmanClicked ? 'scale(0.96)' : 'scale(1.0)',
                  transition: 'all 0.15s',
                }}
              >
                {isAmanArrived ? '✅ ORDERED!' : isAmanClicked ? 'BUYING...' : '⚡ BUY NOW'}
              </div>
            </div>
          </div>

          {/* Center Product Showcase */}
          <div
            style={{
              width: 240,
              background: 'rgba(2, 6, 23, 0.9)',
              border: '2px dashed rgba(250, 204, 21, 0.6)',
              borderRadius: 22,
              padding: '16px 14px',
              textAlign: 'center',
              boxShadow: '0 0 25px rgba(250, 204, 21, 0.15)',
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 4 }}>📱</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF' }}>iPhone 16</div>
            <div
              style={{
                marginTop: 8,
                display: 'inline-block',
                background: currentStock > 0 ? '#10B981' : '#EF4444',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: 18,
                padding: '4px 16px',
                borderRadius: 20,
                boxShadow: currentStock > 0 ? '0 0 15px #10B981' : '0 0 15px #EF4444',
              }}
            >
              {currentStock > 0 ? '🔥 1 LEFT' : '❌ SOLD OUT'}
            </div>
          </div>

          {/* Riya User Card */}
          <div
            style={{
              width: 300,
              background: isRiyaArrived ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.95)',
              border: isRiyaArrived ? '2px solid #EF4444' : '1.5px solid #F59E0B',
              borderRadius: 22,
              padding: 18,
              boxShadow: isRiyaArrived ? '0 0 30px rgba(239, 68, 68, 0.4)' : '0 10px 30px rgba(0,0,0,0.5)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 26 }}>👤</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF' }}>{user2Name}</span>
              </div>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: 16,
                  color: '#F59E0B',
                  background: 'rgba(245, 158, 11, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                18:00:00.415
              </span>
            </div>

            {/* Mobile Phone Mockup Button */}
            <div
              style={{
                marginTop: 16,
                background: '#0B0F19',
                borderRadius: 14,
                padding: '12px 14px',
                textAlign: 'center',
                border: '1px solid #1E293B',
              }}
            >
              <div
                style={{
                  background: isRiyaArrived ? '#EF4444' : isRiyaClicked ? '#F59E0B' : '#FACC15',
                  color: '#000000',
                  fontWeight: 900,
                  fontSize: 18,
                  padding: '10px 14px',
                  borderRadius: 10,
                  boxShadow: isRiyaArrived ? '0 0 15px #EF4444' : '0 0 15px rgba(250, 204, 21, 0.5)',
                  transform: isRiyaClicked ? 'scale(0.96)' : 'scale(1.0)',
                  transition: 'all 0.15s',
                }}
              >
                {isRiyaArrived ? '❌ OUT OF STOCK' : isRiyaClicked ? 'BUYING...' : '⚡ BUY NOW'}
              </div>
            </div>
          </div>
        </div>

        {/* Animated Traveling Request Packets */}
        {isAmanClicked && !isAmanArrived && (
          <div
            style={{
              position: 'absolute',
              left: amanX,
              top: amanY - 260,
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#00F2FE',
              boxShadow: '0 0 25px #00F2FE, 0 0 50px #00F2FE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 900,
              color: '#000',
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
            }}
          >
            A
          </div>
        )}

        {isRiyaClicked && !isRiyaArrived && (
          <div
            style={{
              position: 'absolute',
              left: riyaX - 60,
              top: riyaY - 260,
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#F59E0B',
              boxShadow: '0 0 25px #F59E0B, 0 0 50px #F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 900,
              color: '#000',
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
            }}
          >
            R
          </div>
        )}

        {/* Bottom PostgreSQL Database Cylinder */}
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '92%',
            background: 'rgba(3, 7, 18, 0.96)',
            border: '2px solid #38BDF8',
            borderRadius: 22,
            padding: '22px 28px',
            boxShadow: '0 0 45px rgba(56, 189, 248, 0.3)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 32 }}>🗄️</span>
              <div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#38BDF8' }}>
                  PostgreSQL Database
                </div>
                <div style={{ fontSize: 16, color: '#94A3B8' }}>
                  Single Source of Truth
                </div>
              </div>
            </div>

            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 26,
                fontWeight: 900,
                color: currentStock > 0 ? '#10B981' : '#EF4444',
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '6px 20px',
                borderRadius: 14,
                border: `2px solid ${currentStock > 0 ? '#10B981' : '#EF4444'}`,
                boxShadow: currentStock > 0 ? '0 0 20px rgba(16, 185, 129, 0.3)' : '0 0 20px rgba(239, 68, 68, 0.3)',
              }}
            >
              STOCK: {currentStock}
            </div>
          </div>

          {/* Real-world Atomic Query Box */}
          <div
            style={{
              marginTop: 16,
              background: '#000000',
              padding: '14px 18px',
              borderRadius: 14,
              fontFamily: 'monospace',
              fontSize: 20,
              color: '#FACC15',
              border: '1px solid rgba(250, 204, 21, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ color: '#10B981', fontWeight: 900 }}>SQL &gt;</span>
            <span>{atomicQuery}</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
