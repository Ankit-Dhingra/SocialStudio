import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { PremiumCard } from '../PremiumVisuals.js';
import { VideoDesignTokens as design } from '../design-system.js';

interface CollectionProps {
  title: string;
  items?: {label: string; selected: boolean}[];
  result: string;
  revealFrame: number;
}

export function CollectionScene({title, items = [], result, revealFrame}: CollectionProps) {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [revealFrame, revealFrame + 8], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{justifyContent: 'center', padding: '180px 140px 520px 84px', color: design.colors.ink}}>
    <h2 style={{fontSize: design.typography.title, marginBottom: 36}}>{title}</h2>
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18}}>
      {items.map((item, index) => <PremiumCard key={index} state={item.selected && reveal > 0 ? 'active' : 'default'} style={{
        padding: '24px 22px', fontSize: design.typography.node, overflowWrap: 'anywhere',
        opacity: item.selected ? 1 : 1 - 0.65 * reveal,
      }}>{item.label}</PremiumCard>)}
    </div>
    <p style={{fontSize: 36, color: design.colors.cyan, opacity: reveal}}>{result}</p>
  </AbsoluteFill>;
}
