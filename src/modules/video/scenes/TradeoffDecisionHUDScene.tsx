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
  channelName?: string;
  channelHandle?: string;
}

export const TradeoffDecisionHUDScene: React.FC<TradeoffDecisionHUDSceneProps> = ({
  title = 'THE SYSTEM DESIGN TRADEOFF',
  subtitle = 'Which architecture strategy would you defend in an interview?',
  optionA_Title = 'OPTION A: IN-MEMORY ATOMIC CACHE',
  optionA_Pros = 'Sub-millisecond latency & zero disk lock contention',
  optionA_Cons = 'Requires memory allocation & cache invalidation logic',
  optionB_Title = 'OPTION B: DURABLE DATABASE TRANSACTIONS',
  optionB_Pros = 'Strict ACID compliance across distributed stores',
  optionB_Cons = 'Connection contention & lock queue latency',
  interviewPoints = [
    'Decouple hot read/write paths using in-memory state',
    'Use atomic locks with auto-expiring leases (TTL) to prevent deadlocks',
    'Ensure graceful degradation during network partitions and server crashes',
  ],
  callToAction = 'Save this reel for your System Design Interview & follow for more!',
  channelName = 'Behind The Tech',
  channelHandle = '@behindthestack',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  const p1 = interviewPoints[0] || 'Price signals live supply-demand deficit, not static distance alone';
  const p2 = interviewPoints[1] || 'Spatial indexing converts lookups to in-memory O(1) cell IDs';
  const p3 = interviewPoints[2] || 'Heartbeat TTL freshness checks prevent stale cache anomalies';

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
        paddingTop: VideoDesignTokens.safeMargin.top,
        paddingBottom: VideoDesignTokens.safeMargin.bottom,
        paddingLeft: VideoDesignTokens.safeMargin.left,
        paddingRight: VideoDesignTokens.safeMargin.right,
        justifyContent: 'space-between',
        fontFamily: VideoDesignTokens.typography.fontFamilySans,
        color: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      {/* Header Pill & Title */}
      <div style={{ transform: `scale(${entrance})`, textAlign: 'center', zIndex: 10 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 24px',
            background: frame >= 350 ? 'rgba(56, 189, 248, 0.15)' : 'rgba(234, 179, 8, 0.15)',
            border: `1.5px solid ${frame >= 350 ? 'rgba(56, 189, 248, 0.5)' : 'rgba(234, 179, 8, 0.5)'}`,
            borderRadius: 30,
            marginBottom: 10,
            boxShadow: frame >= 350 ? '0 0 25px rgba(56, 189, 248, 0.25)' : '0 0 25px rgba(234, 179, 8, 0.25)',
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: frame >= 350 ? '#38BDF8' : '#EAB308',
              boxShadow: `0 0 10px ${frame >= 350 ? '#38BDF8' : '#EAB308'}`,
            }}
          />
          <span
            style={{
              fontSize: 18,
              fontWeight: 900,
              letterSpacing: 3,
              color: frame >= 350 ? '#38BDF8' : '#FDE047',
              textTransform: 'uppercase',
            }}
          >
            {frame >= 350 ? 'Behind The Tech • EXCLUSIVE' : 'SENIOR SDE INTERVIEW MATRIX'}
          </span>
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px 0' }}>
          {frame >= 350 ? 'FOLLOW FOR DEEP SYSTEM DESIGN' : title}
        </h1>
        <p style={{ fontSize: 22, fontWeight: 600, color: '#94A3B8', margin: 0 }}>
          {frame >= 350 ? 'Decoding complex engineering systems behind tech giants' : subtitle}
        </p>
      </div>

      {/* Dynamic Cut Switch: Cut 4.1 (SDE Cheat-Sheet HUD) vs Cut 4.2 (Screenshot Moment & Behind The Tech Follow CTA) */}
      {frame < 350 ? (
        /* CUT 4.1: SDE INTERVIEW CHEAT-SHEET HUD (Frames 0 to 350 / 0s - 12s) */
        <div
          style={{
            position: 'absolute',
            top: 360,
            bottom: 530,
            left: 60,
            right: 140,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 20,
            zIndex: 30,
            transform: `scale(${entrance})`,
          }}
        >
          {/* Pillar 1 */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)',
              border: '1.5px solid rgba(56, 189, 248, 0.5)',
              borderRadius: 22,
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1.5px solid #38BDF8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              1
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.3 }}>
                {p1}
              </div>
            </div>
          </div>

          {/* Pillar 2 */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)',
              border: '1.5px solid rgba(16, 185, 129, 0.5)',
              borderRadius: 22,
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1.5px solid #10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              2
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.3 }}>
                {p2}
              </div>
            </div>
          </div>

          {/* Pillar 3 */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)',
              border: '1.5px solid rgba(245, 158, 11, 0.5)',
              borderRadius: 22,
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1.5px solid #F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              3
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.3 }}>
                {p3}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CUT 4.2: VIRAL SCREENSHOT MOMENT & Behind The Tech FOLLOW CTA (Frames 350 to end / 12s - 24s) */
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
            transform: `scale(${spring({ frame: frame - 350, fps, config: { damping: 14, stiffness: 100 } })})`,
          }}
        >
          {/* Prominent Screenshot Banner */}
          <div
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(15, 23, 42, 0.98) 100%)',
              border: '2px solid #EAB308',
              borderRadius: 26,
              padding: '20px 24px',
              textAlign: 'center',
              boxShadow: '0 0 40px rgba(234, 179, 8, 0.4)',
              transform: `scale(${1 + Math.sin(frame / 6) * 0.02})`,
            }}
          >
            <div style={{ fontSize: 32 }}>📸 📌</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', marginTop: 6 }}>
              TAKE A SCREENSHOT NOW
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#FDE047', marginTop: 4 }}>
              Bookmark for your next Senior SDE System Design interview
            </div>
          </div>

          {/* Behind The Tech Follow Card */}
          <div
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.95) 100%)',
              border: '2px solid rgba(56, 189, 248, 0.6)',
              borderRadius: 28,
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 35px rgba(56, 189, 248, 0.3)',
            }}
          >
            {/* Channel Logo Icon */}
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: 24,
                background: 'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
                boxShadow: '0 10px 30px rgba(0, 242, 254, 0.5)',
                marginBottom: 14,
              }}
            >
              ⚡
            </div>

            <div style={{ fontSize: 30, fontWeight: 900, color: '#FFFFFF' }}>
              {channelName}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#38BDF8', marginTop: 2 }}>
              {channelHandle}
            </div>

            <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 10, maxWidth: 380 }}>
              Decoding complex engineering systems behind real-world tech giants.
            </div>

            {/* Glowing Pulsing Follow Button */}
            <div
              style={{
                marginTop: 20,
                background: 'linear-gradient(135deg, #38BDF8 0%, #0284C7 100%)',
                color: '#FFFFFF',
                fontWeight: 900,
                fontSize: 20,
                letterSpacing: 1.5,
                padding: '14px 44px',
                borderRadius: 999,
                boxShadow: '0 0 30px rgba(56, 189, 248, 0.6)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                transform: `scale(${1 + Math.sin(frame / 5) * 0.04})`,
              }}
            >
              <span>FOLLOW NOW</span>
              <span style={{ fontSize: 22 }}>🔔</span>
            </div>
          </div>
        </div>
      )}

      {/* Camera Shutter Flash Overlay at Frame 350 */}
      {frame >= 350 && frame < 365 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: '#FFFFFF',
            opacity: interpolate(frame, [350, 354, 365], [0, 0.85, 0]),
            pointerEvents: 'none',
            zIndex: 100,
          }}
        />
      )}
    </AbsoluteFill>
  );
};
