export type Coord = [number, number];
export type ToPixel = (p: Coord) => { x: number; y: number };

export const DEFAULT_SNAP_THRESHOLD_PX = 12;

export function findSnapTarget(
  target: Coord,
  candidates: Coord[],
  toPixel: ToPixel,
  thresholdPx: number = DEFAULT_SNAP_THRESHOLD_PX,
): Coord | null {
  const targetPx = toPixel(target);
  let best: { coord: Coord; distance: number } | null = null;
  for (const candidate of candidates) {
    const px = toPixel(candidate);
    const dx = px.x - targetPx.x;
    const dy = px.y - targetPx.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > thresholdPx) continue;
    if (!best || distance < best.distance) {
      best = { coord: candidate, distance };
    }
  }
  return best?.coord ?? null;
}
