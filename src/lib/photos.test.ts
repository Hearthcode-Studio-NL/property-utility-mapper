import { describe, expect, it } from 'vitest';
import {
  computeResizeTarget,
  FULL_MAX_EDGE,
  FULL_QUALITY,
  THUMBNAIL_MAX_EDGE,
  THUMBNAIL_QUALITY,
} from './photos';

describe('computeResizeTarget', () => {
  it('leaves images smaller than the limit untouched', () => {
    expect(computeResizeTarget(800, 600, 1920)).toEqual({ width: 800, height: 600 });
    expect(computeResizeTarget(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 });
  });

  it('scales landscape images by longest edge', () => {
    expect(computeResizeTarget(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 });
  });

  it('scales portrait images by longest edge', () => {
    expect(computeResizeTarget(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 });
  });

  it('scales to the thumbnail limit', () => {
    expect(computeResizeTarget(4000, 3000, 256)).toEqual({ width: 256, height: 192 });
  });

  it('never returns dimensions below 1 px for extreme aspect ratios', () => {
    expect(computeResizeTarget(10_000, 1, 256)).toEqual({ width: 256, height: 1 });
  });

  it('preserves a square image proportionally', () => {
    expect(computeResizeTarget(2048, 2048, 1024)).toEqual({ width: 1024, height: 1024 });
  });
});

// resizeImageToBlob / resizeFull / generateThumbnail use createImageBitmap
// + Canvas.toBlob, which jsdom cannot drive — so the encoded-blob path is
// verified manually in the browser. Here we only sanity-check the exported
// constants that determine full vs. thumbnail sizing.
describe('resize constants', () => {
  it('thumbnail is smaller and lower-quality than full', () => {
    expect(THUMBNAIL_MAX_EDGE).toBeLessThan(FULL_MAX_EDGE);
    expect(THUMBNAIL_QUALITY).toBeLessThan(FULL_QUALITY);
  });
});
