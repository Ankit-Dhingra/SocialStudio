export const reelBrand = {
  name: 'Behind The Tech',
} as const;

export function canonicalBrandText(text: string): string {
  const branded = text.replace(/\bbehind\s+the\s+(?:stack|tech)\b/giu, reelBrand.name);
  return /@behindthetech\b/i.test(branded) ? branded.replace(/\s*@behindthetech\b/gi, '').trim() : branded;
}
