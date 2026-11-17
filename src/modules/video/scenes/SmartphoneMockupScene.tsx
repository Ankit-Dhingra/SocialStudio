import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

export interface SmartphoneMockupSceneProps {
  headline?: string;
  subtext?: string;
  appName?: string;
  locationText?: string;
  itemName?: string;
  itemPrice?: string;
  baseDeliveryFee?: string;
  surgeDeliveryFee?: string;
  surgeMultiplier?: string;
  surgeReason?: string;
  onScreenText?: string;
}

export const SmartphoneMockupScene: React.FC<SmartphoneMockupSceneProps> = ({
  headline = 'REAL-TIME SURGE PRICING',
  subtext = 'How delivery fees jump from ₹30 to ₹80 dynamically',
  appName = 'ZOMATO',
  locationText = 'HSR Layout, Sector 4',
  itemName = 'Royal Chicken Dum Biryani',
  itemPrice = '₹350',
  baseDeliveryFee = '₹30',
  surgeDeliveryFee = '₹80',
  surgeMultiplier = '1.8X',
  surgeReason = 'HIGH DEMAND • 120+ ACTIVE ORDERS',
  onScreenText,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Timing milestones:
  // 0 - 60 frames: Normal state (₹30 standard fee)
  // 60 - 75 frames: Surge trigger (rain / demand pulse)
  // 75+ frames: Live fee jump to ₹80 with spring animation
  const fSurgeStart = Math.min(75, Math.floor((durationInFrames || 240) * 0.3));

  // Entrance spring animation
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Surge transition spring
  const surgeSpring = spring({
    frame: Math.max(0, frame - fSurgeStart),
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  const isSurgeActive = frame >= fSurgeStart;

  // Subtle 3D floating perspective tilt
  const rotY = Math.sin(frame / 35) * 3;
  const rotX = Math.cos(frame / 30) * 2 + 2;
  const floatY = Math.sin(frame / 20) * 8;

  // Dynamic Island pulse when surge triggers
  const islandPulse = isSurgeActive
    ? 1 + Math.sin((frame - fSurgeStart) / 8) * 0.05
    : 1;

  // Glow pulse for surge card
  const surgePulse = isSurgeActive
    ? 0.5 + Math.sin(frame / 8) * 0.3
    : 0;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: VideoDesignTokens.safeMargin.top,
        paddingBottom: VideoDesignTokens.safeMargin.bottom,
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      {/* Top Header Badge */}
      <div
        style={{
          transform: `scale(${entrance})`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 28px',
          background: isSurgeActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)',
          border: `1.5px solid ${isSurgeActive ? 'rgba(239, 68, 68, 0.5)' : 'rgba(56, 189, 248, 0.4)'}`,
          borderRadius: 999,
          marginBottom: 16,
          boxShadow: isSurgeActive ? '0 0 25px rgba(239, 68, 68, 0.3)' : '0 0 20px rgba(56, 189, 248, 0.2)',
          transition: 'all 0.3s ease',
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: isSurgeActive ? '#EF4444' : '#38BDF8',
            boxShadow: `0 0 12px ${isSurgeActive ? '#EF4444' : '#38BDF8'}`,
          }}
        />
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: 3,
            color: isSurgeActive ? '#FCA5A5' : '#E0F2FE',
            textTransform: 'uppercase',
          }}
        >
          {isSurgeActive ? 'LIVE DEMAND SURGE DETECTED' : 'SYSTEM ARCHITECTURE BREAKDOWN'}
        </span>
      </div>

      {/* Main Catchy Hook Headline */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 20,
          transform: `scale(${entrance})`,
          padding: '0 50px',
        }}
      >
        <h1
          style={{
            fontSize: 58,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.15,
            margin: '0 0 8px 0',
            textShadow: '0 4px 30px rgba(0, 0, 0, 0.8)',
          }}
        >
          {onScreenText || headline}
        </h1>
        <p
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: '#94A3B8',
            margin: 0,
          }}
        >
          {subtext}
        </p>
      </div>

      {/* Realistic iPhone 16 Pro 3D Mockup */}
      <div
        style={{
          transform: `perspective(1400px) rotateY(${rotY}deg) rotateX(${rotX}deg) translateY(${floatY}px) scale(${entrance})`,
          width: 520,
          height: 1040,
          background: 'linear-gradient(180deg, #0d1117 0%, #06090e 100%)',
          borderRadius: 56,
          border: '4.5px solid rgba(255, 255, 255, 0.18)',
          boxShadow: `0 40px 90px rgba(0, 0, 0, 0.95), 0 0 70px ${
            isSurgeActive ? `rgba(239, 68, 68, ${0.25 + surgePulse * 0.2})` : 'rgba(56, 189, 248, 0.15)'
          }`,
          position: 'relative',
          padding: '16px 22px 24px 22px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* iOS Native Status Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 14px 10px 14px',
            fontSize: 16,
            fontWeight: 700,
            color: '#FFFFFF',
          }}
        >
          <span>9:41</span>
          {/* Real Dynamic Island */}
          <div
            style={{
              width: isSurgeActive ? 150 : 124,
              height: 32,
              background: '#000000',
              borderRadius: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              transform: `scale(${islandPulse})`,
              transition: 'width 0.3s ease',
            }}
          >
            {/* Camera dot */}
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1c1c1e' }} />
            {isSurgeActive && (
              <span style={{ fontSize: 11, fontWeight: 800, color: '#EF4444', letterSpacing: 0.5 }}>
                ⚡ 1.8X SURGE
              </span>
            )}
            {/* Sensor / Mic indicator */}
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSurgeActive ? '#EF4444' : '#10B981' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>5G</span>
            <div style={{ width: 22, height: 12, border: '1.5px solid #FFF', borderRadius: 4, padding: 1.5 }}>
              <div style={{ width: '80%', height: '100%', background: '#10B981', borderRadius: 2 }} />
            </div>
          </div>
        </div>

        {/* In-App Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0 14px 0',
            borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                background: '#E23744',
                color: '#FFF',
                fontWeight: 900,
                fontSize: 18,
                padding: '6px 12px',
                borderRadius: 10,
                letterSpacing: 1.2,
                boxShadow: '0 4px 15px rgba(226, 55, 68, 0.4)',
              }}
            >
              {appName}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#F8FAFC' }}>Delivery to Work</div>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>{locationText}</div>
            </div>
          </div>
          <div
            style={{
              padding: '6px 12px',
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.06)',
              fontSize: 13,
              fontWeight: 700,
              color: '#38BDF8',
            }}
          >
            ⏱️ 18-24 MINS
          </div>
        </div>

        {/* Order Item Card */}
        <div
          style={{
            marginTop: 18,
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 20,
            padding: '16px 18px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>{itemName}</div>
            <div style={{ fontSize: 14, color: '#10B981', marginTop: 4, fontWeight: 700 }}>★ 4.9 (3.2k reviews)</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#F1F5F9', marginTop: 6 }}>{itemPrice}</div>
          </div>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #FF6B6B 0%, #E23744 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              boxShadow: '0 8px 20px rgba(226, 55, 68, 0.3)',
            }}
          >
            🍛
          </div>
        </div>

        {/* LIVE DELIVERY FEE CARD WITH ANIMATED SURGE SHIFT */}
        <div
          style={{
            marginTop: 18,
            borderRadius: 22,
            padding: '20px 22px',
            background: isSurgeActive
              ? `linear-gradient(145deg, rgba(239, 68, 68, 0.22) 0%, rgba(153, 27, 27, 0.12) 100%)`
              : 'rgba(255, 255, 255, 0.03)',
            border: isSurgeActive
              ? `2px solid rgba(239, 68, 68, ${0.5 + surgePulse * 0.4})`
              : '1.5px solid rgba(255, 255, 255, 0.08)',
            boxShadow: isSurgeActive
              ? `0 12px 35px rgba(239, 68, 68, ${0.3 + surgePulse * 0.25})`
              : 'none',
            position: 'relative',
            overflow: 'hidden',
            transition: 'border 0.3s ease, background 0.3s ease',
          }}
        >
          {/* Card Title Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{isSurgeActive ? '⚡' : '🛵'}</span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: 1.2,
                  color: isSurgeActive ? '#EF4444' : '#94A3B8',
                  textTransform: 'uppercase',
                }}
              >
                {isSurgeActive ? 'SURGE PRICING ACTIVE' : 'DELIVERY PARTNER FEE'}
              </span>
            </div>
            {isSurgeActive && (
              <div
                style={{
                  background: '#EF4444',
                  color: '#FFFFFF',
                  fontWeight: 900,
                  fontSize: 15,
                  padding: '4px 12px',
                  borderRadius: 20,
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.5)',
                  transform: `scale(${surgeSpring})`,
                }}
              >
                {surgeMultiplier}
              </div>
            )}
          </div>

          {/* Price Flip Display */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 14 }}>
            {isSurgeActive ? (
              <>
                {/* Strikethrough Base Price */}
                <div
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    color: '#64748B',
                    textDecoration: 'line-through',
                  }}
                >
                  {baseDeliveryFee}
                </div>
                {/* Animated Surge Fee */}
                <div
                  style={{
                    fontSize: 42,
                    fontWeight: 900,
                    color: '#FFFFFF',
                    transform: `scale(${surgeSpring})`,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 8,
                  }}
                >
                  <span style={{ color: '#EF4444' }}>{surgeDeliveryFee}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#FCA5A5' }}>(+₹50 Surge)</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 36, fontWeight: 900, color: '#10B981' }}>
                {baseDeliveryFee}
                <span style={{ fontSize: 16, fontWeight: 600, color: '#94A3B8', marginLeft: 10 }}>Standard Rate</span>
              </div>
            )}
          </div>

          {/* Subtext info */}
          <div style={{ fontSize: 14, color: isSurgeActive ? '#FCA5A5' : '#64748B', marginTop: 8, lineHeight: 1.4 }}>
            {isSurgeActive ? surgeReason : 'Calculated by distance & route traffic'}
          </div>
        </div>

        {/* Live Calculation Metric Pill */}
        <div
          style={{
            marginTop: 18,
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 16,
            padding: '12px 16px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>Algorithm:</span>
          <span style={{ fontSize: 14, color: '#38BDF8', fontWeight: 800 }}>H3 Geospatial Index (&lt;10ms)</span>
        </div>

        {/* Bottom Checkout CTA Button */}
        <div
          style={{
            marginTop: 'auto',
            background: isSurgeActive ? '#DC2626' : '#10B981',
            borderRadius: 18,
            padding: '18px 0',
            textAlign: 'center',
            color: '#FFFFFF',
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: 1.2,
            boxShadow: isSurgeActive
              ? '0 10px 30px rgba(220, 38, 38, 0.5)'
              : '0 10px 25px rgba(16, 185, 129, 0.35)',
            transform: isSurgeActive ? `scale(${1 + Math.sin(frame / 6) * 0.02})` : 'scale(1)',
            transition: 'background 0.3s ease',
          }}
        >
          {isSurgeActive ? 'PAY ₹430 • SURGE APPLIED' : 'PROCEED TO PAY • ₹380'}
        </div>
      </div>
    </AbsoluteFill>
  );
};
