import { describe, expect, it } from 'vitest';
import { LINE_THICKNESSES, type LineThickness } from '@/types';
import { LINE_THICKNESS_LABEL_NL, LINE_WIDTH } from './lineThickness';

describe('LINE_WIDTH preset map', () => {
  it('covers every LineThickness enum value with fill + casing numbers', () => {
    for (const t of LINE_THICKNESSES) {
      const entry = LINE_WIDTH[t];
      expect(typeof entry.fill).toBe('number');
      expect(typeof entry.casing).toBe('number');
      expect(entry.fill).toBeGreaterThan(0);
      expect(entry.casing).toBeGreaterThan(entry.fill);
    }
  });

  it('keeps the casing ~3 px wider than the fill at every preset (1.5 px halo on each side)', () => {
    for (const t of LINE_THICKNESSES) {
      const { fill, casing } = LINE_WIDTH[t];
      expect(casing - fill).toBe(3);
    }
  });

  it('is monotonic: dun < normaal < dik for fill AND casing', () => {
    const fills = (['dun', 'normaal', 'dik'] as LineThickness[]).map(
      (t) => LINE_WIDTH[t].fill,
    );
    expect(fills[0]).toBeLessThan(fills[1]);
    expect(fills[1]).toBeLessThan(fills[2]);
    const casings = (['dun', 'normaal', 'dik'] as LineThickness[]).map(
      (t) => LINE_WIDTH[t].casing,
    );
    expect(casings[0]).toBeLessThan(casings[1]);
    expect(casings[1]).toBeLessThan(casings[2]);
  });
});

describe('LINE_THICKNESS_LABEL_NL', () => {
  it('has a Dutch label for every enum value', () => {
    for (const t of LINE_THICKNESSES) {
      const label = LINE_THICKNESS_LABEL_NL[t];
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
