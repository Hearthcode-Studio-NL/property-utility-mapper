import { describe, expect, it } from 'vitest';
import { findSnapTarget, type Coord, type ToPixel } from './snap';

// Projection: map [lat, lng] -> pixel space with 1 unit = 1 px.
// lat maps to y, lng maps to x. Signs don't matter for distance math.
const simpleProjection: ToPixel = ([lat, lng]) => ({ x: lng, y: lat });

describe('findSnapTarget', () => {
  it('returns null when the candidate list is empty', () => {
    expect(findSnapTarget([0, 0], [], simpleProjection, 10)).toBeNull();
  });

  it('returns null when no candidate is within the threshold', () => {
    const target: Coord = [0, 0];
    const candidates: Coord[] = [[20, 0], [0, 20], [50, 50]];
    expect(findSnapTarget(target, candidates, simpleProjection, 10)).toBeNull();
  });

  it('returns the candidate when one lies within the threshold', () => {
    const target: Coord = [0, 0];
    const candidates: Coord[] = [[3, 4]]; // exactly 5 px away
    expect(findSnapTarget(target, candidates, simpleProjection, 10)).toEqual([3, 4]);
  });

  it('returns the CLOSEST candidate when multiple are within the threshold', () => {
    const target: Coord = [0, 0];
    const near: Coord = [1, 1]; // ~1.41 px
    const farInsideThreshold: Coord = [6, 6]; // ~8.49 px
    expect(
      findSnapTarget(target, [farInsideThreshold, near], simpleProjection, 10),
    ).toEqual(near);
  });

  it('respects a custom threshold', () => {
    const target: Coord = [0, 0];
    const candidate: Coord = [8, 0]; // 8 px away
    expect(findSnapTarget(target, [candidate], simpleProjection, 5)).toBeNull();
    expect(findSnapTarget(target, [candidate], simpleProjection, 10)).toEqual(candidate);
  });

  it('uses pixel-space distance, not lat/lng distance', () => {
    // Projection that magnifies x by 100: distant in lng, close in pixels.
    const magnified: ToPixel = ([lat, lng]) => ({ x: lng * 100, y: lat });
    const target: Coord = [0, 0];
    const candidate: Coord = [0, 0.05]; // 5 px away in projected space
    expect(findSnapTarget(target, [candidate], magnified, 10)).toEqual(candidate);
  });
});
