import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { StoryboardScene } from '../contracts/storyboard.js';

const cyan = '#00F2FE';
const mint = '#10B981';
const coral = '#EF4444';

function stages(s: StoryboardScene): Array<[string, string]> {
  switch (s.type) {
    case 'requestFlow': return s.visualProps.steps.map(v => [v.label, v.description]);
    case 'queueTimeline': return s.visualProps.items.map(v => [v.name, v.detail]);
    case 'collection': return s.visualProps.items.map(v => [v.label, v.selected ? s.visualProps.result : s.visualProps.title]);
    case 'code': return s.visualProps.code.split('\n').filter(Boolean).map(() => [s.visualProps.filename, s.visualProps.explanationCallout]);
    case 'summary': return s.visualProps.takeaways.map(v => [s.visualProps.headline, v]);
    case 'comparison': return [[s.visualProps.leftTitle, s.visualProps.leftPoints.join(' · ')], [s.visualProps.rightTitle, s.visualProps.rightPoints.join(' · ')], [s.visualProps.verdict, s.technicalKeyPoint]];
    case 'tradeoffHUD': return [[s.visualProps.optionA_Title, s.visualProps.optionA_Pros], [s.visualProps.optionA_Title, s.visualProps.optionA_Cons], [s.visualProps.optionB_Title, s.visualProps.optionB_Pros], [s.visualProps.optionB_Title, s.visualProps.optionB_Cons]];
    case 'smartphoneMockup': return [[s.visualProps.baseDeliveryFee, s.visualProps.itemName], [s.visualProps.surgeDeliveryFee, s.visualProps.surgeReason]];
    case 'raceCondition': return [[s.visualProps.user1Name, s.visualProps.itemTitle], [s.visualProps.user2Name, s.visualProps.itemTitle], ['Atomic write', s.visualProps.atomicQuery]];
    case 'h3SpatialMap': return [[s.visualProps.hotHexId, s.visualProps.subtitle], [s.visualProps.orderCount + ' orders', s.visualProps.riderCount + ' riders'], [s.visualProps.surgeMultiplier, s.technicalKeyPoint]];
    case 'architecturePipeline': return [['Redis', s.visualProps.subtitle], [s.visualProps.redisLatencyMs + ' ms', s.visualProps.atomicCommand]];
    case 'hook': return [[s.visualProps.headline, s.technicalKeyPoint]];
  }
}

const prism = 'M0 -105 190 0 0 105 -190 0Z';
function Circuit({ frame, active, color }: { frame: number; active: number; color: string }) {
  return <g transform="translate(540 825)">
    {[-1, 1].map(side => <g key={side} transform={`scale(${side} 1)`}>
      {Array.from({ length: 9 }, (_, i) => {
        const d = `M 78 ${i * 13 - 45} l ${120 + i * 10} ${70 + i * 5} l 90 -50 h 370`;
        return <g key={i}><path d={d} stroke={color} strokeOpacity=".3" fill="none" strokeWidth="2" />
          <path d={d} stroke={color} fill="none" strokeWidth={i % 3 === 0 ? 5 : 2} pathLength="100" strokeDasharray="4 96" strokeDashoffset={-(frame * 1.4 + i * 13) % 100} /></g>;
      })}
    </g>)}
    {[3, 2, 1, 0].map((v) => <g key={v} transform={`translate(0 ${v * 40 - 45 + Math.sin(frame / 22 + v) * 8})`}>
      <path d="M-190 0 0 105 190 0v22L0 127 -190 22Z" fill="#093239" stroke={color} strokeOpacity=".6" />
      <path d={prism} fill={v === 0 ? '#123e48' : '#07181e'} stroke={color} strokeWidth={v === active % 4 ? 5 : 2} />
      {v === 0 && <g transform="scale(1 .55) rotate(45)"><rect x="-78" y="-78" width="156" height="156" fill="#081519" stroke={color} strokeWidth="5" />{[-48, -24, 0, 24, 48].map(x => <path key={x} d={`M${x} -78v-23 M${x} 78v23 M-78 ${x}h-23 M78 ${x}h23`} stroke={color} strokeWidth="7" />)}</g>}
    </g>)}
  </g>;
}

