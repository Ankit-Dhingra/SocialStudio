# SocialStudio — Migration & Handoff Guide

Yeh guide aapko naye laptop par bilkul wahin se continue karne me madad karegi jahan humne kaam choda hai.

---

## 1. Git Repository & Branch
- **Repo URL**: `https://github.com/Ankit-Dhingra/SocialStudio.git`
- **Active Branch**: `final/pipeline`

### Naye Laptop par Setup Commands:
```bash
# 1. Clone repository
git clone https://github.com/Ankit-Dhingra/SocialStudio.git
cd SocialStudio

# 2. Switch to active pipeline branch
git checkout final/pipeline

# 3. Dependencies install karein
npm install
npm --prefix dashboard install

# 4. Build dashboard frontend
npm --prefix dashboard run build

# 5. Start API & Remotion server
npx tsx watch src/api.ts
```
Server live ho jayega: `http://localhost:4000/`

---

## 2. Environment Variables (`.env`)
Project root me `.env` file banayein aur chat me diye gaye API keys paste karein:

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

---

## 3. Antigravity Chat History Naye Laptop par Kaise Continue Karein?

Aapke paas do simple options hain:

### Option A: Agent Context (Fastest & Recommended)
1. Naye laptop par Antigravity open karein aur `SocialStudio` folder ko workspace select karein.
2. Chat box me sirf ye type karein:
   ```text
   @HANDOFF_INSTRUCTIONS.md continue from here. Sab verify karke batao aage kya karna hai.
   ```
3. Antigravity turant context load kar lega aur previous architecture ke sath aage continue karega.

### Option B: Exact Local Chat Database & Artifacts Copy (Full History)
Purane laptop se yeh specific folder copy karke naye laptop ke same path par daal dein:
- **Source**: `C:\Users\ankit\.gemini\antigravity\brain\df73ecc3-3d8d-41bc-ad30-f2dfba53b9bf`
- **Destination (New Laptop)**: `%USERPROFILE%\.gemini\antigravity\brain\df73ecc3-3d8d-41bc-ad30-f2dfba53b9bf`
- Aur agar conversation sidebar history chahiye toh `%USERPROFILE%\.gemini\antigravity\conversation_summaries.db` ko bhi copy kar sakte hain.

---

## 4. Current State & Completed Features
1. **Strict Zod Scene Schemas**: Discriminator based scenes (`raceCondition`, `architecturePipeline`, `comparison`, etc.) with `HumanReadableText` rejecting any raw JSON strings.
2. **Typed Component Registry**: `renderRegisteredScene()` directly maps all 12 scenes into typed React components.
3. **Pilot Pilot Race Condition**: Realistic concert seat booking UI (Coldplay VIP Lounge, dual client clicks, bezier network channels, atomic resolution).
4. **Sarvam Audio & Groq Whisper Alignment**: Dropped intro clauses & slurred syllables fixed; Groq Whisper calculates exact millisecond word timestamps.
5. **Multi-core Parallel Rendering Capping**: Strictly capped to `concurrency: 2` (Chromium) and 2 FFmpeg threads to protect memory and avoid CPU freezing.
6. **Instant Visual Stills (3s)**: `POST /api/pipeline/stills` lets users inspect 1080x1920 vertical frames in a rich gallery before full video render.
7. **Clean 3-Step Dashboard**: Script & Chat Edit $\rightarrow$ Instant Screenshots $\rightarrow$ Fast MP4 Render.
