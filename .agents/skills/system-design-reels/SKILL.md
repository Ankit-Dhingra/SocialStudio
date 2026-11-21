---
name: system-design-reels
description: >-
  Turn 6-key tech, backend, and system design scripts into high-retention 1080x1920 viral developer reels.
  Features 13-cut dynamic scene pacing, 3D mockups, glassmorphic HUDs, animated pipeline architectures,
  and strict Instagram safe-zone adherence.
---

# System Design Reels: Viral Tech Video Engine

`system-design-reels` is the production framework for creating high-retention, anti-PPT, fast-paced technical reels from standard 6-key JSON scripts. It guarantees **100% dynamic scalability** across arbitrary technical domains (Ride-Hailing, Video Streaming, Fintech, Caching, Databases, Messaging, E-commerce, Cloud Architecture, etc.) with **zero hardcoded values**.

---

## 1. The Standard 6-Key Creator JSON Input

Any video begins with this universal JSON schema:

```json
{
  "title": "Topic or System Name (e.g. How Uber Surge Pricing Works / How Netflix Streams Without Buffering)",
  "hook": "The relatable scenario, dramatic price/latency shift, or shocking technical paradox that hooks the viewer in the first 3 seconds.",
  "problem": "The technical bottleneck, distributed system failure, scale challenge, or supply-demand imbalance.",
  "solution": "The high-level architectural paradigm or engineering mechanism that solves the bottleneck.",
  "tech_explained": "The deep-dive backend workflow: ingestion, spatial indexing/partitioning, low-latency cache, calculation rules, and critical edge cases (stale data, race conditions, failovers).",
  "conclusion": "The fundamental engineering takeaway, core rule, or summary insight.",
  "cta": "Call to action specifying the channel name, handle, or next topic to explore."
}
```

> [!NOTE]
> Language Support: The parser accepts **Hinglish**, **pure Hindi**, or **English**. The dynamic domain extractor parses all numbers, currencies, ratios, metrics, and architecture terms identically across languages.

---

## 2. Zero-Hardcoding Dynamic Domain Extractor

The system uses `extractDynamicReelContext(script)` in `src/modules/ai-script/custom-script-parser.ts` to automatically extract all visual entities from the script without any hardcoded company names:

1. **Brand & Domain Detection**:
   - Detects brand names (`Zomato`, `Uber`, `Netflix`, `Swiggy`, `Stripe`, `Zerodha`, `WhatsApp`, `YouTube`, etc.) or falls back to system domain terms (`Dynamic System`, `Distributed Engine`).
2. **Dynamic Currencies & Numbers**:
   - Automatically detects price shifts (e.g. `₹30 -> ₹90`, `$5 -> $25`), latencies (`500ms -> 12ms`), or scale indicators.
3. **Dynamic Shortage / Imbalance Ratios**:
   - Parses metric pairs (e.g. `100 orders vs 20 riders`, `10M requests vs 5 servers`) and calculates exact load multipliers (e.g. `5.0x / RIDER LOAD`).
4. **Dynamic 5-Stage Architecture Pipeline**:
   - Scans `tech_explained` for technical components (Edge GPS/Telemetrics, Spatial Indexing/H3/Geohash, Fast Cache/Redis, Calculation Engine, Edge Cases/Heartbeats) and populates the 5 pipeline stages dynamically.
5. **Dynamic System Audit & HUD Rows**:
   - Synthesizes 3 inspection checkpoints and an attention-grabbing audit question for the mobile mockup audit view.
6. **Dynamic Channel CTA & Takeaway Pillars**:
   - Extracts channel name and handle for the final screen, alongside 3 structured architectural summary pillars.

---

## 3. The 13-Cut Pacing Architecture (Anti-PPT)

To maintain maximum viewer retention on platforms like Instagram and YouTube Shorts, a single scene is **never** left static for more than 4 seconds. The 5 narrative sections are split into **13 visual sub-cuts**:

