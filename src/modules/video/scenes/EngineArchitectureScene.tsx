import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface EngineArchitectureSceneProps {
  title?: string;
  activePhase?: 'microtask' | 'macrotask' | 'stack';
  onScreenText?: string;
  ruleExplanation?: string;
}

export const EngineArchitectureScene: React.FC<EngineArchitectureSceneProps> = ({
  title = 'V8 Event Loop Runtime Architecture',
  activePhase = 'microtask',
  onScreenText = 'UNDER THE HOOD: V8 INTERNALS',
  ruleExplanation = 'Microtasks drain to 0 before the next Macrotask runs!',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  // Animated continuous motion graphics
  const loopRotation = (frame * 2.5) % 360;
  const pulseScale = 1 + Math.sin(frame / 6) * 0.08;

  // Particle positions moving along the queue cycle
  const particleProgress = (frame % 45) / 45; // 0 to 1 cycle
  const particleX = interpolate(particleProgress, [0, 0.5, 1], [150, 420, 720]);
  const particleY = interpolate(particleProgress, [0, 0.5, 1], [400, 360, 320]);

  return (
    <AbsoluteFill
      style={{
        paddingTop: VideoDesignTokens.safeMargin.top,
        paddingBottom: VideoDesignTokens.safeMargin.bottom,
        paddingLeft: VideoDesignTokens.safeMargin.left,
        paddingRight: VideoDesignTokens.safeMargin.right,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        transform: `scale(${entrance})`,
      }}
    >
      {/* Category Pill */}
      <div style={{ marginBottom: 18 }}>
        <div
          style={{
            display: 'inline-block',
            padding: '8px 20px',
            background: 'rgba(168, 85, 247, 0.18)',
            border: `1.5px solid ${VideoDesignTokens.colors.accentPurple}`,
            borderRadius: 30,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 3,
            color: '#E9D5FF',
            textTransform: 'uppercase',
          }}
        >
          {onScreenText}
        </div>
        <h2
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: VideoDesignTokens.colors.textPrimary,
            margin: '10px 0 0',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
      </div>

      {/* Main Diagram Canvas */}
      <div
        style={{
          position: 'relative',
          height: 520,
          background: 'rgba(11, 19, 43, 0.85)',
          border: '2px solid rgba(56, 189, 248, 0.35)',
          borderRadius: 24,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 0 40px rgba(0, 242, 254, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          padding: 24,
          gap: 20,
        }}
      >
        {/* Animated Background Laser Grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            pointerEvents: 'none',
          }}
        />

        {/* Moving Energy Particle SVG */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {/* Connecting Curved Flow Line */}
          <path
            d="M 230 260 Q 420 180 620 190"
            fill="none"
            stroke="rgba(0, 242, 254, 0.35)"
            strokeWidth="3"
            strokeDasharray="6 6"
          />
          <path
            d="M 230 260 Q 420 380 620 370"
            fill="none"
            stroke="rgba(245, 158, 11, 0.35)"
            strokeWidth="3"
            strokeDasharray="6 6"
          />

          {/* Glowing Animated Energy Ball */}
          <circle
            cx={particleX}
            cy={particleY}
            r="10"
            fill="#00F2FE"
            filter="drop-shadow(0 0 10px #00F2FE)"
          />
        </svg>

        {/* Column 1: Call Stack */}
        <div
          style={{
            flex: '0 0 250px',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 2,
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              background: '#1E293B',
              borderRadius: 12,
              border: '1.5px solid #475569',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 900, color: '#38BDF8', letterSpacing: 1.5 }}>
              CALL STACK (V8)
            </div>
            <div style={{ fontSize: 13, color: '#94A3B8' }}>LIFO Execution</div>
          </div>

          <div
            style={{
              flex: 1,
              border: '2px dashed rgba(56, 189, 248, 0.4)',
              borderRadius: 16,
              padding: 12,
              display: 'flex',
              flexDirection: 'column-reverse',
              gap: 8,
              background: 'rgba(15, 23, 42, 0.6)',
            }}
          >
            <div
              style={{
                padding: '12px 14px',
                background: 'linear-gradient(90deg, #0284C7, #0369A1)',
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 800,
                color: '#FFFFFF',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
              }}
            >
              main()
            </div>
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(0, 242, 254, 0.18)',
                border: '1px solid #00F2FE',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                color: '#E0F2FE',
              }}
            >
              console.log('1')
            </div>
          </div>
        </div>

        {/* Column 2: Event Loop Radar */}
        <div
          style={{
            flex: '0 0 170px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 130,
              height: 130,
              borderRadius: '50%',
              border: '3px dashed #A855F7',
              transform: `rotate(${loopRotation}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 35px rgba(168, 85, 247, 0.3)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: 90,
              height: 90,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #7E22CE 0%, #3B0764 80%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${pulseScale})`,
              boxShadow: '0 0 20px #A855F7',
            }}
          >
            <span style={{ fontSize: 26 }}>🔄</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#FFFFFF', letterSpacing: 1 }}>
              EVENT LOOP
            </span>
          </div>
        </div>

        {/* Column 3: Priority Task Queues */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            zIndex: 2,
          }}
        >
          {/* Microtask Queue */}
          <div
            style={{
              padding: 16,
              background: 'rgba(0, 242, 254, 0.12)',
              border: '2px solid #00F2FE',
              borderRadius: 18,
              boxShadow: '0 8px 25px rgba(0, 242, 254, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: '#00F2FE', letterSpacing: 1 }}>
                MICROTASK QUEUE
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  background: '#00F2FE',
                  color: '#050914',
                  padding: '3px 8px',
                  borderRadius: 6,
                }}
              >
                DRAINS 100% FIRST
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                style={{
                  padding: '8px 12px',
                  background: '#07162C',
                  border: '1px solid rgba(0, 242, 254, 0.5)',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#E0F2FE',
                }}
              >
                Promise.then()
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  background: '#07162C',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#94A3B8',
                }}
              >
                queueMicrotask()
              </div>
            </div>
          </div>

          {/* Macrotask Queue */}
          <div
            style={{
              padding: 16,
              background: 'rgba(245, 158, 11, 0.1)',
              border: '2px solid #F59E0B',
              borderRadius: 18,
              boxShadow: '0 8px 25px rgba(245, 158, 11, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: '#F59E0B', letterSpacing: 1 }}>
                MACROTASK QUEUE
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  background: '#F59E0B',
                  color: '#050914',
                  padding: '3px 8px',
                  borderRadius: 6,
                }}
              >
                NEXT TICK
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                style={{
                  padding: '8px 12px',
                  background: '#1A1408',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#FEF3C7',
                }}
              >
                setTimeout()
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  background: '#1A1408',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#94A3B8',
                }}
              >
                setImmediate()
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Under-the-hood Mechanism Rule Callout */}
      {ruleExplanation && (
        <div
          style={{
            marginTop: 18,
            padding: '16px 24px',
            background: 'linear-gradient(90deg, #1E1B4B, #0F172A)',
            borderLeft: '8px solid #00F2FE',
            borderRadius: 14,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div style={{ fontSize: 23, fontWeight: 800, color: '#F8FAFC', lineHeight: 1.35 }}>
            💡 <span style={{ color: '#00F2FE' }}>The Golden Rule:</span> {ruleExplanation}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
