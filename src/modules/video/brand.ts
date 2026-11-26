export const reelBrand = {
  name: 'Behind The Tech',
} as const;

export function canonicalBrandText(text: string): string {
  const branded = text.replace(/\bbehind\s+the\s+(?:stack|tech)\b/giu, reelBrand.name);
  return /@behindthestack\b/i.test(branded) ? branded.replace(/\s*@behindthestack\b/gi, '').trim() : branded;
}
