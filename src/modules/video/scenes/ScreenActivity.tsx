import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TimedShot } from '../visual-story.js';
import { VideoDesignTokens as design } from '../design-system.js';
import { panelStyle } from '../PremiumVisuals.js';

type DeviceShot = Extract<TimedShot, { kind: 'device' }>;
const styles = {
  attach: { color: design.colors.cyan, glyph: '↗' },
  input: { color: design.colors.cyan, glyph: '›' },
  result: { color: design.colors.success, glyph: '✓' },
  choose: { color: design.colors.cyan, glyph: '●' },
  progress: { color: design.colors.purple, glyph: '↻' },
  status: { color: design.colors.ink, glyph: '•' },
  alert: { color: design.colors.error, glyph: '!' },
} as const;

export function ScreenActivity({ shot, compact = false }: { shot: DeviceShot; compact?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shades = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) } as const;
  const visible = shot.actors.map((actor, index) => ({
    actor,
    action: shot.screenActions?.[index] ?? 'status',
    cue: shot.reveals[index] ?? 0,
  })).filter(step => frame >= step.cue).slice(-3);

  if (compact && shot.screenContent === 'checkout') {
    const current = visible.at(-1);
    const earlierInput = visible.find(step => step !== current && step.action === 'input');
    if (!current) return null;
    const { actor, action, cue } = current;
    const progress = interpolate(frame, [cue, cue + fps * design.motion.enter], [0, 1], shades);
    const value = action === 'input' && actor.value
      ? Array.from(actor.value).slice(0, Math.ceil(Array.from(actor.value).length * progress)).join('') : actor.value;
    const finished = action === 'result' || action === 'alert';
    return <section style={{ margin: '18px 21px 0', color: design.colors.background, overflowWrap: 'anywhere' }}>
      <div style={{ padding: '17px 0 23px', borderTop: '1px solid #d9dde3',
        fontSize: design.typography.title - 9, fontWeight: 740, letterSpacing: -1.4 }}>Checkout</div>
      <div style={{ opacity: progress, translate: `0 ${(1 - progress) * 12}px` }}>
        {finished && <div aria-hidden style={{ width: 64, height: 64, display: 'grid', placeItems: 'center',
          borderRadius: '50%', marginBottom: 22,
          background: action === 'alert' ? `${design.colors.error}25` : `${design.colors.success}26`,
          color: design.colors.background, fontSize: 40, fontWeight: 720 }}>{action === 'result' ? '✓' : '!'}</div>}
        <div style={{ fontSize: finished ? 34 : 26, fontWeight: 690 }}>{actor.label}</div>
        {value && <div style={{
          fontSize: 27, marginTop: 11, lineHeight: 1.25, color: design.colors.background,
          ...(action === 'input' ? { border: '1px solid #a5afbc', borderRadius: 13, padding: '18px 15px', background: '#ffffff' } : {}),
        }}>{value}{action === 'input' && progress < 1 && <span aria-hidden style={{ marginLeft: 3, borderLeft: '2px solid currentColor' }} />}</div>}
        {action === 'progress' && <div aria-hidden style={{ marginTop: 25, height: 6, background: '#d7dce4', borderRadius: 8 }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 8, background: design.colors.purple }} />
        </div>}
      </div>
      {earlierInput && <div style={{ marginTop: 40, borderTop: '1px solid #d9dde3', paddingTop: 19, display: 'grid', gap: 7 }}>
        <div style={{ fontSize: 20, color: '#4b5563' }}>{earlierInput.actor.label}</div>
        <div style={{ fontSize: 24, fontWeight: 630 }}>{earlierInput.actor.value}</div>
      </div>}
    </section>;
  }

  const document = !compact && shot.screenLayout === 'desktop' && shot.screenContent === 'document';
  return <div style={{ minHeight: compact ? 395 : document ? 650 : 435, display: 'grid', alignContent: 'start',
    gap: compact ? 16 : document ? 39 : 23, padding: compact ? 18 : document ? '46px 38px' : 34, boxSizing: 'border-box' }}>
    {visible.map(({ actor, action, cue }, index) => {
      const lifecycle = interpolate(frame, [cue, cue + fps * 0.45], [0, 1], shades);
      const active = index === visible.length - 1;
      const { color, glyph } = styles[action];
      const input = action === 'input' || action === 'choose';
      const displayedValue = action === 'input' && actor.value && active
        ? Array.from(actor.value).slice(0, Math.ceil(actor.value.length * lifecycle)).join('') : actor.value;
      return <div key={actor.entity} style={{
        ...panelStyle(),
        justifySelf: input ? 'end' : 'start', width: input ? '83%' : '100%', minWidth: 0, boxSizing: 'border-box',
        color: design.colors.ink, padding: compact ? 15 : document ? '30px 25px' : 23,
        borderColor: active ? `${color}78` : design.colors.border, borderRadius: input ? '20px 20px 6px 20px' : 20,
        opacity: lifecycle, translate: `${(input ? 24 : -24) * (1 - lifecycle)}px ${(1 - lifecycle) * 12}px`,
      }}>
        <div style={{ display: 'flex', gap: compact ? 10 : 17, alignItems: 'center', overflowWrap: 'anywhere' }}>
          <div aria-hidden style={{
            width: compact ? 34 : 54, height: compact ? 40 : 58, flexShrink: 0, borderRadius: action === 'attach' ? '7px 17px 7px 7px' : 12,
            display: 'grid', placeItems: 'center', background: `${color}25`, border: `1px solid ${color}70`, color,
            fontSize: compact ? 26 : 34, fontWeight: 850,
          }}>{glyph}</div>
          <div style={{ minWidth: 0, lineHeight: 1.16 }}>
            <div style={{ fontWeight: 790, fontSize: compact ? 27 : document ? 44 : 37 }}>{actor.label}</div>
            {actor.value && <div style={{ color, fontSize: compact ? 23 : 29, marginTop: 7 }}>{displayedValue}</div>}
          </div>
        </div>
        {action === 'progress' && <div aria-hidden style={{ marginTop: 15, height: 7, borderRadius: 7, background: design.colors.elevated }}>
          <div style={{ height: '100%', width: `${lifecycle * 100}%`, background: color, borderRadius: 7 }} />
        </div>}
      </div>;
    })}
  </div>;
}
