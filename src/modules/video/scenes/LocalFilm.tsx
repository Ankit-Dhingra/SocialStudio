import React, { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { ThreeCanvas } from '@remotion/three';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { Quaternion, Vector3 } from 'three';
import type { TimedShot } from '../visual-story.js';

export type FilmShot = Extract<TimedShot, { kind: 'film' }>;
type Point = [number, number, number];
const ink = '#172531';
const amber = '#eebc75';
const cream = '#f7e2b8';
const teal = '#498887';
const easing = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) } as const;

function Block({ size, at, color }: { size: Point; at: Point; color: string }) {
  return <mesh position={at}>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.77} />
  </mesh>;
}

function Ball({ at, size, color }: { at: Point; size: Point; color: string }) {
  return <mesh position={at} scale={size}>
    <sphereGeometry args={[1, 16, 12]} />
    <meshStandardMaterial color={color} roughness={0.78} />
  </mesh>;
}

function Limb({ from, to, color, radius = 0.068 }: { from: Point; to: Point; color: string; radius?: number }) {
  const a = new Vector3(...from);
  const b = new Vector3(...to);
  const direction = b.clone().sub(a);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
  return <mesh position={a.add(b).multiplyScalar(0.5)} quaternion={rotation}>
    <cylinderGeometry args={[radius, radius * 0.88, direction.length(), 10]} />
    <meshStandardMaterial color={color} roughness={0.8} />
  </mesh>;
}

function Cup({ at, steam = 0 }: { at: Point; steam?: number }) {
  return <group position={at}>
    <mesh>
      <cylinderGeometry args={[0.104, 0.077, 0.178, 20]} />
      <meshStandardMaterial color={cream} />
    </mesh>
    <mesh position={[0, 0.09, 0]}>
      <cylinderGeometry args={[0.088, 0.088, 0.009, 20]} />
      <meshStandardMaterial color="#873f25" />
    </mesh>
    <mesh position={[0.095, 0.013, 0]}>
      <torusGeometry args={[0.05, 0.015, 9, 18]} />
      <meshStandardMaterial color={cream} />
    </mesh>
    {[0, 1, 2].map(index => {
      const rise = (steam + index / 3) % 1;
      return <mesh key={index} position={[Math.sin(rise * 6 + index) * 0.036, 0.14 + 0.31 * rise, 0]} scale={0.045 + 0.04 * rise}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color="#ffeccd" transparent opacity={0.23 * (1 - rise)} depthWrite={false} />
      </mesh>;
    })}
  </group>;
}

function Character({ at, shirt, skin, gesture, t, cup }: {
  at: Point; shirt: string; skin: string; gesture: number; t: number; cup?: boolean;
}) {
  const lean = Math.sin(t * 2.4) * 0.019;
  const shoulder: Point = [0.21, 0.71, 0];
  const elbow: Point = [0.26, 0.49 + gesture * 0.17, 0.15 + gesture * 0.03];
  const hand: Point = [0.20 - gesture * 0.15, 0.39 + gesture * 0.51, 0.27 - gesture * 0.05];
  const blink = Math.sin(t * 2.2) > 0.992 ? 0.011 : 0.041;
  return <group position={at} rotation={[0, lean * 7, 0]}>
    <Ball at={[0, 0.49, 0]} size={[0.255, 0.36, 0.155]} color={shirt} />
    <Limb from={[-0.10, 0.23, 0]} to={[-0.12, -0.14, 0.16]} color={ink} radius={0.093} />
    <Limb from={[0.10, 0.23, 0]} to={[0.12, -0.14, 0.16]} color={ink} radius={0.093} />
    <Ball at={[lean, 0.96, 0.035]} size={[0.189, 0.199, 0.168]} color={skin} />
    <Ball at={[lean, 1.085, 0.025]} size={[0.195, 0.093, 0.167]} color="#292725" />
    <Ball at={[lean - 0.174, 0.964, 0.052]} size={[0.031, 0.052, 0.048]} color={skin} />
    <Ball at={[lean + 0.174, 0.964, 0.052]} size={[0.031, 0.052, 0.048]} color={skin} />
    {[-1, 1].map(sign => <Ball key={sign} at={[lean + sign * 0.064, 0.974, 0.193]} size={[0.018, blink, 0.012]} color={ink} />)}
    <Ball at={[lean, 0.904, 0.195]} size={[0.042, 0.014, 0.008]} color="#5a302a" />
    <Limb from={[-0.20, 0.71, 0]} to={[-0.28, 0.39, 0.15]} color={shirt} />
    <Limb from={shoulder} to={elbow} color={shirt} />
    <Limb from={elbow} to={hand} color={skin} radius={0.049} />
    <Ball at={hand} size={[0.06, 0.054, 0.055]} color={skin} />
    {cup && <Cup at={[hand[0], hand[1] + 0.07, hand[2] + 0.055]} steam={t * 0.45} />}
  </group>;
}

