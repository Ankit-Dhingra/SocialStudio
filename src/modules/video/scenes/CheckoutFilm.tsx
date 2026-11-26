import React, { useEffect, useMemo } from 'react';
import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { TimedShot } from '../visual-story.js';
import { Camera } from './LocalFilm.js';
import { demoQr } from './demo-qr.js';

type Checkout = NonNullable<TimedShot['checkout']>;
type Vector = [number, number, number];
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) } as const;
const ivory = '#eeeae1';

function usePaint(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void, key: string) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    paint(canvas.getContext('2d')!);
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }, [width, height, key]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'center') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function qr(ctx: CanvasRenderingContext2D, x: number, y: number, module: number) {
  const size = (demoQr.length + 8) * module;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#111827';
  demoQr.forEach((row, iy) => [...row].forEach((cell, ix) => {
    if (cell === '1') ctx.fillRect(x + (ix + 4) * module, y + (iy + 4) * module, module, module);
  }));
}

function SoundboxFace(ctx: CanvasRenderingContext2D) {
  rounded(ctx, 0, 0, 600, 600, 55, '#f2f0ea');
  text(ctx, 'pay', 296, 110, '800 75px Arial', '#052e59', 'right');
  text(ctx, 'tm', 293, 110, '800 75px Arial', '#03a5d8', 'left');
  text(ctx, 'Accepted Here', 300, 148, '700 29px Arial', '#173450');
  qr(ctx, 155, 182, 10);
  rounded(ctx, 182, 482, 236, 38, 7, '#123855');
  text(ctx, 'ALL-IN-ONE QR', 300, 508, '700 24px Arial', '#fff');
  text(ctx, 'Scan & pay using any UPI app', 300, 554, '600 22px Arial', '#18334e');
  text(ctx, 'DEMO', 300, 580, '700 15px Arial', '#5d6571');
  for (const side of [1, -1]) for (let row = 0; row < 13; row++) for (let col = 0; col < 4; col++) {
    const x = 300 + side * (193 + col * 15 + (row % 2) * 4);
    const y = 228 + row * 15;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#4b545e';
    ctx.fill();
  }
}

