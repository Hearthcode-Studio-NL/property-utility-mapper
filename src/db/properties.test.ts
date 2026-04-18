import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './dexie';
import {
  addProperty,
  deleteProperty,
  getProperty,
  listProperties,
  PropertyValidationError,
  type NewPropertyInput,
} from './properties';
import { addUtilityLine } from './utilityLines';
import type { Photo } from '../types';

function makeInput(overrides: Partial<NewPropertyInput> = {}): NewPropertyInput {
  return {
    street: 'Herengracht',
    houseNumber: '1',
    city: 'Amsterdam',
    postcode: '1015 BA',
    country: 'Nederland',
    fullAddress: 'Herengracht 1, 1015 BA Amsterdam, Noord-Holland, Nederland',
    centerLat: 52.3676,
    centerLng: 4.9041,
    ...overrides,
  };
}

async function resetDb() {
  await db.transaction(
    'rw',
    db.properties,
    db.utilityLines,
    db.photos,
    db.klicFiles,
    async () => {
      await db.properties.clear();
      await db.utilityLines.clear();
      await db.photos.clear();
      await db.klicFiles.clear();
    },
  );
}

describe('db/properties', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('addProperty persists structured fields + UUID + ISO timestamps', async () => {
    const created = await addProperty(makeInput());

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.street).toBe('Herengracht');
    expect(created.houseNumber).toBe('1');
    expect(created.city).toBe('Amsterdam');
    expect(created.postcode).toBe('1015 BA');
    expect(created.centerLat).toBe(52.3676);
    expect(created.centerLng).toBe(4.9041);
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(created.updatedAt).toBe(created.createdAt);

    expect(await db.properties.get(created.id)).toEqual(created);
  });

  it('addProperty trims whitespace on the structured fields', async () => {
    const created = await addProperty(
      makeInput({ street: '  Herengracht  ', houseNumber: ' 1 ', city: ' Amsterdam ' }),
    );
    expect(created.street).toBe('Herengracht');
    expect(created.houseNumber).toBe('1');
    expect(created.city).toBe('Amsterdam');
  });

  it.each([
    ['street', { street: '' }],
    ['houseNumber', { houseNumber: '' }],
    ['city', { city: '' }],
    ['street (whitespace)', { street: '   ' }],
    ['houseNumber (whitespace)', { houseNumber: ' ' }],
    ['city (whitespace)', { city: '\t' }],
  ])(
    'rejects a property with missing %s',
    async (_label, overrides) => {
      await expect(addProperty(makeInput(overrides))).rejects.toBeInstanceOf(
        PropertyValidationError,
      );
      expect(await db.properties.toArray()).toHaveLength(0);
    },
  );

  it('rejects a property with non-finite coordinates', async () => {
    await expect(
      addProperty(makeInput({ centerLat: Number.NaN })),
    ).rejects.toBeInstanceOf(PropertyValidationError);
  });

  it('getProperty returns the property by id and undefined when missing', async () => {
    const created = await addProperty(makeInput());
    expect(await getProperty(created.id)).toEqual(created);
    expect(await getProperty('missing-id')).toBeUndefined();
  });

  it('listProperties returns newest first', async () => {
    const first = await addProperty(makeInput({ street: 'First' }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await addProperty(makeInput({ street: 'Second' }));

    const list = await listProperties();
    expect(list.map((p) => p.id)).toEqual([second.id, first.id]);
  });

  it('deleteProperty cascades to utility lines of that property', async () => {
    const kept = await addProperty(makeInput({ street: 'Kept' }));
    const doomed = await addProperty(makeInput({ street: 'Doomed' }));

    await addUtilityLine({
      propertyId: kept.id,
      type: 'water',
      vertices: [
        [1, 2],
        [1.1, 2.1],
      ],
    });
    await addUtilityLine({
      propertyId: doomed.id,
      type: 'gas',
      vertices: [
        [3, 4],
        [3.1, 4.1],
      ],
    });

    await deleteProperty(doomed.id);

    const remainingProps = await db.properties.toArray();
    expect(remainingProps.map((p) => p.id)).toEqual([kept.id]);

    const remainingLines = await db.utilityLines.toArray();
    expect(remainingLines).toHaveLength(1);
    expect(remainingLines[0]?.propertyId).toBe(kept.id);
  });

  it('deleteProperty cascades to photos of every line of that property', async () => {
    const doomed = await addProperty(makeInput({ street: 'WithPhotos' }));
    const line = await addUtilityLine({
      propertyId: doomed.id,
      type: 'water',
      vertices: [
        [1, 2],
        [1.1, 2.1],
      ],
    });
    // Seed photos directly so we don't need to pull in the real image
    // resize / encode pipeline — this suite tests the cascade only.
    const photo: Photo = {
      id: 'photo-1',
      lineId: line.id,
      blob: new Blob(['raw'], { type: 'image/jpeg' }),
      thumbnailBlob: new Blob(['thumb'], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    };
    await db.photos.add(photo);
    await db.utilityLines.update(line.id, { photoIds: [photo.id] });

    await deleteProperty(doomed.id);

    expect(await db.properties.toArray()).toHaveLength(0);
    expect(await db.utilityLines.toArray()).toHaveLength(0);
    expect(await db.photos.toArray()).toHaveLength(0);
  });

  it('deleteProperty cascades to klicFiles tied to the property', async () => {
    const doomed = await addProperty(makeInput({ street: 'WithKlic' }));
    await db.klicFiles.add({
      id: 'klic-1',
      propertyId: doomed.id,
      filename: 'k.pdf',
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      uploadedAt: new Date().toISOString(),
    });

    await deleteProperty(doomed.id);

    expect(await db.klicFiles.toArray()).toHaveLength(0);
  });

  it('deleteProperty for a missing id is a no-op', async () => {
    const kept = await addProperty(makeInput({ street: 'Survivor' }));
    await expect(deleteProperty('does-not-exist')).resolves.toBeUndefined();
    expect(await db.properties.toArray()).toHaveLength(1);
    expect(await db.properties.toArray()).toEqual([kept]);
  });

  it('deleteProperty rolls the transaction back if any step fails — no orphans', async () => {
    const doomed = await addProperty(makeInput({ street: 'RollsBack' }));
    const line = await addUtilityLine({
      propertyId: doomed.id,
      type: 'water',
      vertices: [
        [1, 2],
        [1.1, 2.1],
      ],
    });
    // Seed a photo so the cascade has something to delete before the
    // sabotaged step runs. If rollback works, the photo must still exist
    // after the failed deleteProperty call.
    await db.photos.add({
      id: 'photo-rollback',
      lineId: line.id,
      blob: new Blob(['raw'], { type: 'image/jpeg' }),
      thumbnailBlob: new Blob(['thumb'], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    });
    await db.utilityLines.update(line.id, { photoIds: ['photo-rollback'] });

    // Sabotage: make the klicFiles.where(...) call throw. deleteProperty
    // invokes that after photos + lines have already been touched. Dexie
    // aborts the transaction on an uncaught throw inside the callback,
    // which reverts every prior op in the same transaction.
    const whereSpy = vi.spyOn(db.klicFiles, 'where').mockImplementationOnce(() => {
      throw new Error('Simulated IDB failure mid-transaction');
    });

    await expect(deleteProperty(doomed.id)).rejects.toThrow(
      /Simulated IDB failure/,
    );
    whereSpy.mockRestore();

    // Nothing orphaned — everything we had before the call is still there.
    expect(await db.properties.toArray()).toHaveLength(1);
    expect(await db.utilityLines.toArray()).toHaveLength(1);
    expect(await db.photos.toArray()).toHaveLength(1);
  });
});
