---
name: aurora
description: >-
  Explainer & tutorial video layout: frames the speaker in an elegant rounded glass panel with
  side-by-side comparison cards and gold karaoke-style captions.
---

# Aurora: Picture-in-Picture Speaker Panel & Gold Karaoke Captions

Aurora is the definitive layout for technical explainers, tutorials, and deep-dive comparisons. Rather than fullscreen talking head, the presenter is enclosed in an animated rounded glass container, leaving ample canvas space for side-by-side comparison cards, terminal outputs, and dynamic gold-highlighted karaoke captions.

## Visual Design Elements

1. **Rounded Speaker Container (PIP)**:
   - Size: 920px x 680px positioned at top or bottom half.
   - Border Radius: `32px`.
   - Frosted Glass Border: `2px solid rgba(250, 204, 21, 0.3)` with ambient gold drop-shadow (`box-shadow: 0 25px 60px rgba(0,0,0,0.7), 0 0 30px rgba(250, 204, 21, 0.15)`).
2. **Comparison & Feature Cards**:
   - Left vs. Right split cards showing "Wrong Way" vs. "Optimized Way".
   - Color coded: Red tint `#EF4444` vs. Emerald Green `#10B981`.
3. **Gold Karaoke Captions**:
   - Highlight color: Electric Gold (`#FACC15`) with subtle scale pop (`transform: scale(1.15)`).
   - Inactive words: Muted clean white (`rgba(255, 255, 255, 0.6)`).

## Remotion Specification

```tsx
import React from 'react';
import { AbsoluteFill } from 'remotion';

export const AuroraExplainerLayout: React.FC<{
  speakerVideoSrc?: string;
  leftTitle: string;
  leftPoint: string;
  rightTitle: string;
  rightPoint: string;
}> = ({ speakerVideoSrc, leftTitle, leftPoint, rightTitle, rightPoint }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#030712', padding: 48, display: 'flex', flexDirection: 'column' }}>
      {/* Top: Rounded Glass Panel for Speaker */}
      <div
        style={{
          width: '100%',
          height: 640,
          borderRadius: 36,
          overflow: 'hidden',
          border: '2px solid rgba(250, 204, 21, 0.35)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(250, 204, 21, 0.15)',
          position: 'relative',
        }}
      >
        {speakerVideoSrc ? (
          <video src={speakerVideoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1E293B, #0F172A)' }} />
        )}
      </div>

      {/* Bottom: Comparison Cards */}
      <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, flex: 1 }}>
        {/* Left: Anti-Pattern */}
        <div style={{
          padding: 28,
          borderRadius: 24,
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1.5px solid rgba(239, 68, 68, 0.3)',
        }}>
          <div style={{ color: '#EF4444', fontWeight: 800, fontSize: 24, marginBottom: 12 }}>✕ {leftTitle}</div>
          <div style={{ color: '#E2E8F0', fontSize: 20, lineHeight: 1.5 }}>{leftPoint}</div>
        </div>

        {/* Right: Best Practice */}
        <div style={{
          padding: 28,
          borderRadius: 24,
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1.5px solid rgba(16, 185, 129, 0.3)',
        }}>
          <div style={{ color: '#10B981', fontWeight: 800, fontSize: 24, marginBottom: 12 }}>✓ {rightTitle}</div>
          <div style={{ color: '#E2E8F0', fontSize: 20, lineHeight: 1.5 }}>{rightPoint}</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
```

## Best Use Cases
- Benchmarks, comparing architectures (e.g. REST vs gRPC, Redis vs Memcached), code review reels, and step-by-step guides.
