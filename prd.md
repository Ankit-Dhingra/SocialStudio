# TechContent AI Studio — Product Requirements Document (PRD) & System Architecture Specification

**Document Version:** 3.0 (Updated Post-Viral Storytelling Architecture)  
**System Status:** Production MVP Operational & Verified on `main`  
**Target Formats:** 9:16 Vertical Video (1080×1920 @ 30fps) for Instagram Reels & YouTube Shorts  
**Target Audience:** Indian Software Engineers, CS Students, Full-Stack / MERN Developers, SDE-1/2/3 Interview Aspirants  

---

## 1. Executive Summary & Vision

**TechContent AI Studio** is an automated, AI-assisted video production engine designed to transform technical software concepts into viral, high-retention 9:16 educational short videos (60–90 seconds).

Rather than relying on generic AI slide generators or robotic screen recordings, TechContent AI Studio operates as a deterministic video rendering pipeline inspired by top-tier engineering creators (`@fewshot.studio`, `@devmonk.preetam`, `@codewith.pt`). It combines:
1. **Conversational Hinglish Senior-Dev Scripting**: Explaining complex distributed systems like a senior engineer discussing real-world architecture over chai.
2. **5-Act Viral Retention Structure**: Hook ➔ Paradox ➔ Architecture Flow ➔ Aha Reveal ➔ SDE-3 Tradeoff + Save CTA.
3. **Multi-Provider Neural Voiceover & Sound Design**: Edge TTS (`hi-IN-MadhurNeural`) / ElevenLabs with word timestamps and ambient tech BGM ducking.
4. **Cinematic Storytelling Remotion Scenes**: Realistic 3D smartphone food/cab app screens, spatial H3 honeycomb maps with live telemetry, decoupled architecture pipelines with glowing laser packets, and interview cheat sheets.
5. **Mathematically Anchored HUD Connectors**: Exact coordinate-pinned terminal sockets, neon cables, and decision branches with zero floating dots.
6. **Automated Media QA**: Strict verification of audio-visual sync, frame integrity, and SHA-256 fingerprinting.

---

## 2. The 5-Act Script Framework (Proven Viral Formula)

Every script generated or imported strictly follows the 5-Act structure documented in `fewshots.md` and `chatgpt_project_instructions.md`:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Act 1 (0–6s): Relatable Hook                                          │
│   • Everyday scenario: "Zomato delivery fee ₹30 se seedha ₹80!"       │
│   • Candidate's naive solution ("SQL query") ➔ "REJECTED!"             │
├────────────────────────────────────────────────────────────────────────┤
│ Act 2 (6–12s): Counter-Intuitive Paradox                               │
│   • Common assumption shattered ("50k req/s pe database lock ho jayega")│
├────────────────────────────────────────────────────────────────────────┤
│ Act 3 (12–50s): Deep Architecture Breakdown                           │
│   • Step-by-step: Client ➔ API Gateway ➔ In-Memory Cache ➔ Primary DB  │
│   • Each transition is a visual beat with moving laser packets         │
├────────────────────────────────────────────────────────────────────────┤
│ Act 4 (50–70s): The "Aha!" Mechanism Reveal                            │
│   • Real-world engineering magic: Spatial H3 Hex Bins, async stream    │
│     aggregation, O(1) Redis key lookups under 8ms                      │
├────────────────────────────────────────────────────────────────────────┤
│ Act 5 (70–90s): SDE-3 Tradeoff Dilemma + Cheat-Sheet + Save CTA        │
│   • Genuine engineering tradeoff (Micro-Hex Bins vs Macro Zones)       │
│   • Numbered Interview Cheat-Sheet card ("TAKE SCREENSHOT 📌")         │
│   • High-converting Call-to-Action ("Save this reel for your interview")│
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Visual & Motion Architecture (Remotion 4.0)

All visual scenes are programmatically rendered using **Remotion** with lightweight, pure CSS/SVG geometry and React state animations. This avoids heavy 3D GLTF models, preventing Chromium OOM/SIGKILL crashes.

### 3.1 Dimensions & Vertical Safe Margins
- **Aspect Ratio**: 9:16 Vertical (`1080 × 1920`)
- **Frame Rate**: 30 FPS
- **Top Safe Margin**: `170px` (clears username, audio pill, progress bar)
- **Bottom Safe Margin**: `340px` (clears Instagram reel caption, reaction icons, and bottom sheet UI)

