import React, { useEffect, useMemo } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { CanvasTexture, ExtrudeGeometry, Shape, SRGBColorSpace } from 'three';
import type { ReelPlates, ShotKind, VisualContext } from '../visual-story.js';

const ink = '#07090c';
const warm = '#ffb379';
const mint = '#86e2cc';
const red = '#ff7282';
const ease = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const;
const left = 84;
const contentWidth = 848;
const brandAssets: Record<string, { file: string; width: number; height: number; background?: string }> = {
  zomato: { file: 'zomato.png', width: 64, height: 64 },
  redis: { file: 'redis.svg', width: 110, height: 38 },
  'apache kafka': { file: 'kafka.png', width: 118, height: 48, background: '#f8f6f1' },
};

const headlines: Record<Exclude<ShotKind, 'scene'>, string> = {
  street: 'Midnight in the rain',
  quote: 'Same trip. New fee.',
  shortage: 'Demand outruns supply',
  location: 'The rider sends a ping',
  cells: 'A city becomes local cells',
  index: 'GPS to an H3 cell',
  cache: 'Keep local counts ready',
  engine: 'Estimate a local price',
  pricing: 'How the fee adds up',
  heartbeat: 'Is that rider still online?',
  recap: 'Same distance. New conditions.',
  pickup: 'Inside the dark store',
  payment: 'Scan to start payment',
  kafka: 'Follow the event',
  lock: 'One request gets the lock',
  end: 'The engineering behind everyday tech',
};

function StoryPlate({ file, rain = false, muted = false, children }: React.PropsWithChildren<{ file: string; rain?: boolean; muted?: boolean }>) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ scale: interpolate(frame, [0, durationInFrames], [1, 1.075], ease), transformOrigin: '46% 54%' }}>
        <Img src={staticFile(file.includes('/') ? file : `visuals/${file}`)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: muted ? 0.52 : 0.94 }} />
        {children}
      </AbsoluteFill>
      {rain && <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        {Array.from({ length: 70 }, (_, index) => {
          const x = (index * 137) % 1120;
          const y = (index * 101 + frame * (15 + index % 8)) % 2000 - 55;
          return <line key={index} x1={x} y1={y} x2={x - 10} y2={y + 43} stroke="#a7c5da" strokeWidth={1 + index % 2} opacity={0.12 + index % 4 * 0.04} />;
        })}
      </svg>}
    </AbsoluteFill>
  );
}

