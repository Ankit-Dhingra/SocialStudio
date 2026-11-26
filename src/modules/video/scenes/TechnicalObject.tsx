import type { VectorGeometry } from '../vector-spec.js';
import { VideoDesignTokens as design } from '../design-system.js';
import { MechanismGlyph } from './MechanismGlyph.js';

type ObjectShape = Extract<VectorGeometry, { kind: 'object' }>;
const { colors, typography } = design;

export function TechnicalObject({ shape, state, cells, inspection, activity = 0, queueItems, applicationSurface }: { shape: ObjectShape;
  state?: 'cyan' | 'success' | 'warning' | 'error'; cells?: ReadonlyMap<number, string>; inspection?: readonly number[];
  activity?: number; queueItems?: number; applicationSurface?: string }) {
  const { box: [x, y, w, h], family, label, detail, values, tone } = shape;
  const accent = colors[state ?? tone];
  const titleSize = Math.min(37, h * .32, (w - 30) / Math.max(5, label.length * .57));
  const detailSize = Math.min(27, h * .22, (w - 30) / Math.max(5, (detail?.length ?? 1) * .57));
  const labelAt = (text: string, left: number, top: number, size: number, color: string, weight = 610) =>
    <text x={left} y={top} fill={color} fontFamily={typography.fontFamilySans} fontSize={size} fontWeight={weight}>{text}</text>;
  const rule = (id: number, left: number, top: number, width: number, color: string) =>
    <path key={id} d={`M ${left} ${top} h ${width}`} stroke={color} strokeWidth="3.5" />;
  const surface = <rect x="1" y="1" width={w - 2} height={h - 2} rx={Math.min(16, h * .16)}
    fill={family === 'application' && applicationSurface ? applicationSurface : colors.surface} stroke={accent} strokeWidth="2.5" />;
  const result = (() => {
    switch (family) {
      case 'document': {
        const right = w - 19;
        const bottom = h - 19;
        const fold = Math.min(w * .21, 32);
        const page = `M 1 1 H ${right - fold} L ${right} ${fold} V ${bottom} H 1 Z`;
        return <>
          {[16, 8, 0].map(offset => <path key={offset} d={page} transform={`translate(${offset} ${16 - offset})`}
            fill={colors.surface} stroke={colors.structure} strokeWidth="2.5" />)}
          <path d={`M ${right - fold} 17 V ${17 + fold} H ${right}`} fill="none" stroke={colors.structure} strokeWidth="2" />
          <rect x="17" y="35" width={Math.min(w - 53, label.length * titleSize * .67 + 16)} height={titleSize * 1.18} rx="5" fill={colors.pdfBadge} />
          {labelAt(label, 23, 35 + titleSize * .86, titleSize, colors.ink, 790)}
          {[0, 1, 2, 3].map(i => rule(i, 17, 45 + titleSize * 1.18 + i * Math.max(5, (h - 70 - titleSize * 1.18) / 4), (w - 55) * (i === 3 ? .59 : .94), colors.documentLine))}
          {detail && labelAt(detail, 17, h - 18, detailSize, colors.secondary)}
        </>;
      }
      case 'database': {
        const rim = Math.min(h * .105, 31);
        return <>
          <path d={`M 2 ${rim + 2} V ${h - rim - 4} Q ${w / 2} ${h + rim - 3} ${w - 2} ${h - rim - 4} V ${rim + 2} Z`}
            fill={colors.surface} stroke={accent} strokeWidth="2.5" />
          <ellipse cx={w / 2} cy={rim + 2} rx={w / 2 - 2} ry={rim} fill={colors.databaseTop} stroke={accent} strokeWidth="2.5" />
          {[.34, .51].map(y => <path key={y} d={`M 2 ${h * y} Q ${w / 2} ${h * y + rim * 1.9} ${w - 2} ${h * y}`}
            fill="none" stroke={accent} strokeOpacity=".6" strokeWidth="2.2" />)}
          {labelAt(label, 16, h * .78, titleSize, colors.ink)}
        </>;
      }
      case 'vector': {
        const rendered = `[${values?.map(value => value.toFixed(2)).join(', ') ?? ''}]`;
        return <>{surface}
          <text x="15" y={h * .43} fontFamily={typography.fontFamilyMono} fill={colors.vectorValue}
            fontSize={Math.min(34, h * .34, (w - 30) / (rendered.length * .62))}>{rendered}</text>
          {labelAt('Illustrative', 15, h * .8, Math.min(26, h * .23), colors.secondary)}
        </>;
      }
      case 'matrix': {
        const initial = shape.cells ?? [];
        const available = (w - 38) / Math.max(1, initial.length);
        const cellHeight = Math.min(76, h * .47);
        return <>{labelAt(label, 18, 30, titleSize, colors.ink)}
          {initial.map((item, index) => {
            const value = cells?.get(index + 1);
            const selected = inspection?.includes(index + 1);
            const left = 18 + available * index;
            return <g key={index}>
              {selected && <path d={`M${left + (available - 8) / 2} ${h * .23}v${h * .13}m-5-5 5 5 5-5`} fill="none" stroke={colors.warning} strokeWidth="2.5" />}
              <rect x={left} y={h * .39} width={available - 8} height={cellHeight}
                rx="7" fill={value === undefined ? colors.elevated : colors.databaseTop}
                stroke={selected ? colors.warning : value === undefined ? colors.structure : accent} strokeWidth={selected || value !== undefined ? 4 : 2} />
              <text x={left + (available - 8) / 2} y={h * .39 + cellHeight * .62} textAnchor="middle"
                fill={value === undefined ? colors.secondary : accent} fontFamily={typography.fontFamilyMono}
                fontSize={Math.min(34, available * .62)} fontWeight="700">{value ?? item}</text>
              <text x={left + (available - 8) / 2} y={h * .39 + cellHeight + 28} textAnchor="middle"
                fill={colors.secondary} fontFamily={typography.fontFamilyMono} fontSize="22">{index + 1}</text>
            </g>;
          })}
        </>;
      }
      case 'tree': {
        const levels = [[.5], [.28, .72], [.16, .39, .61, .84]];
        const y = [.23, .51, .79];
        const radius = Math.min(w * .062, h * .077);
        return <>
          <path d={`M${w*.5} 0V${h*.23 - radius}`} stroke={colors.structure} strokeWidth="2" strokeDasharray="5 5" />
          <path d={`M${w*.5} ${h*.23}v${h*.28}`} stroke={accent} opacity={activity * .45} strokeWidth="8" />
          {levels.slice(1).map((nodes, depth) => nodes.map((node, i) => {
            const selected = inspection?.some(leaf => depth === 0 ? Math.floor((leaf - 1) / 2) === i : leaf === i + 1);
            return <path key={`${depth}-${node}`} d={`M${levels[depth][Math.floor(i / 2)] * w} ${y[depth] * h}L${node * w} ${y[depth + 1] * h}`}
              fill="none" stroke={selected ? accent : colors.structure} strokeWidth={selected ? 4 + activity * 3 : 3.5} />;
          }))}
          {levels.map((nodes, depth) => nodes.map((node, index) => <g key={`${depth}-${node}`}>
            <circle cx={w * node} cy={h * y[depth]} r={radius} fill={depth === 0 ? colors.databaseTop : colors.elevated}
              stroke={depth === 0 || depth === 2 && inspection?.includes(index + 1) ? accent : colors.structure} strokeWidth="3" />
            <text x={w * node} y={h * y[depth]} dominantBaseline="central" textAnchor="middle" fill={colors.ink}
              fontFamily={typography.fontFamilyMono} fontSize={radius * (depth === 0 ? .71 : depth === 1 ? .5 : 1.1)}>
              {depth === 0 ? 'Root' : depth === 1 ? 'Parent' : index + 1}
            </text>
          </g>))}
          <text x={w / 2} y={h * .99} textAnchor="middle" fill={colors.ink} fontFamily={typography.fontFamilySans} fontSize={titleSize}>{label}</text>
        </>;
      }
      case 'parcel': case 'conveyor': case 'scanner': case 'sensor': case 'tag': case 'diverter': case 'chute': case 'hash': case 'queue': {
        const height = h * .76;
        const wide = ['conveyor', 'queue', 'diverter', 'chute'].includes(family);
        const width = Math.min(w - 10, height * (wide ? 2.9 : 1.5));
        return <>
          <g transform={`translate(${(w - width) * .5} ${h * .03}) scale(${width / 100} ${height / 100})`}>
            <MechanismGlyph family={family} accent={accent} items={queueItems} />
          </g>
          <text x={w / 2} y={h * .96} textAnchor="middle" fill={colors.ink} fontFamily={typography.fontFamilySans} fontSize={titleSize}>{label}</text>
        </>;
      }
      case 'rack': return <>{surface}{labelAt(label, 16, h * .24, titleSize, colors.ink)}
        {[.36, .55, .74].map((y, i) => <g key={y}>
          <rect x="16" y={h * y} width={w - 32} height={h * .13} fill={colors.databaseTop} stroke={colors.detail} rx="4" />
          <circle cx="29" cy={h * (y + .065)} r="4" fill={i === 0 ? accent : colors.detail} />
          {rule(i, 47, h * (y + .065), w * .44, colors.detail)}
        </g>)}</>;
      case 'application': return <>{surface}
        <path d={`M 1 ${h * .25} H ${w - 1}`} stroke={colors.structure} />
        {[18, 30, 42].map(cx => <circle key={cx} cx={cx} cy={h * .13} r="3.5" fill={colors.secondary} />)}
        {labelAt(label, 53, h * .18, Math.min(titleSize, h * .15), colors.ink)}
        {detail && labelAt(detail, 18, h * .49, detailSize, accent)}
        {rule(0, 18, h * .65, w * .79, colors.detail)}
        {rule(1, 18, h * .79, w * .58, colors.detail)}
      </>;
      case 'service': return <>{surface}
        <circle cx="22" cy={h * .37} r="5" fill={accent} />
        {labelAt(label, 39, h * .46, titleSize * .93, colors.ink)}
        {detail && labelAt(detail, 39, h * .77, detailSize, colors.secondary)}
        {!detail && rule(0, 39, h * .72, w * .53, colors.detail)}
      </>;
      case 'entry': case 'status': return <>{surface}
        <circle cx="25" cy={h/2} r="6" fill={accent} />
        {labelAt(label, 44, detail ? h*.45 : h*.58, titleSize, colors.ink)}
        {detail && labelAt(detail, 44, h*.78, detailSize, colors.secondary)}
      </>;
      case 'chunk': return <>{surface}
        {labelAt(label, 16, h * .37, titleSize, accent)}
        {detail ? labelAt(detail, 16, h * .76, detailSize, colors.secondary)
          : <>{rule(0, 16, h * .61, w * .78, colors.detail)}{rule(1, 16, h * .79, w * .56, colors.detail)}</>}
      </>;
    }
  })();
  return <g transform={`translate(${x} ${y})`}>{result}</g>;
}