function Counter({ t, serving, drinking }: { t: number; serving: boolean; drinking: boolean }) {
  const lift = (offset: number) => drinking ? Math.pow(Math.max(0, Math.sin(t * 2.35 + offset)), 2) * 0.89 : 0;
  const slide = serving ? interpolate(t, [0.1, 0.95, 1.75], [0.03, 0.46, 0.58], easing) : 0.03;
  return <>
    <Block size={[7, 0.08, 6]} at={[0, -0.04, 0]} color="#415359" />
    <Block size={[3.76, 2.11, 0.12]} at={[0, 1.05, -1.18]} color="#233e49" />
    <Block size={[3.77, 0.10, 2.1]} at={[0, 2.13, -0.5]} color="#252b36" />
    {[-1.65, 1.65].map(x => <Block key={x} size={[0.084, 2.1, 0.084]} at={[x, 1.06, 0.3]} color="#b7754f" />)}
    {Array.from({ length: 7 }, (_, index) => <Block key={index} size={[0.53, 0.085, 0.54]} at={[-1.59 + index * 0.53, 2.05, 0.69]} color={index % 2 ? '#9b5546' : '#e6b578'} />)}
    <Block size={[3.55, 0.83, 0.58]} at={[0, 0.42, 0.64]} color="#673e37" />
    {Array.from({ length: 8 }, (_, index) => <Block key={index} at={[-1.55 + index * 0.44, 0.39, 0.94]} size={[0.018, 0.69, 0.02]} color="#ac7650" />)}
    <Block size={[3.65, 0.084, 0.70]} at={[0, 0.855, 0.64]} color="#b37a52" />
    <Block size={[3.25, 0.07, 0.27]} at={[0, 1.56, -1.04]} color="#ac6c48" />
    {[-1.1, -0.35, 0.35, 1.1].map((x, index) => <Cup key={x} at={[x, 1.68, -1.02]} steam={index / 5} />)}
    <Character at={[-0.65, 0.56, 0.05]} shirt="#427b78" skin="#bd785d" gesture={lift(0)} t={t} cup />
    <Character at={[0.31, 0.56, 0.03]} shirt="#a75a48" skin="#d69369" gesture={lift(1.7)} t={t + 0.22} cup />
    <Character at={[1.19, 0.57, -0.13]} shirt="#c19e61" skin="#9a5f49" gesture={serving ? slide : 0.15} t={t + 0.6} />
    <Cup at={[-1.1, 0.988, 0.64]} steam={t * 0.5} />
    <Cup at={[0.61, 0.988, 0.48]} steam={t * 0.5 + 0.4} />
    {serving && <Block at={[0.40 - slide * 0.42, 0.908, 0.45 + slide * 0.45]} size={[0.30, 0.016, 0.19]} color="#f1dcb2" />}
    <mesh position={[0, 1.93, 0.38]}>
      <sphereGeometry args={[0.075, 12, 10]} />
      <meshStandardMaterial color={amber} emissive="#ffae43" emissiveIntensity={2} />
    </mesh>
    <pointLight position={[0, 1.83, 0.5]} color="#ffb96a" intensity={11} distance={5} decay={2} />
  </>;
}

