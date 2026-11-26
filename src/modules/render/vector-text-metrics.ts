// Default advance widths from the bundled Inter.ttf hmtx table, in thousandths of an em.
const asciiAdvance = [
  281, 288, 466, 633, 642, 982, 644, 300, 365, 365, 501, 662, 288, 460, 288, 360,
  631, 407, 610, 618, 646, 593, 620, 566, 619, 620, 288, 302, 662, 662, 662, 511,
  966, 690, 654, 730, 722, 601, 590, 746, 743, 269, 571, 672, 565, 903, 753, 765,
  639, 765, 644, 642, 646, 744, 690, 985, 682, 679, 629, 365, 360, 365, 471, 456,
  323, 562, 612, 571, 612, 583, 370, 613, 591, 242, 242, 549, 242, 876, 591, 600,
  612, 612, 376, 528, 327, 591, 562, 818, 546, 562, 552, 426, 333, 426, 662,
];
const punctuation: Record<string, number> = {
  '\u2013': 500, '\u2014': 1000, '\u2018': 261, '\u2019': 261,
  '\u201c': 440, '\u201d': 440, '\u2022': 562, '\u2026': 864,
};

export function vectorTextAdvance(text: string) {
  const advance = Array.from(text).reduce((sum, char) => {
    const glyph = asciiAdvance[char.charCodeAt(0) - 32] ?? punctuation[char] ?? 660;
    // The renderer uses tabular numerals. Allow headroom for variable weight and overhang.
    return sum + (/^[0-9]$/.test(char) ? 646 : glyph);
  }, 0);
  return advance * .00104;
}
