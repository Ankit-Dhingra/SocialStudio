import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { VideoDesignTokens as design } from '../design-system.js';
import { canonicalBrandText, reelBrand } from '../brand.js';

const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const;

export function BrandOutro({ narration }: { narration: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const action = /\bfollow\b|फॉलो/iu.test(narration) ? 'Follow for more' : /\b(?:save|bookmark)\b|सेव/iu.test(narration) ? 'Save this breakdown'
    : /\bshare\b|शेयर/iu.test(narration) ? 'Share this breakdown' : canonicalBrandText(narration);
  const enter = interpolate(frame, [0, fps * 0.55], [0, 1], ease);
  const reveal = interpolate(frame, [fps * 0.22, fps * 0.83], [0, 1], ease);
  return <AbsoluteFill style={{ color: design.colors.ink, fontFamily: design.typography.fontFamilySans }}>
    <div style={{ position: 'absolute', top: 630, left: 108, width: 812, borderTop: `2px solid ${design.colors.cyan}`,
      paddingTop: 42, opacity: enter, translate: `0 ${(1 - enter) * 36}px` }}>
      <div style={{ fontSize: 91, fontWeight: 800, letterSpacing: -3, lineHeight: 0.99 }}>{reelBrand.name}</div>
      <div style={{ marginTop: 36, padding: '24px 28px', display: 'inline-block', background: design.colors.surface, color: design.colors.ink,
        fontSize: action.length > 55 ? 34 : 47, lineHeight: 1.15, fontWeight: 750, borderRadius: 12, opacity: reveal,
        translate: `0 ${(1 - reveal) * 14}px` }}>{action}</div>
    </div>
  </AbsoluteFill>;
}
