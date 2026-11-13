import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface SmartphoneMockupSceneProps {
  headline?: string;
  subtext?: string;
  appName?: string;
  locationText?: string;
  itemName?: string;
  itemPrice?: string;
  surgeAmount?: string;
  surgeMultiplier?: string;
  showRejectedStamp?: boolean;
  rejectedFrame?: number;
}

export const SmartphoneMockupScene: React.FC<SmartphoneMockupSceneProps> = ({
  headline = 'HOW ZOMATO DECIDES SURGE FEE',
  subtext = 'Why your delivery fee jumps from ₹30 to ₹80 in seconds',
  appName = 'ZOMATO',
  locationText = 'HSR Layout, Sector 4',
  itemName = 'Royal Chicken Dum Biryani',
  itemPrice = '₹380',
  surgeAmount = '+₹50',
  surgeMultiplier = '1.8X',
  showRejectedStamp = true,
  rejectedFrame = 32,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  // Floating ambient 3D tilt
  const rotY = Math.sin(frame / 25) * 4;
  const rotX = Math.cos(frame / 25) * 3 + 3;
  const floatY = Math.sin(frame / 18) * 10;

  // Surge glow pulse
  const surgeGlow = 0.5 + Math.sin(frame / 6) * 0.4;

  // Rejected stamp spring slam
  const stampSpring = spring({
    frame: frame - rejectedFrame,
    fps,
    config: { mass: 0.5, damping: 9, stiffness: 150 },
  });

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
      }}
    >
      {/* Category Pill */}
      <div
        style={{
          transform: `scale(${entrance})`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 24px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1.5px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 30,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#EF4444',
            boxShadow: '0 0 12px #EF4444',
          }}
        />
        <span
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 3,
            color: '#FDE047',
            textTransform: 'uppercase',
          }}
        >
          SYSTEM DESIGN BREAKDOWN
        </span>
      </div>

      {/* Main Catchy Hook Headline */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 24,
          transform: `scale(${entrance})`,
          padding: '0 40px',
        }}
      >
        <h1
          style={{
            fontSize: 56,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.15,
            margin: '0 0 10px 0',
            textShadow: '0 4px 30px rgba(239, 68, 68, 0.45)',
          }}
        >
          {headline}
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

      {/* 3D Floating Smartphone Frame */}
      <div
        style={{
          transform: `perspective(1200px) rotateY(${rotY}deg) rotateX(${rotX}deg) translateY(${floatY}px) scale(${entrance})`,
          width: 500,
          height: 980,
          background: '#0B0F19',
          borderRadius: 48,
          border: '4px solid rgba(255, 255, 255, 0.15)',
          boxShadow: `0 35px 80px rgba(0, 0, 0, 0.9), 0 0 60px rgba(239, 68, 68, ${surgeGlow * 0.3})`,
          position: 'relative',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Dynamic Island / Camera Notch */}
        <div
          style={{
            width: 130,
            height: 28,
            background: '#000000',
            borderRadius: 20,
            alignSelf: 'center',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 10,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
        </div>

        {/* App Top Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 14,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                background: '#E23744',
                color: '#FFF',
                fontWeight: 900,
                fontSize: 18,
                padding: '4px 10px',
                borderRadius: 8,
                letterSpacing: 1,
              }}
            >
              {appName}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#FFF' }}>Delivery in 18 mins</div>
              <div style={{ fontSize: 14, color: '#94A3B8' }}>{locationText}</div>
            </div>
          </div>
          <div style={{ fontSize: 24 }}>🛵</div>
        </div>

        {/* Order Item Card */}
        <div
          style={{
            marginTop: 18,
            background: 'rgba(255, 255, 255, 0.04)',
            borderRadius: 18,
            padding: 16,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#FFF' }}>{itemName}</div>
            <div style={{ fontSize: 14, color: '#10B981', marginTop: 4 }}>★ 4.8 (2.4k+ reviews)</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#F8FAFC', marginTop: 6 }}>{itemPrice}</div>
          </div>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #FF6B6B 0%, #E23744 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
            }}
          >
            🍛
          </div>
        </div>

        {/* SURGE PRICING ALERT CARD (The Hero Element) */}
        <div
          style={{
            marginTop: 20,
            background: `linear-gradient(145deg, rgba(239, 68, 68, 0.18) 0%, rgba(185, 28, 28, 0.08) 100%)`,
            border: `2px solid rgba(239, 68, 68, ${0.4 + surgeGlow * 0.5})`,
            borderRadius: 20,
            padding: '18px 20px',
            boxShadow: `0 10px 30px rgba(239, 68, 68, ${surgeGlow * 0.25})`,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26 }}>⚡</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: '#EF4444', letterSpacing: 1.5 }}>
                SURGE FEE APPLIED
              </span>
            </div>
            <div
              style={{
                background: '#EF4444',
                color: '#FFF',
                fontWeight: 900,
                fontSize: 16,
                padding: '4px 12px',
                borderRadius: 20,
              }}
            >
              {surgeMultiplier}
            </div>
          </div>

          <div style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', marginTop: 10 }}>
            {surgeAmount} Surge Added
          </div>
          <div style={{ fontSize: 14, color: '#CBD5E1', marginTop: 4, lineHeight: 1.4 }}>
            High demand in your area. Calculated in &lt;15ms via H3 Spatial Index.
          </div>
        </div>

        {/* Mock Interview Dialog Bubble */}
        <div
          style={{
            marginTop: 18,
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 18,
            padding: '14px 16px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ fontSize: 13, color: '#38BDF8', fontWeight: 800 }}>
            Q: "50k req/sec pe surge kaise calculate karoge?"
          </div>
          <div style={{ fontSize: 14, color: '#FCA5A5', fontWeight: 600, marginTop: 4 }}>
            Candidate: "Simple sir, SQL query chala denge!"
          </div>
        </div>

        {/* Bottom Checkout CTA Button */}
        <div
          style={{
            marginTop: 16,
            background: '#E23744',
            borderRadius: 16,
            padding: '16px 0',
            textAlign: 'center',
            color: '#FFFFFF',
            fontWeight: 900,
            fontSize: 20,
            letterSpacing: 1,
            boxShadow: '0 8px 24px rgba(226, 55, 68, 0.4)',
          }}
        >
          PROCEED TO PAY • ₹430
        </div>

        {/* DRAMATIC "REJECTED!" STAMP OVERLAY */}
        {showRejectedStamp && frame >= rejectedFrame && (
          <div
            style={{
              position: 'absolute',
              top: '38%',
              left: '8%',
              right: '8%',
              transform: `scale(${stampSpring}) rotate(-16deg)`,
              background: 'rgba(220, 38, 38, 0.96)',
              border: '6px solid #FFFFFF',
              borderRadius: 18,
              padding: '18px 20px',
              textAlign: 'center',
              boxShadow: '0 25px 70px rgba(0, 0, 0, 0.95), 0 0 40px rgba(239, 68, 68, 0.8)',
              pointerEvents: 'none',
              zIndex: 99,
            }}
          >
            <div
              style={{
                fontSize: 52,
                fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: 4,
                textTransform: 'uppercase',
                textShadow: '0 4px 10px rgba(0,0,0,0.6)',
              }}
            >
              REJECTED!
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FEE2E2', marginTop: 4 }}>
              "SQL Query at 50,000 req/s = Complete DB Lock"
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
