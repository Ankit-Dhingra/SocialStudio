import test from 'node:test';
import assert from 'node:assert/strict';
import {
  StoryboardSceneSchema,
  StoryboardSchema,
  HumanReadableText,
} from '../src/modules/contracts/storyboard.js';
import { SceneRegistry, renderRegisteredScene } from '../src/modules/video/SceneRegistry.js';

test('HumanReadableText rejects serialized JSON strings', () => {
  // Typical AI slop raw JSON string
  const rawJsonArray = '[{"text":"Last Seat: 1","position":"top_center","color":"white"}]';
  const rawJsonObject = '{"text":"Book Now","position":"bottom_center"}';
  
  assert.throws(() => {
    HumanReadableText.parse(rawJsonArray);
  }, /onScreenText must be human-readable text/);

  assert.throws(() => {
    HumanReadableText.parse(rawJsonObject);
  }, /onScreenText must be human-readable text/);

  // Normal human-readable headline passes
  const validText = 'RACE CONDITION • LAST SEAT BOOKING';
  assert.equal(HumanReadableText.parse(validText), validText);
});

test('StoryboardSceneSchema validates valid discriminated union scene', () => {
  const validRaceScene = {
    id: 'scene-1',
    sceneIndex: 0,
    type: 'raceCondition',
    narration: 'Concert ki last seat bachi hai aur do log simultaneous book kar rahe hain.',
    onScreenText: 'LAST SEAT • RACE CONDITION',
    technicalKeyPoint: 'Atomic conditional write prevents double-allocation',
    durationTargetSec: 15,
    visualProps: {
      title: 'TICKET BOOKING SIMULATOR',
      itemTitle: 'VIP Pass (Seat A-12)',
      user1Name: 'Aman',
      user2Name: 'Riya',
      atomicQuery: 'UPDATE inventory SET stock = stock - 1 WHERE id = 101 AND stock > 0;',
    },
  };

  const parsed = StoryboardSceneSchema.parse(validRaceScene);
  assert.equal(parsed.type, 'raceCondition');
  assert.equal(parsed.visualProps.itemTitle, 'VIP Pass (Seat A-12)');
});

test('StoryboardSceneSchema rejects unknown scene types', () => {
  const invalidScene = {
    id: 'scene-unknown',
    sceneIndex: 0,
    type: 'nonExistentSceneType',
    narration: 'This scene type does not exist in our discriminated union.',
    onScreenText: 'INVALID SCENE',
    technicalKeyPoint: 'Should fail',
  };

  assert.throws(() => {
    StoryboardSceneSchema.parse(invalidScene);
  });
});

test('SceneRegistry has entries for all discriminated union types', () => {
  const expectedTypes = [
    'hook',
    'code',
    'requestFlow',
    'queueTimeline',
    'comparison',
    'collection',
    'raceCondition',
    'summary',
    'smartphoneMockup',
    'h3SpatialMap',
    'architecturePipeline',
    'tradeoffHUD',
  ];

  for (const type of expectedTypes) {
    assert.ok(
      (SceneRegistry as any)[type],
      `SceneRegistry must have a registered component for scene type '${type}'`
    );
  }
});

test('renderRegisteredScene throws on unknown scene type', () => {
  const bogusScene = {
    type: 'unregisteredWidget',
    narration: 'Testing error throw',
    onScreenText: 'ERROR SCENE',
  } as any;

  assert.throws(() => {
    renderRegisteredScene(bogusScene);
  }, /Unknown scene type 'unregisteredWidget'/);
});
