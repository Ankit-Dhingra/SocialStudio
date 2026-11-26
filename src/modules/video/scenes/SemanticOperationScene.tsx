import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens as design } from '../design-system.js';
import { motionEase, PremiumCard } from '../PremiumVisuals.js';
import type { SemanticOperation } from '../semantic-operation.js';

const { colors, typography } = design;
const text = { fontSize: typography.node, fontWeight: 700 };

function AssetGlyph({ symbol, color = colors.cyan }: { symbol: 'people' | 'documents' | 'jobs'; color?: string }) {
  const path = symbol === 'people' ? 'M16 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM7 27v-2a9 9 0 0 1 18 0v2'
    : symbol === 'documents' ? 'M7 4h12l6 6v18H7zM19 4v7h6M11 16h10m-10 5h10'
      : 'M4 10 16 5l12 5v14l-12 5-12-5zM4 10l12 6 12-6M16 16v13';
  return <svg viewBox="0 0 32 32" width="38" height="38" aria-hidden>
    <path d={path} fill="none" stroke={color} strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" />
  </svg>;
}

export function SemanticOperationScene({ operation }: { operation: SemanticOperation }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = (from: number) => interpolate(frame, [from, from + fps * design.motion.enter], [0, 1], motionEase);

  if (operation.kind === 'group') {
    return <AbsoluteFill>
      <div style={{ position: 'absolute', left: 88, right: 144, top: 358, height: 805, opacity: .55 + .45 * enter(operation.from) }}>
        <svg viewBox="0 0 848 805" preserveAspectRatio="none" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} aria-hidden>
          {operation.shape === 'hexagon' ? <path d="M152 60H696L830 402 696 745H152L18 402Z"
            fill={colors.cyan + '08'} stroke={colors.cyan} strokeOpacity=".55" strokeWidth="2.5" />
            : <rect x="18" y="60" width="812" height="685" rx="45" fill={colors.cyan + '08'} stroke={colors.border} strokeWidth="2" />}
        </svg>
        <div style={{ position: 'absolute', top: 138, left: 150, right: 150, textAlign: 'center', fontSize: 48, fontWeight: 750 }}>{operation.label}</div>
        <div style={{ position: 'absolute', top: 270, left: 125, right: 125, display: 'grid',
          gridTemplateColumns: `repeat(${operation.measures.length}, minmax(0, 1fr))`, gap: 26 }}>
          {operation.measures.map(measure => {
            const progress = enter(measure.from);
            const visible = Math.min(20, measure.amount);
            const count = Math.round(visible * progress);
            return <div key={measure.label} style={{ textAlign: 'center', opacity: progress, minWidth: 0 }}>
              <div style={{ color: colors.cyan, fontFamily: typography.fontFamilyMono, fontSize: measure.amount >= 1000 ? 38 : 64, fontWeight: 750 }}>{measure.amount}</div>
              <div style={{ ...text, overflowWrap: 'anywhere', marginBottom: 22 }}>{measure.label}</div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${operation.measures.length === 3 ? 4 : 5}, 38px)`, justifyContent: 'center', gap: 5 }}>
                {Array.from({ length: visible }, (_, index) => <div key={index} style={{ opacity: index < count ? 1 : 0.10 }}>
                  <AssetGlyph symbol={measure.symbol} />
                </div>)}
              </div>
              {measure.amount > visible && <div style={{ color: colors.secondary, marginTop: 9, fontSize: 22 }}>+{measure.amount - visible}</div>}
            </div>;
          })}
        </div>
      </div>
    </AbsoluteFill>;
  }

  if (operation.kind === 'expiry') {
    const expired = frame >= operation.expires && frame < operation.replaces;
    const fresh = frame >= operation.replaces;
    const color = fresh ? colors.success : expired ? colors.error : colors.cyan;
    const remaining = fresh ? 1 : interpolate(frame, [operation.from, operation.expires], [1, 0], motionEase);
    return <AbsoluteFill>
      <div style={{ position: 'absolute', left: 300, top: 460, width: 422, height: 422, opacity: .55 + .45 * enter(operation.from) }}>
        <svg viewBox="0 0 420 420" width="100%" height="100%" aria-hidden>
          <circle cx="210" cy="210" r="185" fill={colors.surface} stroke={colors.border} strokeWidth="6" />
          <circle cx="210" cy="210" r="185" fill="none" pathLength="100" stroke={color} strokeWidth="7"
            transform="rotate(-90 210 210)" strokeLinecap="round" strokeDasharray={`${remaining * 100} 100`} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', justifyItems: 'center', gap: 19, textAlign: 'center' }}>
          <AssetGlyph symbol="documents" color={color} />
          <div style={{ fontSize: 44, fontWeight: 750, maxWidth: 330, overflowWrap: 'anywhere', textDecoration: expired ? 'line-through' : 'none' }}>{operation.label}</div>
          <div style={{ color, fontSize: 27, fontFamily: typography.fontFamilyMono }}>{fresh ? 'Naya' : expired ? 'Expired' : 'TTL'}</div>
        </div>
      </div>
    </AbsoluteFill>;
  }

  if (operation.kind === 'selection') {
    const selected = frame >= operation.selects;
    const miss = operation.outcome === 'miss';
    const processor = operation.processor;
    const moving = processor && frame >= processor.from && frame < operation.ends;
    const origin = operation.candidates.indexOf(operation.selected) % 2 === 0 ? 25 : 75;
    const arrival = processor ? interpolate(frame,
      [processor.from, Math.min(processor.from + fps * design.motion.packet, operation.ends)], [0, 1], motionEase) : 0;
    return <AbsoluteFill>
      <div style={{ position: 'absolute', top: 406, left: 100, right: 142, opacity: .62 + .38 * enter(operation.from) }}>
        <div style={{ ...text, marginBottom: 55 }}>{operation.query}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 24 }}>
          {operation.candidates.map(label => <PremiumCard key={label}
            state={selected && label === operation.selected ? miss ? 'warning' : 'active' : 'default'}
            style={{ display: 'flex', minHeight: 134, gap: 17, alignItems: 'center', opacity: selected && label !== operation.selected ? .50 : 1 }}>
            <AssetGlyph symbol="documents" color={selected && label === operation.selected && miss ? colors.warning : colors.cyan} />
            <span style={{ ...text, fontSize: typography.description, overflowWrap: 'anywhere', minWidth: 0 }}>{label}</span>
          </PremiumCard>)}
        </div>
        {processor && <div style={{ position: 'relative', paddingTop: 116, display: 'grid', justifyItems: 'center' }}>
          <svg width="100%" height="116" viewBox="0 0 100 116" preserveAspectRatio="none" aria-hidden
            style={{ position: 'absolute', top: 0, left: 0, opacity: enter(processor.from) }}>
            <path d={`M${origin} 0 L50 116`} fill="none" vectorEffect="non-scaling-stroke"
              stroke={moving ? miss ? colors.warning : colors.cyan : colors.border} strokeDasharray="5 6" strokeWidth="2" />
          </svg>
          {moving && <div style={{ position: 'absolute', left: `${origin + (50 - origin) * arrival}%`,
            top: 116 * arrival, translate: '-50% -50%', background: colors.canvas }}>
            <AssetGlyph symbol="documents" color={miss ? colors.warning : colors.cyan} />
          </div>}
          <PremiumCard state={moving ? 'processing' : 'default'} style={{ opacity: enter(processor.from), textAlign: 'center',
            minWidth: 230, ...text }}>{processor.label}</PremiumCard>
        </div>}
        <div style={{ marginTop: processor ? 26 : 48, color: miss ? colors.error : colors.success, fontSize: 47, fontWeight: 750,
          opacity: enter(operation.ends), overflowWrap: 'anywhere' }}>{operation.result}</div>
      </div>
    </AbsoluteFill>;
  }

  const phase = operation.steps.reduce((latest, step, index) => step.from <= frame ? index : latest, -1);
  const step = operation.steps[phase];
  const position = { enqueue: 0, dispatch: 1, complete: 2 };
  const x = step ? interpolate(frame, [step.from, step.from + fps * design.motion.packet], [
    phase ? position[operation.steps[phase - 1].action] : -0.36, position[step.action],
  ], motionEase) : -0.36;
  return <AbsoluteFill>
    <div style={{ position: 'absolute', left: 100, top: 570, width: 826 }}>
      <div style={{ position: 'absolute', left: 95, right: 95, top: 107, borderTop: `2px dashed ${colors.border}` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {['Queue', 'Dispatch', 'Complete'].map((label, index) => <div key={label} style={{ width: 178, textAlign: 'center', color: step && position[step.action] === index ? colors.cyan : colors.secondary }}>
          <div style={{ ...text, marginBottom: 28 }}>{label}</div>
          <div style={{ height: 94, border: `1px solid ${colors.border}`, borderRadius: 16, background: colors.surface }} />
        </div>)}
      </div>
      {step && <div style={{ position: 'absolute', top: 85, left: 89 + 324 * x, translate: '-50% 0', display: 'grid', justifyItems: 'center',
        gap: 2, fontSize: 20, color: step.action === 'complete' ? colors.success : colors.ink }}>
        <AssetGlyph symbol="jobs" color={step.action === 'complete' ? colors.success : colors.cyan} />{operation.label}
      </div>}
    </div>
  </AbsoluteFill>;
}
