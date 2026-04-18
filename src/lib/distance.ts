export function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function pathLengthMeters(points: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Dutch-localised distance label. The decimal separator is always a
 * comma per NL convention.
 *
 *   < 1 m     → "X,X m" (one decimal — sub-metre precision is rare but
 *                valid for a degenerate draft)
 *   < 1 km    → "N m"   (integer — "234 m" reads more naturally than
 *                "234,0 m" at everyday ground distances)
 *   ≥ 1 km    → "X,X km" (one decimal with comma — "1,2 km")
 */
export function formatMeters(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '0 m';
  if (m < 1) return `${m.toFixed(1).replace('.', ',')} m`;
  if (m < 1_000) return `${Math.round(m)} m`;
  return `${(m / 1_000).toFixed(1).replace('.', ',')} km`;
}
