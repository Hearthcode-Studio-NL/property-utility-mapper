import { describe, expect, it } from 'vitest';
import { buildGeoJson } from './geojson';
import type { Property, UtilityLine } from '../../types';

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'prop-1',
    street: 'Herengracht',
    houseNumber: '1',
    city: 'Amsterdam',
    postcode: '1015 BA',
    country: 'Nederland',
    fullAddress: 'Herengracht 1, 1015 BA Amsterdam, Noord-Holland, Nederland',
    centerLat: 52.3676,
    centerLng: 4.9041,
    notes: null,
    coverPhotoId: null,
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-04-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeLine(): UtilityLine {
  return {
    id: 'line-1',
    propertyId: 'prop-1',
    type: 'water',
    vertices: [
      [52.3676, 4.9041],
      [52.3677, 4.9042],
    ],
    thickness: 'normaal',
    photoIds: [],
    createdAt: '2026-04-01T10:05:00.000Z',
    updatedAt: '2026-04-01T10:05:00.000Z',
  };
}

function propertyFeature(fc: ReturnType<typeof buildGeoJson>) {
  return fc.features.find((f) => f.properties?.kind === 'property')!;
}

describe('buildGeoJson (v2.2.1 notes + cover)', () => {
  it('includes notes when present', () => {
    const fc = buildGeoJson(
      makeProperty({ notes: 'Sleutel onder de mat' }),
      [makeLine()],
    );
    const p = propertyFeature(fc);
    expect(p.properties.notes).toBe('Sleutel onder de mat');
  });

  it('omits the notes key when notes is null', () => {
    const fc = buildGeoJson(makeProperty({ notes: null }), [makeLine()]);
    const p = propertyFeature(fc);
    expect('notes' in p.properties).toBe(false);
  });

  it('omits the notes key when notes is an empty string', () => {
    const fc = buildGeoJson(makeProperty({ notes: '' }), [makeLine()]);
    const p = propertyFeature(fc);
    expect('notes' in p.properties).toBe(false);
  });

  it('exposes hasCoverPhoto as a boolean presence flag — never embeds photo data', () => {
    const withCover = buildGeoJson(
      makeProperty({ coverPhotoId: 'photo-xyz' }),
      [makeLine()],
    );
    expect(propertyFeature(withCover).properties.hasCoverPhoto).toBe(true);
    // No photo blob / id leaks into the exported JSON.
    expect(propertyFeature(withCover).properties).not.toHaveProperty('coverPhotoId');
    expect(propertyFeature(withCover).properties).not.toHaveProperty('coverBlob');

    const without = buildGeoJson(makeProperty({ coverPhotoId: null }), [
      makeLine(),
    ]);
    expect(propertyFeature(without).properties.hasCoverPhoto).toBe(false);
  });
});