function makePhoneScreen(fee: string, accent: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 880;
  const screen = canvas.getContext('2d')!;
  screen.fillStyle = '#141922';
  screen.beginPath();
  screen.roundRect(0, 0, 480, 880, 44);
  screen.fill();
  screen.fillStyle = '#242f3a';
  screen.fillRect(0, 82, 480, 388);
  screen.strokeStyle = '#45505d';
  screen.lineWidth = 7;
  for (let index = 0; index < 7; index++) {
    screen.beginPath();
    screen.moveTo(index * 84 - 20, 82);
    screen.lineTo(index * 84 + 95, 470);
    screen.moveTo(0, 125 + index * 51);
    screen.lineTo(480, 108 + index * 56);
    screen.stroke();
  }
  screen.strokeStyle = accent;
  screen.lineCap = 'round';
  screen.lineJoin = 'round';
  screen.lineWidth = 12;
  screen.beginPath();
  screen.moveTo(94, 360);
  screen.lineTo(157, 337);
  screen.lineTo(204, 248);
  screen.lineTo(322, 270);
  screen.lineTo(385, 170);
  screen.stroke();
  for (const [x, y] of [[94, 360], [385, 170]]) {
    screen.beginPath();
    screen.arc(x, y, 13, 0, Math.PI * 2);
    screen.fillStyle = '#fff4e9';
    screen.fill();
  }
  screen.fillStyle = '#bfc8d1';
  screen.font = '600 28px Segoe UI';
  screen.fillText('DELIVERY ESTIMATE', 34, 549);
  screen.fillStyle = accent;
  screen.font = 'bold 105px Segoe UI';
  if (fee) screen.fillText(fee, 28, 666);
  screen.fillStyle = '#090b11';
  screen.beginPath();
  screen.roundRect(176, 22, 128, 29, 15);
  screen.fill();
  screen.fillStyle = '#a2abb6';
  screen.beginPath();
  screen.roundRect(175, 829, 130, 6, 3);
  screen.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function Phone({ accent, context }: { accent: string; context: VisualContext }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fee = (frame >= Math.round(fps * 0.48) ? context.finalFee : context.baseFee) ?? '';
  const screen = useMemo(() => makePhoneScreen(fee, accent), [fee, accent]);
  useEffect(() => () => screen.dispose(), [screen]);
  const chassis = useMemo(() => {
    const shape = new Shape();
    const x = 1.31;
    const y = 2.37;
    const r = 0.24;
    shape.moveTo(-x + r, -y);
    shape.lineTo(x - r, -y);
    shape.quadraticCurveTo(x, -y, x, -y + r);
    shape.lineTo(x, y - r);
    shape.quadraticCurveTo(x, y, x - r, y);
    shape.lineTo(-x + r, y);
    shape.quadraticCurveTo(-x, y, -x, y - r);
    shape.lineTo(-x, -y + r);
    shape.quadraticCurveTo(-x, -y, -x + r, -y);
    return new ExtrudeGeometry(shape, { depth: 0.22, steps: 1, bevelSize: 0.055, bevelThickness: 0.055, bevelSegments: 3 });
  }, []);
  useEffect(() => () => chassis.dispose(), [chassis]);
  return (
    <ThreeCanvas width={680} height={635} camera={{ position: [0, 0, 8.4], fov: 38 }} style={{ position: 'absolute', top: 480, left: 160 }}>
      <ambientLight intensity={1.15} />
      <directionalLight position={[4, 5, 6]} intensity={3.2} color="#ffe2c8" />
      <pointLight position={[-3, -1, 2]} intensity={22} color={accent} />
      <group rotation={[-0.13, interpolate(frame, [0, fps * 2], [-0.34, -0.16], ease), -0.13]} position={[0, Math.sin(frame / 40) * 0.1, 0]}>
        <mesh geometry={chassis} position={[0, 0, -0.08]}>
          <meshStandardMaterial color="#9d9699" metalness={0.68} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0, 0.199]}>
          <planeGeometry args={[2.57, 4.69]} />
          <meshBasicMaterial map={screen} transparent toneMapped={false} />
        </mesh>
      </group>
    </ThreeCanvas>
  );
}

const cells = Array.from({ length: 25 }, (_, index) => ({
  x: 125 + (index % 5) * 146 + (Math.floor(index / 5) % 2) * 73,
  y: 104 + Math.floor(index / 5) * 119,
}));
const route = 'M45 493 C155 484 197 586 314 488 S498 328 564 412 S677 423 802 270';
const hexagon = '0,-83 72,-42 72,42 0,83 -72,42 -72,-42';

