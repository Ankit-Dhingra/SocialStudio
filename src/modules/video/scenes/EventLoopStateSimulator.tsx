import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens } from '../design-system.js';

interface SimulatorStep {
  label: string;
  callStack: string[];
  webApis: string[];
  microtasks: string[];
  macrotasks: string[];
  terminal: { text: string; source: string; highlight?: boolean }[];
  explanation: string;
}

const SIMULATOR_STEPS: SimulatorStep[] = [
  // Step 0: Sync execution 1
  {
    label: 'Step 1/5: Synchronous Code',
    callStack: ['main()', 'console.log("1")'],
    webApis: [],
    microtasks: [],
    macrotasks: [],
    terminal: [{ text: '1', source: 'Call Stack' }],
    explanation: 'console.log(1) runs synchronously on the Call Stack.',
  },
  // Step 1: setTimeout offloaded
  {
    label: 'Step 2/5: setTimeout Offloaded',
    callStack: ['main()'],
    webApis: ['Timer (0ms)'],
    microtasks: [],
    macrotasks: [],
    terminal: [{ text: '1', source: 'Call Stack' }],
    explanation: 'setTimeout(..., 0) is handed off to Web APIs/Libuv thread.',
  },
  // Step 2: Promise to Microtask Queue
  {
    label: 'Step 3/5: Promise to Microtask Queue',
    callStack: ['main()'],
    webApis: ['Timer (0ms)'],
    microtasks: ['Promise.then(3)'],
    macrotasks: [],
    terminal: [{ text: '1', source: 'Call Stack' }],
    explanation: 'Promise.then callback enters the high-priority Microtask Queue.',
  },
  // Step 3: Sync execution 4 & Stack Clears
  {
    label: 'Step 4/5: Stack Clears & Drains Microtasks',
    callStack: ['[STACK EMPTY]'],
    webApis: [],
    microtasks: ['Promise.then(3)'],
    macrotasks: ['Timer Callback(2)'],
    terminal: [
      { text: '1', source: 'Call Stack' },
      { text: '4', source: 'Call Stack' },
      { text: '3', source: 'Microtask Queue', highlight: true },
    ],
    explanation: 'Stack empty! Event loop MUST drain all Microtasks before Macrotasks.',
  },
  // Step 4: Final Macrotask execution
  {
    label: 'Step 5/5: Final Macrotask Runs',
    callStack: ['setTimeout Callback(2)'],
    webApis: [],
    microtasks: ['[QUEUE EMPTY]'],
    macrotasks: [],
    terminal: [
      { text: '1', source: 'Call Stack' },
      { text: '4', source: 'Call Stack' },
      { text: '3', source: 'Microtask Queue', highlight: true },
      { text: '2', source: 'Macrotask Queue' },
    ],
    explanation: 'Only after Microtasks are 0, the Macrotask (2) finally executes!',
  },
];