function RoundedSolid({ size, at, sizing, color, roughness = 0.45 }: {
  size: Vector; at: Vector; sizing: number; color: string; roughness?: number;
}) {
  const [x, y, z] = size;
  const geometry = useMemo(() => new RoundedBoxGeometry(x, y, z, 4, sizing), [x, y, z, sizing]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={at} geometry={geometry}>
    <meshStandardMaterial color={color} roughness={roughness} />
  </mesh>;
}

function Soundbox({ active, second }: { active: boolean; second: number }) {
  const face = usePaint(600, 600, SoundboxFace, 'classic-face');
  return <group position={[0.43, 1.02, -0.04]} rotation={[-0.095, -0.095, 0]}>
    <RoundedSolid size={[0.85, 0.85, 0.31]} at={[0, 0.426, 0]} sizing={0.066} color="#0b6ea5" />
    <RoundedSolid size={[0.817, 0.815, 0.12]} at={[0, 0.414, 0.133]} sizing={0.053} color={ivory} />
    <mesh position={[0, 0.414, 0.199]}>
      <planeGeometry args={[0.75, 0.749]} />
      <meshStandardMaterial map={face} transparent alphaTest={0.1} roughness={0.55} />
    </mesh>
    {[-0.23, 0, 0.23].map(x => <RoundedSolid key={x} size={[0.092, 0.013, 0.062]} at={[x, 0.855, 0.016]} sizing={0.005} color="#15567d" />)}
    <mesh position={[0.302, 0.795, 0.179]}>
      <sphereGeometry args={[active ? 0.011 + 0.006 * (1 + Math.sin(second * 10)) : 0.011, 12, 10]} />
      <meshBasicMaterial color={active ? '#67eaff' : '#59aac8'} />
    </mesh>
  </group>;
}

function phonePaint(ctx: CanvasRenderingContext2D, mode: 'scan' | 'review' | 'paid', data: Checkout) {
  if (mode === 'scan') {
    ctx.fillStyle = '#0e1c29';
    ctx.fillRect(0, 0, 540, 1070);
    const view = ctx.createLinearGradient(0, 150, 430, 890);
    view.addColorStop(0, '#71503b');
    view.addColorStop(1, '#273e45');
    rounded(ctx, 0, 142, 540, 698, 0, '#384a4b');
    ctx.fillStyle = view;
    ctx.fillRect(0, 142, 540, 698);
    text(ctx, 'Scan & pay', 270, 96, '700 48px Segoe UI', '#f3f6f9');
    text(ctx, 'Align the merchant QR', 270, 911, '600 28px Segoe UI', '#cbdce8');
    return;
  }
  ctx.fillStyle = '#f2f5f5';
  ctx.fillRect(0, 0, 540, 1070);
  ctx.fillStyle = '#102b40';
  ctx.fillRect(0, 0, 540, 155);
  text(ctx, mode === 'paid' ? 'Payment complete' : 'Confirm payment', 270, 104, '700 43px Segoe UI', '#eff5f6');
  rounded(ctx, 168, 219, 204, 204, 102, mode === 'paid' ? '#d8efe3' : '#def1f6');
  text(ctx, mode === 'paid' ? '✓' : '₹', 270, 360, '700 100px Segoe UI', mode === 'paid' ? '#27765b' : '#146080');
  text(ctx, data.merchant, 270, 503, '700 48px Segoe UI', '#152535');
  text(ctx, data.amount, 270, 637, '800 103px Segoe UI', '#102532');
  if (mode === 'paid' || data.amountAt === undefined) {
    text(ctx, mode === 'paid' ? 'Paid successfully' : 'Bank account selected', 270, 729, '600 34px Segoe UI', '#3f6570');
  }
  rounded(ctx, 49, 843, 442, 105, 28, mode === 'paid' ? '#e3efec' : '#13719e');
  text(ctx, mode === 'paid' ? 'Done' : 'Authorize payment', 270, 911, '700 36px Segoe UI', mode === 'paid' ? '#356353' : '#f5fbfd');
}

function Phone({ data, second, frame, fps }: { data: Checkout; second: number; frame: number; fps: number }) {
  const relative = frame - data.cues.scan;
  const reviewAt = Math.max(data.cues.scan + Math.round(0.15 * fps), data.amountAt ?? 0);
  const mode = frame >= data.cues.confirm ? 'paid' : frame >= reviewAt ? 'review' : 'scan';
  const visibleAmount = frame >= (data.amountAt ?? 0) ? data.amount : '';
  const display = usePaint(540, 1070, ctx => phonePaint(ctx, mode, { ...data, amount: visibleAmount }), JSON.stringify([mode, visibleAmount, data.merchant]));
  const scannedFace = usePaint(600, 600, SoundboxFace, 'scanner-view');
  const raise = interpolate(second, [0, 0.75], [0, 1], clamp);
  const align = interpolate(relative, [-1.15 * fps, 0], [0, 1], clamp);
  const tap = interpolate(frame, [data.cues.authorize - 8, data.cues.authorize, data.cues.authorize + 8], [0, 1, 0], clamp);
  const line = 0.08 - 0.36 * interpolate(relative, [-fps, 0], [0, 1], clamp);
  return <group position={[-0.45 + raise * 0.052, 1.17 + raise * 0.25, 0.61]} rotation={[0.08, -0.085 + 0.1 * raise, -0.12 + raise * 0.105]}>
    <mesh position={[-0.21, -0.29, -0.046]} scale={[0.13, 0.25, 0.07]} rotation={[0, 0, 0.16]}>
      <sphereGeometry args={[1, 24, 16]} />
      <meshStandardMaterial color="#9a5742" roughness={0.81} />
    </mesh>
    <RoundedSolid size={[0.46, 0.93, 0.055]} at={[0, 0, 0]} sizing={0.025} color="#121a22" roughness={0.25} />
    <mesh position={[0, 0, 0.032]}>
      <planeGeometry args={[0.425, 0.86]} />
      <meshBasicMaterial map={display} toneMapped={false} />
    </mesh>
    <RoundedSolid size={[0.101, 0.017, 0.005]} at={[0, 0.415, 0.037]} sizing={0.002} color="#101820" />
    <mesh position={[-0.251 + tap * 0.075, -0.285 + tap * 0.06, 0.07 + (1 - tap) * 0.037]}
      scale={[0.045, 0.128, 0.037]} rotation={[0, 0, -0.32 - tap * 0.67]}>
      <sphereGeometry args={[1, 18, 12]} />
      <meshStandardMaterial color="#b87453" roughness={0.74} />
    </mesh>
    {mode === 'scan' && <>
      <group position={[(1 - align) * 0.062, (1 - align) * -0.11, 0.036]}
        scale={0.71 + 0.29 * align} rotation={[0, 0, (1 - align) * 0.12]}>
        <RoundedSolid size={[0.314, 0.314, 0.001]} at={[0, 0, 0]} sizing={0.0004} color="#0c729e" />
        <mesh position={[0, 0, 0.001]}><planeGeometry args={[0.29, 0.29]} />
          <meshBasicMaterial map={scannedFace} transparent alphaTest={0.1} toneMapped={false} /></mesh>
      </group>
      {[-1, 1].flatMap(x => [-1, 1].map(y => <group key={`${x}-${y}`} position={[0.154 * x, -0.011 + 0.16 * y, 0.038]}>
        <RoundedSolid size={[0.061, 0.006, 0.002]} at={[-x * 0.023, 0, 0]} sizing={0.001} color="#bae9fb" />
        <RoundedSolid size={[0.006, 0.061, 0.002]} at={[0, -y * 0.023, 0]} sizing={0.001} color="#bae9fb" />
      </group>))}
      <mesh position={[0, Math.max(-0.15, line), 0.04]}>
        <planeGeometry args={[0.305, 0.005]} />
        <meshBasicMaterial color="#84f8d1" />
      </mesh>
    </>}
  </group>;
}

function CounterSurface() {
  const wood = usePaint(768, 480, ctx => {
    const base = ctx.createLinearGradient(0, 0, 0, 480);
    base.addColorStop(0, '#71462f');
    base.addColorStop(0.5, '#976341');
    base.addColorStop(1, '#75513b');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 768, 480);
    for (let row = 0; row < 460; row += 3) {
      ctx.beginPath();
      ctx.moveTo(0, row);
      for (let x = 0; x < 775; x += 12) ctx.lineTo(x, row + 4 * Math.sin(x * 0.017 + row * 0.21));
      ctx.strokeStyle = row % 5 ? '#d9ac6f24' : '#442d2352';
      ctx.stroke();
    }
  }, 'wood');
  return <>
    <RoundedSolid size={[6.5, 0.13, 3.2]} at={[0, 0.95, 0]} sizing={0.045} color="#96704b" />
    <mesh position={[0, 1.017, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[6.45, 3.15]} />
      <meshStandardMaterial map={wood} roughness={0.64} />
    </mesh>
    <RoundedSolid size={[6.5, 1.14, 0.11]} at={[0, 0.318, 1.38]} sizing={0.04} color="#314b48" />
    <RoundedSolid size={[6.3, 2.9, 0.1]} at={[0, 1.43, -1.48]} sizing={0.04} color="#22353b" />
    <RoundedSolid size={[4.15, 0.075, 0.34]} at={[0, 1.64, -1.27]} sizing={0.025} color="#7a5840" />
    {[-1.82, -1.52, -1.32, -1.03, 1.51, 1.77].map((x, index) => <group key={x} position={[x, 1.69, -1.25]}>
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.11, 0.09, 0.26, 22]} />
        <meshStandardMaterial color={index % 2 ? '#9e693d' : '#cfba89'} roughness={0.43} />
      </mesh>
      <RoundedSolid size={[0.22, 0.039, 0.22]} at={[0, 0.268, 0]} sizing={0.018} color="#ada082" />
    </group>)}
    {[-1.02, 1.13].map((x, index) => <group key={x} position={[x, 1.125, 0.26 + index * 0.25]}>
      <mesh>
        <cylinderGeometry args={[0.136, 0.083, 0.21, 28]} />
        <meshStandardMaterial color="#c98751" roughness={0.77} />
      </mesh>
      <mesh position={[0, 0.10, 0]}>
        <cylinderGeometry args={[0.125, 0.125, 0.006, 24]} />
        <meshStandardMaterial color="#733a24" roughness={0.38} />
      </mesh>
    </group>)}
  </>;
}

