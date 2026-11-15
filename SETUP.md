# SocialStudio — Setup Guide

Production-ready setup guide for running **SocialStudio** on a new machine.

---

## ⚡ Quick Start (TL;DR)

```bash
# 1. Clone repository
git clone https://github.com/Ankit-Dhingra/SocialStudio.git
cd SocialStudio

# 2. Checkout active production branch
git checkout final/pipeline

# 3. Create your .env file in the root directory (see section below)

# 4. Install dependencies
npm install
npm --prefix dashboard install

# 5. Build dashboard frontend
npm --prefix dashboard run build

# 6. Verify tests
npm test

# 7. Start API & Remotion server
npx tsx watch src/api.ts
```

Open your browser at: **[http://localhost:4000](http://localhost:4000)**

---

## 📋 System Prerequisites

| Requirement | Recommended Version | Notes |
| :--- | :--- | :--- |
| **Node.js** | `>= 18.0.0` (LTS 20+ recommended) | Run `node -v` to verify |
| **npm** | `>= 9.0.0` | Run `npm -v` to verify |
| **Git** | Any modern version | Run `git --version` |
| **Google Chrome** | Latest stable | Required for Remotion headless rendering |
| **OS** | Windows 10/11, macOS, or Linux | Tested on Windows 11 & Linux |

> [!NOTE]
> PostgreSQL and Redis are optional for local development. If local PostgreSQL/Redis are offline, the app automatically runs in standalone file-storage mode without crashing.

---

## 🔑 Environment Configuration (`.env`)

Create a file named `.env` in the root folder of the project (`SocialStudio/.env`):

```env
DATABASE_URL=postgres://studio:studio_dev@127.0.0.1:5432/techcontent
REDIS_URL=redis://127.0.0.1:6379
API_PORT=4000
DEMO_MODE=false

# LLM Providers (gemini | groq)
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GROQ_API_KEYS=your_groq_api_keys_here
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=qwen/qwen3.8-27b

# TTS Providers (sarvam | elevenlabs | edge)
TTS_PROVIDER=sarvam
SARVAM_API_KEY=your_sarvam_api_key_here
SARVAM_SPEAKER=sunny_hi_reels
SARVAM_MODEL=bulbul:v4-flash
EDGE_TTS_VOICE=hi-IN-MadhurNeural
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=IKne3meq5aSn9XLyUdCD
ELEVENLABS_MODEL=eleven_multilingual_v2

AUTOMATION_TOKEN=change-me-in-local-dev
CHROME_EXECUTABLE=C:\Program Files\Google\Chrome\Application\chrome.exe
```

> [!IMPORTANT]
> Paste your active API keys into the `.env` file. Do **not** commit `.env` to Git (it is already in `.gitignore`).

---

## 🧪 Verification & Health Check

Run the automated test suite to verify that all Zod schemas, scene discriminated unions, and component registries are functioning properly:

```bash
npm test
```

Expected output:
```text
✔ HumanReadableText rejects serialized JSON strings
✔ StoryboardSceneSchema validates valid discriminated union scene
✔ StoryboardSceneSchema rejects unknown scene types
✔ SceneRegistry has entries for all discriminated union types
✔ renderRegisteredScene throws on unknown scene type
# pass 5
# fail 0
```

---

## 🚀 Running the Studio Pipeline

1. **Start the API & Studio Backend**:
   ```bash
   npx tsx watch src/api.ts
   ```
2. Open **[http://localhost:4000](http://localhost:4000)** in Chrome or your default browser.
3. Follow the 3-step creation flow:
   - **Step 1: Script & Chat Refinement**: Enter your engineering topic/angle, generate master script, and refine with AI.
   - **Step 2: Voiceover Synthesis**: Generate studio Hinglish audio with Sarvam AI (`sunny_hi_reels`) and auto-align with Groq Whisper.
   - **Step 3: Instant Visual Stills Review**: Review high-resolution 1080×1920 screenshots of all 5 scenes in 3–4 seconds.
   - **Step 4: Fast Multi-Core MP4 Render**: Export 1080×1920 9:16 vertical short reel with controlled 2-core Remotion concurrency.

---

## 🤖 Continuing in Google Antigravity on New Machine

1. Open **Google Antigravity** on your new laptop.
2. Select the cloned `SocialStudio` folder as your active workspace.
3. Open chat and type:
   ```text
   @HANDOFF_INSTRUCTIONS.md continue from here. Sab verify karke aage proceed karo.
   ```
4. Antigravity will automatically load the architectural context and resume seamlessly.
