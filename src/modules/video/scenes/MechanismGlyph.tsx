import { VideoDesignTokens } from '../design-system.js';

const { colors } = VideoDesignTokens;
type Glyph = 'hash' | 'queue' | 'conveyor' | 'scanner' | 'sensor' | 'tag' | 'diverter' | 'chute' | 'parcel';

export function ParcelGlyph({ accent = colors.cyan }: { accent?: string }) {
  return <>
    <path d="M39 29V18Q39 14 44 14H56Q61 14 61 18V29" fill="none" stroke={accent} strokeWidth="3" />
    <rect x="25" y="26" width="50" height="55" rx="11" fill={colors.databaseTop} stroke={accent} strokeWidth="2" />
    <rect x="30" y="31" width="40" height="45" rx="7" fill={colors.elevated} stroke={colors.structure} />
    <path d="M41 35V71M50 35V71M59 35V71" stroke={accent} strokeOpacity=".48" strokeWidth="2" />
    <circle cx="37" cy="84" r="4" fill={colors.structure} /><circle cx="63" cy="84" r="4" fill={colors.structure} />
    <path d="M67 27l10 8-4 10-10-5z" fill={colors.surface} stroke={colors.warning} />
  </>;
}

export function MechanismGlyph({ family, accent, items = 0 }: { family: Glyph; accent: string; items?: number }) {
  const surface = colors.elevated;
  const inset = colors.databaseTop;
  const line = colors.structure;
  switch (family) {
    case 'parcel': return <ParcelGlyph accent={accent} />;
    case 'conveyor': return <>
      <path d="M13 69l-3 15m80-15 3 15" stroke={line} strokeWidth="3" />
      <rect x="5" y="29" width="90" height="44" rx="12" fill={surface} stroke={accent} strokeWidth="2" />
      {Array.from({ length: 8 }, (_, index) => <path key={index} d={`M${13 + index * 10} 36v28`} stroke={line} strokeWidth="4" />)}
      <path d="M12 50h72m-8-7 8 7-8 7" stroke={accent} strokeWidth="2" fill="none" />
    </>;
    case 'scanner': return <>
      <path d="M16 83V33Q16 15 34 15H66Q84 15 84 33V83H72V39Q72 29 61 29H39Q28 29 28 39V83Z" fill={inset} stroke={accent} strokeWidth="2" />
      <path d="M40 31 32 68H68L60 31Z" fill={accent} fillOpacity=".18" />
      <path d="M36 52H64M33 61H67" stroke={accent} strokeWidth="1.2" strokeDasharray="3 2" />
      <path d="M7 81H93" stroke={line} strokeWidth="4" />
    </>;
    case 'tag': return <>
      <path d="M10 42 27 23H88V74H27L10 57Z" fill={surface} stroke={accent} strokeWidth="2" />
      <circle cx="25" cy="49" r="4" fill="none" stroke={accent} />
      {[33, 37, 42, 47, 50, 57, 61, 66, 69, 75, 81].map((x, i) => <path key={x} d={`M${x} 35v28`} stroke={colors.ink} strokeWidth={i % 3 === 0 ? '2.4' : '1'} />)}
    </>;
    case 'sensor': return <>
      <rect x="15" y="36" width="37" height="32" rx="7" fill={inset} stroke={accent} strokeWidth="2" />
      <circle cx="39" cy="52" r="7" fill={accent} />
      <path d="M58 44q10 8 0 16m8-24q18 16 0 32m8-41q26 26 0 51" fill="none" stroke={accent} strokeWidth="2.8" />
    </>;
    case 'diverter': case 'chute': return <>
      <path d={family === 'diverter' ? 'M10 39H40L70 15H94V36H76L58 50 76 65H94V86H68L40 62H10Z' : 'M10 24H61L88 61V82H70L44 47H10Z'}
        fill={inset} stroke={accent} strokeWidth="2" />
      <path d={family === 'diverter' ? 'M15 50H46L78 25H89M46 50 78 75H89' : 'M18 35H52L80 72'} fill="none" stroke={colors.secondary} strokeWidth="2" strokeDasharray="4 4" />
      {family === 'diverter' && <circle cx="45" cy="50" r="6" fill={accent} />}
    </>;
    case 'hash': return <>
      <path d="M2 52h18m60 0h18M42 11V25m16-14V25M42 77V91m16-14V91" fill="none" stroke={accent} strokeWidth="2" />
      <rect x="21" y="23" width="58" height="56" rx="10" fill={inset} stroke={accent} strokeWidth="2" />
      <path d="M37 45h26m-29 11h26M46 36l-7 30m21-30-7 30" fill="none" stroke={accent} strokeWidth="3" />
    </>;
    case 'queue': return <>
      <path d="M8 31v40h84V31" fill="none" stroke={accent} strokeWidth="2" />
      {[14, 32, 50, 68].map((x, index) => <rect key={x} x={x} y="38" width="15" height="25" rx="3" fill={index >= items ? colors.surface : inset} stroke={index >= items ? line : accent} />)}
      <path d="M15 22h67m-6-5 6 5-6 5" stroke={accent} fill="none" />
    </>;
  }
}
