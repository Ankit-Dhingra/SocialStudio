import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimedShot } from '../visual-story.js';
import { ScreenActivity } from './ScreenActivity.js';
import { BrandMark } from './CinematicStage.js';
import { PremiumCard } from '../PremiumVisuals.js';
import { VideoDesignTokens as design } from '../design-system.js';

export function DesktopDemo({ shot }: { shot: Extract<TimedShot, { kind: 'device' }> }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = interpolate(frame, [0, fps * 0.45], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });
  const document = shot.screenContent === 'document';
  return <AbsoluteFill style={{ color: design.colors.ink, justifyContent: 'center',
    padding: document ? '145px 89px 530px 72px' : '150px 140px 490px 80px' }}>
    <PremiumCard style={{ opacity: document ? .82 + .18 * entrance : entrance,
      translate: `0 ${(1 - entrance) * 30}px`, overflow: 'hidden', padding: 0 }}>
      <div style={{ minHeight: 77, display: 'flex', alignItems: 'center', gap: 20, padding: '16px 28px',
        background: design.colors.elevated, fontWeight: 730,
        fontSize: document ? 43 : design.typography.node, boxSizing: 'border-box' }}>
        <div aria-hidden style={{ display: 'flex', gap: 10 }}>
          {[0, 1, 2].map(index => (
            <span key={index} style={{ width: 10, height: 10, borderRadius: '50%', background: design.colors.muted }} />
          ))}
        </div>
        <BrandMark brand={shot.appName} size={37} />
        {shot.appName || shot.headline}
      </div>
      <ScreenActivity shot={shot} />
    </PremiumCard>
  </AbsoluteFill>;
}
