import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';
import { LayercutWordBehind } from '../MotionStyles.js';

interface QueueItem {
  name: string;
  priority?: string;
  detail: string;
}

interface QueueTimelineSceneProps {
  title?: string;
  items?: QueueItem[];
  timelineSteps?: string[];
  activeItemIndex?: number;
  cueFrames?: number[];
  accentColor?: string;
  onScreenText?: string;
}

export const QueueTimelineScene: React.FC<QueueTimelineSceneProps> = ({
  title = 'Execution Flow',
  items = [],
  timelineSteps = [],
  activeItemIndex = 1,
  cueFrames,
  accentColor = '#38BDF8',
  onScreenText,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const displayItems: QueueItem[] =
    items.length > 0
      ? items
      : timelineSteps.map((step, idx) => ({
          name: step,
          priority: idx === 0 ? 'high' : 'medium',
          detail: 'Step in pipeline',
        }));

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  // Animated laser line traveling down the conduit
  const laserProgress = (frame % 45) / 45;

  return (
    <AbsoluteFill
      style={{
        paddingTop: 120,
        paddingBottom: VideoDesignTokens.safeMargin.bottom,
        paddingLeft: 40,
        paddingRight: 40,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: VideoDesignTokens.typography.fontFamilySans,
        color: '#FFFFFF',
        overflow: 'hidden',
      }}
    >
      <LayercutWordBehind word="PIPELINE" topPercent={25} color="rgba(56, 189, 248, 0.05)" />

      {/* Header Pill & Title */}
      <div style={{ transform: `scale(${entrance})`, textAlign: 'center', zIndex: 10 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 24px',
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1.5px solid rgba(56, 189, 248, 0.5)',
            borderRadius: 30,
            marginBottom: 10,
            boxShadow: '0 0 25px rgba(56, 189, 248, 0.25)',
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#38BDF8', boxShadow: '0 0 10px #38BDF8' }} />
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: 3, color: '#38BDF8', textTransform: 'uppercase' }}>
            {onScreenText || 'STREAM PIPELINE FLOW'}
          </span>
        </div>
        <h1 style={{ fontSize: 46, fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px 0' }}>
          {title}
        </h1>
      </div>

      {/* Main Conduit Stream (No Boring Checklist Boxes!) */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 20, zIndex: 10 }}>
        {/* Animated Vertical Laser Conduit Cable */}
        <div
          style={{
            position: 'absolute',
            left: 28,
            top: 20,
            bottom: 20,
            width: 4,
            background: 'rgba(56, 189, 248, 0.2)',
            borderRadius: 2,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: `${laserProgress * 100}%`,
              left: -3,
              width: 10,
              height: 40,
              background: '#00F2FE',
              borderRadius: 5,
              filter: 'drop-shadow(0 0 10px #00F2FE)',
            }}
          />
        </div>

        {/* Steps along Conduit */}
        {displayItems.slice(0, 4).map((item, idx) => {
          const itemSpring = spring({
            frame: Math.max(0, frame - idx * 7),
            fps,
            config: { damping: 14, stiffness: 90 },
          });

          const isActive = idx === activeItemIndex;
          const isError = item.name.toLowerCase().includes('crash') || item.name.toLowerCase().includes('disconnect');

          return (
            <div
              key={idx}
              style={{
                transform: `translateX(${(1 - itemSpring) * 60}px)`,
                opacity: itemSpring,
                marginLeft: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
              }}
            >
              {/* Conduit Junction Node */}
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: isError ? '#EF4444' : isActive ? '#10B981' : '#1E293B',
                  border: `3px solid ${isError ? '#FECACA' : isActive ? '#6EE7B7' : 'rgba(255,255,255,0.2)'}`,
                  boxShadow: isActive ? '0 0 20px #10B981' : isError ? '0 0 20px #EF4444' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 16,
                  color: '#FFFFFF',
                  flexShrink: 0,
                  zIndex: 2,
                }}
              >
                {isError ? '!' : idx + 1}
              </div>

              {/* Floating Holographic Step Capsule */}
              <div
                style={{
                  flex: 1,
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(15, 23, 42, 0.9) 100%)'
                    : isError
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(15, 23, 42, 0.9) 100%)'
                    : 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(16px)',
                  border: `1.5px solid ${isActive ? 'rgba(16, 185, 129, 0.5)' : isError ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: 22,
                  padding: '16px 22px',
                  boxShadow: isActive ? '0 10px 30px rgba(0,0,0,0.7), 0 0 25px rgba(16, 185, 129, 0.2)' : '0 10px 30px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF' }}>
                    {item.name}
                  </span>
                  {isActive && (
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.25)',
                        color: '#6EE7B7',
                        padding: '4px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 900,
                        border: '1px solid #10B981',
                      }}
                    >
                      ACTIVE STATE
                    </span>
                  )}
                  {isError && (
                    <span
                      style={{
                        background: 'rgba(239, 68, 68, 0.25)',
                        color: '#FCA5A5',
                        padding: '4px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 900,
                        border: '1px solid #EF4444',
                      }}
                    >
                      FAILURE DETECTED
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 16, color: '#94A3B8', marginTop: 4, fontWeight: 600 }}>
                  {item.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Conduit Status Pill */}
      <div style={{ textAlign: 'center', zIndex: 10 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 24px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1.5px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 20,
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)',
          }}
        >
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#6EE7B7' }}>
            Event streams guarantee zero deadlock and zero out-of-order data corruption.
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