// Axial coordinates form a connected radius-three hexagonal lattice.
const cells = Array.from({ length: 7 }, (_, row) => row - 3).flatMap(q =>
  Array.from({ length: 7 }, (_, col) => col - 3).filter(r => Math.abs(q + r) <= 3).map(r => [q, r]));

function Radar({ frame, hex, color }: { frame: number; hex: boolean; color: string }) {
  return <g transform="translate(540 845)">
    <circle r="268" fill="url(#signal-halo)" />
    {[105, 178, 249].map(r => <circle key={r} r={r} stroke={color} strokeOpacity=".45" strokeDasharray={r === 249 ? '2 10' : undefined} fill="none" />)}
    <g transform={`rotate(${frame * 2.4})`}><path d="M0 0L249 0A249 249 0 0 0 215 -125Z" fill={color} opacity=".14" /><path d="M0 0H249" stroke={color} strokeWidth="3" /></g>
    {Array.from({ length: hex ? 37 : 9 }, (_, i) => {
      const theta = i * 2.4, r = Math.sqrt(i) * 71;
      const [q, row] = cells[i];
      const x = hex ? 51 * q : Math.cos(theta) * r;
      const y = hex ? 58 * (row + q / 2) : Math.sin(theta) * r;
      return <g key={i} transform={`translate(${x} ${y})`}>
        {hex ? <path d="M-17 -29h34l17 29-17 29h-34l-17-29Z" fill={i % 7 === 0 ? coral : '#0c3031'} stroke={color} /> : <circle r={i === 0 ? 15 : 7} fill={i % 3 === 0 ? coral : color} />}
      </g>;
    })}
  </g>;
}


function Flow({ labels, active, frame, color }: { labels: string[]; active: number; frame: number; color: string }) {
  const locations = labels.map((_, i) => ({ x: 175 + i * 730 / Math.max(1, labels.length - 1), y: 830 + (i % 2 === 0 ? 55 : -55) }));
  const line = locations.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ');
  return <g>
    <path d={line} fill="none" stroke="#13474a" strokeWidth="7" />
    <path d={line} fill="none" pathLength="100" stroke={color} strokeWidth="4" strokeDasharray="4 96" strokeDashoffset={-frame % 100} />
    {locations.map(({ x, y }, i) => <g key={i} transform={'translate(' + x + ' ' + y + ')'}>
      <circle r={i === active ? 55 : 33} fill="#071519" stroke={i <= active ? color : '#4c666c'} strokeWidth="4" />
      {i === active && <circle r={64 + frame % 28} fill="none" stroke={color} opacity={(1 - frame % 28 / 28) * 0.7} />}
      <circle r="11" fill={i <= active ? color : '#4c666c'} />
      <text y={i % 2 === 0 ? 115 : -100} textAnchor="middle" fill={i === active ? 'white' : '#95a9ad'} fontSize={labels.length > 3 ? 25 : 32}>
        {labels[i].split(/\s+/).slice(0, 3).join(' ').slice(0, 22)}
      </text>
    </g>)}
  </g>;
}


function Collection({ scene, revealed, frame }: { scene: Extract<StoryboardScene, { type: 'collection' }>; revealed: boolean; frame: number }) {
  const { items } = scene.visualProps;
  return <g>{items.map((item, i) => {
    const angle = i * 2 * Math.PI / items.length - Math.PI / 2;
    const selected = revealed && item.selected;
    const x = 540 + Math.cos(angle) * 300;
    const y = 830 + Math.sin(angle) * 210;
    return <g key={i}>
      <path d={`M540 830 L${x} ${y}`} stroke={selected ? mint : '#214149'} strokeWidth={selected ? 4 : 2} strokeDasharray="12 7" strokeDashoffset={-frame} />
      <circle cx={x} cy={y} r={selected ? 19 : 11} fill={selected ? mint : cyan} />
      <text x={x} y={y + 46} textAnchor="middle" fill={selected ? 'white' : '#9cabb0'} fontSize={items.length > 6 ? 22 : 29}>{item.label.slice(0, 23)}</text>
    </g>;
  })}<circle cx="540" cy="830" r="35" fill="#0e292e" stroke={revealed ? mint : cyan} strokeWidth="4" /></g>;
}


