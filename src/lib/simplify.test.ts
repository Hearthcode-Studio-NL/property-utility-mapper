import { describe, expect, it } from 'vitest';
import { simplifyPath } from './simplify';
import type { Coord } from './snap';

describe('simplifyPath', () => {
  it('returns the input unchanged when there are fewer than 3 points', () => {
    expect(simplifyPath([], 1)).toEqual([]);
    expect(simplifyPath([[0, 0]], 1)).toEqual([[0, 0]]);
    expect(simplifyPath([[0, 0], [0, 0.001]], 1)).toEqual([[0, 0], [0, 0.001]]);
  });

  it('drops collinear middle points', () => {
    const input: Coord[] = [
      [0, 0],
      [0, 0.001],
      [0, 0.002],
    ];
    expect(simplifyPath(input, 1)).toEqual([
      [0, 0],
      [0, 0.002],
    ]);
  });

  it('keeps a middle point when its perpendicular deviation exceeds tolerance', () => {
    // Endpoints form an east-west line at the equator (cos(lat)=1).
    // Middle is offset ~11m north of the straight line.
    const input: Coord[] = [
      [0, 0],
      [0.0001, 0.005],
      [0, 0.01],
    ];
    expect(simplifyPath(input, 5)).toEqual(input);
  });

  it('drops a middle point when its deviation is smaller than tolerance', () => {
    const input: Coord[] = [
      [0, 0],
      [0.0001, 0.005],
      [0, 0.01],
    ];
    expect(simplifyPath(input, 20)).toEqual([
      [0, 0],
      [0, 0.01],
    ]);
  });

  it('simplifies a low-amplitude zigzag down to its endpoints at a large tolerance', () => {
    const input: Coord[] = [
      [0, 0],
      [0.00005, 0.0001],
      [-0.00005, 0.0002],
      [0.00005, 0.0003],
      [0, 0.0004],
    ];
    expect(simplifyPath(input, 50)).toEqual([
      [0, 0],
      [0, 0.0004],
    ]);
  });

  it('preserves endpoints and returns a new array (does not mutate input)', () => {
    const input: Coord[] = [
      [0, 0],
      [0, 0.001],
      [0, 0.002],
    ];
    const out = simplifyPath(input, 1);
    expect(out).not.toBe(input);
    expect(out[0]).toEqual(input[0]);
    expect(out[out.length - 1]).toEqual(input[input.length - 1]);
  });
});