function LocalMap({ kind, accent }: { kind: ShotKind; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const travel = interpolate(frame, [0, fps * 2.2], [0, 1], ease);
  const activeCount = kind === 'cells' ? 3 : 1;
  const isOffline = kind === 'heartbeat' && travel > 0.55;
  return (
    <svg width="880" height="660" viewBox="0 0 880 660" style={{ position: 'absolute', top: 510, left: 66 }} aria-hidden="true">
      <defs>
        <radialGradient id="map-floor"><stop stopColor="#243139" /><stop offset="1" stopColor="#0a0d11" /></radialGradient>
        <radialGradient id="map-signal"><stop stopColor={accent} stopOpacity=".45" /><stop offset="1" stopColor={accent} stopOpacity=".04" /></radialGradient>
      </defs>
      <rect x="5" y="5" width="850" height="620" rx="44" stroke="#272e35" fill="url(#map-floor)" />
      <g opacity=".48">
        {[0, 1, 2, 3, 4].map(i => <path key={i} d={`M26 ${115 + 104 * i} Q330 ${174 + i * 70} 830 ${74 + i * 107}`} fill="none" stroke="#73828f" strokeWidth={i % 2 ? 5 : 2} />)}
        {[0, 1, 2, 3, 4, 5].map(i => <path key={i} d={`M${99 + 129 * i} 28 Q${18 + 140 * i} 259 ${165 + 105 * i} 604`} fill="none" stroke="#657582" strokeWidth={i % 2 ? 3 : 6} />)}
      </g>
      {cells.map(({ x, y }, index) => {
        const active = [12, 13, 7].slice(0, activeCount).includes(index);
        return <polygon key={index} points={hexagon} transform={`translate(${x} ${y}) scale(.91)`} fill={active ? 'url(#map-signal)' : 'transparent'} stroke={active ? accent : '#485963'} strokeWidth={active ? 3 : 1} opacity={active ? 0.45 + travel * 0.39 : 0.47} />;
      })}
      {kind === 'shortage' && Array.from({ length: 28 }, (_, index) => {
        const angle = index * 2.39996;
        const distance = 19 * Math.sqrt(index + 1);
        return <circle key={index} cx={421 + Math.cos(angle) * distance * travel} cy={342 + Math.sin(angle) * distance * travel} r={4.6} fill={red} opacity={0.25 + 0.5 * travel} />;
      })}
      <path d={route} fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" pathLength="1" strokeDasharray={`${0.25 + 0.75 * travel} 1`} opacity=".83" />
      {[[102, 495], [440, 389], [723, 338]].map(([x, y], index) => (
        <g key={x} opacity={isOffline && index === 1 ? 0.3 : 1}>
          <circle cx={x} cy={y} r={15 + ((frame + 11 * index) % 42) * 0.6} fill="none" stroke={accent} strokeWidth="2" opacity=".44" />
          <circle cx={x} cy={y} r="9" fill={accent} stroke="#fff" strokeWidth="2" />
        </g>
      ))}
      {isOffline && <path d="m420 369 40 40m0-40-40 40" stroke={red} strokeWidth="8" strokeLinecap="round" />}
    </svg>
  );
}

function DataSculpture({ kind, accent }: { kind: ShotKind; accent: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [0, fps * 1.8], [0, 1], ease);
  const stack = kind === 'cache';
  return (
    <ThreeCanvas width={840} height={650} camera={{ position: [4.6, 4.1, 7.2], fov: 36 }} style={{ position: 'absolute', top: 485, left: 84 }}>
      <ambientLight intensity={1.0} />
      <directionalLight position={[2, 6, 6]} intensity={3} color="#ddefff" />
      <pointLight position={[-3, 0, 1]} intensity={35} color={accent} />
      <group rotation={[0, -0.35 + progress * 0.43, 0]}>
        <mesh position={[0, -1.35, 0]}>
          <cylinderGeometry args={[2.6, 2.6, 0.12, 64]} />
          <meshStandardMaterial color="#242c35" roughness={0.52} metalness={0.5} />
        </mesh>
        {Array.from({ length: 3 }, (_, index) => (
          <group key={index} position={stack ? [0, -0.76 + index * 0.67, 0] : [(index - 1) * 1.42, -0.5, 0]}>
            <mesh>
              <boxGeometry args={stack ? [2.8, 0.38, 2.3] : [0.88, 1.18, 1.55]} />
              <meshStandardMaterial color={index === Math.min(2, Math.floor(progress * 3)) ? accent : '#667584'} roughness={0.37} metalness={0.52} />
            </mesh>
            <mesh position={[0, 0.04, stack ? 1.16 : 0.79]}>
              <boxGeometry args={stack ? [2.1, 0.05, 0.035] : [0.54, 0.07, 0.03]} />
              <meshBasicMaterial color={accent} />
            </mesh>
          </group>
        ))}
        {!stack && [-1, 1].map(direction => (
          <mesh key={direction} position={[(direction === 1 && kind === 'lock' ? 0.9 : 2.15 - progress * 2.15) * direction, 0.54, 0.08]}>
            <sphereGeometry args={[0.15, 24, 16]} />
            <meshBasicMaterial color={kind === 'lock' && direction === 1 ? red : accent} />
          </mesh>
        ))}
      </group>
    </ThreeCanvas>
  );
}

function KafkaFlow() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const travel = interpolate(frame, [0, fps * 2.8], [125, 739], ease);
  return <svg width="848" height="585" viewBox="0 0 848 585" style={{ position: 'absolute', left, top: 532 }} aria-hidden="true">
    <path d="M115 292H742" stroke="#4c6569" strokeWidth="6" strokeDasharray="12 14" />
    <rect x="270" y="102" width="310" height="381" rx="35" fill="#18242c" stroke="#405463" strokeWidth="2" />
    <text x="425" y="166" textAnchor="middle" fill="#e7eee9" fontSize="36" fontWeight="700">Kafka topic</text>
    {[0, 1, 2].map(index => <g key={index}>
      <rect x="307" y={203 + index * 66} width="237" height="55" rx="15" fill={index === 1 ? '#34695c' : '#243541'} />
      <text x="425" y={239 + index * 66} textAnchor="middle" fill="#e7eee9" fontSize="25">Partition {index}</text>
    </g>)}
    <circle cx="106" cy="292" r="32" fill="#263d3f" stroke={mint} strokeWidth="3" />
    <circle cx="743" cy="292" r="32" fill="#263d3f" stroke={mint} strokeWidth="3" />
    <circle cx={travel} cy="292" r="13" fill="#edfff5" stroke={mint} strokeWidth="6" />
    <text x="106" y="380" textAnchor="middle" fill="#c3d0d5" fontSize="28">Producer</text>
    <text x="743" y="380" textAnchor="middle" fill="#c3d0d5" fontSize="28">Consumer</text>
  </svg>;
}