| Cut # | Scene Type | Visual Component & Motion | Retention Role | Duration |
| :--- | :--- | :--- | :--- | :--- |
| **0.1** | `SmartphoneMockup` | 3D angled smartphone with animated order card, pulse ring & surge badge | Instant visual hook | ~5.3s |
| **0.2** | `SmartphoneMockup` | Audit HUD switch: 3 verification rows + glowing stamp | Curiosity gap | ~8.0s |
| **1.1** | `ComparisonScene` | 2-column glowing imbalance bars (Demand vs Supply) with load multiplier | Quantifies the bottleneck | ~7.3s |
| **1.2** | `ComparisonScene` | Holographic server strain HUD with alert badges & circuit pulse | Urgency / Threat | ~7.3s |
| **2.1** | `H3SpatialMapScene` | Geospatial hexagonal mesh with animated radar scanner sweep | Visualizes the solution | ~8.3s |
| **2.2** | `H3SpatialMapScene` | Floating dynamic formula card with live variable tags & multiplier | Explains the math | ~8.3s |
| **3.1** | `ArchitecturePipeline` | **Stage 1 (Ingestion)**: Edge client telemetry & live GPS ping waves | Backend step 1 | ~12.8s |
| **3.2** | `ArchitecturePipeline` | **Stage 2 (Spatial Indexing)**: Hexagonal geohash cell mapping | Backend step 2 | ~12.8s |
| **3.3** | `ArchitecturePipeline` | **Stage 3 (In-Memory Cache)**: Redis ultra-fast memory store | Backend step 3 | ~12.8s |
| **3.4** | `ArchitecturePipeline` | **Stage 4 (Pricing/Compute)**: Dynamic rule calculation engine | Backend step 4 | ~12.8s |
| **3.5** | `ArchitecturePipeline` | **Stage 5 (Guardrails)**: Stale cache eviction & heartbeat validator | Backend step 5 | ~12.8s |
| **4.1** | `TradeoffHUD` | 3-Pillar Architecture Summary HUD with "TAKE SCREENSHOT 📌" badge | Save & share trigger | ~14.4s |
| **4.2** | `TradeoffHUD` | Channel CTA Card with pulsing subscribe ring & creator handle | Follow conversion | ~9.6s |

---

## 4. Instagram & Shorts Safe Zones (Blackout Avoidance)

All visual elements, text overlays, and cards strictly obey platform UI overlays:

```
+--------------------------------------------------------+ y = 0
|                   TOP BLACKOUT (180px)                 |
|      (Reels Title, Audio Attribution, Back Button)     |
+--------------------------------------------------------+ y = 180
|                                                        |
|                                         +------------+ |
|                   SAFE CONTENT AREA     |   RIGHT    | |
|                                         |  MARGIN    | |
|              Interactive Visuals        |  (140px)   | |
|              Cards & 3D Objects         |            | |
|              Top: 200px - 1380px        | Like / Cmd | |
|                                         | Share / Rem| |
|                                         +------------+ |
+--------------------------------------------------------+ y = 1380
|   KINETIC CAPTIONS ZONE (y = 1400px - 1500px)          |
+--------------------------------------------------------+ y = 1520
|                 BOTTOM BLACKOUT (400-520px)            |
|       (Username, Bio / Captions, Sound Waveform)       |
+--------------------------------------------------------+ y = 1920
```

> [!IMPORTANT]
> **Safe Zone Rules:**
> 1. No critical text above `y = 180px`.
> 2. No interactive buttons or key statistics to the right of `x = 940px` (leave 140px on the right margin).
> 3. Visual cards and diagrams must end before `y = 1380px`.
> 4. Dynamic kinetic captions must sit centered between `y = 1400px` and `y = 1500px`.
> 5. Never place content below `y = 1520px`.

---

## 5. Audio & SFX Engineering

1. **Audio Lock Guarantee**:
   - Audio tracks are generated once via Sarvam TTS (or human VO) and locked.
   - Subsequent video and visual iterations **must reuse existing audio clips** without re-calling TTS.
2. **Word Alignment**:
   - Whisper-grade word-level timestamps drive active word highlighting (`#00F2FE` neon cyan) with subtle vertical bounce.
3. **Layered Sound Effects**:
   - `whoosh.mp3` on camera tilts and scene transitions.
   - `slam.mp3` on dramatic stat reveals and stamps.
   - `radar.mp3` on geospatial sweeps.
   - `beep.mp3` on pipeline step transitions.

---

## 6. How to Run & Generate

### Step 1: Bundle Remotion
```bash
npx tsx scripts/bundle-remotion.ts
```

### Step 2: Render 13 Preview Stills (Fast QA)
```bash
npx tsx scripts/preview-creator-cuts.ts
```
Outputs 13 full-res JPEG frames into `output/creator_previews/cut_01.jpg` to `cut_13.jpg` for instant visual inspection.

### Step 3: Render Full 1080x1920 MP4 Video
```bash
npx tsx scripts/render-creator-script.ts
```
Renders complete video with hardware-accelerated Chromium GL, automatic audio sync, and Media QA verification.
