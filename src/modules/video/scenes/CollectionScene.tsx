import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

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
  return <AbsoluteFill style={{justifyContent: 'center', padding: '180px 84px 280px', color: '#f3f4f6'}}>
    <h2 style={{fontSize: 56, marginBottom: 36}}>{title}</h2>
    <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18}}>
      {items.map((item, index) => <div key={index} style={{
        padding: '28px 22px', fontSize: 34, borderRadius: 16, background: '#142033',
        border: '3px solid ' + (item.selected && reveal > 0 ? '#62dfb5' : '#465268'),
        opacity: item.selected ? 1 : 1 - 0.65 * reveal,
      }}>{item.label}</div>)}
    </div>
    <p style={{fontSize: 36, color: '#ffd37c', opacity: reveal}}>{result}</p>
  </AbsoluteFill>;
}