function PricingFlow({ context }: { context: VisualContext }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inputs = ['Local demand', 'Available riders', ...(context.rain ? ['Rain'] : []), ...(context.eta ? ['Delivery time'] : []), ...(context.rules ? ['Pricing rules'] : [])];
  const travel = interpolate(frame, [0, fps * 2.4], [0.12, 1], ease);
  return <svg width="848" height="650" viewBox="0 0 848 650" style={{ position: 'absolute', left, top: 508 }} aria-hidden="true">
    {inputs.map((item, index) => {
      const y = 328 + (index - (inputs.length - 1) / 2) * 111;
      const line = `M244 ${y} C360 ${y} 334 328 510 328`;
      return <g key={item}>
        <path d={line} stroke="#233746" strokeWidth="5" fill="none" />
        <path d={line} stroke={warm} strokeWidth="4" fill="none" pathLength="1" strokeDasharray={`0.15 1`} strokeDashoffset={-((travel * 0.9 + index * .14) % 1)} />
        <rect x="2" y={y - 34} width="242" height="68" rx="17" fill="#1a222c" stroke="#334553" />
        <text x="123" y={y + 10} textAnchor="middle" fill="#edf1f4" fontSize="26" fontWeight="600">{item}</text>
      </g>;
    })}
    <rect x="490" y="243" width="295" height="172" rx="31" fill="#382a28" stroke={warm} strokeWidth="2" />
    <text x="637" y="319" textAnchor="middle" fill="#faf6ee" fontSize="41" fontWeight="700">Pricing</text>
    <text x="637" y="366" textAnchor="middle" fill="#faf6ee" fontSize="41" fontWeight="700">engine</text>
  </svg>;
}

function DemoQr({ onCounter = false }: { onCounter?: boolean }) {
  return <div style={{
    position: 'absolute', top: onCounter ? 988 : 595, left: onCounter ? 310 : 335, width: onCounter ? 179 : 342,
    background: onCounter ? 'transparent' : '#f8f6f1', borderRadius: 18, padding: 12,
    transform: onCounter ? 'rotate(-5deg) skew(4deg)' : undefined,
    mixBlendMode: onCounter ? 'multiply' : undefined,
  }}>
    <Img src={staticFile('visuals/demo-qr.png')} alt="Demo QR" style={{ display: 'block', width: '100%' }} />
    <div style={{ textAlign: 'center', color: '#171a20', fontSize: 23, fontWeight: 720, paddingBottom: 5 }}>DEMO QR</div>
  </div>;
}

