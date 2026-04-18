import { describe, expect, it } from 'vitest';
import { formatMeters, haversineMeters, pathLengthMeters } from './distance';

describe('haversineMeters', () => {
  it('returns 0 for two identical points', () => {
    expect(haversineMeters([52.37, 4.89], [52.37, 4.89])).toBe(0);
  });

  it('0.01° longitude at ~52° N is close to 686 m', () => {
    // At latitude 52° N, 1° longitude spans R × cos(52°) ≈ 6371 × 0.616
    // ≈ 3923 km, so 0.01° ≈ 686 m. Same-latitude endpoints make the
    // expectation tractable without a third-party tool.
    const d = haversineMeters([52.0, 4.9], [52.0, 4.91]);
    expect(d).toBeGreaterThan(683);
    expect(d).toBeLessThan(690);
  });

  it('scales roughly linearly for small offsets — 0.001° at NL latitude is close to 111 m in latitude', () => {
    // One degree of latitude ≈ 111 km; 0.001° ≈ 111 m.
    const d = haversineMeters([52.0, 4.9], [52.001, 4.9]);
    expect(d).toBeGreaterThan(108);
    expect(d).toBeLessThan(114);
  });
});

describe('pathLengthMeters', () => {
  it('empty or single-point path is 0 (degenerate case)', () => {
    expect(pathLengthMeters([])).toBe(0);
    expect(pathLengthMeters([[52.37, 4.89]])).toBe(0);
  });

  it('2-point path equals the haversine distance of the single segment', () => {
    const a: [number, number] = [52.3791, 4.9003];
    const b: [number, number] = [52.3731, 4.8926];
    expect(pathLengthMeters([a, b])).toBeCloseTo(haversineMeters(a, b), 6);
  });

  it('3+ point path sums every segment', () => {
    const a: [number, number] = [52.0, 4.9];
    const b: [number, number] = [52.001, 4.9]; // ~111 m north of a
    const c: [number, number] = [52.001, 4.9015]; // ~100 m east of b at this lat
    const direct = haversineMeters(a, b) + haversineMeters(b, c);
    expect(pathLengthMeters([a, b, c])).toBeCloseTo(direct, 6);
    // And it's strictly larger than the straight line a→c.
    expect(pathLengthMeters([a, b, c])).toBeGreaterThan(haversineMeters(a, c));
  });
});

describe('formatMeters (Dutch)', () => {
  it.each([
    [0, '0,0 m'],
    [0.5, '0,5 m'],
    [0.05, '0,1 m'], // one-decimal rounding is deliberate
    [1, '1 m'],
    [12, '12 m'],
    [234, '234 m'],
    [999, '999 m'],
    [1000, '1,0 km'],
    [1234, '1,2 km'],
    [12345, '12,3 km'],
  ])('formats %d m as "%s"', (input, expected) => {
    expect(formatMeters(input)).toBe(expected);
  });

  it('never uses a dot as the decimal separator', () => {
    for (const v of [0.5, 123.456, 1234, 12345]) {
      const out = formatMeters(v);
      expect(out).not.toMatch(/\./);
    }
  });

  it('guards against NaN / negative input', () => {
    expect(formatMeters(Number.NaN)).toBe('0 m');
    expect(formatMeters(-5)).toBe('0 m');
  });
});