export const EventLoopStateSimulator: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Progress through the 5 steps across the scene duration
  const stepDuration = durationInFrames / SIMULATOR_STEPS.length;
  const currentStepIndex = Math.min(
    SIMULATOR_STEPS.length - 1,
    Math.floor(frame / stepDuration)
  );
  const currentStep = SIMULATOR_STEPS[currentStepIndex];

  const loopRotate = (frame * 3) % 360;

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
        gap: 16,
      }}
    >
      {/* Step Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            padding: '6px 16px',
            background: 'rgba(0, 242, 254, 0.15)',
            border: '1.5px solid #00F2FE',
            borderRadius: 20,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 2,
            color: '#00F2FE',
          }}
        >
          {currentStep.label}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: '2px dashed #A855F7',
              transform: `rotate(${loopRotate}deg)`,
            }}
          />
          <span style={{ fontSize: 16, fontWeight: 800, color: '#A855F7' }}>EVENT LOOP ACTIVE</span>
        </div>
      </div>

      {/* Main 2x2 Architectural Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          background: 'rgba(11, 19, 43, 0.85)',
          border: '2px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 20,
          padding: 20,
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Box 1: Call Stack */}
        <div
          style={{
            background: '#0F172A',
            border: '2px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 14,
            padding: 14,
            minHeight: 140,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, color: '#38BDF8', letterSpacing: 1, marginBottom: 8 }}>
            📥 CALL STACK (LIFO)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: 6, flex: 1 }}>
            {currentStep.callStack.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 800,
                  background: item.includes('EMPTY') ? 'rgba(16, 185, 129, 0.2)' : 'linear-gradient(90deg, #0284C7, #0369A1)',
                  color: item.includes('EMPTY') ? '#10B981' : '#FFFFFF',
                  border: item.includes('EMPTY') ? '1px dashed #10B981' : 'none',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Box 2: Web APIs / Libuv */}
        <div
          style={{
            background: '#0F172A',
            border: '2px solid rgba(148, 163, 184, 0.3)',
            borderRadius: 14,
            padding: 14,
            minHeight: 140,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 900, color: '#94A3B8', letterSpacing: 1, marginBottom: 8 }}>
            ⚙️ WEB APIS / LIBUV
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {currentStep.webApis.length === 0 ? (
              <span style={{ fontSize: 14, color: '#475569', fontStyle: 'italic', marginTop: 10 }}>Idle</span>
            ) : (
              currentStep.webApis.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    background: 'rgba(148, 163, 184, 0.15)',
                    color: '#E2E8F0',
                    border: '1px solid #475569',
                  }}
                >
                  {item}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Box 3: Microtask Queue (PRIORITY) */}
        <div
          style={{
            background: 'rgba(0, 242, 254, 0.08)',
            border: '2px solid #00F2FE',
            borderRadius: 14,
            padding: 14,
            minHeight: 140,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 0 20px rgba(0, 242, 254, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#00F2FE' }}>⚡ MICROTASK QUEUE</span>
            <span style={{ fontSize: 11, fontWeight: 900, background: '#00F2FE', color: '#050914', padding: '2px 6px', borderRadius: 4 }}>
              DRAINS 1ST
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {currentStep.microtasks.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 800,
                  background: item.includes('EMPTY') ? 'transparent' : 'rgba(0, 242, 254, 0.2)',
                  color: item.includes('EMPTY') ? '#64748B' : '#E0F2FE',
                  border: item.includes('EMPTY') ? '1px dashed #64748B' : '1px solid #00F2FE',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Box 4: Macrotask Queue */}
        <div
          style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '2px solid #F59E0B',
            borderRadius: 14,
            padding: 14,
            minHeight: 140,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#F59E0B' }}>⏱️ MACROTASK QUEUE</span>
            <span style={{ fontSize: 11, fontWeight: 900, background: '#F59E0B', color: '#050914', padding: '2px 6px', borderRadius: 4 }}>
              NEXT TICK
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            {currentStep.macrotasks.length === 0 ? (
              <span style={{ fontSize: 14, color: '#475569', fontStyle: 'italic', marginTop: 10 }}>Empty</span>
            ) : (
              currentStep.macrotasks.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    background: 'rgba(245, 158, 11, 0.18)',
                    color: '#FEF3C7',
                    border: '1px solid #F59E0B',
                  }}
                >
                  {item}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live Terminal Output Window */}
      <div
        style={{
          background: '#030712',
          border: '1.5px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 16,
          padding: 16,
          fontFamily: VideoDesignTokens.typography.fontFamilyMono,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 900, color: '#10B981', letterSpacing: 1 }}>
            LIVE CONSOLE OUTPUT:
          </span>
          <span style={{ fontSize: 13, color: '#94A3B8' }}>Execution Order: 1 ➔ 4 ➔ 3 ➔ 2</span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {currentStep.terminal.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                background: item.highlight ? 'rgba(0, 242, 254, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                border: item.highlight ? '1px solid #00F2FE' : '1px solid transparent',
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 900, color: item.highlight ? '#00F2FE' : '#10B981' }}>
                &gt; {item.text}
              </span>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>({item.source})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Causal Explanation Banner */}
      <div
        style={{
          padding: '12px 18px',
          background: 'linear-gradient(90deg, #1E1B4B, #0F172A)',
          borderLeft: '6px solid #00F2FE',
          borderRadius: 12,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800, color: '#F8FAFC', lineHeight: 1.3 }}>
          💡 <span style={{ color: '#00F2FE' }}>The Reality:</span> {currentStep.explanation}
        </div>
      </div>
    </AbsoluteFill>
  );
};
