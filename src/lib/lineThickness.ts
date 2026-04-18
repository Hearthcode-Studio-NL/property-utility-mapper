import type { LineThickness } from '@/types';

/**
 * Pixel widths per thickness preset (v2.3.1). `fill` is the coloured
 * stroke the user sees; `casing` is the dark outline rendered BENEATH
 * it (see CLAUDE.md for the v2.1.4 casing rationale). Each preset keeps
 * the same 1.5 px halo on each side of the fill so the outline stays
 * visually consistent regardless of thickness.
 */
export const LINE_WIDTH: Record<
  LineThickness,
  { fill: number; casing: number }
> = {
  dun: { fill: 2, casing: 5 },
  normaal: { fill: 4, casing: 7 },
  dik: { fill: 6, casing: 9 },
};

/** Dutch labels for the RadioGroup in the attribute modal. */
export const LINE_THICKNESS_LABEL_NL: Record<LineThickness, string> = {
  dun: 'Dun',
  normaal: 'Normaal',
  dik: 'Dik',
};
