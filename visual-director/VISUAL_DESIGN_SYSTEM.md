# Visual design system — golden reference
The actual SVG and rendered PNG are the primary visual benchmark. Style is constant; composition is not. Use semantic theme tokens if the contract supports them; do not emit raw styling fields unless permitted.

| Role | Color |
|---|---|
| Canvas | #05070B |
| Background depth | #0B0F14 |
| `surface` | #111827 |
| `elevated` | #171D26 |
| Grid | white at 5% opacity |
| Default border | white at 12% opacity |
| Structural stroke | #667085 |
| Internal detail | #64748B |
| Document lines | #8391A4 |
| Primary flow | #67E8F9 |
| Processing | #8B5CF6 |
| Vector values | #B6A4FB |
| PDF badge | #A82F39 |
| Database top | #172D37 |
| Main text | #F8FAFC |
| `secondary` text | #94A3B8 |
| Success | #22C55E |
| Warning | #F59E0B |
| Error | #EF4444 |

Technical scenes: use the near-black 56 px grid with restrained cyan and purple atmospheric light. Use matte graphite panels only on meaningful objects. Keep foreground strokes crisp, inactive paths subdued, active dashed paths and packets luminous, and purple for processing. For custom vector phone screens and app panels, use `surface` or `elevated` for default dark fills. Use `secondary` for muted text and `structure` for borders and internal strokes. Use the supplied safe area and reserve room for captions. At full resolution, aim for body labels of 30–38 px and headings of 46–56 px. Use compact English technical terms or Roman Hinglish with Inter and aligned numeric values.

Phone: build a recognizable graphite chassis, inset display, and distinct content sections. Keep the display edge and typography readable. Use an explicit light fill or approved artwork for intentional light-mode interfaces. Preserve verified assets and authored appearance. Avoid generic dark-blue fills, strong blur and decorative neon. Keep consistent card padding, align labels deliberately, measure words at their actual weights, and leave room around connector bends, repeat grids and animated objects. Use Behind The Tech for closing cards and include a handle or logo only when verified in the job.
