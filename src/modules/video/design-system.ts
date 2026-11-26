const colors = {
  canvas: '#05070B',
  background: '#0B0F14',
  surface: '#111827',
  elevated: '#171D26',
  grid: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.12)',
  mutedBorder: 'rgba(255,255,255,0.07)',
  cyan: '#67E8F9',
  purple: '#8B5CF6',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  ink: '#F8FAFC',
  secondary: '#94A3B8',
  structure: '#667085',
  detail: '#64748B',
  documentLine: '#8391A4',
  vectorValue: '#B6A4FB',
  pdfBadge: '#A82F39',
  databaseTop: '#172D37',
  muted: 'rgba(248,250,252,0.50)',
} as const;

export const VideoDesignTokens = {
  colors: {
    ...colors,
    bgDark: colors.background,
    bgDarker: colors.canvas,
    bgCard: colors.surface,
    bgCardSolid: colors.surface,
    bgCardBorder: colors.border,
    textPrimary: colors.ink,
    textSecondary: colors.secondary,
    textMuted: colors.muted,
    accentCyan: colors.cyan,
    accentBlue: colors.cyan,
    accentPurple: colors.purple,
    accentPink: colors.purple,
    accentOrange: colors.error,
    accentGreen: colors.success,
    accentYellow: colors.warning,
    codeBg: colors.background,
    terminalBg: colors.canvas,
    // VS Code Syntax Tokens
    syntax: {
      keyword: '#C586C0',    // const, let, function, return
      func: '#DCDCAA',       // console.log, setTimeout
      string: '#CE9178',     // 'strings'
      variable: '#9CDCFE',   // variable names
      comment: '#6A9955',    // // comments
      number: '#B5CEA8',     // 0, 1000
    },
  },
  safeMargin: {
    top: 180,
    bottom: 520,
    left: 60,
    right: 140,
  },
  typography: {
    fontFamilySans: '"BTS Inter", "Segoe UI", "Nirmala UI", system-ui, sans-serif',
    fontFamilyMono: '"BTS JetBrains Mono", Consolas, monospace',
    headline: 72,
    title: 54,
    node: 32,
    description: 28,
    annotation: 24,
    number: 44,
    code: 30,
    caption: 42,
  },
  spacing: { unit: 8, gap: 24, cardPadding: 26, sectionGap: 40 },
  radius: { card: 22, badge: 12, chip: 10 },
  effects: { panelShadow: '0 14px 36px rgba(0,0,0,0.32)', focusGlow: '0 0 27px' },
  motion: { text: 0.26, enter: 0.36, draw: 0.52, packet: 0.84, highlight: 0.32,
    focus: 0.78, transition: 0.40, artwork: 6 },
};

export const visualDirectionStyle = 'Behind The Tech uses a near-black 56px grid, matte graphite surfaces, Inter typography, cyan data flow and purple processing accents. Use green, amber and red for semantic states. Keep routes crisp and dashed, use progressive reveals and stable object IDs, and retain authentic device UI colors. Use the current stage contract for output.';
