import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface ArchitectureFlowPipelineSceneProps {
  title?: string;
  subtitle?: string;
  redisLatencyMs?: number;
}

export const ArchitectureFlowPipelineScene: React.FC<ArchitectureFlowPipelineSceneProps> = ({
  title = 'REAL-TIME READ PATH vs ASYNC WRITE PATH',
  subtitle = 'How Redis in-memory lookup prevents database deadlocks',
  redisLatencyMs = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  // Read packet animation: cycles every 45 frames (0 to 1)
  const readCycle = 45;
  const readProgress = (frame % readCycle) / readCycle;

  // Exact coordinates matching the node ports:
  // Node 1 (App): Center (155, 465), Right Socket (280, 465)
  // Node 2 (Gateway): Left Socket (335, 465), Center (460, 465), Right Socket (585, 465)
  // Node 3 (Redis): Left Socket (640, 465), Center (765, 465)
  const packetX = interpolate(
    readProgress,
    [0, 0.45, 0.55, 1],
    [155, 460, 460, 765]
  );
  const packetY = 465;

  // Redis Hit flash when read packet arrives (t > 0.85)
  const isRedisHit = readProgress > 0.85;

  // Write packet animation: travels vertically from Worker to Redis every 35 frames
  const writeCycle = 35;
  const writeProgress = (frame % writeCycle) / writeCycle;
  // From Worker top socket (765, 680) to Redis bottom socket (765, 550)
  const writePacketY = interpolate(writeProgress, [0, 1], [745, 490]);
  const writePacketX = 765;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        paddingTop: VideoDesignTokens.safeMargin.top,
        paddingBottom: VideoDesignTokens.safeMargin.bottom,
        paddingLeft: 40,
        paddingRight: 40,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ transform: `scale(${entrance})`, marginBottom: 24, textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 24px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1.5px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 30,
            marginBottom: 12,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 10px #10B981' }} />
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: 3, color: '#34D399', textTransform: 'uppercase' }}>
            DECOUPLED ARCHITECTURE
          </span>
        </div>
        <h1 style={{ fontSize: 46, fontWeight: 900, color: '#FFFFFF', margin: '0 0 8px 0' }}>
          {title}
        </h1>
        <p style={{ fontSize: 24, fontWeight: 600, color: '#94A3B8', margin: 0 }}>
          {subtitle}
        </p>
      </div>

      {/* Main Architecture Diagram Canvas (920px wide, 860px tall) */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          background: 'radial-gradient(ellipse at center, #0B132B 0%, #030712 90%)',
          borderRadius: 32,
          border: '2px solid rgba(56, 189, 248, 0.25)',
          boxShadow: '0 25px 70px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
        }}
      >
        {/* SVG CABLES & SOCKETS (Exact Coordinates) */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <linearGradient id="readCableGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="writeCableGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* 1. Cable: App (280, 465) to Gateway (335, 465) */}
          <line x1="280" y1="465" x2="335" y2="465" stroke="url(#readCableGrad)" strokeWidth="6" strokeDasharray="6 4" />

          {/* 2. Cable: Gateway (585, 465) to Redis (640, 465) */}
          <line x1="585" y1="465" x2="640" y2="465" stroke="url(#readCableGrad)" strokeWidth="6" strokeDasharray="6 4" />

          {/* 3. Bypassed Database Cable: Gateway (460, 380) to DB (460, 210) */}
          <line x1="460" y1="380" x2="460" y2="210" stroke="#EF4444" strokeWidth="3" strokeDasharray="5 5" opacity="0.6" />

          {/* 4. Cable: Workers (765, 680) to Redis (765, 550) */}
          <line x1="765" y1="680" x2="765" y2="550" stroke="url(#writeCableGrad)" strokeWidth="6" strokeDasharray="6 4" />

          {/* Sockets / Terminals (Glowing Dots exactly at the ports) */}
          <circle cx="280" cy="465" r="7" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="2" filter="drop-shadow(0 0 6px #38BDF8)" />
          <circle cx="335" cy="465" r="7" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="2" filter="drop-shadow(0 0 6px #38BDF8)" />
          <circle cx="585" cy="465" r="7" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" filter="drop-shadow(0 0 6px #10B981)" />
          <circle cx="640" cy="465" r="7" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" filter="drop-shadow(0 0 6px #10B981)" />
          <circle cx="460" cy="380" r="6" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="460" cy="210" r="6" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="765" cy="680" r="7" fill="#A855F7" stroke="#FFFFFF" strokeWidth="2" filter="drop-shadow(0 0 6px #A855F7)" />
          <circle cx="765" cy="550" r="7" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" filter="drop-shadow(0 0 6px #10B981)" />

          {/* Red X over the bypassed DB line */}
          <g transform="translate(460, 295)">
            <rect x="-60" y="-16" width="120" height="32" rx="16" fill="rgba(239,68,68,0.9)" stroke="#FFFFFF" strokeWidth="2" />
            <text x="0" y="5" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900" fontFamily="sans-serif">
              ⛔ BYPASSED
            </text>
          </g>

          {/* Animated Glowing Read Laser Packet */}
          <circle
            cx={packetX}
            cy={packetY}
            r="12"
            fill="#00F2FE"
            filter="drop-shadow(0 0 14px #00F2FE)"
          />
          <circle cx={packetX} cy={packetY} r="5" fill="#FFFFFF" />

          {/* Animated Glowing Write Laser Packet */}
          <circle
            cx={writePacketX}
            cy={writePacketY}
            r="11"
            fill="#C084FC"
            filter="drop-shadow(0 0 14px #C084FC)"
          />
          <circle cx={writePacketX} cy={writePacketY} r="4" fill="#FFFFFF" />
        </svg>

        {/* NODE 0: Primary Database (Top, x: 320, y: 90, w: 280, h: 120) */}
        <div
          style={{
            position: 'absolute',
            left: 320,
            top: 90,
            width: 280,
            height: 120,
            background: 'rgba(239, 68, 68, 0.08)',
            border: '2px dashed rgba(239, 68, 68, 0.45)',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: '10px 16px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 36 }}>🛢️</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#F87171' }}>PRIMARY DATABASE</div>
            <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 800 }}>0 READ LOCKS (SAFE)</div>
          </div>
        </div>

        {/* NODE 1: Zomato App (Left, x: 30, y: 380, w: 250, h: 170) */}
        <div
          style={{
            position: 'absolute',
            left: 30,
            top: 380,
            width: 250,
            height: 170,
            background: 'rgba(15, 23, 42, 0.9)',
            border: '2px solid rgba(56, 189, 248, 0.5)',
            borderRadius: 24,
            padding: '16px 14px',
            textAlign: 'center',
            boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 4 }}>📱</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FFF' }}>ZOMATO APP</div>
          <div style={{ fontSize: 13, color: '#38BDF8', marginTop: 4, fontFamily: 'monospace' }}>
            GPS: 12.91, 77.64
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Surge query initiated</div>
        </div>

        {/* NODE 2: API Gateway / Spatial Resolver (Center, x: 335, y: 380, w: 250, h: 170) */}
        <div
          style={{
            position: 'absolute',
            left: 335,
            top: 380,
            width: 250,
            height: 170,
            background: 'rgba(15, 23, 42, 0.9)',
            border: '2px solid rgba(56, 189, 248, 0.5)',
            borderRadius: 24,
            padding: '16px 14px',
            textAlign: 'center',
            boxShadow: '0 12px 30px rgba(0,0,0,0.7)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 4 }}>⚡</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#FFF' }}>API GATEWAY</div>
          <div style={{ fontSize: 13, color: '#FBBF24', marginTop: 4, fontFamily: 'monospace' }}>
            H3: #88619A0A4
          </div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>O(1) Spatial Resolver</div>
        </div>

        {/* NODE 3: Redis In-Memory Cache (Right, x: 640, y: 380, w: 250, h: 170) */}
        <div
          style={{
            position: 'absolute',
            left: 640,
            top: 380,
            width: 250,
            height: 170,
            background: isRedisHit
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(15, 23, 42, 0.95) 100%)'
              : 'rgba(15, 23, 42, 0.9)',
            border: `2px solid ${isRedisHit ? '#10B981' : 'rgba(16, 185, 129, 0.45)'}`,
            borderRadius: 24,
            padding: '16px 14px',
            textAlign: 'center',
            boxShadow: `0 15px 40px rgba(16, 185, 129, ${isRedisHit ? 0.4 : 0.15})`,
            transform: `scale(${isRedisHit ? 1.04 : 1})`,
            transition: 'all 0.15s ease',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 4 }}>⚡🔥</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#34D399' }}>REDIS IN-MEMORY</div>
          <div style={{ fontSize: 13, color: '#A7F3D0', fontWeight: 800, marginTop: 4 }}>
            LOOKUP: {redisLatencyMs}ms
          </div>
          <div
            style={{
              marginTop: 6,
              background: '#10B981',
              color: '#064E3B',
              fontWeight: 900,
              fontSize: 13,
              padding: '3px 8px',
              borderRadius: 8,
            }}
          >
            SURGE: 1.8X
          </div>
        </div>

        {/* NODE 4: Background Workers (Bottom, x: 550, y: 680, w: 340, h: 130) */}
        <div
          style={{
            position: 'absolute',
            left: 550,
            top: 680,
            width: 340,
            height: 130,
            background: 'rgba(168, 85, 247, 0.14)',
            border: '2px solid rgba(168, 85, 247, 0.55)',
            borderRadius: 24,
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 10px 30px rgba(168, 85, 247, 0.25)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ fontSize: 36 }}>⚙️</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#C084FC' }}>
              BACKGROUND STREAM WORKERS
            </div>
            <div style={{ fontSize: 12, color: '#E9D5FF', marginTop: 2 }}>
              Aggregates orders & telemetry into Redis every 5s
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Takeaway */}
      <div
        style={{
          marginTop: 18,
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1.5px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 18,
          padding: '14px 24px',
          textAlign: 'center',
          color: '#BAE6FD',
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        Reads hit 100% in-memory cache. Writes happen asynchronously in background workers!
      </div>
    </AbsoluteFill>
  );
};
