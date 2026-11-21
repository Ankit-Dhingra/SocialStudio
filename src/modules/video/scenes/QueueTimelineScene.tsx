import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';
import { LayercutWordBehind } from '../MotionStyles.js';

export interface QueueItem {
  name: string;
  priority?: string;
  detail: string;
  cue?: string;
}

export interface QueueTimelineSceneProps {
  title?: string;
  items?: QueueItem[];
  timelineSteps?: string[];
  activeItemIndex?: number;
  cueFrames?: number[];
  accentColor?: string;
  onScreenText?: string;
  technicalKeyPoint?: string;
  visualProps?: Record<string, any>;
  mode?: 'lock' | 'queue' | 'event-loop' | 'timeline';
}

export const QueueTimelineScene: React.FC<QueueTimelineSceneProps> = ({
  title = 'Execution Flow',
  items = [],
  timelineSteps = [],
  activeItemIndex = 1,
  cueFrames,
  accentColor = '#38BDF8',
  onScreenText,
  technicalKeyPoint,
  visualProps,
  mode,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const totalFrames = durationInFrames || 240;

  // Strip raw markdown asterisks from headers
  const rawTitle = (title || '').replace(/\*{1,2}/g, '').trim();
  const rawOnScreen = (onScreenText || '').replace(/\*{1,2}/g, '').trim();
  const rawKeyPoint = (technicalKeyPoint || '').replace(/\*{1,2}/g, '').trim();
  const allContext = `${rawTitle} ${rawOnScreen} ${rawKeyPoint} ${visualProps?.cue || ''}`;

  // 1. Detect Event Loop / Microtask context
  const hasEventLoopTokens =
    /event\s*loop|microtask|macrotask|call\s*stack|promise|callback\s*queue|process\.nexttick|settimeout|setimmediate/i.test(allContext) ||
    items.some(it => /microtask|macrotask|promise|event\s*loop|settimeout|setimmediate|process\.nexttick/i.test(it.name || it.detail || ''));

  // 2. Semantic storyboard lock cue detection
  // Apply lock-specific animation ONLY from a semantic storyboard cue, never when event-loop is requested
  const isLockScene = !hasEventLoopTokens && (
    mode === 'lock' ||
    visualProps?.mode === 'lock' ||
    /distributed\s*lock|mutex|ttl|lease|worker\s*crash|failover/i.test(allContext) ||
    items.some(it => /lock|mutex|ttl|lease|worker\s*[ab]|set\s+key/i.test(it.name || it.detail || ''))
  );

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  // =========================================================================
  // SCENE VARIANT 1: DISTRIBUTED LOCK & LEASE EXPIRY (Show Lease Expiring + Retry Succeeding)
  // =========================================================================
  if (isLockScene) {
    // Dynamic milestones based on cueFrames or scene duration
    const cue = cueFrames && cueFrames.length > 0 && cueFrames[0] > 0
      ? Math.min(cueFrames[0], Math.floor(totalFrames * 0.65))
      : Math.floor(totalFrames * 0.55);

    const fCrash = Math.max(20, Math.floor(cue * 0.45));
    const fExpire = cue;
    const fRetrySuccess = fExpire + Math.max(12, Math.floor(fps * 0.5));

    // Lease TTL Countdown: 5.0s -> 0.0s (Expired & Evicted) -> Resets to 5.0s on Worker B retry success
    let ttlSeconds: number;
    let ttlPercent: number;

    if (frame < fCrash) {
      ttlSeconds = interpolate(frame, [0, fCrash], [5.0, 3.2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      ttlPercent = (ttlSeconds / 5.0) * 100;
    } else if (frame < fExpire) {
      ttlSeconds = interpolate(frame, [fCrash, fExpire], [3.2, 0.0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      ttlPercent = (ttlSeconds / 5.0) * 100;
    } else if (frame < fRetrySuccess) {
      ttlSeconds = 0.0;
      ttlPercent = 0;
    } else {
      ttlSeconds = interpolate(frame, [fRetrySuccess, totalFrames], [5.0, 3.8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      ttlPercent = (ttlSeconds / 5.0) * 100;
    }

    const isCrashed = frame >= fCrash;
    const isExpired = frame >= fExpire;
    const isRetrySuccess = frame >= fRetrySuccess;

    const crashSpring = spring({
      frame: Math.max(0, frame - fCrash),
      fps,
      config: { damping: 10, stiffness: 120 },
    });

    const retrySpring = spring({
      frame: Math.max(0, frame - fRetrySuccess),
      fps,
      config: { damping: 12, stiffness: 110 },
    });

    // Shockwave animation when Worker B retry succeeds
    const shockwaveProgress = interpolate(frame - fRetrySuccess, [0, 24], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const shockwaveScale = interpolate(shockwaveProgress, [0, 1], [0.85, 1.6]);
    const shockwaveOpacity = interpolate(shockwaveProgress, [0, 0.2, 1], [0, 0.9, 0]);

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
        <LayercutWordBehind word="MUTEX" topPercent={25} color="rgba(56, 189, 248, 0.05)" />

        {/* Header Pill & Title */}
        <div style={{ transform: `scale(${entrance})`, textAlign: 'center', zIndex: 10 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 24px',
              background: isCrashed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
              border: `1.5px solid ${isCrashed ? 'rgba(239, 68, 68, 0.5)' : 'rgba(56, 189, 248, 0.5)'}`,
              borderRadius: 30,
              marginBottom: 10,
              boxShadow: isCrashed ? '0 0 25px rgba(239, 68, 68, 0.25)' : '0 0 25px rgba(56, 189, 248, 0.25)',
              transition: 'all 0.3s ease',
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isRetrySuccess ? '#10B981' : isCrashed ? '#EF4444' : '#38BDF8',
                boxShadow: `0 0 10px ${isRetrySuccess ? '#10B981' : isCrashed ? '#EF4444' : '#38BDF8'}`,
              }}
            />
            <span
              style={{
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 3,
                color: isRetrySuccess ? '#6EE7B7' : isCrashed ? '#FCA5A5' : '#38BDF8',
                textTransform: 'uppercase',
              }}
            >
              {isRetrySuccess ? 'MUTEX RETRY SUCCESSFUL' : isCrashed ? 'NODE CRASH • TTL EVICTION' : 'DISTRIBUTED MUTEX LIFECYCLE'}
            </span>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px 0' }}>
            Redis TTL Lease & Failover
          </h1>
        </div>

        {/* Central Lock State & Lease Countdown Display */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(16px)',
            border: `1.5px solid ${isRetrySuccess ? 'rgba(16, 185, 129, 0.5)' : isExpired ? 'rgba(239, 68, 68, 0.5)' : 'rgba(56, 189, 248, 0.3)'}`,
            borderRadius: 24,
            padding: '24px 28px',
            boxShadow: '0 12px 35px rgba(0,0,0,0.6)',
            zIndex: 10,
          }}
        >
          {/* Key and Status Pill */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 13, color: '#94A3B8', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Active Cluster Key
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', fontFamily: VideoDesignTokens.typography.fontFamilyMono, marginTop: 2 }}>
                hex_mutex:88619A
              </div>
            </div>

            <div
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: 1,
                textTransform: 'uppercase',
                background: isRetrySuccess
                  ? 'rgba(16, 185, 129, 0.25)'
                  : isExpired
                  ? 'rgba(239, 68, 68, 0.25)'
                  : isCrashed
                  ? 'rgba(245, 158, 11, 0.25)'
                  : 'rgba(56, 189, 248, 0.25)',
                color: isRetrySuccess ? '#6EE7B7' : isExpired ? '#FCA5A5' : isCrashed ? '#FCD34D' : '#38BDF8',
                border: `1px solid ${isRetrySuccess ? '#10B981' : isExpired ? '#EF4444' : isCrashed ? '#F59E0B' : '#38BDF8'}`,
              }}
            >
              {isRetrySuccess
                ? 'LEASE RE-ACQUIRED (WORKER B)'
                : isExpired
                ? 'LEASE EXPIRED (KEY EVICTED)'
                : isCrashed
                ? 'HOLDER OFFLINE (COUNTING DOWN)'
                : 'LEASE HELD (WORKER A)'}
            </div>
          </div>

          {/* Animated Lease TTL Countdown Gauge */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#CBD5E1', letterSpacing: 1 }}>
                LEASE TTL REMAINING:
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  fontFamily: VideoDesignTokens.typography.fontFamilyMono,
                  color: isRetrySuccess ? '#10B981' : isExpired ? '#EF4444' : isCrashed ? '#F59E0B' : '#38BDF8',
                }}
              >
                {isExpired && !isRetrySuccess ? '0.00s (EXPIRED)' : `${ttlSeconds.toFixed(2)}s / 5.00s`}
              </span>
            </div>

            {/* Gauge Bar */}
            <div
              style={{
                width: '100%',
                height: 16,
                background: 'rgba(0, 0, 0, 0.5)',
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, ttlPercent))}%`,
                  height: '100%',
                  background: isRetrySuccess
                    ? 'linear-gradient(90deg, #10B981, #34D399)'
                    : isExpired
                    ? '#EF4444'
                    : isCrashed
                    ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                    : 'linear-gradient(90deg, #0284C7, #38BDF8)',
                  borderRadius: 10,
                  boxShadow: `0 0 15px ${isRetrySuccess ? '#10B981' : isCrashed ? '#EF4444' : '#38BDF8'}`,
                  transition: 'width 0.1s linear',
                }}
              />
            </div>
          </div>
        </div>

        {/* Two Competing Worker Panels: Worker A (Crashes) vs Worker B (Retries & Succeeds) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, zIndex: 10 }}>
          {/* Worker Node A: Holder -> Crashes */}
          <div
            style={{
              background: isCrashed
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(15, 23, 42, 0.95) 100%)'
                : 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0.85) 100%)',
              border: `1.5px solid ${isCrashed ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.3)'}`,
              borderRadius: 20,
              padding: '18px 24px',
              boxShadow: isCrashed ? '0 0 25px rgba(239, 68, 68, 0.25)' : 'none',
              transform: isCrashed ? `scale(${1 + Math.sin(frame / 6) * 0.01})` : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{isCrashed ? '💥' : '⚙️'}</span>
                <div>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF' }}>Worker A (PID 10842)</span>
                  <div style={{ fontSize: 13, color: isCrashed ? '#FCA5A5' : '#94A3B8', fontWeight: 600 }}>
                    {isCrashed ? 'Ungraceful exit • Crashed before releasing lock' : 'Holds active lock for surge calculation'}
                  </div>
                </div>
              </div>
              <span
                style={{
                  background: isCrashed ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)',
                  color: isCrashed ? '#FCA5A5' : '#38BDF8',
                  padding: '4px 12px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 900,
                  border: `1px solid ${isCrashed ? '#EF4444' : '#38BDF8'}`,
                }}
              >
                {isCrashed ? 'HEARTBEAT LOST' : 'INITIAL HOLDER'}
              </span>
            </div>
            <div
              style={{
                marginTop: 10,
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: 10,
                padding: '8px 14px',
                fontFamily: VideoDesignTokens.typography.fontFamilyMono,
                fontSize: 14,
                color: isCrashed ? '#FCA5A5' : '#E2E8F0',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>SET hex_mutex:88619A worker_A NX EX 5</span>
              <span style={{ color: isCrashed ? '#EF4444' : '#10B981', fontWeight: 900 }}>
                {isCrashed ? 'NODE UNRESPONSIVE' : '→ OK (Acquired)'}
              </span>
            </div>
          </div>

          {/* Worker Node B: Retry Backoff -> Succeeds! */}
          <div
            style={{
              position: 'relative',
              background: isRetrySuccess
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(15, 23, 42, 0.95) 100%)'
                : 'rgba(15, 23, 42, 0.75)',
              border: `1.5px solid ${isRetrySuccess ? 'rgba(16, 185, 129, 0.7)' : 'rgba(255, 255, 255, 0.1)'}`,
              borderRadius: 20,
              padding: '18px 24px',
              boxShadow: isRetrySuccess ? '0 0 35px rgba(16, 185, 129, 0.35)' : 'none',
              transform: isRetrySuccess ? `scale(${retrySpring})` : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Shockwave on Retry Success */}
            {isRetrySuccess && frame < fRetrySuccess + 24 && (
              <div
                style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: 26,
                  border: '3px solid #10B981',
                  boxShadow: '0 0 40px #10B981',
                  transform: `scale(${shockwaveScale})`,
                  opacity: shockwaveOpacity,
                  pointerEvents: 'none',
                }}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 24 }}>{isRetrySuccess ? '🚀' : '⏳'}</span>
                <div>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF' }}>Worker B (PID 10955)</span>
                  <div style={{ fontSize: 13, color: isRetrySuccess ? '#6EE7B7' : '#94A3B8', fontWeight: 600 }}>
                    {isRetrySuccess ? 'Retry succeeds • New lease acquired cleanly' : 'Waiting for lease eviction with jittered backoff'}
                  </div>
                </div>
              </div>
              <span
                style={{
                  background: isRetrySuccess ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.1)',
                  color: isRetrySuccess ? '#6EE7B7' : '#94A3B8',
                  padding: '4px 12px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 900,
                  border: `1px solid ${isRetrySuccess ? '#10B981' : 'rgba(255, 255, 255, 0.2)'}`,
                }}
              >
                {isRetrySuccess ? 'ACTIVE LEASE HOLDER' : isExpired ? 'RETRIEVING LEASE...' : 'WAITING BACKOFF'}
              </span>
            </div>

            <div
              style={{
                marginTop: 10,
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: 10,
                padding: '8px 14px',
                fontFamily: VideoDesignTokens.typography.fontFamilyMono,
                fontSize: 14,
                color: isRetrySuccess ? '#6EE7B7' : '#94A3B8',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>SET hex_mutex:88619A worker_B NX EX 5</span>
              <span style={{ color: isRetrySuccess ? '#10B981' : '#94A3B8', fontWeight: 900 }}>
                {isRetrySuccess ? '→ OK (Acquired!)' : '→ (nil) [Locked]'}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Technical Explanatory Pill (Accurate, bounded system behavior) */}
        <div style={{ textAlign: 'center', zIndex: 10 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 24px',
              background: 'rgba(15, 23, 42, 0.9)',
              border: `1.5px solid ${isRetrySuccess ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.3)'}`,
              borderRadius: 20,
              boxShadow: '0 0 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            <span style={{ fontSize: 18 }}>🛡️</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: isRetrySuccess ? '#6EE7B7' : '#E0F2FE' }}>
              SET key owner NX EX 5 ensures lease auto-eviction if worker crashes without manual DEL.
            </span>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // =========================================================================
  // SCENE VARIANT 2: STANDARD QUEUE / EVENT LOOP (Preserve Authored Items)
  // =========================================================================

  // Preserve authored queue content; fallback to domain defaults only when empty
  const defaultEventLoopItems: QueueItem[] = [
    { name: '1. process.nextTick Queue', priority: 'microtask', detail: 'Synchronous microtask drained before promises' },
    { name: '2. Promise.then Queue', priority: 'microtask', detail: 'Microtask queue drained before next macrotask' },
    { name: '3. Timers Macrotask Queue', priority: 'macrotask', detail: 'setTimeout / setInterval phase callbacks' },
    { name: '4. Check Macrotask Queue', priority: 'macrotask', detail: 'setImmediate callback queue' },
  ];

  const defaultPipelineItems: QueueItem[] = [
    { name: '1. Inbound Ingestion', priority: 'high', detail: 'Buffer incoming client stream' },
    { name: '2. Processing Queue', priority: 'high', detail: 'Worker dispatch and transform' },
    { name: '3. State Mutation', priority: 'medium', detail: 'Atomic consistency check' },
    { name: '4. Delivery Response', priority: 'medium', detail: 'Egress flush to client' },
  ];

  const displayItems: QueueItem[] = items.length > 0
    ? items
    : hasEventLoopTokens
    ? defaultEventLoopItems
    : defaultPipelineItems;

  const displayBadge = rawOnScreen || (hasEventLoopTokens ? 'EVENT LOOP EXECUTION QUEUE' : 'PIPELINE CONDUIT FLOW');
  const displayTitle = rawTitle || (hasEventLoopTokens ? 'Microtask & Macrotask Priority Flow' : 'Execution Flow');

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
      <LayercutWordBehind
        word={hasEventLoopTokens ? 'EVENTLOOP' : 'PIPELINE'}
        topPercent={25}
        color="rgba(56, 189, 248, 0.05)"
      />

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
            {displayBadge}
          </span>
        </div>
        <h1 style={{ fontSize: 46, fontWeight: 900, color: '#FFFFFF', margin: '0 0 6px 0' }}>
          {displayTitle}
        </h1>
      </div>

      {/* Main Conduit Stream (Preserving authored items faithfully) */}
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

          const isMicrotask = /microtask|nexttick/i.test(`${item.name} ${item.priority} ${item.detail}`);
          const isMacrotask = /macrotask|settimeout|setimmediate/i.test(`${item.name} ${item.priority} ${item.detail}`);
          const isActive = idx === activeItemIndex;

          const nodeColor = isMicrotask ? '#00F2FE' : isMacrotask ? '#F59E0B' : isActive ? '#10B981' : '#38BDF8';

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
                  background: isActive ? nodeColor : '#1E293B',
                  border: `3px solid ${isActive ? '#FFFFFF' : 'rgba(255,255,255,0.2)'}`,
                  boxShadow: isActive ? `0 0 20px ${nodeColor}` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 14,
                  color: '#FFFFFF',
                  flexShrink: 0,
                  zIndex: 2,
                }}
              >
                {isMicrotask ? 'MT' : isMacrotask ? 'MC' : idx + 1}
              </div>

              {/* Floating Holographic Step Capsule */}
              <div
                style={{
                  flex: 1,
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(15, 23, 42, 0.9) 100%)'
                    : 'rgba(15, 23, 42, 0.75)',
                  backdropFilter: 'blur(16px)',
                  border: `1.5px solid ${isActive ? 'rgba(56, 189, 248, 0.6)' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: 22,
                  padding: '16px 22px',
                  boxShadow: isActive ? '0 10px 30px rgba(0,0,0,0.7), 0 0 25px rgba(56, 189, 248, 0.2)' : '0 10px 30px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF' }}>
                    {item.name}
                  </span>
                  {isMicrotask ? (
                    <span
                      style={{
                        background: 'rgba(0, 242, 254, 0.2)',
                        color: '#00F2FE',
                        padding: '4px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 900,
                        border: '1px solid #00F2FE',
                      }}
                    >
                      MICROTASK
                    </span>
                  ) : isMacrotask ? (
                    <span
                      style={{
                        background: 'rgba(245, 158, 11, 0.2)',
                        color: '#FCD34D',
                        padding: '4px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 900,
                        border: '1px solid #F59E0B',
                      }}
                    >
                      MACROTASK
                    </span>
                  ) : (
                    <span
                      style={{
                        background: 'rgba(56, 189, 248, 0.2)',
                        color: '#38BDF8',
                        padding: '4px 12px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 900,
                        border: '1px solid #38BDF8',
                      }}
                    >
                      STAGE {idx + 1}
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

      {/* Conduit Status Pill (Contextual without false guarantees) */}
      <div style={{ textAlign: 'center', zIndex: 10 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 24px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 20,
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.15)',
          }}
        >
          <span style={{ fontSize: 20 }}>⚡</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#38BDF8' }}>
            {hasEventLoopTokens
              ? 'Microtasks drain completely before the runtime executes the next Macrotask.'
              : 'Queue stages execute in deterministic priority order.'}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