function Metric({ value, label, color }: { value: string | number; label: string; color?: string }) {
  return <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 75, lineHeight: 1, fontWeight: 780, letterSpacing: -4, color: color ?? '#faf6ee', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    <div style={{ marginTop: 12, fontSize: 29, fontWeight: 620, color: '#bfc9cf' }}>{label}</div>
  </div>;
}

function ShotDetails({ kind, context, accent }: { kind: Exclude<ShotKind, 'scene'>; context: VisualContext; accent: string }) {
  const { orders, riders, ratio, baseFee, finalFee, extraFee } = context;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const complete = frame >= Math.round(fps * 0.48);
  const offline = frame >= Math.round(fps * 0.9);
  if (kind === 'street') return context.midnight
    ? <Metric value="12:00 AM" label="Illustrative delivery scene" color={warm} />
    : <div style={{ fontSize: 41 }}>Delivery in the rain</div>;
  if (kind === 'pickup') return <div style={{ fontSize: 41 }}>Local order fulfillment</div>;
  if (kind === 'payment') return <div style={{ fontSize: 41 }}>Camera reads the payment QR</div>;
  if (kind === 'engine') return <div style={{ fontSize: 41 }}>Local conditions → Delivery estimate</div>;
  if (kind === 'end') return <div style={{ fontSize: 41 }}>{context.channel ? `Follow ${context.channel}` : 'Follow for more tech stories'}</div>;
  if (kind === 'quote' || kind === 'pricing' || kind === 'recap') {
    if (kind === 'recap') return <div style={{ fontSize: 38, lineHeight: 1.3 }}>Local demand · Available riders · Delivery conditions</div>;
    if (kind === 'pricing' && baseFee && finalFee && extraFee) return <>
      <Metric value={baseFee} label="Base fee" />
      <span>+</span>
      <Metric value={extraFee} label="Additional" />
      <span>=</span>
      <Metric value={finalFee} label="Example fee" color={accent} />
    </>;
    if (baseFee && finalFee) return <>
      <Metric value={baseFee} label="Before" />
      <span>→</span>
      <Metric value={complete ? finalFee : baseFee} label="Delivery fee" color={accent} />
    </>;
    return <div style={{ fontSize: 38 }}>Local conditions → Pricing rules → Delivery fee</div>;
  }
  if (kind === 'shortage' || kind === 'cache') {
    if (orders !== undefined && riders !== undefined) return <>
      <Metric value={orders} label="Pending orders" />
      <Metric value={riders} label="Available riders" />
      {ratio && <Metric value={ratio} label="Orders per rider" color={accent} />}
    </>;
    return <div style={{ fontSize: 38 }}>Pending orders vs. available riders</div>;
  }
  const detail = {
    location: 'GPS location + availability',
    cells: 'Group nearby pickup and delivery activity',
    index: context.h3 ? 'GPS coordinates → H3 cell' : 'GPS coordinates → local cell',
    heartbeat: offline ? 'Stale signal → check availability' : 'Last known location',
    kafka: 'Producer → partition → consumer',
    lock: 'SET NX → one winner',
  }[kind];
  return <div style={{ fontSize: 41, lineHeight: 1.2, color: kind === 'heartbeat' && offline ? red : '#edf1f4' }}>{detail}</div>;
}

export function GeneratedOpening({ file, title }: { file: string; title: string }) {
  return <AbsoluteFill style={{ backgroundColor: ink }}>
    <StoryPlate file={file} />
    <AbsoluteFill style={{ background: 'linear-gradient(180deg, #07090cf0, transparent 42%, transparent 55%, #07090c 75%)' }} />
    <div style={{ position: 'absolute', left, width: contentWidth, top: 225, color: '#faf6ee', fontSize: 76, fontWeight: 800, lineHeight: 1.03, letterSpacing: -2.5, overflowWrap: 'anywhere' }}>{title}</div>
  </AbsoluteFill>;
}

