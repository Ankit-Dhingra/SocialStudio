import React from 'react';
import { AbsoluteFill, Easing, Freeze, Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimedShot } from '../visual-story.js';
import { LocalFilm, type FilmShot } from './LocalFilm.js';

export type StoryShot = Extract<TimedShot, { kind: 'image' }>;
export type StoryHandoffShot = StoryShot | FilmShot;
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
  return <Img src={staticFile(shot.asset!)} style={{
    ...style, transformOrigin: '48% 54%',
    scale: interpolate(progress, [0, 1], scale),
    translate: `${interpolate(progress, [0, 1], x)}px ${interpolate(progress, [0, 1], y)}px`,
  }} />;
}

export function StoryHandoff({ previous }: { previous: StoryHandoffShot }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, Math.round(fps * 1.15)], [1, 0], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic),
  });
  return <AbsoluteFill style={{ zIndex: 1, opacity }}>
    <Freeze frame={previous.duration - 1}>
      {previous.kind === 'film' ? <LocalFilm shot={previous} /> : <StoryFootage shot={previous} />}
    </Freeze>
  </AbsoluteFill>;
}
