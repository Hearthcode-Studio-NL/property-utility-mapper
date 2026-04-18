import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './dexie';
import {
  addProperty,
  CoverPhotoNotFoundError,
  deleteProperty,
  duplicateProperty,
  getProperty,
  listProperties,
  PropertyValidationError,
  updateProperty,
  type NewPropertyInput,
} from './properties';
import { addUtilityLine, listLinesForProperty } from './utilityLines';
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

  it('addProperty initialises notes and coverPhotoId to null (v2.2.1 defaults)', async () => {
    const created = await addProperty(makeInput());
    expect(created.notes).toBeNull();
    expect(created.coverPhotoId).toBeNull();
    const stored = await db.properties.get(created.id);
    expect(stored?.notes).toBeNull();
    expect(stored?.coverPhotoId).toBeNull();
  });

  it('updateProperty patches notes and bumps updatedAt', async () => {
    const original = await addProperty(makeInput());
    await new Promise((r) => setTimeout(r, 2));

    const updated = await updateProperty(original.id, {
      notes: 'Sleutel onder de mat achter',
    });

    expect(updated.notes).toBe('Sleutel onder de mat achter');
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt > original.updatedAt).toBe(true);
    expect((await db.properties.get(original.id))?.notes).toBe(
      'Sleutel onder de mat achter',
    );
  });

  it('updateProperty accepts coverPhotoId when the photo exists', async () => {
    const property = await addProperty(makeInput());
    const line = await addUtilityLine({
      propertyId: property.id,
      type: 'water',
      vertices: [
        [1, 2],
        [1.1, 2.1],
      ],
    });
    await db.photos.add({
      id: 'photo-valid',
      lineId: line.id,
      blob: new Blob(['b']),
      thumbnailBlob: new Blob(['t']),
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    });

    const updated = await updateProperty(property.id, {
      coverPhotoId: 'photo-valid',
    });
    expect(updated.coverPhotoId).toBe('photo-valid');
  });

  it('updateProperty rejects a coverPhotoId that does not reference an existing photo', async () => {
    const property = await addProperty(makeInput());
    await expect(
      updateProperty(property.id, { coverPhotoId: 'nope-not-a-real-photo' }),
    ).rejects.toBeInstanceOf(CoverPhotoNotFoundError);
    // The property wasn't partially updated either.
    expect((await db.properties.get(property.id))?.coverPhotoId).toBeNull();
  });

  it('updateProperty accepts coverPhotoId: null to clear a prior cover', async () => {
    const property = await addProperty(makeInput());
    const line = await addUtilityLine({
      propertyId: property.id,
      type: 'water',
      vertices: [
        [1, 2],
        [1.1, 2.1],
      ],
    });
    await db.photos.add({
      id: 'photo-keep',
      lineId: line.id,
      blob: new Blob(['b']),
      thumbnailBlob: new Blob(['t']),
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
    });
    await updateProperty(property.id, { coverPhotoId: 'photo-keep' });
    const cleared = await updateProperty(property.id, { coverPhotoId: null });
    expect(cleared.coverPhotoId).toBeNull();
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

  describe('duplicateProperty', () => {
    it('creates a new property with a new id, fresh timestamps, and the supplied fullAddress label', async () => {
      const source = await addProperty(makeInput({ street: 'Original' }));
      await new Promise((r) => setTimeout(r, 2));

      const copy = await duplicateProperty(source.id, 'Copied label (kopie)');

      expect(copy.id).not.toBe(source.id);
      expect(copy.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(copy.fullAddress).toBe('Copied label (kopie)');
      expect(copy.createdAt > source.createdAt).toBe(true);
      expect(copy.updatedAt).toBe(copy.createdAt);
      // Structured fields + coords carry over from the source — the
      // single-field dialog only sets fullAddress. (See the v2.2.2
      // commit message + CLAUDE.md for the trade-off.)
      expect(copy.street).toBe(source.street);
      expect(copy.houseNumber).toBe(source.houseNumber);
      expect(copy.city).toBe(source.city);
      expect(copy.centerLat).toBe(source.centerLat);
      expect(copy.centerLng).toBe(source.centerLng);
    });

    it('clones every utility line with a NEW id and the new property as parent', async () => {
      const source = await addProperty(makeInput({ street: 'WithLines' }));
      const line1 = await addUtilityLine({
        propertyId: source.id,
        type: 'water',
        vertices: [
          [1, 2],
          [1.1, 2.1],
        ],
      });
      const line2 = await addUtilityLine({
        propertyId: source.id,
        type: 'gas',
        vertices: [
          [3, 4],
          [3.1, 4.1],
        ],
      });

      const copy = await duplicateProperty(source.id, 'Nieuwe straat 99');
      const clonedLines = await listLinesForProperty(copy.id);

      expect(clonedLines).toHaveLength(2);
      // Every cloned line has a fresh id + points at the new property.
      for (const cl of clonedLines) {
        expect(cl.id).not.toBe(line1.id);
        expect(cl.id).not.toBe(line2.id);
        expect(cl.propertyId).toBe(copy.id);
        expect(cl.photoIds).toEqual([]);
      }
      // Geometry + type + attributes preserved across the clone.
      const originalTypes = [line1.type, line2.type].sort();
      const clonedTypes = clonedLines.map((l) => l.type).sort();
      expect(clonedTypes).toEqual(originalTypes);

      // Original's lines still untouched.
      const originalLines = await listLinesForProperty(source.id);
      expect(originalLines.map((l) => l.id).sort()).toEqual(
        [line1.id, line2.id].sort(),
      );
    });

    it('does NOT copy photos — photo table count is unchanged after duplicate', async () => {
      const source = await addProperty(makeInput({ street: 'WithPhotos' }));
      const line = await addUtilityLine({
        propertyId: source.id,
        type: 'water',
        vertices: [
          [1, 2],
          [1.1, 2.1],
        ],
      });
      const photo: Photo = {
        id: 'photo-only-on-original',
        lineId: line.id,
        blob: new Blob(['raw']),
        thumbnailBlob: new Blob(['thumb']),
        mimeType: 'image/jpeg',
        createdAt: new Date().toISOString(),
      };
      await db.photos.add(photo);
      await db.utilityLines.update(line.id, { photoIds: [photo.id] });

      const photoCountBefore = await db.photos.count();
      await duplicateProperty(source.id, 'Geen fotos hier (kopie)');
      expect(await db.photos.count()).toBe(photoCountBefore);

      // Photo stays bound to the ORIGINAL line, not the cloned one.
      const remaining = await db.photos.toArray();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.lineId).toBe(line.id);
    });

    it('resets notes and coverPhotoId on the new property', async () => {
      const source = await addProperty(makeInput({ street: 'Memorable' }));
      // Seed source notes + a cover (via direct writes — update() bypasses
      // the coverPhotoId validation so we can exercise a "had a cover"
      // source without needing a whole line + photo for this test).
      await db.properties.update(source.id, {
        notes: 'Sleutel achter de vuilnisbak',
        coverPhotoId: 'some-photo-id-on-source',
      });

      const copy = await duplicateProperty(source.id, 'Tweede locatie');

      expect(copy.notes).toBeNull();
      expect(copy.coverPhotoId).toBeNull();
    });

    it('rejects an empty or whitespace-only label and persists nothing', async () => {
      const source = await addProperty(makeInput({ street: 'NoEmpty' }));
      const beforePropertyCount = (await db.properties.toArray()).length;
      const beforeLineCount = (await db.utilityLines.toArray()).length;

      await expect(duplicateProperty(source.id, '')).rejects.toBeInstanceOf(
        PropertyValidationError,
      );
      await expect(duplicateProperty(source.id, '   ')).rejects.toBeInstanceOf(
        PropertyValidationError,
      );

      expect((await db.properties.toArray()).length).toBe(beforePropertyCount);
      expect((await db.utilityLines.toArray()).length).toBe(beforeLineCount);
    });

    it('throws if the source property does not exist', async () => {
      await expect(
        duplicateProperty('does-not-exist', 'Foo (kopie)'),
      ).rejects.toThrow(/not found/i);
    });

    it('rolls the whole transaction back if a line insert fails — no orphan property', async () => {
      const source = await addProperty(makeInput({ street: 'RollsBack' }));
      await addUtilityLine({
        propertyId: source.id,
        type: 'water',
        vertices: [
          [1, 2],
          [1.1, 2.1],
        ],
      });

      const propertiesBefore = await db.properties.toArray();
      const linesBefore = await db.utilityLines.toArray();

      // Sabotage: make the NEXT utilityLines.add() throw. duplicateProperty
      // will have inserted the new property row by then; Dexie must roll
      // that back alongside the failed line insert.
      const addSpy = vi
        .spyOn(db.utilityLines, 'add')
        .mockImplementationOnce(() => {
          throw new Error('Simulated add failure');
        });

      await expect(
        duplicateProperty(source.id, 'Nooit opgeslagen'),
      ).rejects.toThrow(/Simulated add failure/);
      addSpy.mockRestore();

      // Nothing orphaned — property + line tables match the pre-call snapshot.
      expect(await db.properties.toArray()).toEqual(propertiesBefore);
      expect(await db.utilityLines.toArray()).toEqual(linesBefore);
    });
  });
});
