# TechContent AI Studio — vertical-slice MVP

Builds an AI-scripted 1080×1920 educational short with animated React/Remotion scenes, TTS, a Redis/BullMQ worker, PostgreSQL state, and a React approval dashboard. **No platform publishing is included.**

## Requirements
- Node.js 20+ and npm
- Docker with Compose (or locally running PostgreSQL + Redis)
- `ffmpeg`, `ffprobe` on PATH
- Chromium/Chrome for Remotion rendering (Remotion may download a compatible browser)
- AI mode: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, and a voice ID obtained from ElevenLabs
- Demo/offline mode: additionally `espeak` binary on PATH; demo mode provides a synthetic test voice, **not** the desired natural AI narrator

## Quick start
```bash
cp .env.example .env
# On Windows PowerShell: Copy-Item .env.example .env
docker compose up -d
npm install
npm --prefix dashboard install
npm run db:init
# Three terminals:
npm run api
npm run worker
npm run dev:dashboard
```
Open `http://localhost:5173`. Keep the development automation token equal to `AUTOMATION_TOKEN` in your `.env`; **never expose this API publicly without proper authentication.**

Click **Queue Video**. The worker creates script, narration and the MP4. When finished, watch it and approve or reject. `media/<uuid>.mp4` is the output. Review does **not** upload to any platform.

### Switch to real AI
Set `DEMO_MODE=false` and configure the OpenAI API key, ElevenLabs API key and voice ID. Change `OPENAI_MODEL` as needed to a Responses-API compatible model supporting structured outputs. Select voices from your ElevenLabs account. Be sure the narrator is disclosed as AI-generated in your publishing context where applicable.

### API
```bash
curl -X POST http://localhost:4000/api/videos \
  -H 'Content-Type: application/json' \
  -H 'x-automation-token: change-me-in-local-dev' \
  -d '{"topic":"How does Node.js manage concurrent connections?"}'

curl http://localhost:4000/api/videos
```

### n8n integration
Import `n8n/workflow.json` using the n8n UI. Its sample scheduler calls the API once per day. Replace the hardcoded sample topic and dev token; use n8n credentials and secret expressions. When n8n runs **in Docker**, `host.docker.internal` may need an `extra_hosts` configuration on Linux. If n8n is on the host, use `http://localhost:4000/api/videos`. Review node settings against your installed n8n version before enabling.

## Main files
- `src/api.ts`: REST endpoints
- `src/worker.ts`: async script → voice → render
- `src/script.ts`: structured OpenAI script / demo fixture
- `src/tts.ts`: ElevenLabs speech / offline synthetic demonstration
- `remotion/tech-short.tsx`: animated diagrams, code, kinetic text, audio
- `dashboard/src/main.jsx`: React operations dashboard
- `db/schema.sql`: PostgreSQL table and state machine

## Engineering caveats
- This is a **single-machine development MVP**, not a hardened cloud deployment. Add user authentication, secure secret storage, rate limits, audit logs, storage lifecycle, proper scene-level TTS alignments, accessibility controls and a reliable publication outbox before internet exposure.
- The renderer uses word-proportion estimates to distribute scene timings against *actual total audio length*. For production-level lip/timing sync, generate each scene's audio separately or obtain timestamp alignment data from TTS and render precise captions. The example's on-screen narration is scene-level, not word-accurate subtitles.
- Remotion bundle is memoized within one worker process to avoid a costly rebuild per video.
- The existing BullMQ job uses one attempt; operators should manually requeue failures after troubleshooting instead of blindly repeating billable API requests. For retry-on-crash design, store each successful stage and associated asset IDs and reuse them.
- Review generated technical claims and code before publication. AI agents should not autonomously publish without human oversight.
- No verified end-to-end render occurred in this creation environment without your external API credentials and a running PostgreSQL/Redis stack. See the test checklist below.

## Smoke-test checklist
1. `GET /api/health` returns `{"ok":true}`.
2. Dashboard queues a topic and shows `QUEUED`.
3. Worker proceeds `SCRIPTING → NARRATING → RENDERING → READY_FOR_REVIEW`.
4. MP4 exists under `media/`, plays with correct sound, has 1080×1920 dimensions and no black frames.
5. Approval changes status but **does not** publish.
6. With real credentials, compare narrator quality, factual accuracy and duration before switching off demo mode.

## Suggested next iterations
1. Scene-level TTS timestamps and precise captioning.
2. Source-grounded topic research and citation provenance.
3. Script revisions and re-render endpoints.
4. Per-video cost estimates, metrics and quota checks.
5. Official YouTube/Meta APIs with publishing approval, OAuth and deduplicated outbox.
