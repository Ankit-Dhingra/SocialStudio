import React from 'react';
import { Composition } from 'remotion';
import { StudioShortComposition, StudioShortProps } from '../src/modules/video/StudioShortComposition.js';
import { TechShort } from './tech-short.js';

// Default preview fixture for Remotion Studio
const defaultPreviewProps = {
  storyboard: {
    topic: 'Node.js Event Loop: Microtasks vs Macrotasks',
    title: 'Node.js Event Loop Explained!',
    hook: 'Microtasks vs Macrotasks in Node.js',
    learningObjective: 'Understand task queues in Node.js',
    targetAudience: 'Developers',
    format: 'short' as const,
    estimatedDurationSec: 42,
    hashtags: ['#javascript', '#nodejs', '#webdev'],
    scenes: [
      {
        id: 'scene-1',
        sceneIndex: 0,
        type: 'hook' as const,
        narration: 'Node.js Event Loop mein Microtasks aur Macrotasks kaise handle hote hain, pata hai?',
        onScreenText: 'EVENT LOOP SECRETS',
        technicalKeyPoint: 'Queue priority',
        durationTargetSec: 6,
        visualProps: {
          headline: 'Event Loop Trick',
          subtext: 'Promise beats setTimeout(0)?',
          badgeText: 'NODE.JS INTERNALS',
          accentColor: '#00F2FE',
        },
      },
      {
        id: 'scene-2',
        sceneIndex: 1,
        type: 'code' as const,
        narration: 'Screen pe dekho ye code. Promise.then pehle run hota hai ya setTimeout?',
        onScreenText: 'Which runs first?',
        technicalKeyPoint: 'Promise runs first',
        durationTargetSec: 10,
        visualProps: {
          filename: 'event-loop.js',
          language: 'javascript' as const,
          code: 'console.log("Start");\nsetTimeout(() => console.log("Timeout"), 0);\nPromise.resolve().then(() => console.log("Promise"));\nconsole.log("End");',
          highlightLines: [2, 3],
          explanationCallout: 'Promise.then executes before setTimeout!',
        },
      },
      {
        id: 'scene-3',
        sceneIndex: 2,
        type: 'queueTimeline' as const,
        narration: 'Kyunki Event Loop microtasks ko pehle execute karta hai aur macrotasks ko baad mein.',
        onScreenText: 'Microtasks Win!',
        technicalKeyPoint: 'Microtasks drain first',
        durationTargetSec: 12,
        visualProps: {
          title: 'Event Loop Task Priority',
          items: [
            { name: 'Microtask Queue (Promise.then)', priority: 'high', detail: 'Drains after current stack' },
            { name: 'Macrotask Queue (setTimeout)', priority: 'medium', detail: 'Runs in next event loop tick' },
          ],
          activeItemIndex: 0,
          accentColor: '#FF6B6B',
        },
      },
      {
        id: 'scene-4',
        sceneIndex: 3,
        type: 'summary' as const,
        narration: 'Toh yaad rakho, Promises hamesha timers se pehle run honge. Follow for more dev secrets!',
        onScreenText: 'Key Takeaways',
        technicalKeyPoint: 'Execution hierarchy',
        durationTargetSec: 8,
        visualProps: {
          headline: 'Summary',
          takeaways: [
            'Call Stack clears first',
            'Microtasks have higher priority',
            'Macrotasks execute in subsequent phases',
          ],
          callToAction: 'Follow for more deep tech!',
        },
      },
    ],
  },
  timeline: {
    fps: 30,
    totalDurationInFrames: 1080,
    totalDurationSec: 36,
    segments: [
      {
        sceneId: 'scene-1',
        sceneIndex: 0,
        type: 'hook',
        startFrame: 0,
        durationInFrames: 210,
        audioDurationMs: 6000,
        audioSrc: '',
      },
      {
        sceneId: 'scene-2',
        sceneIndex: 1,
        type: 'code',
        startFrame: 210,
        durationInFrames: 330,
        audioDurationMs: 10000,
        audioSrc: '',
      },
      {
        sceneId: 'scene-3',
        sceneIndex: 2,
        type: 'queueTimeline',
        startFrame: 540,
        durationInFrames: 330,
        audioDurationMs: 10000,
        audioSrc: '',
      },
      {
        sceneId: 'scene-4',
        sceneIndex: 3,
        type: 'summary',
        startFrame: 870,
        durationInFrames: 210,
        audioDurationMs: 6000,
        audioSrc: '',
      },
    ],
    bgmVolumeDucked: 0.12,
  },
};

const legacyDemo = {
  short: {
    title: 'Node.js concurrency',
    description: 'Tech explainer',
    scenes: [
      { type: 'hook', headline: 'One thread, many requests', narration: 'Node.js handles many connections.', code: '', label: 'Event loop' },
    ],
  },
  audioSrc: 'audio/test.mp3',
  durations: [90],
};

export const Root: React.FC = () => {
  return (
    <>
      {/* Flagship Production 9:16 Studio Short Composition */}
      <Composition
        id="StudioShort"
        component={StudioShortComposition as any}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={1080}
        calculateMetadata={({ props }: { props: any }) => {
          return {
            durationInFrames: props?.timeline?.totalDurationInFrames || 1080,
          };
        }}
        defaultProps={defaultPreviewProps as any}
      />
    </>
  );
};