export function CinematicStoryShot({ kind, context, plates }: { kind: Exclude<ShotKind, 'scene'>; context: VisualContext; plates?: ReelPlates }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const street = kind === 'street';
  const phone = kind === 'quote' || kind === 'recap' || kind === 'pricing';
  const map = kind === 'shortage' || kind === 'location' || kind === 'cells' || kind === 'index' || kind === 'heartbeat';
  const ambient = street || kind === 'pickup' || kind === 'payment' || kind === 'end';
  const accent = ambient || phone || kind === 'engine' ? warm : kind === 'cache' ? red : mint;
  const brand = phone ? context.app : (kind === 'cache' || kind === 'lock') && context.redis ? 'Redis' : kind === 'kafka' ? 'Apache Kafka' : undefined;
  const logo = brand ? brandAssets[brand.toLowerCase()] : undefined;
  const section = brand ?? (street ? 'THE DELIVERY' : kind === 'end' ? '' : kind === 'lock' || kind === 'kafka' ? 'ILLUSTRATIVE FLOW' : 'ILLUSTRATIVE DESIGN');
  const headline = kind === 'street' && !context.midnight ? 'Delivery in the rain'
    : kind === 'index' && !context.h3 ? 'Index the rider location'
    : headlines[kind];
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 44% 43%, #171d25 0%, #0a0d11 44%, #050608 79%)', color: '#faf6ee', fontFamily: 'Segoe UI, Nirmala UI, sans-serif' }}>
      {context.delivery && context.rain && (street || kind === 'quote' || kind === 'recap' || kind === 'location' || kind === 'end') && <StoryPlate file={plates?.street ?? 'rain-delivery.png'} rain muted={!street} />}
      {!context.rain && kind === 'end' && (plates?.payment || context.chaiShop) && <StoryPlate file={plates?.payment ?? 'chai-shop.png'} muted />}
      {kind === 'pickup' && <StoryPlate file={plates?.pickup ?? 'dark-store.png'} />}
      {kind === 'payment' && (plates?.payment || context.chaiShop) && <StoryPlate file={plates?.payment ?? 'chai-shop.png'}>{!plates?.payment && <DemoQr onCounter />}</StoryPlate>}
      <AbsoluteFill style={{ background: `linear-gradient(180deg, ${ink}dc 3%, ${ink}8c 21%, transparent 44%, transparent 56%, ${ink} 73%, #050608 100%)` }} />
      {phone && <Phone accent={accent} context={context} />}
      {map && <LocalMap kind={kind} accent={accent} />}
      {kind === 'payment' && (plates?.payment || !context.chaiShop) && <DemoQr />}
      {kind === 'kafka' && <KafkaFlow />}
      {kind === 'engine' && <PricingFlow context={context} />}
      {(kind === 'cache' || kind === 'lock') && <DataSculpture kind={kind} accent={accent} />}
      <div style={{ position: 'absolute', top: 219, left, width: contentWidth, translate: `0 ${interpolate(frame, [0, fps * 0.46], [23, 0], ease)}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: 62, marginBottom: 18, fontSize: 25, fontWeight: 750, letterSpacing: 4, color: accent, textTransform: 'uppercase' }}>
          {logo ? <><Img src={staticFile(`visuals/${logo.file}`)} alt={brand} style={{ width: logo.width, height: logo.height, objectFit: 'contain', borderRadius: 10, background: logo.background }} /><span>Illustrative {phone ? 'scenario' : 'design'}</span></> : section}
        </div>
        <div style={{ fontSize: 87, lineHeight: 0.98, fontWeight: 780, letterSpacing: -4, textShadow: '0 5px 38px #0009' }}>{headline}</div>
      </div>
      <div style={{ position: 'absolute', left, width: contentWidth, bottom: 582, minHeight: 104, display: 'flex', alignItems: 'center', gap: 33, fontSize: 41, fontWeight: 670, color: accent }}>
        <ShotDetails kind={kind} context={context} accent={accent} />
      </div>
    </AbsoluteFill>
  );
}
