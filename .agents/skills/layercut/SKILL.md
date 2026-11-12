---
name: layercut
description: >-
  Turn raw talking-head videos into high-retention studio reels with subject cutouts,
  "Word Behind Head" cinematic typography, automated pause & filler cuts, and 3D page flyovers.
---

# Layercut: Cinematic Subject-Layered Motion Graphics

Layercut transforms a plain talking-head video into a studio-grade viral reel by cutting dead air, extracting the speaker into an alpha mask layer, and placing cinematic typography, 3D cards, and dynamic badges **behind** the speaker's head.

## Core Capabilities

1. **Silence & Filler Trimming**: Uses Whisper word timestamps and FFmpeg `silencedetect` to remove pauses longer than 0.35s and vocal fillers (`um`, `uh`, throat clears).
2. **Subject Alpha Segmentation**: Automatically isolates the human subject into a transparent foreground stream using `rembg` (`u2net_human_seg`) or Apple Vision framework.
3. **Word-Behind-Head Compositing**:
   - **Layer 1 (Back)**: Original video with subtle vignette/darkening (`opacity: 0.8`).
   - **Layer 2 (Middle)**: Gigantic cinematic text (140px, bold font, `#FFFFFF` with drop-shadow or neon glow) placed precisely between the background and speaker.
   - **Layer 3 (Foreground)**: Subject alpha cut-out, keeping the speaker completely in front of the background words.
   - **Layer 4 (Overlays)**: Keyword pop-in plates, code callouts, and 3D page flyover elements.

## Execution Workflow

### Step 1: Trim Pauses & Detect Speech Cues
```bash
# Extract audio and get word-level alignment using whisper / faster-whisper
python -c "
import whisper
model = whisper.load_model('base')
result = model.transcribe('input.mp4', word_timestamps=True)
for segment in result['segments']:
    for word in segment['words']:
        print(f\"{word['start']:.2f} -> {word['end']:.2f}: {word['word']}\")
"
```

### Step 2: Extract Subject Mask (Free Open Source)
```bash
# Generate alpha matte using rembg (Python)
python -c "
from rembg import remove, new_session
import cv2

session = new_session('u2net_human_seg')
cap = cv2.VideoCapture('input.mp4')
# Process frames to output foreground RGBA video or PNG sequence
"
```

### Step 3: Layercut Remotion / CSS Layout Specification
```tsx
import { AbsoluteFill } from 'remotion';

export const LayercutScene = ({ keyword, subjectCutoutSrc, backgroundSrc }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0A0A' }}>
      {/* Layer 1: Background Video */}
      <video src={backgroundSrc} style={{ filter: 'brightness(0.7) blur(2px)' }} />

      {/* Layer 2: Word Behind Head */}
      <div style={{
        position: 'absolute',
        top: '28%',
        width: '100%',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '130px',
        fontWeight: 900,
        textTransform: 'uppercase',
        letterSpacing: '-0.04em',
        color: '#FFFFFF',
        opacity: 0.95,
        textShadow: '0 0 40px rgba(0, 242, 254, 0.4)',
        zIndex: 2,
      }}>
        {keyword}
      </div>

      {/* Layer 3: Foreground Subject Cutout */}
      <video src={subjectCutoutSrc} style={{ position: 'absolute', inset: 0, zIndex: 3 }} />

      {/* Layer 4: Foreground Interactive Badges */}
      <div style={{ position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 4 }}>
        <div style={{
          padding: '12px 24px',
          background: 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(16px)',
          borderRadius: '999px',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#FACC15',
          fontWeight: 700,
        }}>
          ⚡ Critical Rule
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

## Best Practices
- Keep background text to 1 or 2 high-impact words (e.g. `ASYNC`, `DEADLOCK`, `QUEUE`).
- Anchor text position around the upper third (top 25%–35%) of the 9:16 vertical frame.
- Add micro-zoom (1.00x -> 1.05x) across the cut to maintain viral viewer retention.