function CheckoutFilm({ shot, frame }: { shot: TimedShot & { checkout: Checkout }; frame: number }) {
  const { fps, width, height } = useVideoConfig();
  const data = shot.checkout;
  const progress = interpolate(frame, [0, Math.max(1, shot.duration - 1)], [0, 1], clamp);
  const alert = data.phase === 'alert';
  const alertFrame = data.amountAt === undefined ? 0 : data.cues.alert;
  const showReceiptAt = Math.max(alertFrame, data.amountAt ?? 0);
  const position: Vector = alert ? [0.87 - progress * 0.31, 1.84 - progress * 0.15, 2.93 - progress * 0.33]
    : [0.12 + progress * 0.08, 1.79 - progress * 0.08, 4.45 - progress * 0.29];
  if (data.amountAt !== undefined && shot.kind === 'film') {
    if (shot.camera === 'locked') {
      position[0] = alert ? 0.87 : 0.12;
      position[1] = alert ? 1.84 : 1.79;
      position[2] = alert ? 2.93 : 4.45;
    }
    if (shot.camera === 'track-left') position[0] += (0.5 - progress) * 0.72;
    if (shot.camera === 'track-right') position[0] += (progress - 0.5) * 0.72;
    if (shot.camera === 'pull-back') position[2] += progress * 0.85;
    if (shot.camera === 'rise') position[1] += progress * 0.58;
    position[2] += shot.framing === 'wide' ? 0.46 : shot.framing === 'close' ? -0.17 : 0;
  }
  const target: Vector = alert ? [0.42, 1.43, 0.07] : [0.05 - progress * 0.07, 1.42, 0.32];
  return <AbsoluteFill style={{ background: '#17232e' }}>
    <ThreeCanvas width={width} height={height} dpr={1} camera={{ fov: alert ? 38 : 42, near: 0.04, far: 25 }}>
      <color attach="background" args={['#1e3038']} />
      <fog attach="fog" args={['#20343d', 3.2, 9]} />
      <hemisphereLight args={['#e2dcc4', '#446573', 1.06]} />
      <directionalLight position={[-2, 3, 4]} color="#ffddb2" intensity={2.18} />
      <directionalLight position={[3, 2, -3]} color="#92dcec" intensity={1.45} />
      <pointLight position={[-1, 2.05, 0.1]} intensity={7} decay={2} color="#eec497" />
      <Camera position={position} target={target} />
      <CounterSurface />
      <Soundbox active={alert && frame >= alertFrame} second={Math.max(0, frame - (alert ? alertFrame : 0)) / fps} />
      {!alert && <Phone data={data} second={frame / fps} frame={frame + data.offset} fps={fps} />}
    </ThreeCanvas>
    <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse at 49% 48%, transparent 35%, #12202c78 100%)' }} />
    {alert && <div style={{
      position: 'absolute', top: 1160, left: 163, padding: '16px 29px', borderRadius: 12, color: '#f4fafc',
      background: '#123042ec', border: '1px solid #76bdd4aa', font: '600 43px Segoe UI',
      opacity: interpolate(frame, [showReceiptAt, showReceiptAt + 14], [0, 1], clamp),
    }}>{data.amount} received</div>}
  </AbsoluteFill>;
}

