export type Coord = [number, number];
export type ToPixel = (p: Coord) => { x: number; y: number };

export const DEFAULT_SNAP_THRESHOLD_PX = 12;

/**
 * A single line segment between two lat/lng endpoints. Consumers flatten
 * lines into Segments before calling findClosestSegmentPoint — typically
 * `line.vertices` pairs (v[i], v[i+1]) for i in 0..n-2.
 */
export interface Segment {
  a: Coord;
  b: Coord;
}

/**
 * Result of a segment snap. `point` is the lat/lng that lies on the
 * segment (its perpendicular foot from the target); `pxDistance` is the
 * on-screen pixel distance between the target and that foot. Callers
 * comparing across segments can pick the closest, or combine with a
 * vertex snap and pick the winner by precedence (vertex wins ties).
 */
export interface SegmentSnapHit {
  point: Coord;
  pxDistance: number;
}

/**
 * Pixel-distance snap to an existing vertex. Returns the matched
 * candidate (nearest within threshold) or null.
 */
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

/**
 * Perpendicular snap to the closest segment whose foot lies within the
 * segment's extent AND within the pixel threshold. Returns the foot as a
 * lat/lng (linearly interpolated at the pixel-space parameter `t`, which
 * is accurate to sub-metre at typical Dutch-property zooms — much better
 * than the GPS noise floor we're already handling).
 *
 * `null` when:
 *   - no segments are within threshold, OR
 *   - the closest foot would fall beyond the segment (t < 0 or t > 1),
 *     in which case the caller's vertex-snap may still catch the endpoint.
 */
export function findClosestSegmentPoint(
  target: Coord,
  segments: Segment[],
  toPixel: ToPixel,
  thresholdPx: number = DEFAULT_SNAP_THRESHOLD_PX,
): SegmentSnapHit | null {
  const targetPx = toPixel(target);
  let best: SegmentSnapHit | null = null;
  for (const seg of segments) {
    const ap = toPixel(seg.a);
    const bp = toPixel(seg.b);
    const dx = bp.x - ap.x;
    const dy = bp.y - ap.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue; // degenerate segment — vertex snap handles the point
    const t = ((targetPx.x - ap.x) * dx + (targetPx.y - ap.y) * dy) / lenSq;
    if (t < 0 || t > 1) continue; // foot outside the segment extent
    const footPx = { x: ap.x + t * dx, y: ap.y + t * dy };
    const ddx = footPx.x - targetPx.x;
    const ddy = footPx.y - targetPx.y;
    const pxDistance = Math.sqrt(ddx * ddx + ddy * ddy);
    if (pxDistance > thresholdPx) continue;
    const point: Coord = [
      seg.a[0] + t * (seg.b[0] - seg.a[0]),
      seg.a[1] + t * (seg.b[1] - seg.a[1]),
    ];
    if (!best || pxDistance < best.pxDistance) {
      best = { point, pxDistance };
    }
  }
  return best;
}

/**
 * Composite snap. Runs vertex snap first; if a vertex is within
 * threshold it wins — even when a segment foot is technically closer
 * in pixel space. Falls back to segment snap. Returns the chosen snap
 * lat/lng or null if nothing is within threshold.
 *
 * This is the single entry point drawing / editing call-sites use.
 * `vertexCandidates` and `segments` must come from the same scope
 * (same property, and when editing a line exclude that line's own
 * vertices AND segments).
 */
export function findBestSnap(
  target: Coord,
  vertexCandidates: Coord[],
  segments: Segment[],
  toPixel: ToPixel,
  thresholdPx: number = DEFAULT_SNAP_THRESHOLD_PX,
): Coord | null {
  const vertex = findSnapTarget(target, vertexCandidates, toPixel, thresholdPx);
  if (vertex) return vertex;
  const seg = findClosestSegmentPoint(target, segments, toPixel, thresholdPx);
  return seg?.point ?? null;
}

/**
 * Flatten a list of polyline vertex-arrays into Segments. Lines with
 * fewer than 2 vertices contribute nothing.
 */
export function verticesToSegments(vertices: Coord[]): Segment[] {
  if (vertices.length < 2) return [];
  const out: Segment[] = [];
  for (let i = 1; i < vertices.length; i++) {
    out.push({ a: vertices[i - 1]!, b: vertices[i]! });
  }
  return out;
}
