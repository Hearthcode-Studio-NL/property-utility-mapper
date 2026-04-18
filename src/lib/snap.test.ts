import { describe, expect, it } from 'vitest';
import {
  findBestSnap,
  findClosestSegmentPoint,
  findSnapTarget,
  verticesToSegments,
  type Coord,
  type Segment,
  type ToPixel,
} from './snap';

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

describe('findClosestSegmentPoint (v2.3.7)', () => {
  it('returns null when no segments are supplied', () => {
    expect(findClosestSegmentPoint([0, 0], [], simpleProjection, 12)).toBeNull();
  });

  it('snaps to the perpendicular foot when pxDistance < threshold', () => {
    // Segment runs horizontally from (y=0,x=0) to (y=0,x=100) in pixel space.
    // Target 5 px above the midpoint should snap to (0, 50).
    const segments: Segment[] = [{ a: [0, 0], b: [0, 100] }];
    const hit = findClosestSegmentPoint([5, 50], segments, simpleProjection, 12);
    expect(hit).not.toBeNull();
    expect(hit!.point[0]).toBeCloseTo(0, 10);
    expect(hit!.point[1]).toBeCloseTo(50, 10);
    expect(hit!.pxDistance).toBeCloseTo(5, 10);
  });

  it('returns null when the perpendicular distance is at or beyond the threshold', () => {
    const segments: Segment[] = [{ a: [0, 0], b: [0, 100] }];
    // 12 px away — threshold is strict '>' so exactly-at-threshold still snaps,
    // but 13 px definitely doesn't.
    expect(
      findClosestSegmentPoint([13, 50], segments, simpleProjection, 12),
    ).toBeNull();
  });

  it("returns null when the foot falls beyond the segment's endpoints", () => {
    // Segment from (0,0) to (0,10). Target at x=20 projects to t > 1.
    const segments: Segment[] = [{ a: [0, 0], b: [0, 10] }];
    expect(
      findClosestSegmentPoint([1, 20], segments, simpleProjection, 12),
    ).toBeNull();
    // Target at x=-5 projects to t < 0.
    expect(
      findClosestSegmentPoint([1, -5], segments, simpleProjection, 12),
    ).toBeNull();
  });

  it('picks the closest segment when multiple are within threshold', () => {
    // Two parallel horizontal segments. Target is 2 px from the first,
    // 8 px from the second.
    const segments: Segment[] = [
      { a: [0, 0], b: [0, 100] }, // closer
      { a: [10, 0], b: [10, 100] }, // farther
    ];
    const hit = findClosestSegmentPoint([2, 50], segments, simpleProjection, 12);
    expect(hit).not.toBeNull();
    expect(hit!.point[0]).toBeCloseTo(0, 10);
    expect(hit!.pxDistance).toBeCloseTo(2, 10);
  });

  it('ignores degenerate zero-length segments', () => {
    const segments: Segment[] = [{ a: [0, 0], b: [0, 0] }];
    expect(
      findClosestSegmentPoint([1, 1], segments, simpleProjection, 12),
    ).toBeNull();
  });

  it('interpolates the foot lat/lng linearly at the pixel-space parameter', () => {
    // Diagonal segment from (0,0) to (10,10). Target (6,4) should project
    // to t = 0.5 in pixel space — foot at (5,5).
    const segments: Segment[] = [{ a: [0, 0], b: [10, 10] }];
    const hit = findClosestSegmentPoint([6, 4], segments, simpleProjection, 12);
    expect(hit).not.toBeNull();
    expect(hit!.point[0]).toBeCloseTo(5, 10);
    expect(hit!.point[1]).toBeCloseTo(5, 10);
  });
});

describe('findBestSnap (v2.3.7)', () => {
  it('returns null when nothing is within threshold', () => {
    expect(findBestSnap([0, 0], [], [], simpleProjection, 12)).toBeNull();
  });

  it('prefers a vertex match when both a vertex and a segment are in range', () => {
    // Vertex is 5 px away; segment foot is 2 px away. Vertex still wins.
    const vertices: Coord[] = [[0, 5]]; // 5 px from [0,0]
    const segments: Segment[] = [{ a: [2, 0], b: [2, 100] }]; // foot 2 px from [0,50]
    // Target near both: at [0,5] a vertex is right there, at [2,0] the seg foot wins.
    // To test tie-breaking we need both in range of the SAME target.
    const target: Coord = [0, 5];
    // Vertex at [0,5] is 0 px away; segment foot (0, 5) from [2,0]-[2,100] is
    // 2 px away. Vertex wins.
    expect(findBestSnap(target, vertices, segments, simpleProjection, 12)).toEqual([
      0, 5,
    ]);
  });

  it('falls back to a segment snap when no vertex is in range', () => {
    const vertices: Coord[] = [[50, 50]]; // far away
    const segments: Segment[] = [{ a: [0, 0], b: [0, 100] }];
    const hit = findBestSnap([3, 40], vertices, segments, simpleProjection, 12);
    expect(hit).not.toBeNull();
    expect(hit![0]).toBeCloseTo(0, 10);
    expect(hit![1]).toBeCloseTo(40, 10);
  });

  it('honours the self-exclusion contract: callers filter out own geometry', () => {
    // Simulate an edit session where the edited line has vertices [[0,0],[0,10]].
    // The filtered candidate lists (what Property.tsx will compute) contain
    // only OTHER lines — so the edited line's own segment can't snap to itself.
    const vertices: Coord[] = []; // edited line excluded
    const segments: Segment[] = []; // edited line excluded
    expect(
      findBestSnap([0, 5], vertices, segments, simpleProjection, 12),
    ).toBeNull();
  });
});

describe('verticesToSegments (v2.3.7)', () => {
  it('returns an empty array when there are fewer than 2 vertices', () => {
    expect(verticesToSegments([])).toEqual([]);
    expect(verticesToSegments([[1, 2]])).toEqual([]);
  });

  it('emits one segment per adjacent pair', () => {
    const segs = verticesToSegments([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
    expect(segs).toEqual([
      { a: [0, 0], b: [1, 1] },
      { a: [1, 1], b: [2, 2] },
      { a: [2, 2], b: [3, 3] },
    ]);
  });
});
