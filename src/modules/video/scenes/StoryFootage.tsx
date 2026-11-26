import React from 'react';
import { AbsoluteFill, Easing, Freeze, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimedShot } from '../visual-story.js';
import { LocalFilm, type FilmShot } from './LocalFilm.js';
import { CheckoutPilotShot } from './CheckoutFilm.js';
import { AppScreen } from './AppScreen.js';
import { DesktopDemo } from './DesktopDemo.js';
import { VideoDesignTokens as design } from '../design-system.js';

export type StoryShot = Extract<TimedShot, { kind: 'image' }>;
export type StoryHandoffShot = StoryShot | FilmShot | Extract<TimedShot, { kind: 'device' }>;
const trajectories = {
  locked: { x: [0, 0], y: [0, 0], scale: [1, 1] },
  'push-in': { x: [0, 0], y: [0, -28], scale: [1.02, 1.20] },
  'pull-back': { x: [0, 0], y: [-32, 0], scale: [1.24, 1.03] },
  'track-left': { x: [-56, 56], y: [0, 0], scale: [1.16, 1.16] },
  'track-right': { x: [56, -56], y: [0, 0], scale: [1.16, 1.16] },
  rise: { x: [0, 0], y: [-92, 88], scale: [1.18, 1.14] },
};

export function StoryFootage({ shot }: { shot: StoryShot }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const style = { width: '100%', height: '100%', objectFit: 'cover' as const };
  if (shot.clip) {
    const sourceFrames = Math.max(1, Math.floor(shot.clip.seconds * fps) - 1);
    return <OffthreadVideo muted src={staticFile(shot.clip.asset)} style={style}
      playbackRate={Math.min(1, sourceFrames / shot.duration)} />;
  }
  const { x, y, scale } = trajectories[shot.camera ?? 'push-in'];
  const progress = interpolate(frame, [0, Math.max(1, shot.duration - 1)], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  });
  const beat = shot.storyBeat;
  const reframing = beat ? interpolate(frame, [beat.from, beat.from + fps * design.motion.focus], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  }) : 0;
  const artworkStyle = {
    ...style, transformOrigin: '48% 54%',
    scale: interpolate(progress, [0, 1], scale) + reframing * 0.045,
    translate: `${interpolate(progress, [0, 1], x) - reframing * 20}px ${interpolate(progress, [0, 1], y)}px`,
  };
  const cue = shot.actionFrame ?? 0;
  return <AbsoluteFill>
    <Img src={staticFile(shot.asset!)} style={artworkStyle} />
    {beat && reframing > 0 && <div style={{ position: 'absolute', top: 226, left: 82, color: design.colors.ink,
      fontFamily: design.typography.fontFamilySans, fontSize: design.typography.annotation, fontWeight: 700,
      padding: '9px 16px', borderLeft: `3px solid ${design.colors.cyan}`, background: `${design.colors.canvas}d9`,
      opacity: reframing }}>{beat.label}</div>}
    {shot.beatAsset && <AbsoluteFill style={{ opacity: interpolate(frame, [cue, cue + fps * 0.32], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
    }) }}><Img src={staticFile(shot.beatAsset)} style={artworkStyle} /></AbsoluteFill>}
    {shot.layers?.subjects.map((subject, index) => {
      const opts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) } as const;
      const range = [subject.from, subject.from + subject.duration - 1];
      return <Img key={index} src={staticFile(subject.asset)} style={{
        position: 'absolute', width: `${subject.width * 100}%`, height: `${(subject.height ?? 0.24) * 100}%`, objectFit: 'contain',
        left: `${interpolate(frame, range, [subject.start.x, subject.end.x], opts) * 100}%`,
        top: `${interpolate(frame, range, [subject.start.y, subject.end.y], opts) * 100}%`,
        translate: '-50% -50%',
      }} />;
    })}
    {shot.layers && [shot.layers.backgroundCredit, ...shot.layers.subjects.map(subject => subject.credit)].some(Boolean) &&
      <div style={{ position: 'absolute', top: '7%', left: '8%', right: '12%',
        fontSize: 22, color: 'white', textShadow: '0 1px 4px black' }}>
        {[...new Set([shot.layers.backgroundCredit, ...shot.layers.subjects.map(subject => subject.credit)])].filter(Boolean).join(' · ')}
      </div>}
  </AbsoluteFill>;
}

export function StoryHandoff({ previous }: { previous: StoryHandoffShot }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, Math.round(fps * design.motion.transition)], [1, 0], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  });
  return <AbsoluteFill style={{ zIndex: 1, opacity,
    translate: previous.kind === 'device' ? `${(1 - opacity) * -5}% 0` : undefined }}>
    <Freeze frame={previous.duration - 1}>
      {previous.checkout ? <CheckoutPilotShot shot={{ ...previous, checkout: previous.checkout }} />
        : previous.kind === 'film' ? <LocalFilm shot={previous} />
        : previous.kind === 'device' ? (previous.screenLayout === 'desktop' && !previous.asset && !previous.clip
          ? <DesktopDemo shot={previous} /> : <AppScreen shot={previous} />) : <StoryFootage shot={previous} />}
    </Freeze>
  </AbsoluteFill>;
}
