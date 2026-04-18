import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './dexie';
import { addProperty } from './properties';
import {
  addUtilityLine,
  LineNotFoundError,
  reGpsLine,
  updateUtilityLine,
} from './utilityLines';

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

describe('reGpsLine (v2.3.6)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('replaces only vertices + updatedAt; every other field survives', async () => {
    const propertyId = await seedProperty();
    const original = await addUtilityLine({
      propertyId,
      type: 'gas',
      vertices: [
        [52.37, 4.89],
        [52.371, 4.891],
      ],
      thickness: 5,
    });
    // Fill in a representative set of attribute fields via updateUtilityLine
    // so we can verify they all round-trip through re-GPS unchanged.
    await updateUtilityLine(original.id, {
      depthCm: 80,
      material: 'PE',
      diameterMm: 32,
      installDate: '2022-05-01T00:00:00.000Z',
      notes: 'loopt achter de schuur langs',
    });
    // Simulate a few photo ids too — reGpsLine must not touch the list.
    await db.utilityLines.update(original.id, {
      photoIds: ['photo-a', 'photo-b'],
    });
    const before = await db.utilityLines.get(original.id);
    expect(before).toBeDefined();

    // Ensure updatedAt can move strictly forward on fast machines.
    await new Promise((r) => setTimeout(r, 2));

    const newGeometry: [number, number][] = [
      [52.3705, 4.8905],
      [52.3712, 4.8912],
      [52.372, 4.892],
    ];
    const updated = await reGpsLine(original.id, newGeometry);

    // Geometry swapped.
    expect(updated.vertices).toEqual(newGeometry);
    // Every other field intact.
    expect(updated.id).toBe(original.id);
    expect(updated.propertyId).toBe(propertyId);
    expect(updated.type).toBe('gas');
    expect(updated.thickness).toBe(5);
    expect(updated.depthCm).toBe(80);
    expect(updated.material).toBe('PE');
    expect(updated.diameterMm).toBe(32);
    expect(updated.installDate).toBe('2022-05-01T00:00:00.000Z');
    expect(updated.notes).toBe('loopt achter de schuur langs');
    expect(updated.photoIds).toEqual(['photo-a', 'photo-b']);
    expect(updated.createdAt).toBe(before!.createdAt);
    // Only updatedAt moved forward.
    expect(updated.updatedAt > before!.updatedAt).toBe(true);

    // DB read matches the returned value.
    const readBack = await db.utilityLines.get(original.id);
    expect(readBack).toEqual(updated);
  });

  it('throws LineNotFoundError when the id is unknown and writes nothing', async () => {
    const countBefore = (await db.utilityLines.toArray()).length;
    await expect(
      reGpsLine('does-not-exist', [
        [1, 2],
        [3, 4],
      ]),
    ).rejects.toBeInstanceOf(LineNotFoundError);
    expect((await db.utilityLines.toArray()).length).toBe(countBefore);
  });

  it('rolls the transaction back on a thrown put — original geometry preserved', async () => {
    const propertyId = await seedProperty();
    const original = await addUtilityLine({
      propertyId,
      type: 'water',
      vertices: [
        [52.37, 4.89],
        [52.371, 4.891],
      ],
    });

    // Sabotage: force db.utilityLines.put to throw after the existing
    // row is read. Dexie aborts the rw transaction and the original row
    // must be readable exactly as it was.
    const putSpy = vi
      .spyOn(db.utilityLines, 'put')
      .mockImplementationOnce(() => {
        throw new Error('Simulated IDB put failure');
      });

    await expect(
      reGpsLine(original.id, [
        [99, 99],
        [99.1, 99.1],
      ]),
    ).rejects.toThrow(/Simulated IDB put failure/);
    putSpy.mockRestore();

    const preserved = await db.utilityLines.get(original.id);
    expect(preserved).toEqual(original);
  });
});
