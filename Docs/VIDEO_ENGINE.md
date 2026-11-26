# Behind The Tech video engine

The finalized script and existing voiceover are the inputs. The dashboard and worker use the saved audio timeline and word offsets. The director receives the complete narration and a batch of scene indices. Local compilation matches each proposed cue to the spoken words and converts it to a frame. Preview and export use the same compiled shots in `StudioShort`.

## Findings and changes

- The previous planner could accept a partial response, abandon later batches after provider errors, and silently fall back to text. The planner now retries only missing or invalid scenes, uses one bounded repair request per batch, and records remaining fallback scenes in the dashboard.
- A physical hook was limited to one optional opening illustration. Any scene can now use a generated editorial plate, or an approved background plus separate cutout layers that move on spoken cues. A plate uses camera motion. Independent motion uses a separate subject asset.
- The first local render showed a redundant truncated headline and low contrast on inactive nodes. Technical scenes now use the shared dark editorial canvas, including summaries. Diagrams show bundled logos when grounded labels match approved artwork.
- The existing diagram compiler still provides stable entity IDs, progressive nodes and deterministic packet paths. Existing caption, mockup, code, comparison, and audio components remain in use.
- Numeric trend scenes require a supported spoken measurement for every point and matching units. Preview frames and the final video use the same data.

## Local setup

Use `npm run api` and `npm run dev:dashboard` from the project root. Open the dashboard, finalize a script, generate or reuse voiceover, then generate the visual previews. In **Revise visual plan**, choose a scene and enter feedback to regenerate that scene from the same voiceover. Check the preview and select **Render** to export the full reel. The output validator checks audio and video codecs, dimensions, frame count and duration against the compiled timeline.

| Setting | Behavior |
| --- | --- |
| `GROQ_API_KEY` or `GROQ_API_KEYS` | Existing Groq credentials. The director defaults to `openai/gpt-oss-120b`. |
| `REEL_DIRECTOR_PROVIDER`, `REEL_DIRECTOR_MODEL` | Director-only provider and model selection. An explicit `REEL_PREMIUM_DIRECTOR_*` override takes precedence. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional Gemini fallback for scene planning and the credential for Gemini artwork or review. |
| `REEL_IMAGE_GENERATION=on` | Enables generated editorial artwork. Use the configured `REEL_IMAGE_PROVIDER` and `REEL_IMAGE_MODEL`, or the existing Cloudflare configuration. |
| `REEL_APPROVED_ASSET_DIR` | Optional local catalog directory. Defaults to `media/approved-reel-assets`. |
| `REEL_VISUAL_REVIEW_MODEL` | Enables Gemini multimodal review. Set an available image-capable model ID. Sends rendered JPEGs and corresponding narration to Google. Leave unset for manual review. |
| `REMOTION_CONCURRENCY` | Overrides the local Remotion render concurrency. |
| `REMOTION_PRIVATE_LICENSE_KEY`, `REMOTION_PRODUCTION_RENDER` | Configure the Remotion license when required. Set `REMOTION_PRODUCTION_RENDER=false` for local test exports. |

## Approved artwork

Place `catalog.json` and the approved PNG or JPEG files in the catalog directory. Use a portrait background and a transparent PNG for an independently moving subject. Each manifest entry includes a stable `id`, `description`, `role` (`background` or `subject`), basename `file`, `source`, `license`, and optional `credit`. A background can declare `motionLaneY`, a normalized vertical center for horizontal movement on its ground plane. Include credit if the license requires an on-screen mention. Keep only artwork whose terms allow the intended video usage and local caching. The director receives IDs and descriptions, and the server validates format, dimensions, asset position and on-screen bounds before rendering. Arbitrary model-supplied paths and remote URLs are outside this catalog interface.

Bundled wordmarks are matched against a normalized grounded entity label. Check the source and usage terms for any mark you add. The renderer keeps a neutral icon when the bundle has no matching logo.

Simple Icons and the gilbarbara/Iconify collections can help source technology marks. Verify the specific mark against the brand's own guidelines. Brandfetch offers a remote brand lookup, and SVG Repo is a discovery source with per-asset license terms. This implementation stages validated local PNG and JPEG files. [Simple Icons disclaimer](https://github.com/simple-icons/simple-icons/blob/develop/DISCLAIMER.md), [Iconify collections](https://github.com/iconify/icon-sets/blob/master/collections.md), [Brandfetch](https://brandfetch.com/developers), [SVG Repo licensing](https://www.svgrepo.com/page/licensing/)

