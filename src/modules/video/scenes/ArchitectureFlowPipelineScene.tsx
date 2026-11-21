import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LottieAsset } from '../LottieAsset.js';

interface PipelineStep {
  label: string;
  description: string;
  status?: string;
  cue?: string;
}

export interface DeepDiveStage {
  stagePill?: string;
  stageTitle?: string;
  card1Tag?: string;
  card1Title?: string;
  card1Desc?: string;
  card1Badge?: string;
  card2Tag?: string;
  card2Title?: string;
  card2Desc?: string;
  card2Badge?: string;
  codeSnippet?: string;
  mathRows?: Array<{ label: string; value: string }>;
  totalFormulaValue?: string;
}

export interface ArchitectureFlowPipelineSceneProps {
  title?: string;
  subtitle?: string;
  redisLatencyMs?: number;
  steps?: PipelineStep[];
  bypassedLabel?: string;
  deepDiveStages?: DeepDiveStage[];
}

export const ArchitectureFlowPipelineScene: React.FC<ArchitectureFlowPipelineSceneProps> = ({
  title = '50ms IN-MEMORY ARCHITECTURE',
  subtitle = 'Why Hot Geospatial Queries Are Offloaded to Redis Under Surge',
  redisLatencyMs = 4,
  steps,
  deepDiveStages,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  // Check if we are running in multi-cut deep dive mode (Scene 3 is ~1916 frames)
  const isDeepDive = durationInFrames > 500;

  // 5 Fast-Paced Sub-Cuts for Scene 3
  if (isDeepDive) {
    // Stage 1: Ingestion / Telemetry Stream (0 to 360 / 0s - 12s)
    // Stage 2: Spatial Index / Sharding Mesh (360 to 750 / 12s - 25s)
    // Stage 3: In-Memory / State Management (750 to 1140 / 25s - 38s)
    // Stage 4: Engine / Algorithm Calculation (1140 to 1500 / 38s - 50s)
    // Stage 5: Edge-Case / Safeguard Verification (1500 to end / 50s - 63.86s)

    const stageIndex = frame < 360 ? 0 : frame < 750 ? 1 : frame < 1140 ? 2 : frame < 1500 ? 3 : 4;
    const stageFrame = frame < 360 ? frame : frame < 750 ? frame - 360 : frame < 1140 ? frame - 750 : frame < 1500 ? frame - 1140 : frame - 1500;
    const stageSpring = spring({ frame: stageFrame, fps, config: { damping: 14, stiffness: 95 } });

    const activeStage = deepDiveStages?.[stageIndex];
    const stagePillText = activeStage?.stagePill || (
      stageIndex === 0
        ? 'STAGE 1/5 • TELEMETRY INGESTION'
        : stageIndex === 1
        ? 'STAGE 2/5 • SPATIAL INDEXING & MESH'
        : stageIndex === 2
        ? 'STAGE 3/5 • IN-MEMORY CACHE STATE'
        : stageIndex === 3
        ? 'STAGE 4/5 • CALCULATION ENGINE'
        : 'STAGE 5/5 • EDGE-CASE SAFEGUARD'
    );
    const stageTitleText = activeStage?.stageTitle || (
      stageIndex === 0
        ? 'Live Ingestion & Heartbeat Stream'
        : stageIndex === 1
        ? 'O(1) Spatial Resolution & Partitioning'
        : stageIndex === 2
        ? 'In-Memory Telemetry Counter Cache'
        : stageIndex === 3
        ? 'Engine Rule & Imbalance Evaluation'
        : 'Heartbeat Verification Safeguard'
    );

    return (
      <AbsoluteFill
        style={{
          overflow: 'hidden',
          background: 'transparent',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        {/* Universal Top HUD for Scene 3 */}
        <div
          style={{
            position: 'absolute',
            top: 180,
            left: 0,
            right: 0,
            textAlign: 'center',
            zIndex: 40,
            transform: `scale(${stageSpring})`,
            padding: '0 140px 0 60px',
          }}
        >
          {/* Stage Pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 24px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: `1.5px solid ${
                stageIndex === 0
                  ? '#38BDF8'
                  : stageIndex === 1
                  ? '#00F2FE'
                  : stageIndex === 2
                  ? '#F59E0B'
                  : stageIndex === 3
                  ? '#10B981'
                  : '#EF4444'
              }`,
              borderRadius: 999,
              boxShadow: `0 0 25px ${
                stageIndex === 0
                  ? 'rgba(56, 189, 248, 0.4)'
                  : stageIndex === 1
                  ? 'rgba(0, 242, 254, 0.4)'
                  : stageIndex === 2
                  ? 'rgba(245, 158, 11, 0.4)'
                  : stageIndex === 3
                  ? 'rgba(16, 185, 129, 0.4)'
                  : 'rgba(239, 68, 68, 0.5)'
              }`,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background:
                  stageIndex === 0
                    ? '#38BDF8'
                    : stageIndex === 1
                    ? '#00F2FE'
                    : stageIndex === 2
                    ? '#F59E0B'
                    : stageIndex === 3
                    ? '#10B981'
                    : '#EF4444',
                boxShadow: '0 0 10px currentColor',
              }}
            />
            <span
              style={{
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 2.5,
                color:
                  stageIndex === 0
                    ? '#38BDF8'
                    : stageIndex === 1
                    ? '#00F2FE'
                    : stageIndex === 2
                    ? '#FCD34D'
                    : stageIndex === 3
                    ? '#34D399'
                    : '#FCA5A5',
                textTransform: 'uppercase',
              }}
            >
              {stagePillText}
            </span>
          </div>

          <h1
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: '#FFFFFF',
              lineHeight: 1.15,
              margin: '0 0 8px 0',
              textShadow: '0 4px 30px rgba(0, 0, 0, 0.9)',
            }}
          >
            {stageTitleText}
          </h1>
        </div>

        {/* Dynamic Stage Canvas Container */}
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
            alignItems: 'center',
            zIndex: 30,
          }}
        >
          {/* ========================================================================= */}
          {/* CUT 3.1: RIDER GPS INGESTION (Frames 0 to 360)                            */}
          {/* ========================================================================= */}
          {stageIndex === 0 && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                transform: `scale(${stageSpring})`,
              }}
            >
              {/* Rider Mobile App Telemetry Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(15, 23, 42, 0.95) 100%)',
                  border: '2px solid rgba(56, 189, 248, 0.6)',
                  borderRadius: 28,
                  padding: '24px 28px',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 35px rgba(56, 189, 248, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <div
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 20,
                      background: 'rgba(56, 189, 248, 0.2)',
                      border: '1.5px solid #38BDF8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 34,
                      boxShadow: '0 0 25px rgba(56, 189, 248, 0.5)',
                    }}
                  >
                    🛵
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#38BDF8', letterSpacing: 2 }}>
                      RIDER MOBILE APP (CLIENT)
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', marginTop: 2 }}>
                      GPS: 12.9352° N, 77.6245° E
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#94A3B8', marginTop: 4 }}>
                      Availability Status: <span style={{ color: '#34D399' }}>ACTIVE & AVAILABLE 🟢</span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid #38BDF8',
                    borderRadius: 16,
                    padding: '10px 16px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8' }}>PING INTERVAL</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#38BDF8', marginTop: 2 }}>⚡ 5 SECONDS</div>
                </div>
              </div>

              {/* Animated Stream Beam into Gateway */}
              <div
                style={{
                  height: 60,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: '70%',
                    height: 4,
                    background: 'linear-gradient(90deg, #38BDF8 0%, #10B981 100%)',
                    boxShadow: '0 0 15px #38BDF8',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: `${((stageFrame * 4) % 100)}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      boxShadow: '0 0 20px #00F2FE, 0 0 40px #00F2FE',
                    }}
                  />
                </div>
              </div>

              {/* Ingestion Gateway Card */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1.5px solid rgba(16, 185, 129, 0.5)',
                  borderRadius: 24,
                  padding: '20px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 15px 40px rgba(0, 0, 0, 0.7)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 32 }}>📡</span>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#34D399' }}>
                      INGESTION GATEWAY / KAFKA STREAM
                    </div>
                    <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 2 }}>
                      Ingests 15,000+ driver heartbeats/second with sub-10ms processing latency
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    background: '#10B981',
                    color: '#FFFFFF',
                    padding: '6px 16px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  BUFFERED
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CUT 3.2: UBER H3 SPATIAL INDEXING (Frames 360 to 750)                     */}
          {/* ========================================================================= */}
          {stageIndex === 1 && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                transform: `scale(${stageSpring})`,
              }}
            >
              {/* Formula & Coordinate Mapping Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.16) 0%, rgba(15, 23, 42, 0.95) 100%)',
                  border: '2px solid rgba(0, 242, 254, 0.6)',
                  borderRadius: 28,
                  padding: '24px 28px',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 242, 254, 0.3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#00F2FE', letterSpacing: 2 }}>
                    UBER H3 SPATIAL INDEXING
                  </div>
                  <div
                    style={{
                      background: '#00F2FE',
                      color: '#0F172A',
                      fontWeight: 900,
                      fontSize: 14,
                      padding: '4px 14px',
                      borderRadius: 999,
                    }}
                  >
                    O(1) RESOLUTION
                  </div>
                </div>

                {/* Spatial Hash Equation */}
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.7)',
                    borderLeft: '5px solid #00F2FE',
                    borderRadius: 16,
                    padding: '16px 20px',
                    fontFamily: 'monospace',
                    fontSize: 22,
                    color: '#E0F2FE',
                    fontWeight: 800,
                  }}
                >
                  h3.geoToH3(12.9352, 77.6245, res=8) ➔ <span style={{ color: '#00F2FE' }}>"#88619A0A4"</span>
                </div>

                <div style={{ fontSize: 15, color: '#94A3B8', marginTop: 14, lineHeight: 1.4 }}>
                  Instead of querying polygons or radius distances, coordinates instantly map to an in-memory 64-bit integer Hex ID.
                </div>
              </div>

              {/* Hexagon Lattice Visual Display */}
              <div
                style={{
                  background: 'rgba(10, 15, 30, 0.9)',
                  border: '1.5px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 24,
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-around',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36 }}>⬡</div>
                  <div style={{ fontSize: 13, color: '#64748B', fontFamily: 'monospace' }}>#88619A0A1</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#38BDF8', marginTop: 2 }}>1.0x Normal</div>
                </div>

                <div
                  style={{
                    textAlign: 'center',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '2px solid #EF4444',
                    borderRadius: 18,
                    padding: '12px 20px',
                    boxShadow: '0 0 30px rgba(239, 68, 68, 0.5)',
                  }}
                >
                  <div style={{ fontSize: 44, color: '#EF4444' }}>⬢</div>
                  <div style={{ fontSize: 15, color: '#FFFFFF', fontWeight: 900, fontFamily: 'monospace' }}>#88619A0A4</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#EF4444', marginTop: 4 }}>3.0X SURGE HOTSPOT</div>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36 }}>⬡</div>
                  <div style={{ fontSize: 13, color: '#64748B', fontFamily: 'monospace' }}>#88619A0A2</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#38BDF8', marginTop: 2 }}>1.1x Normal</div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CUT 3.3: REDIS IN-MEMORY TELEMETRY (Frames 750 to 1140)                   */}
          {/* ========================================================================= */}
          {stageIndex === 2 && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                transform: `scale(${stageSpring})`,
              }}
            >
              {/* Redis Cluster Header Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(15, 23, 42, 0.95) 100%)',
                  border: '2px solid rgba(239, 68, 68, 0.6)',
                  borderRadius: 28,
                  padding: '22px 28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 35px rgba(239, 68, 68, 0.3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span style={{ fontSize: 36 }}>⚡</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#EF4444', letterSpacing: 2 }}>
                      REDIS IN-MEMORY CACHE
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', marginTop: 2 }}>
                      Hex Cell Key: `zone:88619A0A4`
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    background: '#10B981',
                    color: '#FFFFFF',
                    padding: '8px 18px',
                    borderRadius: 999,
                    fontWeight: 900,
                    fontSize: 16,
                    boxShadow: '0 0 15px rgba(16, 185, 129, 0.5)',
                  }}
                >
                  ⚡ &lt; 1.8ms LATENCY
                </div>
              </div>

              {/* Dual Counter Gauges: 100 Orders vs 20 Riders */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                {/* Orders Card */}
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '2px solid #EF4444',
                    borderRadius: 24,
                    padding: '24px 20px',
                    textAlign: 'center',
                    boxShadow: '0 0 25px rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <span style={{ fontSize: 32 }}>📦</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#FCA5A5', letterSpacing: 1.5, marginTop: 4 }}>
                    PENDING ORDERS
                  </div>
                  <div style={{ fontSize: 52, fontWeight: 900, color: '#FFFFFF', marginTop: 4 }}>
                    100
                  </div>
                  <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 800, marginTop: 4 }}>
                    🔥 HIGH DEMAND SPIKE
                  </div>
                </div>

                {/* Riders Card */}
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '2px solid #10B981',
                    borderRadius: 24,
                    padding: '24px 20px',
                    textAlign: 'center',
                    boxShadow: '0 0 25px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <span style={{ fontSize: 32 }}>🛵</span>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#A7F3D0', letterSpacing: 1.5, marginTop: 4 }}>
                    AVAILABLE RIDERS
                  </div>
                  <div style={{ fontSize: 52, fontWeight: 900, color: '#FFFFFF', marginTop: 4 }}>
                    20
                  </div>
                  <div style={{ fontSize: 13, color: '#10B981', fontWeight: 800, marginTop: 4 }}>
                    🌧️ SEVERE DEFICIT
                  </div>
                </div>
              </div>

              {/* Deficit Banner */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1.5px solid #F59E0B',
                  borderRadius: 18,
                  padding: '14px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 800, color: '#FCD34D' }}>
                  IMBALANCE RATIO: 100 ÷ 20 = 5.0 Orders / Rider
                </span>
                <span
                  style={{
                    background: '#F59E0B',
                    color: '#0F172A',
                    fontWeight: 900,
                    fontSize: 13,
                    padding: '4px 12px',
                    borderRadius: 8,
                  }}
                >
                  SURGE TRIGGERED
                </span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CUT 3.4: PRICING ENGINE MATH FORMULA (Frames 1140 to 1500)                 */}
          {/* ========================================================================= */}
          {stageIndex === 3 && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                transform: `scale(${stageSpring})`,
              }}
            >
              {/* Math Formula Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(15, 23, 42, 0.95) 100%)',
                  border: '2px solid rgba(16, 185, 129, 0.6)',
                  borderRadius: 28,
                  padding: '26px 30px',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 35px rgba(16, 185, 129, 0.3)',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 900, color: '#34D399', letterSpacing: 2, marginBottom: 14 }}>
                  PRICING ENGINE FORMULA EVALUATION
                </div>

                {/* Calculation Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: '#E2E8F0', fontWeight: 700 }}>
                    <span>📍 Base Delivery Fee (Standard)</span>
                    <span style={{ fontWeight: 900, color: '#FFFFFF' }}>₹30</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: '#60A5FA', fontWeight: 700 }}>
                    <span>🌧️ Rain & Weather Condition Surcharge</span>
                    <span style={{ fontWeight: 900 }}>+₹30</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: '#F87171', fontWeight: 700 }}>
                    <span>⚡ 5.0x Rider Supply Deficit Multiplier</span>
                    <span style={{ fontWeight: 900 }}>+₹30</span>
                  </div>

                  <div style={{ height: 2, background: 'rgba(255, 255, 255, 0.2)', margin: '6px 0' }} />

                  {/* Final Output */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 24, fontWeight: 900, color: '#34D399' }}>
                      TOTAL CUSTOMER FEE SHOWN:
                    </span>
                    <span
                      style={{
                        fontSize: 48,
                        fontWeight: 900,
                        color: '#FFFFFF',
                        background: '#10B981',
                        padding: '4px 24px',
                        borderRadius: 16,
                        boxShadow: '0 0 25px rgba(16, 185, 129, 0.6)',
                      }}
                    >
                      ₹90
                    </span>
                  </div>
                </div>
              </div>

              {/* App UI Feedback Notice */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1.5px solid #38BDF8',
                  borderRadius: 18,
                  padding: '16px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                <span style={{ fontSize: 28 }}>📱</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: '#FFFFFF' }}>
                    Customer App Displays: ₹90 Delivery Fee
                  </div>
                  <div style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
                    Base ₹30 + Extra ₹60 calculated instantly under 50ms based on local conditions
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* CUT 3.5: GHOST RIDER CACHE BUG (Frames 1500 to end)                      */}
          {/* ========================================================================= */}
          {stageIndex === 4 && (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                transform: `scale(${stageSpring})`,
              }}
            >
              {/* Warning Alert Card */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(15, 23, 42, 0.98) 100%)',
                  border: '2px solid #EF4444',
                  borderRadius: 28,
                  padding: '24px 28px',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 45px rgba(239, 68, 68, 0.5)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <span style={{ fontSize: 36 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#EF4444', letterSpacing: 2 }}>
                      THE CRITICAL ARCHITECTURAL CATCH
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#FFFFFF', marginTop: 2 }}>
                      The "Ghost Rider" Stale Cache Bug
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.7)',
                    borderRadius: 16,
                    padding: '16px 20px',
                    borderLeft: '5px solid #EF4444',
                  }}
                >
                  <div style={{ fontSize: 16, color: '#FCA5A5', fontWeight: 700 }}>
                    Rider goes offline in rain ➔ Old GPS remains cached in Redis!
                  </div>
                  <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 4 }}>
                    System mistakenly counts offline riders as available, suppressing needed surge!
                  </div>
                </div>
              </div>

              {/* Safeguard Solution Card */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '2px solid #10B981',
                  borderRadius: 24,
                  padding: '22px 28px',
                  boxShadow: '0 0 35px rgba(16, 185, 129, 0.3)',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 900, color: '#34D399', letterSpacing: 2, marginBottom: 8 }}>
                  THE ENGINEERING SOLUTION
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#FFFFFF', marginBottom: 12 }}>
                  Heartbeat TTL & Timestamp Verification
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 15, color: '#E2E8F0', fontWeight: 700 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>⏱️</span>
                    <span>Every GPS ping carries high-precision timestamp & active delivery flag</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>🗑️</span>
                    <span>If (now - last_heartbeat) &gt; 30s ➔ Evict rider from Redis pool instantly</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span>✅</span>
                    <span>Guarantees surge pricing always reflects real-world availability!</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  // Classic fallback for short scenes (duration <= 500 frames)
  const node1Label = steps?.[0]?.label || 'CLIENT APP';
  const node1Desc = steps?.[0]?.description || 'High Traffic Request';
  const node2Label = steps?.[1]?.label || 'API GATEWAY';
  const node2Desc = steps?.[1]?.description || 'Route to Cache';
  const node3Label = steps?.[2]?.label || 'REDIS CLUSTER';
  const node3Desc = steps?.[2]?.description || 'In-Memory O(1) Lookup';
  const node4Label = steps?.[3]?.label || 'PRIMARY DB';
  const node4Desc = steps?.[3]?.description || 'Disk I/O Bottleneck';

  // Primary Read laser packets cycling along horizontal line: Node 1 (220, 960) -> Node 2 (540, 960) -> Node 3 (860, 960)
  const packetCycle = 36;
  const t1 = (frame % packetCycle) / packetCycle;
  const t2 = ((frame + 18) % packetCycle) / packetCycle;
  const p1X = interpolate(t1, [0, 1], [220, 860]);
  const p2X = interpolate(t2, [0, 1], [220, 860]);
  const readLaserY = 960;

  // Database crash shake
  const dbShake = frame >= 25 ? Math.sin(frame * 2.5) * 4 : 0;

  // Quadratic Bezier from Kafka (540, 1340) with control point (860, 1340) to Redis (860, 1030)
  const kafkaCycle = 30;
  const kt = (frame % kafkaCycle) / kafkaCycle;
  const p0x = 540;
  const p0y = 1340;
  const p1x = 860;
  const p1y = 1340;
  const p2x = 860;
  const p2y = 1030;
  const oneMinusKt = 1 - kt;
  const kafkaPacketX = oneMinusKt * oneMinusKt * p0x + 2 * oneMinusKt * kt * p1x + kt * kt * p2x;
  const kafkaPacketY = oneMinusKt * oneMinusKt * p0y + 2 * oneMinusKt * kt * p1y + kt * kt * p2y;

  return (
    <AbsoluteFill
      style={{
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      {/* Top Floating Sleek Title HUD */}
      <div
        style={{
          position: 'absolute',
          top: 180,
          left: 0,
          right: 0,
          textAlign: 'center',
          zIndex: 40,
          transform: `scale(${entrance})`,
          padding: '0 140px 0 60px',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 28px',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(20px)',
            border: '1.5px solid rgba(16, 185, 129, 0.5)',
            borderRadius: 999,
            boxShadow: '0 0 35px rgba(16, 185, 129, 0.35)',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#10B981',
              boxShadow: '0 0 12px #10B981',
            }}
          />
          <span
            style={{
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: 3,
              color: '#34D399',
              textTransform: 'uppercase',
            }}
          >
            REAL-TIME PIPELINE UNDER 50MS
          </span>
        </div>

        <h1
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.15,
            margin: '0 0 10px 0',
            textShadow: '0 4px 30px rgba(0, 0, 0, 0.9)',
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: '#94A3B8',
            margin: 0,
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.9)',
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* FULL-CANVAS SVG LASER CIRCUIT & PIPELINE */}
      <svg
        viewBox="0 0 1080 1920"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <defs>
          <linearGradient id="neonCyanGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="purpleStream" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#A855F7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* 1. Primary In-Memory Highway: App (220, 960) -> Gateway (540, 960) -> Redis (860, 960) */}
        <line
          x1="220"
          y1="960"
          x2="860"
          y2="960"
          stroke="url(#neonCyanGlow)"
          strokeWidth="8"
          strokeDasharray="14 8"
          filter="drop-shadow(0 0 14px #00F2FE)"
        />

        {/* 2. Bypassed Slow Database Route: Gateway (540, 960) to Postgres (540, 620) */}
        <line
          x1="540"
          y1="960"
          x2="540"
          y2="620"
          stroke="#EF4444"
          strokeWidth="5"
          strokeDasharray="8 8"
          opacity="0.6"
        />

        {/* 3. Kafka GPS Background Sync: Kafka (540, 1340) -> Redis (860, 960) */}
        <path
          d="M 540 1340 Q 860 1340 860 1030"
          fill="none"
          stroke="url(#purpleStream)"
          strokeWidth="6"
          strokeDasharray="12 6"
          filter="drop-shadow(0 0 12px #A855F7)"
        />

        {/* Primary Laser Read Packet 1 */}
        <g transform={`translate(${p1X}, ${readLaserY})`}>
          <circle r="18" fill="#00F2FE" filter="drop-shadow(0 0 24px #00F2FE)" />
          <circle r="8" fill="#FFFFFF" />
          <rect
            x="-70"
            y="-52"
            width="140"
            height="34"
            rx="17"
            fill="rgba(15, 23, 42, 0.95)"
            stroke="#00F2FE"
            strokeWidth="2"
            filter="drop-shadow(0 0 15px rgba(0, 242, 254, 0.7))"
          />
          <text
            x="0"
            y="-30"
            textAnchor="middle"
            fill="#38BDF8"
            fontSize="15"
            fontWeight="900"
            fontFamily="sans-serif"
          >
            ⚡ GET &lt;4ms
          </text>
        </g>

        {/* Primary Laser Read Packet 2 (Smoothly Follows Behind on Highway) */}
        <g transform={`translate(${p2X}, ${readLaserY})`}>
          <circle r="12" fill="#10B981" filter="drop-shadow(0 0 18px #10B981)" />
          <circle r="5" fill="#FFFFFF" />
        </g>

        {/* Kafka GPS Stream Packet (Strictly Aligned Along the Glowing Bezier Curve) */}
        <g transform={`translate(${kafkaPacketX}, ${kafkaPacketY})`}>
          <circle r="16" fill="#A855F7" filter="drop-shadow(0 0 22px #A855F7)" />
          <circle r="7" fill="#FFFFFF" />
        </g>
      </svg>

      {/* NODE 1: SOURCE / CLIENT (Left, Center: 220, 960) */}
      <div
        style={{
          position: 'absolute',
          left: 220,
          top: 960,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 36,
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '2.5px solid #38BDF8',
            boxShadow: '0 0 40px rgba(56, 189, 248, 0.5), inset 0 0 20px rgba(56, 189, 248, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 54,
          }}
        >
          📱
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF' }}>{node1Label}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#38BDF8', marginTop: 2 }}>{node1Desc}</div>
        </div>
      </div>

      {/* NODE 2: GATEWAY / DEMUX (Center, Center: 540, 960) */}
      <div
        style={{
          position: 'absolute',
          left: 540,
          top: 960,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 36,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '2.5px solid #F59E0B',
            boxShadow: '0 0 40px rgba(245, 158, 11, 0.5), inset 0 0 20px rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 54,
          }}
        >
          ⚡
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF' }}>{node2Label}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#FCD34D', marginTop: 2 }}>{node2Desc}</div>
        </div>
      </div>

      {/* NODE 3: CACHE / MICROTASK QUEUE (Right, Center: 860, 960) */}
      <div
        style={{
          position: 'absolute',
          left: 860,
          top: 960,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: 40,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.35) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '3px solid #10B981',
            boxShadow: '0 0 60px rgba(16, 185, 129, 0.7), inset 0 0 30px rgba(16, 185, 129, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LottieAsset name="server" style={{ width: 70, height: 70 }} />
          <span style={{ fontSize: 20, fontWeight: 900, color: '#34D399', marginTop: 2 }}>{redisLatencyMs} MS</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#34D399' }}>{node3Label}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#A7F3D0', marginTop: 2 }}>{node3Desc}</div>
        </div>
      </div>

      {/* NODE 4: BYPASSED SLOW PATH (Top, Center: 540, 620) */}
      <div
        style={{
          position: 'absolute',
          left: 540 + dbShake,
          top: 620,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div
          style={{
            width: 280,
            padding: '16px 24px',
            borderRadius: 24,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2.5px dashed #EF4444',
            boxShadow: '0 0 35px rgba(239, 68, 68, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <LottieAsset name="database" style={{ width: 50, height: 50 }} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#F87171' }}>{node4Label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#EF4444' }}>⚠️ {node4Desc}</div>
          </div>
        </div>
        {/* Red Warning Bypass Tag */}
        <div
          style={{
            padding: '6px 18px',
            borderRadius: 999,
            background: '#EF4444',
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: 900,
            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.6)',
          }}
        >
          ⚡ OFFLOADED FROM READ PATH
        </div>
      </div>

      {/* NODE 5: KAFKA REAL-TIME GPS STREAM (Bottom, Center: 540, 1340) */}
      <div
        style={{
          position: 'absolute',
          left: 540,
          top: 1340,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          zIndex: 30,
        }}
      >
        <div
          style={{
            width: 320,
            padding: '16px 24px',
            borderRadius: 24,
            background: 'rgba(168, 85, 247, 0.15)',
            border: '2px solid #A855F7',
            boxShadow: '0 0 35px rgba(168, 85, 247, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <span style={{ fontSize: 40 }}>📡</span>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#C084FC' }}>KAFKA EVENT STREAM</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#E9D5FF' }}>🛵 10,000+ Driver GPS Pings / Sec</div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Visual Takeaway HUD (Safely above captions & Reels UI) */}
      <div
        style={{
          position: 'absolute',
          bottom: 530,
          left: 60,
          right: 140,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 40,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 16,
            padding: '18px 36px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '2px solid #10B981',
            borderRadius: 24,
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), 0 0 35px rgba(16, 185, 129, 0.35)',
          }}
        >
          <span style={{ fontSize: 32 }}>⚡</span>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#34D399', letterSpacing: 1.5 }}>
              READ PATH HITS REDIS IN 4MS • ZERO DISK LOCKS
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#94A3B8', marginTop: 2 }}>
              Writes happen asynchronously in background via Kafka. User never waits on SQL!
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
