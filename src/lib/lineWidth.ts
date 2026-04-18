/**
 * Line-casing geometry.
 *
 * Every utility polyline renders as two stacked strokes: a dark casing
 * underneath and the coloured fill on top. To keep the casing halo
 * visually consistent at every thickness we hold a fixed 1.5 px extra
 * on each side — i.e. `casing = fill + 3`. This rule has been in place
 * since v2.1.4; v2.3.5 moved it from a lookup table keyed on an enum to
 * this single helper because thickness is now just a number.
 */
export const CASING_HALO_PX = 3;

export function casingWidth(fill: number): number {
  return fill + CASING_HALO_PX;
}