function DeviceAction({ t, confirm, scanCode }: { t: number; confirm: boolean; scanCode: boolean }) {
  const lift = interpolate(t, [0, 0.65], [0, 1], easing);
  const scan = (t * 0.7) % 1;
  const success = t > 1.25;
  return <group position={[0, 1.1, 0.69]}>
    {confirm ? <>
      <Block size={[0.66, 0.61, 0.34]} at={[0, 0.06, 0]} color="#315961" />
      <Block size={[0.56, 0.43, 0.04]} at={[0, 0.07, 0.19]} color="#182c35" />
      {Array.from({ length: 6 }, (_, row) => Array.from({ length: 8 }, (_cell, column) =>
        <Ball key={`${row}-${column}`} at={[-0.21 + column * 0.06, -0.05 + row * 0.049, 0.216]} size={[0.012, 0.012, 0.009]} color="#647e80" />))}
      {[0, 1, 2].map(index => {
        const phase = (t * 0.82 + index / 3) % 1;
        return <mesh key={index} position={[0, 0.08, 0.235 + phase * 0.45]} scale={0.22 + 0.91 * phase}>
          <torusGeometry args={[0.51, 0.012, 8, 44]} />
          <meshBasicMaterial color="#a8f5dc" transparent opacity={(1 - phase) * 0.75} depthWrite={false} />
        </mesh>;
      })}
      <mesh position={[0.24, 0.297, 0.19]} scale={0.02 + Math.pow(Math.sin(t * 5), 2) * 0.018}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color="#b2ffd9" />
      </mesh>
    </> : <group position={[0, lift * 0.18, lift * 0.14]} rotation={[0.18 * (1 - lift), -0.24 + lift * 0.25, -0.12 + lift * 0.10]}>
      <Ball at={[-0.22, -0.22, 0.04]} size={[0.14, 0.21, 0.09]} color="#bf815e" />
      <Block size={[0.44, 0.84, 0.053]} at={[0, 0, 0]} color="#10202b" />
      <Block size={[0.385, 0.75, 0.02]} at={[0, 0.005, 0.035]} color={success ? '#29574c' : '#ecdfbd'} />
      {success ? <>
        <Ball at={[0, 0.05, 0.059]} size={[0.109, 0.109, 0.013]} color="#8be2b2" />
        <Limb from={[-0.05, 0.047, 0.076]} to={[-0.015, 0.008, 0.076]} color="#224a40" radius={0.014} />
        <Limb from={[-0.015, 0.008, 0.076]} to={[0.061, 0.093, 0.076]} color="#224a40" radius={0.014} />
      </> : scanCode ? <>
        {Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_cell, column) =>
          (row * 19 + column * 37 + row * column * 13) % 7 < 3 &&
          <Block key={`${row}-${column}`} size={[0.021, 0.021, 0.011]} at={[-0.10 + column * 0.025, -0.082 + row * 0.025, 0.057]} color="#24363e" />))}
        <Block size={[0.29, 0.012, 0.014]} at={[0, 0.14 - scan * 0.27, 0.075]} color="#57cda3" />
      </> : <>
        <Block at={[0, 0.14, 0.057]} size={[0.27, 0.045, 0.01]} color="#52797c" />
        <Block at={[0, 0.045, 0.057]} size={[0.27, 0.035, 0.01]} color="#91a79d" />
        <Block at={[0, -0.147, 0.059]} size={[0.24, 0.079, 0.01]} color="#608f7a" />
      </>}
      <Ball at={[0.258 - Math.sin(lift * 1.4) * 0.14, -0.18 + lift * 0.12, 0.14]} size={[0.055, 0.115, 0.052]} color="#bf815e" />
    </group>}
  </group>;
}

function Street({ t }: { t: number }) {
  return <>
    <Block size={[8, 0.07, 12]} at={[0, -0.03, 0]} color="#394b55" />
    {Array.from({ length: 9 }, (_, index) => {
      const z = 5 - (index * 1.6 + t * 2.8) % 14;
      return <group key={index} position={[0, 0, z]}>
        <Block size={[0.07, 0.012, 0.45]} at={[0.87, 0.015, 0]} color="#f2c98a" />
        {[-1, 1].map(sign => <group key={sign} position={[sign * 2.65, 0, 0]}>
          <Block size={[1.25, 1.7 + index % 3 * 0.42, 1.45]} at={[0, 0.82, 0]} color={index % 2 ? '#536e77' : '#374952'} />
          <Block size={[0.29, 0.31, 0.02]} at={[0.22, 1.02, 0.74]} color="#e8b577" />
        </group>)}
      </group>;
    })}
    <group position={[Math.sin(t * 2) * 0.12, 0, 0]} rotation={[0, -0.36, Math.sin(t * 2) * 0.1]}>
      <Block size={[0.42, 0.25, 0.97]} at={[0, 0.38, 0]} color={teal} />
      <Block size={[0.27, 0.095, 0.39]} at={[0, 0.57, -0.13]} color={ink} />
      {[0.45, -0.42].map(z => <mesh key={z} position={[0, 0.23, z]} rotation={[0, Math.PI / 2, t * 13]}>
        <torusGeometry args={[0.18, 0.058, 9, 18]} />
        <meshStandardMaterial color="#202a32" />
      </mesh>)}
      <group position={[0, 0.62, -0.10]} rotation={[0.16, Math.PI, 0]} scale={0.66}>
        <Character at={[0, 0, 0]} shirt="#ad694c" skin="#c98a65" t={t} gesture={0.39} />
      </group>
    </group>
  </>;
}

