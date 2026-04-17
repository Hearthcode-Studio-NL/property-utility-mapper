import type { Coord } from './snap';

interface ProjectedPoint {
  x: number;
  y: number;
}

const METERS_PER_DEG_LAT = 111_132;
const METERS_PER_DEG_LNG_EQUATOR = 111_320;

export function simplifyPath(points: Coord[], toleranceMeters: number): Coord[] {
  if (points.length <= 2) return points.slice();
  if (toleranceMeters <= 0) return points.slice();

  const latRad = (points[0][0] * Math.PI) / 180;
  const metersPerDegLng = METERS_PER_DEG_LNG_EQUATOR * Math.cos(latRad);
  const projected: ProjectedPoint[] = points.map(([lat, lng]) => ({
    x: lng * metersPerDegLng,
    y: lat * METERS_PER_DEG_LAT,
  }));

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  simplifyRange(projected, 0, projected.length - 1, toleranceMeters, keep);

  const result: Coord[] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

function simplifyRange(
  pts: ProjectedPoint[],
  start: number,
  end: number,
  tol: number,
  keep: boolean[],
): void {
  if (end <= start + 1) return;
  let maxDist = 0;
  let maxIndex = start;
  for (let i = start + 1; i < end; i++) {
    const d = perpendicularDistance(pts[i], pts[start], pts[end]);
    if (d > maxDist) {
      maxDist = d;
      maxIndex = i;
    }
  }
  if (maxDist > tol) {
    keep[maxIndex] = true;
    simplifyRange(pts, start, maxIndex, tol, keep);
    simplifyRange(pts, maxIndex, end, tol, keep);
  }
}

function perpendicularDistance(
  p: ProjectedPoint,
  a: ProjectedPoint,
  b: ProjectedPoint,
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    const px = p.x - a.x;
    const py = p.y - a.y;
    return Math.sqrt(px * px + py * py);
  }
  // |dy·p.x - dx·p.y + b.x·a.y - b.y·a.x| / |AB|
  return (
    Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / Math.sqrt(lengthSq)
  );
}
