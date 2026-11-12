---
name: spiral
description: >-
  Render premium talking-head reels with an animated 3D frosted glass ribbon floating behind the subject,
  and dynamic glassmorphism keyword tiles popping into view on speech cues.
---

# Spiral: 3D Frosted Glass Ribbon & Kinetic Keyword Tiles

Spiral introduces a luxury aesthetic to tech explainers by rendering an undulating 3D frosted glass ribbon behind the presenter, synchronized with glassmorphic keyword tiles that bounce in on spoken technical concepts.

## Visual Design System

- **Background**: Deep cyber gradient (`#060C1B` to `#02040A`).
- **3D Ribbon Geometry**:
  - Smooth undulating spline rendered via SVG / CSS 3D transforms (`rotateX`, `rotateY`, `perspective(1000px)`).
  - Material: `backdrop-filter: blur(20px)`, subtle iridescent gradient (`linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 100%)`).
  - Edge Highlight: `border: 1.5px solid rgba(255, 255, 255, 0.3)`.
- **Keyword Tiles**:
  - Pop-in animation triggered on specific timestamp cues.
  - Floating pill badges with glossy reflection and glow shadows.

## Remotion Specification

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

export const SpiralGlassRibbon: React.FC<{ activeWord?: string }> = ({ activeWord }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Floating continuous 3D wave motion
  const waveOffset = Math.sin(frame / 25) * 40;
  const rotation = Math.sin(frame / 60) * 12;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', perspective: 1200 }}>
      {/* 3D Undulating Glass Ribbon */}
      <div
        style={{
          position: 'absolute',
          top: '35%',
          left: '-20%',
          width: '140%',
          height: 180,
          borderRadius: 90,
          background: 'linear-gradient(90deg, rgba(0, 242, 254, 0.15) 0%, rgba(168, 85, 247, 0.18) 50%, rgba(255, 255, 255, 0.08) 100%)',
          backdropFilter: 'blur(24px)',
          border: '1.5px solid rgba(255, 255, 255, 0.28)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.4)',
          transform: `translateY(${waveOffset}px) rotateZ(-18deg) rotateX(${rotation}deg)`,
          transformOrigin: 'center center',
          zIndex: 1,
        }}
      />

      {/* Pop-in Glassmorphism Keyword Tile */}
      {activeWord && (
        <div
          style={{
            position: 'absolute',
            top: '48%',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '16px 36px',
            borderRadius: 24,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 242, 254, 0.3)',
            zIndex: 3,
          }}
        >
          <span style={{ fontSize: 32, fontWeight: 800, color: '#FACC15', letterSpacing: '-0.02em' }}>
            ✦ {activeWord}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
```

## Best Use Cases
- High-level architecture overviews, developer portfolio intros, and product launches where high visual fidelity is demanded.
