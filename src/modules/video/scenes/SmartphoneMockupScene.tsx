import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';
import { LottieAsset } from '../LottieAsset.js';

export interface SmartphoneMockupSceneProps {
  headline?: string;
  subtext?: string;
  appName?: string;
  appCategory?: 'shop' | 'ecommerce' | 'delivery' | 'food' | 'ride' | 'fintech' | 'generic';
  locationText?: string;
  itemName?: string;
  itemEmoji?: string;
  itemPrice?: string;
  feeLabel?: string;
  baseDeliveryFee?: string;
  surgeDeliveryFee?: string;
  surgeMultiplier?: string;
  surgeReason?: string;
  algorithmName?: string;
  ctaText?: string;
  lottieAsset?: string;
  onScreenText?: string;
  cueFrames?: number[];
  auditRow1Label?: string;
  auditRow1Value?: string;
  auditRow2Label?: string;
  auditRow2Value?: string;
  auditRow3Label?: string;
  auditRow3Value?: string;
  auditQuestion?: string;
}

export const SmartphoneMockupScene: React.FC<SmartphoneMockupSceneProps> = ({
  headline = 'REAL-TIME CLIENT REQUEST',
  subtext = 'High-concurrency mobile application interaction',
  appName,
  appCategory,
  locationText,
  itemName,
  itemEmoji,
  itemPrice,
  feeLabel,
  baseDeliveryFee,
  surgeDeliveryFee,
  surgeMultiplier,
  surgeReason,
  algorithmName,
  ctaText,
  lottieAsset,
  onScreenText,
  cueFrames,
  auditRow1Label,
  auditRow1Value,
  auditRow2Label,
  auditRow2Value,
  auditRow3Label,
  auditRow3Value,
  auditQuestion,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Topic & Category detection
  const combinedContext = `${appName || ''} ${itemName || ''} ${onScreenText || ''} ${headline} ${subtext}`.toLowerCase();
  const isShop = appCategory === 'shop' || appCategory === 'ecommerce' || /shop|store|cart|retail|product|sneaker|iphone|gadget|headphone/i.test(combinedContext);
  const isFood = appCategory === 'food' || /food|restaurant|biryani|burger|pizza|meal|zomato|swiggy/i.test(combinedContext);
  const isRide = appCategory === 'ride' || /ride|cab|taxi|uber|ola|driver/i.test(combinedContext);
  const isFintech = appCategory === 'fintech' || /pay|wallet|bank|stock|crypto|upi|stripe|transfer/i.test(combinedContext);

  const resolvedAppName = appName || (isShop ? 'STORE' : isFood ? 'FOOD' : isRide ? 'RIDE' : isFintech ? 'PAY' : 'APP');
  const resolvedItemName = itemName || (isShop ? 'Online Product' : isFood ? 'Food Order' : isRide ? 'City Ride' : isFintech ? 'Payment Transfer' : 'Resource Allocation');
  const resolvedLocation = locationText || (isShop ? 'Express Shipping Hub' : isRide ? 'Airport Terminal 2' : isFintech ? 'Direct Settlement' : 'Region Central API');
  const resolvedEmoji = itemEmoji || (isShop ? '🛍️' : isFood ? '🍛' : isRide ? '🚗' : isFintech ? '💳' : '⚡');

  const hasExplicitPrice = Boolean(baseDeliveryFee || surgeDeliveryFee || itemPrice);
  const isSurgeContext = hasExplicitPrice && (isFood || isRide || /surge|fare|pricing|multiplier|delivery\s*fee/i.test(combinedContext));

  const resolvedReason = surgeReason || (isShop ? 'FLASH SALE • LIMITED WAREHOUSE STOCK' : 'HIGH TRAFFIC • 120+ ACTIVE REQUESTS');
  const resolvedFeeLabel = feeLabel || (isShop ? 'EXPRESS HANDLING / SURGE' : isRide ? 'PEAK TRAFFIC TARIFF' : isFintech ? 'PRIORITY PROCESSING FEE' : 'REQUEST METRIC STATUS');

  const appBadgeColor = isShop
    ? 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)'
    : isFood
    ? 'linear-gradient(135deg, #E23744 0%, #EF4444 100%)'
    : isRide
    ? 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)'
    : isFintech
    ? 'linear-gradient(135deg, #059669 0%, #10B981 100%)'
    : 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)';

  // Consistent, verified arithmetic (eliminates conflicting price calculations)
  const parseAmount = (val: string | number | undefined, defaultVal: number): number => {
    if (typeof val === 'number') return val;
    const match = String(val || '').replace(/[^0-9]/g, '');
    return match ? parseInt(match, 10) : defaultVal;
  };

  const foodPriceNum = parseAmount(itemPrice, 350);
  const baseDeliveryNum = parseAmount(baseDeliveryFee, 30);
  const surgeDeliveryNum = parseAmount(surgeDeliveryFee, 80);

  const baseTotalNum = foodPriceNum + baseDeliveryNum;
  const surgeTotalNum = foodPriceNum + surgeDeliveryNum;
  const surgeDeltaNum = Math.max(0, surgeDeliveryNum - baseDeliveryNum);
  const calculatedMultiplier = `${(surgeDeliveryNum / Math.max(1, baseDeliveryNum)).toFixed(1)}X`;

  // Timing milestones:
  // Synchronize surge with speech cueFrame if present, else trigger at ~30% of scene duration
  const fSurgeStart = cueFrames && cueFrames.length > 0 && cueFrames[0] > 0
    ? Math.min(cueFrames[0], Math.max(30, durationInFrames - 20))
    : Math.min(75, Math.floor((durationInFrames || 240) * 0.35));

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

  // Synchronized shockwave ring on surge start
  const shockwaveProgress = interpolate(frame - fSurgeStart, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shockwaveScale = interpolate(shockwaveProgress, [0, 1], [0.85, 1.85]);
  const shockwaveOpacity = interpolate(shockwaveProgress, [0, 0.2, 1], [0, 0.9, 0]);

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

  // Cinematic Camera Zoom / Punch-In onto the price reveal
  const phoneZoom = interpolate(surgeSpring, [0, 1], [1.0, 1.14]);
  const phoneFocusY = interpolate(surgeSpring, [0, 1], [0, -45]);

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
      {/* Audio SFX on Surge Price Reveal */}
      {fSurgeStart > 0 && fSurgeStart < durationInFrames && (
        <Sequence from={fSurgeStart} durationInFrames={35}>
          <Audio src={staticFile('sfx/ding.wav')} volume={0.45} />
        </Sequence>
      )}

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
          {isSurgeContext && isSurgeActive ? 'LIVE DEMAND SURGE DETECTED' : 'LIVE CLIENT REQUEST / ACTION'}
        </span>
      </div>

      {/* Main Catchy Hook Headline */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 20,
          transform: `scale(${entrance})`,
          padding: '0 50px',
          opacity: frame >= 170 ? interpolate(frame, [170, 185], [1, 0.15], { extrapolateRight: 'clamp' }) : 1,
          transition: 'opacity 0.3s ease',
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

      {/* Realistic iPhone 16 Pro 3D Mockup with Dynamic Camera Punch-In */}
      <div
        style={{
          transform: `perspective(1400px) rotateY(${rotY}deg) rotateX(${rotX}deg) translateY(${floatY + phoneFocusY}px) scale(${entrance * phoneZoom})`,
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
            {isSurgeContext && isSurgeActive ? (
              <span style={{ fontSize: 11, fontWeight: 800, color: '#EF4444', letterSpacing: 0.5 }}>
                ⚡ 1.8X SURGE
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 800, color: '#10B981', letterSpacing: 0.5 }}>
                ⚡ 200 OK
              </span>
            )}
            {/* Sensor / Mic indicator */}
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSurgeContext && isSurgeActive ? '#EF4444' : '#10B981' }} />
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
                background: appBadgeColor,
                color: '#FFF',
                fontWeight: 900,
                fontSize: 18,
                padding: '6px 14px',
                borderRadius: 10,
                letterSpacing: 1.2,
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
              }}
            >
              {resolvedAppName}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#F8FAFC' }}>
                {isShop ? 'Online Checkout' : isRide ? 'Instant Trip' : isFintech ? 'Direct Settlement' : isFood ? 'Food Order' : 'Service Client'}
              </div>
              <div style={{ fontSize: 13, color: '#94A3B8' }}>{resolvedLocation}</div>
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
            {isShop ? '⚡ IN STOCK' : isRide ? '⏱️ 3 MINS AWAY' : isFintech ? '🔒 256-BIT' : isFood ? '⏱️ 18-24 MINS' : '⚡ CONNECTED'}
          </div>
        </div>

        {/* HERO 3D ANIMATED SHOWCASE */}
        <div
          style={{
            marginTop: 14,
            height: 180,
            borderRadius: 22,
            background: 'radial-gradient(ellipse at center, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1.5px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 30px rgba(0, 0, 0, 0.7), 0 12px 30px rgba(0, 0, 0, 0.45)',
          }}
        >
          {/* Glowing Ambient Core */}
          <div
            style={{
              position: 'absolute',
              width: 170,
              height: 170,
              borderRadius: '50%',
              background: isShop ? '#4F46E5' : isFood ? '#EF4444' : isRide ? '#38BDF8' : '#10B981',
              filter: 'blur(45px)',
              opacity: 0.5,
            }}
          />
          {/* Large Hero 3D Animated Lottie with Theme Color Grading */}
          <LottieAsset
            name={
              lottieAsset ||
              (isShop
                ? 'ecommerce-shop'
                : isRide
                ? 'truck'
                : isFood
                ? 'shopping-cart'
                : isFintech
                ? 'money-3d'
                : 'server')
            }
            style={{
              width: 340,
              height: 175,
              transform: `scale(${1 + Math.sin(frame / 20) * 0.035}) translateY(${Math.sin(frame / 15) * 3}px)`,
              filter: isRide
                ? 'hue-rotate(185deg) saturate(1.25) drop-shadow(0 10px 25px rgba(56, 189, 248, 0.45))'
                : isShop
                ? 'hue-rotate(240deg) saturate(1.2) drop-shadow(0 10px 25px rgba(79, 70, 229, 0.45))'
                : isFintech
                ? 'hue-rotate(90deg) saturate(1.2) drop-shadow(0 10px 25px rgba(16, 185, 129, 0.45))'
                : 'drop-shadow(0 10px 25px rgba(239, 68, 68, 0.45))',
            }}
          />
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
            <div style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>{resolvedItemName}</div>
            <div style={{ fontSize: 14, color: '#10B981', marginTop: 4, fontWeight: 700 }}>
              {hasExplicitPrice ? '★ 4.9 (Verified item)' : 'Protocol: Client State Sync'}
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#F1F5F9', marginTop: 6 }}>
              {hasExplicitPrice ? `₹${foodPriceNum}` : 'REQUEST #1042'}
            </div>
          </div>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 18,
              background: appBadgeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            {lottieAsset ? (
              <LottieAsset name={lottieAsset} style={{ width: 52, height: 52 }} />
            ) : isShop ? (
              <LottieAsset name="shopping-cart" style={{ width: 52, height: 52 }} />
            ) : isRide ? (
              <LottieAsset name="truck" style={{ width: 52, height: 52 }} />
            ) : isFintech ? (
              <LottieAsset name="credit-card" style={{ width: 52, height: 52 }} />
            ) : (
              resolvedEmoji
            )}
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
              <span style={{ fontSize: 24 }}>{isSurgeContext && isSurgeActive ? '⚡' : resolvedEmoji}</span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: 1.2,
                  color: isSurgeContext && isSurgeActive ? '#EF4444' : '#94A3B8',
                  textTransform: 'uppercase',
                }}
              >
                {isSurgeContext && isSurgeActive ? 'SURGE PRICING ACTIVE' : resolvedFeeLabel}
              </span>
            </div>
            {isSurgeContext && isSurgeActive && (
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
                {calculatedMultiplier} SURGE
              </div>
            )}
          </div>

          {/* Neon Shockwave on Surge Trigger */}
          {frame >= fSurgeStart && frame < fSurgeStart + 26 && (
            <div
              style={{
                position: 'absolute',
                inset: -10,
                borderRadius: 28,
                border: '3px solid #EF4444',
                boxShadow: '0 0 45px #EF4444, inset 0 0 20px #EF4444',
                transform: `scale(${shockwaveScale})`,
                opacity: shockwaveOpacity,
                pointerEvents: 'none',
                zIndex: 40,
              }}
            />
          )}

          {/* Price Flip or State Display */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 14 }}>
            {isSurgeContext ? (
              isSurgeActive ? (
                <>
                  {/* Strikethrough Base Price with Animated Red Slash */}
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <div
                      style={{
                        fontSize: 26,
                        fontWeight: 700,
                        color: '#64748B',
                        opacity: 0.7,
                      }}
                    >
                      ₹{baseDeliveryNum}
                    </div>
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: 0,
                        width: `${Math.min(100, Math.round(surgeSpring * 100))}%`,
                        height: 3,
                        background: '#EF4444',
                        boxShadow: '0 0 8px #EF4444',
                        transform: 'translateY(-50%)',
                      }}
                    />
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
                    <span style={{ color: '#EF4444', textShadow: '0 0 20px rgba(239, 68, 68, 0.6)' }}>₹{surgeDeliveryNum}</span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: '#FCA5A5' }}>(+₹{surgeDeltaNum} Surge)</span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 36, fontWeight: 900, color: '#10B981' }}>
                  ₹{baseDeliveryNum}
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#94A3B8', marginLeft: 10 }}>Standard Rate</span>
                </div>
              )
            ) : (
              <div style={{ fontSize: 28, fontWeight: 900, color: isSurgeActive ? '#38BDF8' : '#10B981', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{isSurgeActive ? '⚡ 200 OK • ATOMIC DISPATCH' : '⚡ READY • QUEUED'}</span>
              </div>
            )}
          </div>

          {/* Subtext info */}
          <div style={{ fontSize: 14, color: isSurgeActive ? '#FCA5A5' : '#64748B', marginTop: 8, lineHeight: 1.4 }}>
            {isSurgeActive ? resolvedReason : 'Calculated by dynamic system balancing'}
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
          <span style={{ fontSize: 14, color: '#38BDF8', fontWeight: 800 }}>
            {algorithmName || (isShop ? 'Inventory Balancing & Demand Surge' : isRide ? 'Geospatial Dispatch Matching' : isFood ? 'H3 Hexagonal Indexing' : 'Dynamic SLA State Machine')}
          </span>
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
            fontSize: 20,
            letterSpacing: 1.2,
            boxShadow: isSurgeActive
              ? '0 10px 30px rgba(220, 38, 38, 0.5)'
              : '0 10px 25px rgba(16, 185, 129, 0.35)',
            transform: isSurgeActive ? `scale(${1 + Math.sin(frame / 6) * 0.02})` : 'scale(1)',
            transition: 'background 0.3s ease',
          }}
        >
          {ctaText ||
            (isSurgeContext && isSurgeActive
              ? `CHECKOUT • ₹${surgeTotalNum} (₹${foodPriceNum} + ₹${surgeDeliveryNum} Surge)`
              : `PROCEED • ${resolvedItemName}`)}
        </div>

        {/* Cut 0.2: Receipt Mystery Audit Card (Triggered at frame 170+ / ~6s) */}
        {frame >= 170 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(10, 15, 29, 0.94)',
              backdropFilter: 'blur(25px)',
              borderRadius: 52,
              padding: '36px 28px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 60,
              transform: `scale(${spring({ frame: frame - 170, fps, config: { damping: 14, stiffness: 100 } })})`,
              boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.8), 0 0 50px rgba(239, 68, 68, 0.4)',
              border: '2px solid rgba(239, 68, 68, 0.6)',
            }}
          >
            {/* Mystery Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 20px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1.5px solid rgba(239, 68, 68, 0.6)',
                borderRadius: 999,
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: 18 }}>🔍</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#FCA5A5', letterSpacing: 2 }}>
                RECEIPT AUDIT CHECK
              </span>
            </div>

            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: '#FFFFFF',
                textAlign: 'center',
                lineHeight: 1.2,
                marginBottom: 24,
              }}
            >
              EVERYTHING IS IDENTICAL
            </div>

            {/* Comparison Rows (100% Dynamic) */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '12px 18px',
                  borderRadius: 14,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span style={{ fontSize: 18, color: '#94A3B8', fontWeight: 700 }}>
                  {auditRow1Label || (isFood ? '🏪 Restaurant' : isRide ? '🚗 Service' : isFintech ? '💳 Account' : '📦 Entity')}
                </span>
                <span style={{ fontSize: 18, color: '#34D399', fontWeight: 900 }}>
                  {auditRow1Value || `${resolvedItemName} (SAME) ✓`}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '12px 18px',
                  borderRadius: 14,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span style={{ fontSize: 18, color: '#94A3B8', fontWeight: 700 }}>
                  {auditRow2Label || (isFood ? '🏠 Drop Location' : isRide ? '📍 Destination' : isFintech ? '🏦 Target Bank' : '📍 Destination')}
                </span>
                <span style={{ fontSize: 18, color: '#34D399', fontWeight: 900 }}>
                  {auditRow2Value || `${resolvedLocation} (SAME) ✓`}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '12px 18px',
                  borderRadius: 14,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                <span style={{ fontSize: 18, color: '#94A3B8', fontWeight: 700 }}>
                  {auditRow3Label || (isFood ? '📏 Distance' : isRide ? '📏 Route KM' : isFintech ? '🔒 Protocol' : '📏 Parameter')}
                </span>
                <span style={{ fontSize: 18, color: '#34D399', fontWeight: 900 }}>
                  {auditRow3Value || (isSurgeContext ? '3.2 KM (UNCHANGED) ✓' : 'UNCHANGED ✓')}
                </span>
              </div>
            </div>

            {/* Giant Pulsing Mystery Callout */}
            <div
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(185, 28, 28, 0.2) 100%)',
                border: '2px solid #EF4444',
                borderRadius: 20,
                padding: '18px 20px',
                textAlign: 'center',
                boxShadow: '0 0 30px rgba(239, 68, 68, 0.4)',
                transform: `scale(${1 + Math.sin(frame / 6) * 0.03})`,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: '#FCA5A5', letterSpacing: 1.5, marginBottom: 4 }}>
                THE CORE QUESTION
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.2 }}>
                {auditQuestion || (isSurgeContext ? `EXTRA +₹${surgeDeltaNum} KAHAN SE AAYE? 🤔` : 'WHY DID THIS CALL DELAY OR FAIL? 🤔')}
              </div>
              <div style={{ fontSize: 14, color: '#38BDF8', fontWeight: 700, marginTop: 6 }}>
                {isSurgeContext ? `${resolvedFeeLabel}: ₹${baseDeliveryNum} ➔ ₹${surgeDeliveryNum} Spike` : 'Concurrency State Anomaly'}
              </div>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