### 3.2 Standard Scene Catalog
| Scene Component | Act | Description & Key Visuals |
| :--- | :--- | :--- |
| **`SmartphoneMockupScene`** | Act 1 | Floating 3D perspective phone mockup with screen glare, realistic Zomato/Uber food order screen (Royal Dum Biryani, `₹380`, `+₹50 Surge 1.8X`), and animated rubber-stamp **"REJECTED!"** applied to naive answers. |
| **`H3SpatialMapScene`** | Act 2–3 | Spatial indexing honeycomb lattice with pulsing radar waves radiating from hot surge hexagon bins (`#88619A0A4`). Floating telemetry HUD displaying active orders, available riders, and $< 8\text{ms}$ $O(1)$ latency. |
| **`ArchitectureFlowPipelineScene`** | Act 3–4 | Decoupled architecture flow with mathematically anchored neon cyan (`#38BDF8`) and emerald (`#10B981`) cables. Laser packets traveling between App, Gateway, and Redis. Bypassed Database connection with explicit red `⛔ BYPASSED` badge. |
| **`TradeoffDecisionHUDScene`** | Act 5 | Anchored SVG Decision Fork branching into Option A (Micro-Hex 500m) and Option B (Macro Zones 5km). Numbered 4-point **Interview Cheat-Sheet** card (`TAKE SCREENSHOT 📌`) and red gradient Save CTA banner comfortably above captions. |
| **`KineticCaptions`** | All | Chunked 3–4 word dynamic subtitles positioned at `bottom: 240px` with active word karaoke highlight in vibrant gold (`#FACC15`). |

---

## 4. Audio & Voice Engineering

1. **TTS Engine**:
   - **Primary**: Microsoft Edge Neural TTS (`hi-IN-MadhurNeural`) for instant, broadcast-quality, natural Hinglish speech with zero API cost.
   - **Alternative**: ElevenLabs Multilingual v2 voice lock with custom voice design.
2. **Word-Level Timestamp Extraction**:
   - Audio boundary events and WhisperX alignment generate precise millisecond start/end timestamps for every word.
   - Subtitles and scene animation triggers (`anchor_words`) lock onto exact audio frames.
3. **Soundtrack & Audio Ducking**:
   - Continuous ambient tech synth BGM track (`music/tech-ambient.wav`).
   - Automated audio ducking: BGM volume lowers to `0.08` (-14dB) during narration and rises to `0.16` during dramatic pauses.

---

## 5. System Architecture & Component Design

```
[ Dashboard (React + Vite) / CLI Script Generator ]
                   │
                   ▼
         [ LLM Script Engine ]
     • Gemini 2.5 Flash / Groq / OpenAI
     • Few-Shot Style Reference (fewshots.md)
     • 5-Act Structural Parser
                   │
                   ▼
        [ Audio & Timing Engine ]
     • Edge-TTS (hi-IN-MadhurNeural)
     • Word Timestamp Alignment
     • BGM Ducking Mixer
                   │
                   ▼
     [ Remotion Video Composition ]
     • StudioShortComposition.tsx
     • SmartphoneMockupScene (Act 1)
     • H3SpatialMapScene (Act 2-3)
     • ArchitectureFlowPipelineScene (Act 3-4)
     • TradeoffDecisionHUDScene (Act 5)
     • KineticCaptions (Karaoke)
                   │
                   ▼
       [ Render & Export Engine ]
     • Pre-bundled Webpack (dist-remotion)
     • Single-Thread Constrained FFmpeg (OOM Safe)
     • Automated Media QA & Fingerprint
                   │
                   ▼
       [ Social Publishing Outbox ]
     • Instagram Graph API (Reels Container)
     • YouTube Data API v3 (Shorts Upload)
```

---

## 6. Social Publishing & Upload Requirements (Next Phase)

### 6.1 Metadata Generation Package
Every generated reel produces a structured publication payload:
- **Hook Options**: 5 high-CTR hooks for thumbnail and reel cover selection.
- **Caption**: 1-line catchy summary + 5 targeted hashtags (`#systemdesign #backend #redis #softwareengineer #coding`).
- **Call-to-Action**: Explicit prompt to save the reel and follow for daily system design breakdowns.
- **Pronunciation Notes**: Phonetic Hindi spellings for English tech terminology.

### 6.2 Upload Pipeline Specifications
1. **Instagram Reels Upload**:
   - Endpoint: Instagram Graph API (`POST /{ig-user-id}/media`) with `media_type=REELS`.
   - Polling: Check media container status (`FINISHED`) before issuing `POST /{ig-user-id}/media_publish`.
   - Sandbox / Draft Mode: Upload as private/draft for creator review before public publish.
2. **YouTube Shorts Upload**:
   - Endpoint: YouTube Data API v3 (`videos.insert`) with `part=snippet,status`.
   - Categorization: Category `28` (Science & Technology), tags, vertical dimension check.
   - Status: Initially uploaded with `privacyStatus=private` or `unlisted`.

---

## 7. Non-Functional Requirements & Stability

- **Zero Memory Leaks**: Memory footprint constrained to $< 1.5\text{ GB}$ during full video rendering by isolating Chromium execution and streaming frames directly through FFmpeg.
- **Deterministic Sync**: Scene durations are dynamically calculated from actual audio narration lengths with fixed 10-frame padding buffers.
- **Fast Iteration**: Demo snapshot preview rendering (`scripts/preview-demo-scenes.ts`) generates 4 high-res frames in under 15 seconds.
