import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './dexie';
import { addProperty } from './properties';
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

async function seedProperty(): Promise<string> {
  const p = await addProperty({
    street: 'Herengracht',
    houseNumber: '1',
    city: 'Amsterdam',
    fullAddress: 'Herengracht 1, 1015 BA Amsterdam, Nederland',
    centerLat: 52.3676,
    centerLng: 4.9041,
  });
  return p.id;
}

describe('addUtilityLine — thickness defaulting (v2.3.1)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('defaults thickness to 4 when the caller omits it (v2.3.5)', async () => {
    const propertyId = await seedProperty();
    const line = await addUtilityLine({
      propertyId,
      type: 'water',
      vertices: [
        [1, 2],
        [1.1, 2.1],
      ],
    });
    expect(line.thickness).toBe(4);
    expect((await db.utilityLines.get(line.id))?.thickness).toBe(4);
  });

  it('persists the explicit numeric thickness when the caller provides one', async () => {
    const propertyId = await seedProperty();
    const line = await addUtilityLine({
      propertyId,
      type: 'water',
      vertices: [
        [1, 2],
        [1.1, 2.1],
      ],
      thickness: 6,
    });
    expect(line.thickness).toBe(6);
  });
});