function CheckoutBanks({ shot }: { shot: TimedShot & { checkout: Checkout } }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { checkout: data } = shot;
  const now = frame + data.offset;
  const fade = (start: number) => interpolate(now, [start, start + fps * 0.34], [0, 1], clamp);
  return <AbsoluteFill style={{ color: 'inherit' }}>
    <div style={{ position: 'absolute', top: 412, left: 104, width: 872, textAlign: 'center', fontWeight: 740, fontSize: 61, letterSpacing: -1.8 }}>
      How did the payment get there?
    </div>
    <div style={{ position: 'absolute', top: 712, left: 108, width: 864, display: 'flex', justifyContent: 'space-between' }}>
      {[
        { title: data.payer, role: 'Payer', bank: data.banks[0], at: data.cues.payer, bankAt: data.cues.payerBank },
        { title: data.merchant, role: 'Merchant', bank: data.banks[1], at: data.cues.merchant, bankAt: data.cues.merchantBank },
      ].map(account => <div key={account.role} style={{
        boxSizing: 'border-box', width: 328, padding: '38px 30px', borderRadius: 21, background: '#111827',
        border: '1.5px solid rgba(255,255,255,0.12)', minHeight: 272, opacity: fade(account.at),
        translate: `0px ${(1 - fade(account.at)) * 20}px`,
      }}>
        <div style={{ color: '#a0cad0', fontSize: 25, fontWeight: 680 }}>{account.role}</div>
        <div style={{ marginTop: 12, fontSize: 41, fontWeight: 750 }}>{account.title}</div>
        <div style={{ marginTop: 21, color: '#f5cb94', fontSize: 40, fontWeight: 780, opacity: fade(account.bankAt) }}>{account.bank}</div>
      </div>)}
    </div>
    <div style={{ position: 'absolute', left: 459, top: 804, width: 162, borderTop: '3px dashed #73939c', opacity: fade(data.cues.merchant) }}>
      <div style={{ position: 'absolute', left: 55, top: -34, width: 52, height: 55, textAlign: 'center', fontSize: 46,
        fontWeight: 700, background: '#142c39', color: '#eecf9e' }}>?</div>
    </div>
    {data.closeQuestionAt !== undefined && now >= data.closeQuestionAt && <div style={{
      position: 'absolute', top: 1090, left: 108, width: 864, textAlign: 'center', fontSize: 45, fontWeight: 700,
      color: '#9cded7', opacity: fade(data.closeQuestionAt),
    }}>The app doesn’t hold the money.</div>}
  </AbsoluteFill>;
}