function Decision({ left, right, selected, frame }: { left: string; right: string; selected: number; frame: number }) {
  return <g transform="translate(540 835)">
    {[-1, 1].map((side, i) => {
      const active = selected === i;
      const color = i === 0 ? coral : mint;
      const branch = `M0 220V80 L${side * 225} -50 V-130`;
      return <g key={side}>
        <path d={branch} fill="none" stroke={color} opacity=".45" strokeWidth="6" />
        {active && <path d={branch} fill="none" pathLength="100" stroke={color} strokeWidth="8" strokeDasharray="11 89" strokeDashoffset={-frame % 100} />}
        <circle cx={side * 225} cy="-136" r={active ? 31 : 18} fill="#081419" stroke={color} strokeWidth="5" />
        <foreignObject x={side * 225 - 195} y="-325" width="390" height="155">
          <div style={{ textAlign: 'center', fontSize: 35, color: active ? 'white' : '#8f999d', fontWeight: 650 }}>{i === 0 ? left : right}</div>
        </foreignObject>
      </g>;
    })}
    <circle cy="220" r="19" fill="white" />
  </g>;
}

function CodeTrace({ scene, active }: { scene: Extract<StoryboardScene, { type: 'code' }>; active: number }) {
  const lines = scene.visualProps.code.split('\n').filter(Boolean);
  const line = Math.min(lines.length - 1, active);
  const start = Math.max(0, line - 2);
  return <foreignObject x="80" y="610" width="914" height="470">
    <div style={{ fontFamily: 'Consolas, monospace', fontSize: 34 }}>
      {lines.slice(start, start + 5).map((text, i) => <div key={start + i} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: start + i === line ? cyan : '#84949b', marginBottom: 15 }}>{text}</div>)}
    </div>
  </foreignObject>;
}

