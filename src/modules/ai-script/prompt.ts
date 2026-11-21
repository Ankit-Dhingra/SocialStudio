import { z } from 'zod';
import { StoryboardSchema } from '../contracts/storyboard.js';

export function buildHinglishScriptPrompt(topic: string, angle?: string, targetDurationSec = 105): string {
  const angleClause = angle ? ` Angle / Engineering Focus: ${JSON.stringify(angle)}.` : '';
  return `Write one complete vertical engineering deep-dive lesson for Instagram Reels and YouTube Shorts.
Topic: ${JSON.stringify(topic)}.${angleClause} Target spoken duration: around ${targetDurationSec} seconds (90–120 second deep dive).
Audience: final-year students and developers with 1–4 years of experience.
IMPORTANT CONSTRAINTS FOR VIRAL HIGH-RETENTION DEEP DIVES:
- Total spoken narration across ALL scenes combined MUST be around ${Math.round(targetDurationSec * 2.5)} words (approx 240–300 words), including the hook and payoff.
- Supply 12 to 16 chronological scenes. Keep each scene narration to 1 to 2 short, punchy sentences (maximum 20-25 words per scene).
- Problem-before-jargon Hinglish: 70% conversational Hindi grammar + 30% standard English software engineering vocabulary (e.g. Redis, Kafka, O(1), H3, SETNX, cache, queue, lock, latency).
- Frame latency targets (such as 50 ms calculation) as an illustrative design budget unless explicitly sourced from verified public engineering disclosures.
- Preserve authored sentences, visual cues and spoken overrides without overwriting or omitting technical detail.
Choose ONE concrete question narrow enough to answer fully. Open with a prediction or observed bug.
Use one worked example throughout. Show the initial values, operations in order, resulting values,
the reason for the result, and when the viewer would use this knowledge. Check each transition.
Speak conversational Hinglish in short natural sentences. Keep identifiers in the diagram;
explain their meaning aloud. Use punctuation for a question, a pause, and the reveal.
Avoid invented benchmarks, salary claims, generic interview framing, and unsupported absolutes.
Omit sourceBrief unless the caller supplies a verified source. Never invent citations.
End by answering the opening question and explaining why. Give a practical rule with its scope.
Finish the last sentence completely. Use the available time for teaching.

Return only a JSON object with topic, angle (if provided), title, hook (plain string, minimum 10 characters), learningObjective, targetAudience, format ("short"),
estimatedDurationSec, hashtags and scenes. Supply 12–16 chronological scenes. Each needs id,
zero-based sceneIndex, type, narration, optional spokenNarration, onScreenText, technicalKeyPoint, durationTargetSec and visualProps.
Start with hook {headline, subtext}. Include at least one explanatory diagram:
requestFlow {title, steps:[{label,description,cue}]} or queueTimeline {title,items:[{name,detail,cue}]}.
For retrieval or filtering, use collection {title,items:[{label,selected}],cue,result}. Include 2–12 labelled items and a spoken reveal cue.
Use 2–4 steps/items. Give each flow step a cue copied verbatim from its narration where it should appear.
Use concrete actors, values and outcomes. For code use {filename,code,highlightLines,explanationCallout}.
For comparison use {leftTitle,leftPoints,rightTitle,rightPoints,verdict}.
Finish with summary {headline,takeaways:[specific result, causal explanation or practical rule]}.
Use this JSON Schema for the top-level and scene fields. All scene-specific values go inside visualProps.
${JSON.stringify(z.toJSONSchema(StoryboardSchema))}
For example, scenes[0].type is exactly "hook"; scenes[0].visualProps is {"headline":"...","subtext":"..."}.
For the last scene use type "summary" and visualProps {"headline":"...","takeaways":["...","..."]}.
Keep visual labels short enough for a phone. Make every scene about the requested topic.`;
}