export function CheckoutReceipt({ shot, frame }: { shot: TimedShot & { checkout: Checkout }; frame: number }) {
  return <CheckoutFilm shot={{ ...shot, checkout: { ...shot.checkout, phase: 'alert' } }} frame={frame} />;
}

export function CheckoutIntro({ amount, duration }: { amount: string; duration: number }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const progress = interpolate(frame, [0, Math.max(1, duration - 1)], [0, 1], clamp);
  const bill = usePaint(496, 340, ctx => {
    ctx.fillStyle = '#f0e4c9';
    ctx.fillRect(0, 0, 496, 340);
    text(ctx, '2 CHAI', 248, 102, '700 44px Segoe UI', '#5c422b');
    ctx.fillStyle = '#a28a69';
    ctx.fillRect(65, 141, 366, 3);
    text(ctx, amount, 248, 242, '800 75px Segoe UI', '#382a20');
  }, amount);
  const slide = interpolate(frame, [fps * 1.75, fps * 2.65], [0.69, 0.24], clamp);
  return <AbsoluteFill>
    <ThreeCanvas width={width} height={height} dpr={1} camera={{ fov: 37, near: 0.04, far: 25 }}>
      <color attach="background" args={['#1e3038']} />
      <hemisphereLight args={['#e2dcc4', '#446573', 1.15]} />
      <directionalLight position={[-2, 3, 4]} color="#ffddb2" intensity={2.28} />
      <pointLight position={[-1, 2.05, 0.1]} intensity={7} decay={2} color="#eec497" />
      <Camera position={[0.42 - progress * 0.28, 2.7 - progress * 0.32, 3.87 - progress * 0.46]} target={[0.06, 1.09, 0.27]} />
      <CounterSurface />
      <Soundbox active={false} second={0} />
      <mesh position={[-0.18, 1.028, slide]} rotation={[-Math.PI / 2, 0, 0.10]}>
        <planeGeometry args={[0.55, 0.377]} /><meshStandardMaterial map={bill} roughness={0.86} />
      </mesh>
      {[-0.73, -0.37].map((x, index) => <group key={x} position={[x, 1.15, -0.08 - index * 0.27]}>
        <mesh><cylinderGeometry args={[0.14, 0.091, 0.25, 25]} /><meshStandardMaterial color={index ? '#d29158' : '#cc8554'} /></mesh>
        <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[0.124, 0.124, 0.006, 24]} /><meshStandardMaterial color="#7d4327" /></mesh>
        {[0, 1, 2].map(puff => {
          const p = (frame / fps * 0.67 + puff / 3) % 1;
          return <mesh key={puff} position={[Math.sin(p * 8 + index) * 0.043, 0.17 + p * 0.46, 0]} scale={0.025 + p * 0.048}>
            <sphereGeometry args={[1, 12, 10]} /><meshBasicMaterial color="#f3e3c3" transparent opacity={0.28 * (1 - p)} depthWrite={false} />
          </mesh>;
        })}
      </group>)}
    </ThreeCanvas>
    <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 50%, transparent 35%, #12202c75 100%)' }} />
  </AbsoluteFill>;
}

export function CheckoutPilotShot({ shot }: { shot: TimedShot & { checkout: Checkout } }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const data = shot.checkout;
  if (data.phase === 'banks') return <CheckoutBanks shot={shot} />;
  if (data.phase === 'scan' || data.phase === 'alert') return <CheckoutFilm shot={shot} frame={frame} />;

  const now = frame + data.offset;
  const begin = data.cues.begin ?? data.offset;
  if (now < begin) return <CheckoutIntro amount={data.amount} duration={begin - data.offset} />;
  const entersAlert = now >= data.cues.alert;
  const start = entersAlert ? data.cues.alert : begin;
  const end = entersAlert ? data.cues.question : data.cues.alert;
  const stage = {
    ...shot, duration: end - start,
    checkout: { ...data, phase: entersAlert ? 'alert' as const : 'scan' as const, offset: start },
  };
  if (now < data.cues.question) return <CheckoutFilm shot={stage} frame={now - start} />;

  const opacity = interpolate(now, [data.cues.question, data.cues.question + fps * 0.58], [1, 0], clamp);
  return <>
    <CheckoutBanks shot={shot} />
    {opacity > 0 && <AbsoluteFill style={{ opacity }}>
      <CheckoutFilm shot={stage} frame={stage.duration - 1} />
    </AbsoluteFill>}
  </>;
}
