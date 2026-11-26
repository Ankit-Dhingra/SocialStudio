import React from 'react';
import { AbsoluteFill, Composition, Easing, Img, interpolate, registerRoot, useCurrentFrame, useVideoConfig } from 'remotion';
import { cutPath, getLength, getPointAtLength } from '@remotion/paths';

export interface ReferenceNode {
  tag: string;
  props: Record<string, string>;
  children: Array<ReferenceNode | string>;
}

type Props = { source: string; tree: ReferenceNode; mode: 'original' | 'static' | 'animated' };
const stages = [0, 0, 0, 0, 0, 1.28, 1.28, 1.28, 2, 2, 2, 2.35, 2.35, 2.35,
  2.7, 2.7, 2.7, 3.3, 3.95, 3.95, 4.7, 5, 5, 6.35, 5.36, 5.36, 6.7, 5.72, 5.72, 7.05, 6.35];
const routes = new Set([5, 17, 20, 23, 26, 29]);
const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) } as const;

function element(node: ReferenceNode | string, key: number): React.ReactNode {
  return typeof node === 'string' ? node : React.createElement(node.tag, { ...node.props, key }, node.children.map(element));
}

function GoldenReference({ source, tree, mode }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const active = mode === 'animated';
  const zoom = active ? interpolate(t, [0, 3, 5.5, 8.8], [1.26, 1.16, 1.07, 1], ease) : 1;
  return <AbsoluteFill style={{ background: '#05070B', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ position: 'absolute', inset: 0, backgroundSize: '48px 48px',
      backgroundImage: 'linear-gradient(#ffffff0d 1px, transparent 1px), linear-gradient(90deg,#ffffff0d 1px, transparent 1px)' }} />
    {mode === 'original' ? <Img src={source} style={{ width: 960, height: 960 * 350 / 340 }} />
      : <svg {...tree.props} style={{ width: 960, height: 960 * 350 / 340, overflow: 'visible',
        transform: `scale(${zoom})`, transformOrigin: '50% 18%' }}>
        {tree.children.map((node, index) => {
          if (typeof node === 'string' || !active || index < 4) return element(node, index);
          if (index === 6) return null; // The parked reference packet becomes a moving packet.
          const start = stages[index] ?? 0;
          const progress = interpolate(t, [start, start + (routes.has(index) ? .64 : .36)], [0, 1], ease);
          if (routes.has(index)) {
            const path = node.props.d;
            const length = getLength(path);
            const drawn = progress > 0 ? cutPath(path, progress * length) : null;
            const position = getPointAtLength(path, length * progress);
            return <g key={index}>{drawn && <path {...node.props} d={drawn} />}
              {position && progress > 0 && progress < 1 && <circle cx={position.x} cy={position.y} r={2.6} fill={node.props.stroke} />}</g>;
          }
          const rise = index === 4 ? 7 : 2;
          return <g key={index} opacity={progress} transform={`translate(0 ${(1 - progress) * rise})`}>{element(node, index)}</g>;
        })}
        {active && <path d={`M 49 ${interpolate(t, [.46, 1.24], [86, 130], ease)} H 97`}
          stroke="#67E8F9" strokeWidth="1.4" opacity={interpolate(t, [.46, .64, 1.02, 1.28], [0, .82, .82, 0], ease)} />}
        {active && <rect x="96" y="200" width="148" height="32" rx="6" fill="none" stroke="#8B5CF6"
          strokeWidth="2" opacity={interpolate(t, [3.95, 4.35, 5.2], [0, .7, 0], ease)} />}
        {active && <ellipse cx="277" cy="268" rx="24" ry="8" fill="#67E8F9"
          opacity={interpolate(t, [7.65, 8, 8.85], [0, .32, 0], ease)} />}
      </svg>}
  </AbsoluteFill>;
}

const defaults: Props = { source: '', tree: { tag: 'svg', props: { viewBox: '0 0 340 350' }, children: [] }, mode: 'static' };
registerRoot(() => <Composition id="GoldenVisualReference" component={GoldenReference} defaultProps={defaults}
  width={1080} height={1920} fps={30} durationInFrames={285} />);
