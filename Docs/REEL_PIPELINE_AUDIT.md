# Reel production audit

## Production paths

| Entry point | Script and persistence | Downstream path |
| --- | --- | --- |
| Dashboard | `dashboard/src/main.jsx` calls the script start, chat and finalize routes in `src/api.ts`. The master script service reads `MASTER_SCRIPT_PROMPT.md`, parses its scene JSON and persists sessions under `media/sessions`. The voice editor supplies optional spoken text per scene. | Synthesize on demand, save mastered clips and a measured timeline, request stills, render the MP4, poll render status. |
| Scheduled or queued job | n8n submits to `/api/videos`. PostgreSQL stores video state and BullMQ dispatches the job to `src/worker.ts`. The worker reuses a valid stored storyboard or calls the structured Gemini/Groq generator. | Synthesize scenes, stage audio, build the timeline, render `StudioShort`, probe the export, and record the QA result. |
| Local production CLI | `scripts/render-topic.ts` accepts a topic or storyboard JSON. | Uses the same synthesizer, timeline, renderer and QA functions. |
| Opening voice preview | `/api/previews` accepts a topic or a custom script. | Uses the shared speech preparation and mastering on the opening scene. Whole-reel duration fitting and transcript requests are skipped for this short audition. |

`remotion/index.ts` registers `remotion/root.tsx`. The production composition is `StudioShort`, at 1080 × 1920. The older `remotion/tech-short.tsx`, `src/script.ts` and `src/tts.ts` sit outside the worker's production path. The standalone Python script and prompt templates are alternative authoring tools. Existing scripts under `tests/` and `scripts/` also include demonstrations that use fixed example timings. Those timings cannot establish speech sync.

## Findings and changes

| Where quality degraded | Effect | Change |
| --- | --- | --- |
| Master parser split long sentences at 18 words and rotated replacement scene types. It could also append an extra spoken CTA. | A new TTS request restarted prosody mid-sentence. An explanation could switch to unrelated sample data. | Preserve each authored take, its typed visual props, and its spoken override. Move visual beats inside the scene. When directions lack typed diagram data, use the supplied text. |
| The dashboard prompt targeted 75–85 seconds. The worker passed 55 seconds to a prompt that hard-coded 40–50. | Two entry points produced incompatible scripts. A previously saved local session contained 134.83 seconds of audio. | Align the default brief around 55 seconds. Present one question, a worked example, and an answer. Use measured clip lengths to build the export. |
| Sarvam could discard a Roman-script voice edit, and its long-input sentence regex could drop an unterminated tail. Edge removed parentheses before interpreting complexity notation. | Pronunciation and sometimes the actual content depended on the provider. | Prepare speech once, preserve explicit voice edits, expand technical terms, translate SSML breaks into punctuation, escape text at Edge's SSML boundary, and split oversized requests without dropping text. |
| Provider files were sent directly to the renderer. The background track had a constant low volume. | Scene loudness varied, and the music never responded to speech. | Master each scene with FFmpeg at a target of −16 LUFS and −2 dBTP. Measure quiet intervals. Apply one bounded tempo factor across a short, then duck and release the music against the resulting voice intervals. |
| Character alignment was useful only if it matched the display string exactly. ASR and display text could use different scripts. | Spoken acronym expansions and language changes shifted captions and visual cues. | Retain provider alignment, otherwise use word-level ASR when available. Map the spoken script to display words by sentence. When timing is unavailable, estimate from voiced spans and nearby pauses. |
| Several scene components repeated the headline, wrapped steps in bordered cards, and animated against local hard-coded frame numbers. | Motion could continue while the teaching point stayed static. | The registry now drives a full-bleed stage with price changes, lock states, hex cells, connected request nodes, filtering, code, branches and circuit layers. Captions and effects use the same scene-local clock. |
| The stills endpoint reparsed the script, and the renderer accepted any existing prebundle. | Preview and export could use different scene routing or old component code. | Preview the saved storyboard/timeline pair. Fingerprint composition source and dependencies, stage run-specific audio, and rebuild on a mismatch. |
| Dashboard render status could report completion when media QA failed. | Operators could receive an apparently finished bad export. | Check the QA result before publishing the media URL. Isolate synthesis and export filenames by revision and discard a stale render result when the timeline changes. |

## Verification and limits

The local verification lesson is an authored example of delivery pricing. Its price, order count and rider count are illustrative. The proof path used real Sarvam synthesis and Groq word timing, followed by Remotion, FFmpeg and the production media QA function. No publishing, scheduling or external posting was involved.

The four-scene lesson produced 49.82 seconds of mastered voice and a 1,514-frame timeline at 30 fps. The transition padding and closing hold account for the difference. A 50–60 second target uses a maximum 10% tempo adjustment in either direction. A substantially overlong script still needs editorial shortening. Measured retention would require viewer analytics. Unsupported or unmatched words have estimated timings, particularly across scripts.

Run `npm test` for registry and timing regressions, `npm run check` for production TypeScript, and `npm run bundle:remotion` to create a deployable bundle. To inspect two moments in the same scene, run `npx tsx scripts/preview-motion.ts <storyboard-or-session.json> output/review 0:0.2 0:0.8`. A saved session uses its measured timeline. A standalone storyboard uses its duration estimates.
