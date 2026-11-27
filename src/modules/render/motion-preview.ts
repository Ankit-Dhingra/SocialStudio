import type { ScriptSession } from '../ai-script/master-script-service.js';
import type { MotionScope } from '../jobs/durable-jobs.js';
import type { VideoTimeline } from '../video/timeline.js';
import { technicalShotKinds, type VisualPlan } from '../video/visual-story.js';
import type { ReelVisualAssets } from './reel-visual-assets.js';

export function motionFrameRange(timeline: VideoTimeline, shots: VisualPlan, sceneIndex: number, scope: MotionScope): [number, number] {
  const selected = timeline.segments[sceneIndex];
  if (!selected) throw new Error('Choose a valid start scene.');
  let start = selected.startFrame;
  let seconds = 24;
  if (scope === 'hook') { start = 0; seconds = 15; }
  if (scope === 'ending') { seconds = 12; start = Math.max(0, timeline.totalDurationInFrames - seconds * timeline.fps); }
  if (scope === 'transition') {
    const cuts = shots.flatMap((group, i) => group.map(shot => ({ shot, frame: timeline.segments[i].startFrame + shot.from })));
    const change = cuts.find(entry => entry.frame > 0 && (entry.shot.nativeScene || technicalShotKinds.has(entry.shot.kind)));
    start = Math.max(0, (change?.frame ?? 0) - 3 * timeline.fps);
    seconds = 15;
  }
  return [start, Math.min(timeline.totalDurationInFrames - 1, start + seconds * timeline.fps - 1,
    scope === 'scene' ? selected.startFrame + selected.durationInFrames - 1 : Infinity)];
}

export function motionPreviewMetadata(storyboard: ScriptSession['storyboard'], timeline: VideoTimeline, visuals: ReelVisualAssets,
  sceneIndex: number, scope: MotionScope, [start, end]: [number, number], mediaUrl: string, durationSec: number): NonNullable<ScriptSession['motionPreview']> {
  return {
    visualRevision: visuals.fingerprint, mediaUrl, sceneIndex, scope, durationSec, direction: visuals.direction,
    shots: visuals.shots.flatMap((shots, i) => shots.flatMap(shot => {
      const first = timeline.segments[i].startFrame + shot.from;
      if (first > end || first + shot.duration <= start) return [];
      return [{
        id: shot.id, title: shot.headline || storyboard.scenes[i].onScreenText || `Scene ${i + 1}`,
        kind: shot.nativeScene?.kind ?? shot.kind, fromSec: Math.max(0, first - start) / timeline.fps,
        ...(shot.kind === 'image' && { action: shot.action || shot.brief, camera: shot.camera, footage: Boolean(shot.clip) }),
        ...(shot.kind === 'film' && { action: shot.action, camera: shot.camera }),
        ...(shot.kind === 'device' && shot.appName && shot.scanFrame === undefined && {
          appName: shot.appName, hasScreenCapture: Boolean(shot.asset || shot.clip),
        }),
      }];
    })),
  };
}