ELK Layered supports ranking and edge routing for larger graphs. The current portrait layout remains bounded for readability and keeps existing node placement. Shiki is a possible future upgrade for code tokenization. [ELK Layered](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html), [Shiki](https://shiki.style/guide/)

## Preview review and export

Review samples the rendered shot previews. When enabled, the reviewer returns structured issues by scene index. A single targeted repair is rendered and rechecked. Use the dashboard to inspect unresolved issues. Automated export reports a failed or unavailable configured review separately from media encoding. An explicitly reviewed visual revision can be manually exported from the dashboard.

The approved asset catalog and image provider cover layered sprites and illustrated plates. General stock search, a remote verified-logo catalog, generated motion footage, and independently animated objects inside a flat illustration are outside the implemented catalog flow. The graph engine continues to use the existing bounded mobile layout. The reviewer measures visible problems in sampled frames, with preview playback available for timing and continuity.

Remotion uses a free license where eligible. Check the entity and automation terms before production use. [Remotion licensing](https://www.remotion.dev/pricing)

## Implementation files

| Area | Files |
| --- | --- |
| Direction, approved assets and review | `src/modules/render/storyboard-visuals.ts`, `approved-visual-assets.ts`, `reel-visual-assets.ts`, `review-storyboard.ts` |
| Composition and visual styling | `src/modules/video/visual-story.ts`, `video-theme.ts`, `scenes/DirectedShot.tsx`, `scenes/CinematicStage.tsx`, `scenes/StoryFootage.tsx` |
| Export and integration | `src/modules/render/video-renderer.ts`, `src/api.ts`, `src/worker.ts`, `src/modules/pipeline/server-orchestrator.ts`, `dashboard/src/main.jsx` |
| Configuration and regression coverage | `.env.example`, `tests/reel-quality.test.ts`, and the official Remotion skills installation |

## Local review artifacts

- `output/director-v4-sample/delivery-pricing.mp4` uses the existing 50.47-second narration and local artwork. The scene-planning provider responses were controlled for this full render.
- `output/director-v4-sample/frames/` contains its cinematic opening, timed packet shots and editorial summary. The revised frames were checked for readability and logo overlap.
- `output/director-v4-sample/layered/repair/` contains independent movement of a vehicle cutout. The repair test used real Remotion frames with a controlled review response to isolate the review and regeneration flow.
- `output/director-v4-sample/live-pickup/pickup-live.mp4` is the synthetic live test using Sarvam narration, Groq Whisper alignment, GPT-OSS 120B direction and Remotion export. Its cutout and background are local QA assets.

The local UPI and delivery references show that the strongest technical cuts give one action the full frame and maintain a recognizable story subject. The next quality pass should use art-directed assets with matching perspective and lighting, plus more deliberate transitions between the real-world and technical views.

## Behind The Tech visual system

`src/modules/video/design-system.ts` owns the locked palette, type scale, safe margins, spacing, and motion durations. The shared composition loads the bundled Inter and JetBrains Mono fonts and renders a stationary 56 px grid. Technical scenes share that canvas. Full-frame illustrative shots can cover it, and the narration-timed handoff brings the grid back.

`PremiumVisuals.tsx` supplies the canvas, matte panels, semantic states, and a front-facing graphite iPhone shell with a clipped display. App, QR, and messaging scenes use that shell. The generated checkout interior is an illustrative interface. Real logos are sourced from the existing approved bundle. Add permitted SVG, PNG, or WebP marks under `remotion/public/visuals/brands/` and use their brand names as filenames. Unavailable brands keep a neutral icon.

`AnimatedConnector.tsx` routes straight, curved, and orthogonal tracks from node borders. Packets and receiving-node emphasis use the same frame clock. Reverse directions take distinct lanes. `CinematicStage.tsx` applies cyan active, purple processing, green success, amber warning, and red error states. The storyboard director and optional reviewer use the same style specification. Saved shot plans inherit the design at render time.

The development showcase uses the production composition from a separate entry, `remotion/design-showcase.tsx`. Run `npm run preview:design` for the video and seven inspection frames. To include the cinematic transition, pass a local approved image with `npm run preview:design -- path/to/illustration.png`. The showcase is independent of the production entry and provider credentials.

| Area | Design changes |
| --- | --- |
| Shared renderer | `design-system.ts`, `PremiumVisuals.tsx`, `AnimatedConnector.tsx`, `StudioShortComposition.tsx`, `KineticCaptions.tsx`, and `MotionStyles.tsx`. The separate light theme module was removed. |
| Diagrams and compiled shots | `motion-stage.ts`, `visual-story.ts`, `directed-film.ts`, `CinematicStage.tsx`, `DirectedShot.tsx`, and `PaymentGuide.tsx`. |
| Device and scene styling | `AppScreen.tsx`, `MessagingScreen.tsx`, `SmartphoneMockupScene.tsx`, `ScreenActivity.tsx`, `DesktopDemo.tsx`, `StoryFootage.tsx`, `BrandOutro.tsx`, and the existing registered fallback scenes. |
| Director, review, and development | `storyboard-visuals.ts`, `premium-direction.ts`, `review-storyboard.ts`, `remotion/design-showcase.tsx`, `scripts/render-design-showcase.ts`, `package.json`, and `tests/reel-quality.test.ts`. |

- Showcase video and inspection frames are under `output/premium-design/showcase/`.
- The full delivery sample with the existing voiceover is `output/premium-design/delivery-pricing.mp4`. Its inspection frames are in `output/premium-design/frames/`.
- Font redistribution notices are included in `remotion/public/fonts/`. [Remotion font loading](https://www.remotion.dev/docs/fonts), [Inter](https://github.com/google/fonts/tree/main/ofl/inter), [JetBrains Mono](https://github.com/google/fonts/tree/main/ofl/jetbrainsmono)

## Semantic scene planning

The previous planner split any sequential narration into fallback rows. The stage builder converted each row into a graph actor and added a packet to the next row. The scene planner also accepted some noun-based graphs whose arrows had no corresponding transfer in the narration.

Scene plan v5 requires concise spoken entities, a grounded transfer cue for an edge, and references to the actors involved. Invalid replies send a repair reason to the next attempt. Authored queue steps are compiled to job movement on the queue, dispatch and completion states. Other typed operations demonstrate measured membership, lifecycle expiry and replacement, and candidate selection with an optional downstream processor. Existing artwork, device, code, and numerical comparisons remain available. Technical scenes that exhaust planning can be inspected in preview. The export checks the saved scene plan for unresolved technical directions.

The delivery comparison uses the same saved script and audio, with controlled planning responses. Compare `output/premium-design/frames/shot-2-1.jpg` with `output/semantic-design/frames/shot-2-1.jpg` for H3. The new frame displays 20 orders and 5 riders within one cell. The expired and replaced quote states are in `shot-4-1-action.jpg` and `shot-4-1.jpg` in the new frames directory. The complete export is `output/semantic-design/delivery-pricing.mp4`. The synthetic retrieval preview under `output/semantic-design/retrieval/` exercises the selection, processor and failed result from a live Groq plan.

## Dynamic SVG scenes

Scene plan v6 gives the director an SVG capability registry. For a custom technical mechanism, the director defines the subject, surrounding geometry, foreground labels and narration cues. Groq receives the compact plan schema in JSON object mode. Each proposed scene still passes the strict local schema and visual compiler before Remotion receives it. Gemini uses its structured response schema. The planner retries invalid scenes with the validation reason and carries forward established entity and layer IDs.

The vector artboard supports paths, lines, polygons, rectangles, ellipses, text, nested groups, bounded repeated elements, palette-based gradients, patterns, clips, masks, shadows, glows and approved local asset IDs. Frame-driven tracks cover translation, scale, rotation, opacity, stroke changes, path drawing and path following. Compact compositions can fit to the artboard automatically, and a narration cue can trigger a bounded camera zoom. Positioning and the crop preserve the shared caption lane.

The compiler checks coordinates, hierarchy, references, exact narration cues, repeated geometry, translation and path sweeps, and persistent foreground at critical frames. Unresolved scene directions block final export. The asset loader sanitizes standalone SVGs with an XML allowlist and stages them by content hash. The renderer uses the same compiled state for stills and exports. Vector scene paths support absolute M/L/H/V/C/Q/Z commands. Built-in masks and patterns use bounded geometry. Imported SVGs use local definitions and a supported subset of static markup.

| Area | Files |
| --- | --- |
| Planning and request transport | `storyboard-visuals.ts`, `groq-provider.ts`, `vector-spec.ts` |
| Compilation and approved assets | `compile-vector.ts`, `sanitize-vector-asset.ts`, `approved-visual-assets.ts`, `reel-visual-assets.ts` |
| Rendering and continuity | `VectorScene.tsx`, `DirectedShot.tsx`, `StoryFootage.tsx`, `SemanticOperationScene.tsx`, `video-renderer.ts`, `visual-story.ts`, `motion-stage.ts` |
| Dependencies and regressions | `package.json`, `package-lock.json`, `tests/reel-quality.test.ts` |

The local comparisons under `output/vector-upgrade/` provide both MP4s, a before-and-after sheet, and representative frames from all 18 scenes. They use controlled director replies and the preserved narration audio and word timings. The Groq request and local handoff are covered by a mocked transport test. Live SVG generation after the transport change remains unverified.

## Full-canvas composition

Scene plan v7 requires vector scenes to declare a framing strategy and focal layer IDs. The previous RAG plan supplied the opaque enclosing rectangles in its SVG layer lists, and the fixed inset viewport constrained those compositions further. New SVG scenes render over the shared grid at composition size. The compiler fits painted geometry and motion into the caption-safe area with a uniform scale, checks focal scale and rendered type size, and flags enclosing rectangles that function as scene backdrops. Real document, device and data surfaces can remain. Continuous scenes use a stable coordinate transform and retain visible geometry across cuts. Archived scenes preserve their original viewport behavior.

Visual direction and repair remain independently configurable through `REEL_PREMIUM_DIRECTOR_PROVIDER`, `REEL_PREMIUM_DIRECTOR_MODEL`, `REEL_GROQ_DIRECTOR_MODEL` and `REEL_GEMINI_DIRECTOR_MODEL`. GPT-OSS 120B is the Groq default. Only compare providers on the same approved script and timeline, using identical render settings and inspecting the resulting frames and motion. The local RAG comparison uses controlled replies to exercise the actual compiler and renderer. There is no rendered Gemini Pro comparison.

The Outro and rendered branding use `src/modules/video/brand.ts`. Caption text can display the canonical name in an archived script while retaining its original word positions and audio. RAG exports and visual comparison sheets are in `output/composition-upgrade/`.

## Golden SVG reference and continuous sequences

The supplied `references/golden-visual-reference.svg.svg` is the source of record. Run `node --import tsx scripts/render-golden-reference.ts` to render the original, its static Remotion reconstruction and an animated 1080 × 1920 study. The study preserves the 340 × 350 aspect ratio. Its development timing demonstrates the scan, split, processing, vector rows and arrival. Production animation timing comes from exact narration cues.

Scene plan v8 adds reusable semantic objects for documents, chunks, numerical vectors, database cylinders, server racks, services, applications, entries and status. They coexist with custom SVG geometry and approved assets. Compact technical terminology is grounded in the narration or the renderer's vocabulary. Numerical vector examples carry an on-screen illustrative label.

A vector proposal can cover up to four adjacent requested narration segments. All covered segments share one compiled object, route and camera timeline. Each preview and export frame evaluates that timeline at its offset from the start of the sequence. For repeated cues, use the one-based scene index followed by `|` and the exact spoken phrase. Port connectors attach to object bounds, validate their orthogonal route, draw a dashed stroke, and sample that path for packet position and the arrival pulse. Camera tracks can pan and zoom into active objects while the full composition remains available at overview scale.

The visual director receives the original SVG source with the Groq JSON request or the rendered PNG with the Gemini request. Both receive the same palette, capabilities and composition guidance. The visual transport is separate from script generation, TTS and word alignment. RAG and load-balancing samples use controlled local replies and the production compiler and renderer. A live provider quality comparison remains unverified.

## Semantic production planning

The current dashboard production path uses `semantic-v1`. The Creative Director plans ordered sequence ranges and their teaching objective. The Scene Engineer returns compact object roles, relations and cue-based operations. The local compiler assigns the boxes, readable type, connector ports, packet paths and animation frames, then passes the result through the SVG compiler and the existing export checks.

The visual planner reads the saved timeline as-is. Cue IDs such as `s2c3` resolve to the saved frame, milliseconds and word ranges. A missing or mismatched word timeline fails the visual step. The visual endpoints reuse stored audio and never initiate voice synthesis or transcription. A scoped still request can send `sceneIndices` to retry a sequence and keep the previous validated shots and unaffected stills. A pinned incomplete visual revision remains ineligible for export.

Send `recompileSavedVisuals: true` to the still-preview endpoint to rebuild validated specifications and their recorded assets locally. The optional `sceneIndices` restrict the recompile to the sequences covering those scenes. A scoped preview without the recompile flag requests a new model-generated plan.

Choose the two model stages independently with `REEL_CREATIVE_DIRECTOR_PROVIDER`, `REEL_CREATIVE_DIRECTOR_MODEL`, `REEL_SCENE_ENGINEER_PROVIDER` and `REEL_SCENE_ENGINEER_MODEL`. The default Groq model for the visual stages is GPT-OSS 120B. The Groq path tokenizes prompt text locally and reserves a framing margin and completion budget against `REEL_GROQ_VISUAL_TPM`. It also records actual provider-reported usage, retries bounded rate limits, and partitions a request when its scope exceeds the budget. The semantic prompt uses concise design guidance extracted from the golden reference. `REEL_VISUAL_PLANNER=legacy` selects the earlier SVG-draft planner.

The asset manifest distinguishes approved catalog assets, generated artwork and procedural geometry. Illustration generation still requires an enabled and configured image provider. Compact visual requests use approved asset IDs or an illustration description.

The Creative Director can combine architecture, application mockups, data visualization, procedural imagery, cinematic illustration, and bounded custom vector outlines. The engineer supplies typed objects and narrated operations. Binary trees render actual connected tiers, arrays preserve indexed state across explicitly continuous sequences, and queue occupancy follows packet arrivals and departures. Physical conveyors, scanners, tags, diverters, chutes, and moving parcels use reusable SVG artwork. When cinematic illustration is selected, its staged image receives a dedicated full-width area above the explanatory diagram.

## Manual visual directive import

In the dashboard, open an approved job with saved audio and aligned words. In **Stage 3**, select **Manual (Import JSON)**. The prompt prepares automatically. Click **Copy Visual Prompt**, paste it into ChatGPT, then paste the returned JSON into the dashboard and click **Generate Visuals**. This validates every sequence, stages the requested assets and renders stills before committing the new revision. Use the same motion preview and export controls for the accepted revision. **Copy Repair Prompt** includes the submitted text and validation issues. **Advanced Settings** contains source downloads for ChatGPT Project setup, prompt and context downloads, manual refresh, JSON upload, and optional validation without rendering. Select **Automatic (Groq)** and click **Generate Stills** to replace manual visuals through automatic planning.

`GET /api/pipeline/manual-visual/:sessionId/context` returns job-scoped context, the current contract and copy-ready prompt. `POST .../validate` and `POST .../generate` accept a raw JSON body (`text/plain` or `application/json`, up to 256 KB). The envelope binds schema and artifact revisions. `semantic` sequences share the automatic path’s compiler adapter. `vector` sequences expose the existing canvas primitives, named ports, camera, tracks, definitions and staged asset references. Manual import and its pinned previews make no visual-planner request. An explicitly requested illustration can use the configured image provider.

New dashboard jobs use a random browser owner credential. The server binds this credential’s digest to the job and checks it on job-scoped API requests. Existing unowned jobs can be adopted on the local development dashboard. For a hosted legacy job, an operator can provision the owner with `POST .../claim`, using the configured `X-Automation-Token` and the target browser’s `X-SocialStudio-Owner` capability. A claimed job cannot be reassigned through this endpoint. Treat existing media URLs as shareable links.

`visual-director/` is the editable art direction source. The Groq Creative Director gets the supplied master prompt with its intermediate-stage output instructions. The Scene Engineer gets a compact excerpt of the same priorities, design and motion rules to keep repeat requests within the existing budget. Manual copy and context downloads include the three complete guides. The configured reel brand and production schemas govern both paths. The golden SVG and PNG are benchmarks for hierarchy, detail, contrast, routing and portrait adaptation. When enabled, automatic frame review includes the PNG in its first batch, and imported plans retain their exact compiled content.

`npm run export:visual-source-pack` copies all seven supplied files byte-for-byte and adds the runtime-derived schema, capabilities, rules, compiled example and version metadata. The metadata separates the art direction revision from the schema and contract hashes. The dashboard also exposes each file for download. Restart the backend after updating the reference files to load the new revision. An existing accepted preview stays pinned. The next planning request can refresh its Creative Director outline when the reference changes.

Run the saved-audio integration with `REEL_MANUAL_AUDIT_SESSION` set to a session ID. Set `REEL_MANUAL_RENDER_TEST=1` to include stills, motion preview and MP4 export. The integration uses a temporary job record pointing at the original clips, blocks external calls, and records reuse verification under `output/manual-visual-import` or `output/manual-visual-validation`.