export function SignalScene({ scene, cueFrames, wordFrames, audioFrames }: {
  scene: StoryboardScene; cueFrames?: number[]; wordFrames?: number[]; audioFrames?: number
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const beats = stages(scene);
  const length = audioFrames || durationInFrames;
  const words = scene.narration.replace(/<[^>]+>/g, ' ').trim().split(/\s+/);
  const starts = wordFrames?.length === words.length ? wordFrames : words.map((_, i) => Math.floor(i * length / words.length));
  const activeWord = Math.max(0, starts.filter(f => f <= frame).length - 1);
  const triggers = beats.map(([label], i) => {
    if (cueFrames?.length === beats.length) return cueFrames[i];
    const keyword = label.toLowerCase().split(/\s+/)[0];
    const token = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const match = i > 0 && token(keyword) ? words.findIndex(w => token(w) === token(keyword)) : -1;
    return match > 0 ? starts[match] : starts[Math.min(words.length - 1, Math.floor(i * words.length / beats.length))];
  });
  const active = Math.max(0, triggers.reduce((idx, f, i) => f <= frame ? i : idx, 0));
  const [label, detail] = scene.type === 'collection'
    ? [frame >= (cueFrames?.[0] ?? length / 2) ? scene.visualProps.result : scene.visualProps.title, scene.technicalKeyPoint]
    : beats[active] || [scene.onScreenText, scene.technicalKeyPoint];
  const danger = scene.type === 'raceCondition' && active === 1 || scene.type === 'smartphoneMockup' && active > 0;
  const color = danger ? coral : active % 2 ? mint : cyan;
  const pulse = Math.exp(-Math.max(0, frame - starts[activeWord]) / (fps * .14));
  const crashIndex = words.findIndex(word => /^(crash(?:es|ed)?|क्रैश)[,.!?।]?$/i.test(word));
  const crashFrame = crashIndex >= 0 ? starts[crashIndex] : Infinity;
  const sinceCrash = frame - crashFrame;
  function graphic() {
    switch (scene.type) {
      case 'requestFlow':
      case 'queueTimeline':
        return <Flow labels={beats.map(([label]) => label)} active={active} frame={frame} color={color} />;
      case 'comparison':
        return <Decision left={scene.visualProps.leftTitle} right={scene.visualProps.rightTitle} selected={Math.min(1, active)} frame={frame} />;
      case 'tradeoffHUD':
        return <Decision left={scene.visualProps.optionA_Title} right={scene.visualProps.optionB_Title} selected={Math.floor(active / 2)} frame={frame} />;
      case 'collection':
        return <Collection scene={scene} frame={frame} revealed={frame >= (cueFrames?.[0] ?? length / 2)} />;
      case 'code':
        return <CodeTrace scene={scene} active={active} />;
      case 'h3SpatialMap':
      case 'hook':
        return <Radar frame={frame} hex={scene.type === 'h3SpatialMap'} color={color} />;
      case 'smartphoneMockup':
        return <g transform={`translate(540 824) rotate(-9) skewY(${Math.sin(frame / 35) * 3})`}>
        <rect x="-186" y="-275" width="372" height="550" rx="48" fill="#0b2127" stroke={color} strokeWidth="6" />
        <path d="M-45 -244h90" stroke={color} strokeWidth="7" /><text y="-123" fill="white" textAnchor="middle" fontSize="36">{scene.visualProps.appName}</text>
        <text y="-15" fill={active ? '#a5b0b4' : 'white'} textAnchor="middle" fontSize="77" textDecoration={active ? 'line-through' : undefined}>{scene.visualProps.baseDeliveryFee}</text>
        {active > 0 && <><text y="95" fill={color} textAnchor="middle" fontSize="95">{label}</text><circle r={80 + (frame - triggers[active]) * 4} fill="none" stroke={color} opacity={Math.max(0, 1 - (frame - triggers[active]) / fps)} /></>}
      </g>;
      case 'raceCondition':
        return <g transform="translate(540 825)">
        <path d="M-520 -120h210l130 120h180 M520 120H310L180 0H0" fill="none" stroke={color} strokeWidth="4" strokeDasharray="18 8" strokeDashoffset={-frame * 2} />
        <path d={`M-78 -35v${active === 2 ? -60 : -100}a78 78 0 0 1 156 0v60`} fill="none" stroke={color} strokeWidth="23" />
        <rect x="-126" y="-40" width="252" height="175" rx="22" fill="#10252c" stroke={color} strokeWidth="5" /><circle cy="39" r="20" fill={color} />
      </g>;
      default:
        return <Circuit frame={frame} active={activeWord} color={color} />;
    }
  }
  const title = scene.onScreenText;
  return <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 45%,#00f2fe12,transparent 54%)', fontFamily: 'Inter, Arial, sans-serif' }}>
    <div style={{ position: 'absolute', left: 78, right: 96, top: 200, fontSize: title.length > 55 ? 69 : 88, fontWeight: 800, lineHeight: 1.02, letterSpacing: '-0.055em', overflowWrap: 'anywhere' }}>{title}</div>
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: 'absolute', inset: 0 }}>
      <defs><radialGradient id="signal-halo"><stop stopColor={color} stopOpacity=".14" /><stop offset="1" stopColor={color} stopOpacity="0" /></radialGradient></defs>
      <ellipse cx="540" cy="850" rx="510" ry="390" fill="url(#signal-halo)" />
      <g transform={`translate(540 845) scale(${1 + pulse * .016}) translate(-540 -845)`}>
        {graphic()}
        {sinceCrash >= 0 && sinceCrash < fps * 1.4 && <path d="M524 672l45 75-34 52 50 62-70 82 23-66-41-64 36-52Z"
          fill={coral} opacity={Math.min(1, (fps * 1.4 - sinceCrash) / 8)} />}
      </g>
    </svg>
    {scene.type === 'h3SpatialMap' && active > 0 && <div style={{ position: 'absolute', left: 80, top: 1010, fontFamily: 'Consolas, monospace', fontSize: 32, color: mint }}>
      {Math.round(scene.visualProps.orderCount * Math.min(1, (frame - triggers[1] + 1) / (fps * .4)))} orders / {scene.visualProps.riderCount} riders
    </div>}
    <div style={{ position: 'absolute', left: 80, right: 100, top: 1140 }}>
      {label.toLowerCase() !== title.toLowerCase() && <div style={{ fontSize: label.length > 32 ? 39 : 54, lineHeight: 1.04, fontWeight: 750, color, letterSpacing: '-.03em' }}>{label}</div>}
      <div style={{ fontFamily: scene.type === 'code' ? 'Consolas, monospace' : undefined, fontSize: detail.length > 100 ? 33 : 41, lineHeight: 1.17, marginTop: 12, color: '#d2dce0', overflowWrap: 'anywhere' }}>{detail}</div>
    </div>
  </AbsoluteFill>;
}
