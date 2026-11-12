---
name: eclipse
description: >-
  Create high-energy tech reels with an audio-reactive pulsing neon blue halo ring behind the head,
  futuristic cyber HUD chips, and portal scene wipes.
---

# Eclipse: Cyber Neon Halo Ring & HUD Keyword Chips

Eclipse creates an unmistakable futuristic cyberpunk visual identity for engineering shorts. It projects a pulsating neon cyan aura ring behind the speaker's head, punctuated by floating HUD tech chips that snap into view on spoken technical buzzwords.

## Visual Design Elements

1. **Cyber Halo Ring**:
   - Diameter: 620px circle positioned directly behind head center (X: 50%, Y: 28%).
   - Neon Palette: Core cyan `#00F2FE` with outer violet glow `rgba(168, 85, 247, 0.4)`.
   - Motion: Continuous subtle rotation + audio-reactive radial scale pulse (1.00x -> 1.08x).
2. **HUD Tech Chips**:
   - Monospace typography (`JetBrains Mono`, `Fira Code`).
   - Neon badge container: `background: rgba(0, 242, 254, 0.08)`, `border: 1px solid #00F2FE`.
   - Corner bracket accents (`┌ ┐ └ ┘`).
3. **Portal Scene Wipes**:
   - Iris-in and iris-out radial zoom transitions between technical chapters.

## Remotion Specification

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

export const EclipseNeonRing: React.FC<{ pulse?: number }> = ({ pulse = 1 }) => {
  const frame = useCurrentFrame();

  const rotation = (frame * 1.5) % 360;
  const glowIntensity = interpolate(Math.sin(frame / 12), [-1, 1], [0.85, 1.15]) * pulse;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Outer Cyan Halo Glow */}
      <div
        style={{
          position: 'absolute',
          top: '28%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 580,
          height: 580,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 242, 254, 0.22) 0%, rgba(168, 85, 247, 0.12) 50%, transparent 70%)',
          filter: `blur(${35 * glowIntensity}px)`,
          zIndex: 1,
        }}
      />

      {/* Rotating Dashed Neon HUD Ring */}
      <svg
        style={{
          position: 'absolute',
          top: '28%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          width: 500,
          height: 500,
          zIndex: 2,
        }}
        viewBox="0 0 500 500"
      >
        <circle
          cx="250"
          cy="250"
          r="230"
          fill="none"
          stroke="#00F2FE"
          strokeWidth="3"
          strokeDasharray="40 20 10 20 60 30"
          strokeOpacity="0.8"
        />
        <circle
          cx="250"
          cy="250"
          r="215"
          fill="none"
          stroke="#A855F7"
          strokeWidth="1.5"
          strokeDasharray="15 15"
          strokeOpacity="0.6"
        />
      </svg>
    </AbsoluteFill>
  );
};
```

## Best Use Cases
- Event loops, distributed systems, deep-dive backend engineering, algorithms, and cybersecurity explainers.
