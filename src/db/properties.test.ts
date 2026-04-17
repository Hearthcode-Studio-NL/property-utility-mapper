import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './dexie';
import {
  addProperty,
  deleteProperty,
  getProperty,
  listProperties,
} from './properties';
import { addUtilityLine } from './utilityLines';

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

  it('addProperty stores a record with a UUID and ISO timestamps', async () => {
    const created = await addProperty({
      address: 'Herengracht 1, Amsterdam',
      lat: 52.37,
      lng: 4.9,
    });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.address).toBe('Herengracht 1, Amsterdam');
    expect(created.lat).toBe(52.37);
    expect(created.lng).toBe(4.9);
    expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(created.updatedAt).toBe(created.createdAt);

    const persisted = await db.properties.get(created.id);
    expect(persisted).toEqual(created);
  });

  it('getProperty returns the property by id and undefined when missing', async () => {
    const created = await addProperty({ address: 'A', lat: 1, lng: 2 });

    expect(await getProperty(created.id)).toEqual(created);
    expect(await getProperty('missing-id')).toBeUndefined();
  });

  it('listProperties returns newest first', async () => {
    const first = await addProperty({ address: 'First', lat: 1, lng: 2 });
    // Ensure the second record has a strictly later createdAt.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await addProperty({ address: 'Second', lat: 3, lng: 4 });

    const list = await listProperties();

    expect(list.map((p) => p.id)).toEqual([second.id, first.id]);
  });

  it('deleteProperty cascades to utility lines of that property', async () => {
    const kept = await addProperty({ address: 'Kept', lat: 1, lng: 2 });
    const doomed = await addProperty({ address: 'Doomed', lat: 3, lng: 4 });

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
});