function Room({ t, opening }: { t: number; opening: boolean }) {
  const motion = interpolate(t, [0.15, 1.25], [0, 1], easing);
  return <>
    <Block size={[6, 0.08, 6]} at={[0, -0.04, 0]} color="#516869" />
    <Block size={[5, 3.2, 0.16]} at={[0, 1.6, -1]} color="#314751" />
    {opening ? <>
      <Block size={[1.2, 1.92, 0.51]} at={[0, 0.98, -0.28]} color="#52686c" />
      <Block size={[1.03, 1.60, 0.02]} at={[0, 0.96, 0.008]} color="#bad1c9" />
      {[0.35, 0.68, 1.01, 1.34].map(y => <Block key={y} size={[1.02, 0.04, 0.38]} at={[0, y, 0.14]} color="#e3ddad" />)}
      <group position={[-0.59, 0.98, 0.31]} rotation={[0, -motion * 1.73, 0]}>
        <Block size={[1.18, 1.92, 0.10]} at={[0.59, 0, 0]} color="#7d9c97" />
        <Block size={[0.05, 0.28, 0.09]} at={[1.04, 0.14, 0.07]} color={cream} />
      </group>
    </> : <>
      <Block size={[1.46, 0.76, 0.38]} at={[0, 0.92, 0.1]} color="#253d47" />
      <mesh position={[0, 0.91, 0.40 - motion * 0.081]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.17, 32]} />
        <meshStandardMaterial color={motion > 0.75 ? '#9de6b1' : '#e2a55b'} />
      </mesh>
      <Ball at={[0.48 - motion * 0.30, 0.83 + motion * 0.07, 0.65 - motion * 0.26]} size={[0.25, 0.086, 0.11]} color="#bf815e" />
    </>}
  </>;
}

export function Camera({ position, target }: { position: Point; target: Point }) {
  const camera = useThree(state => state.camera);
  const advance = useThree(state => state.advance);
  useLayoutEffect(() => {
    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateMatrixWorld();
    advance(performance.now());
  }, [camera, advance, position, target]);
  return null;
}

export function LocalFilm({ shot }: { shot: FilmShot }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const progress = interpolate(frame, [0, Math.max(1, shot.duration - 1)], [0, 1], easing);
  const close = shot.performance === 'scan' || shot.performance === 'confirm';
  const exchange = shot.performance === 'serve';
  const street = shot.set === 'street';
  const counter = shot.set === 'counter';
  const x = shot.camera === 'track-left' ? 0.4 - 0.9 * progress : shot.camera === 'track-right' ? -0.4 + 0.9 * progress : 0.14;
  const move = shot.camera === 'push-in' ? 0.30 * progress : shot.camera === 'pull-back' ? 0.35 * (1 - progress) : 0;
  const y = (close ? 1.6 : street ? 2.35 : 2.49) + (shot.camera === 'rise' ? 0.9 * progress : 0);
  const target: Point = [exchange ? 0.20 : 0, close ? 1.17 : street ? 0.77 : 1.03, close || exchange ? 0.69 : 0.20];
  return <AbsoluteFill style={{ background: '#182d38' }}>
    <ThreeCanvas width={width} height={height} dpr={1} camera={{ fov: close ? 37 : 35, near: 0.03, far: 40 }}
      gl={{ antialias: true }} style={{ position: 'absolute', inset: 0 }}>
      <color attach="background" args={['#192f3a']} />
      <fog attach="fog" args={['#263d46', 5, 14]} />
      <hemisphereLight args={['#ffe9c6', '#456678', 2.25]} />
      <directionalLight position={[3, 6, 4]} color="#ffd39b" intensity={2.15} />
      <directionalLight position={[-4, 2, -4]} color="#83c5e2" intensity={1.05} />
      <Camera position={[x, y, (close ? 3.08 : street ? 3.95 : exchange ? 4.62 : 5.35) - move]} target={target} />
      {counter && <Counter t={t} serving={shot.performance === 'serve'} drinking={shot.performance === 'drink'} />}
      {close && <DeviceAction t={t} confirm={shot.performance === 'confirm'} scanCode={/\b(?:qr|scan\w*)\b|स्कैन/iu.test(shot.action)} />}
      {street && <Street t={t} />}
      {shot.set === 'room' && <Room t={t} opening={shot.performance === 'open'} />}
    </ThreeCanvas>
    <AbsoluteFill style={{ pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 46%, transparent 35%, #101b2970 100%)' }} />
  </AbsoluteFill>;
}
