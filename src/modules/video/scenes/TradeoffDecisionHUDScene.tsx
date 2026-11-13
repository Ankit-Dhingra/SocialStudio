import React from 'react';
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

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
  subtitle = 'Which architecture would you choose in an interview?',
  optionA_Title = 'OPTION A: MICRO-HEX BINS (500m)',
  optionA_Pros = 'Hyper-accurate local pricing & rider incentives',
  optionA_Cons = 'High Redis RAM & 100k key-writes per second',
  optionB_Title = 'OPTION B: MACRO ZONES (5km)',
  optionB_Pros = 'Ultra-lightweight in-memory footprint',
  optionB_Cons = 'Border pricing anomalies & rider churn',
  interviewPoints = [
    'H3 Spatial Indexing converts geometric polygons to O(1) string hashes',
    'Redis In-Memory caching serves dynamic surge pricing in < 8ms',
    'Background worker streaming decouples read path from write path',
    'Tradeoff: Spatial Granularity vs In-Memory write throughput',
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
    frame: frame - 8,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const cardEntranceB = spring({
    frame: frame - 14,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const cheatSheetEntrance = spring({
    frame: frame - 22,
    fps,
    config: { damping: 13, stiffness: 85 },
  });

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        paddingTop: VideoDesignTokens.safeMargin.top,
        paddingBottom: 340,
        paddingLeft: 40,
        paddingRight: 40,
        overflow: 'hidden',
      }}
    >
      {/* Category Pill & Title */}
      <div style={{ transform: `scale(${entrance})`, marginBottom: 18, textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 24px',
            background: 'rgba(234, 179, 8, 0.15)',
            border: '1.5px solid rgba(234, 179, 8, 0.4)',
            borderRadius: 30,
            marginBottom: 10,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EAB308', boxShadow: '0 0 10px #EAB308' }} />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3, color: '#FDE047', textTransform: 'uppercase' }}>
            SENIOR SDE-3 DECISION
          </span>
        </div>
        <h1 style={{ fontSize: 46, fontWeight: 900, color: '#FFFFFF', margin: '0 0 8px 0' }}>
          {title}
        </h1>
        <p style={{ fontSize: 24, fontWeight: 600, color: '#94A3B8', margin: 0 }}>
          {subtitle}
        </p>
      </div>

      {/* SVG DECISION FORK CONNECTOR (Explicit, anchored branching lines) */}
      <div style={{ position: 'relative', width: '100%', height: 36 }}>
        <svg viewBox="0 0 920 36" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
          {/* Central Stem */}
          <line x1="460" y1="0" x2="460" y2="16" stroke="#FBBF24" strokeWidth="3" />
          <circle cx="460" cy="16" r="5" fill="#FBBF24" filter="drop-shadow(0 0 6px #FBBF24)" />

          {/* Left Branch into Option A center (x: 230) */}
          <path d="M 460 16 C 460 30, 230 20, 230 36" fill="none" stroke="#EF4444" strokeWidth="3" strokeDasharray="5 3" />
          <circle cx="230" cy="36" r="5" fill="#EF4444" filter="drop-shadow(0 0 6px #EF4444)" />

          {/* Right Branch into Option B center (x: 690) */}
          <path d="M 460 16 C 460 30, 690 20, 690 36" fill="none" stroke="#38BDF8" strokeWidth="3" strokeDasharray="5 3" />
          <circle cx="690" cy="36" r="5" fill="#38BDF8" filter="drop-shadow(0 0 6px #38BDF8)" />
        </svg>
      </div>

      {/* Split Comparison Fork (Option A vs Option B) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Option A Card */}
        <div
          style={{
            transform: `scale(${cardEntranceA})`,
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '2px solid rgba(239, 68, 68, 0.55)',
            borderRadius: 24,
            padding: '18px 20px',
            boxShadow: '0 12px 35px rgba(239, 68, 68, 0.25)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: '#EF4444', letterSpacing: 1 }}>
            {optionA_Title}
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: '#10B981', fontSize: 16 }}>✔</span>
              <span style={{ fontSize: 15, color: '#F1F5F9', fontWeight: 600 }}>{optionA_Pros}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: '#EF4444', fontSize: 16 }}>✖</span>
              <span style={{ fontSize: 15, color: '#FCA5A5', fontWeight: 600 }}>{optionA_Cons}</span>
            </div>
          </div>
        </div>

        {/* Option B Card */}
        <div
          style={{
            transform: `scale(${cardEntranceB})`,
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '2px solid rgba(56, 189, 248, 0.55)',
            borderRadius: 24,
            padding: '18px 20px',
            boxShadow: '0 12px 35px rgba(56, 189, 248, 0.25)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: '#38BDF8', letterSpacing: 1 }}>
            {optionB_Title}
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: '#10B981', fontSize: 16 }}>✔</span>
              <span style={{ fontSize: 15, color: '#F1F5F9', fontWeight: 600 }}>{optionB_Pros}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ color: '#EF4444', fontSize: 16 }}>✖</span>
              <span style={{ fontSize: 15, color: '#BAE6FD', fontWeight: 600 }}>{optionB_Cons}</span>
            </div>
          </div>
        </div>
      </div>

      {/* The Interview Cheat-Sheet Card (High Value Saving Trigger) */}
      <div
        style={{
          transform: `scale(${cheatSheetEntrance})`,
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(20px)',
          border: '2px solid rgba(16, 185, 129, 0.45)',
          borderRadius: 28,
          padding: '20px 26px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(16, 185, 129, 0.2)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>📋</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#34D399', letterSpacing: 2 }}>
                INTERVIEW CHEAT-SHEET
              </span>
            </div>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34D399',
                fontSize: 13,
                fontWeight: 800,
                padding: '4px 12px',
                borderRadius: 12,
              }}
            >
              TAKE SCREENSHOT 📌
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-evenly', margin: '12px 0' }}>
            {interviewPoints.map((point, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '9px 12px',
                  borderRadius: 14,
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div
                  style={{
                    background: '#10B981',
                    color: '#064E3B',
                    fontWeight: 900,
                    fontSize: 14,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ fontSize: 17, color: '#E2E8F0', fontWeight: 600, lineHeight: 1.35 }}>
                  {point}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Bar at the bottom of the card */}
        <div
          style={{
            marginTop: 14,
            background: 'linear-gradient(90deg, #E23744 0%, #EF4444 100%)',
            borderRadius: 18,
            padding: '13px 20px',
            textAlign: 'center',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: 18,
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
          }}
        >
          {callToAction}
        </div>
      </div>
    </AbsoluteFill>
  );
};
