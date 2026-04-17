import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './dexie';
import { addProperty } from './properties';
import { addUtilityLine, deleteUtilityLine } from './utilityLines';
import { deleteProperty } from './properties';
import {
  addPhoto,
  deletePhoto,
  deletePhotosForLine,
  listPhotosForLine,
  MAX_PHOTOS_PER_LINE,
  PhotoLimitError,
} from './photos';

// Bypass real Canvas/ImageBitmap work — the DB layer only cares that a
// Blob goes in. Each wrapper returns a distinct stub so full vs thumbnail
// are distinguishable if we assert on them.
vi.mock('@/lib/photos', () => ({
  resizeFull: vi.fn(async () => new Blob(['full'], { type: 'image/jpeg' })),
  generateThumbnail: vi.fn(async () => new Blob(['thumb'], { type: 'image/jpeg' })),
}));

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

async function seedLine() {
  const property = await addProperty({
    street: 'Herengracht',
    houseNumber: '1',
    city: 'Amsterdam',
    fullAddress: 'Herengracht 1, Amsterdam',
    centerLat: 52.37,
    centerLng: 4.9,
  });
  const line = await addUtilityLine({
    propertyId: property.id,
    type: 'water',
    vertices: [
      [52.37, 4.9],
      [52.371, 4.901],
    ],
  });
  return { property, line };
}

function fakeFile() {
  return new File(['fake-jpeg-bytes'], 'photo.jpg', { type: 'image/jpeg' });
}

describe('db/photos', () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it('addPhoto writes a row and appends the id to line.photoIds', async () => {
    const { line } = await seedLine();

    const photo = await addPhoto(line.id, fakeFile());

    expect(photo.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(photo.lineId).toBe(line.id);
    expect(photo.mimeType).toBe('image/jpeg');
    expect(photo.blob).toBeInstanceOf(Blob);
    expect(photo.thumbnailBlob).toBeInstanceOf(Blob);
    expect(photo.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const updatedLine = await db.utilityLines.get(line.id);
    expect(updatedLine?.photoIds).toEqual([photo.id]);
  });

  it('listPhotosForLine returns photos for the right line only', async () => {
    const { line: line1 } = await seedLine();
    const { line: line2 } = await seedLine();

    const a = await addPhoto(line1.id, fakeFile());
    const b = await addPhoto(line1.id, fakeFile());
    await addPhoto(line2.id, fakeFile());

    const list = await listPhotosForLine(line1.id);
    expect(list.map((p) => p.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('deletePhoto removes the row and pulls the id out of line.photoIds', async () => {
    const { line } = await seedLine();
    const a = await addPhoto(line.id, fakeFile());
    const b = await addPhoto(line.id, fakeFile());

    await deletePhoto(a.id);

    expect(await db.photos.get(a.id)).toBeUndefined();
    const remaining = await db.utilityLines.get(line.id);
    expect(remaining?.photoIds).toEqual([b.id]);
  });

  it('deletePhotosForLine cascades and clears the photoIds array', async () => {
    const { line } = await seedLine();
    await addPhoto(line.id, fakeFile());
    await addPhoto(line.id, fakeFile());

    await deletePhotosForLine(line.id);

    expect(await listPhotosForLine(line.id)).toHaveLength(0);
    const updatedLine = await db.utilityLines.get(line.id);
    expect(updatedLine?.photoIds).toEqual([]);
  });

  it('deleting a line cascades its photos', async () => {
    const { line } = await seedLine();
    await addPhoto(line.id, fakeFile());
    await addPhoto(line.id, fakeFile());

    await deleteUtilityLine(line.id);

    expect(await listPhotosForLine(line.id)).toHaveLength(0);
  });

  it('deleting a property cascades photos of every line', async () => {
    const { property, line } = await seedLine();
    await addPhoto(line.id, fakeFile());
    const otherLine = await addUtilityLine({
      propertyId: property.id,
      type: 'gas',
      vertices: [
        [52.37, 4.9],
        [52.371, 4.9],
      ],
    });
    await addPhoto(otherLine.id, fakeFile());

    await deleteProperty(property.id);

    expect(await db.photos.toArray()).toHaveLength(0);
  });

  it('rejects once the line is at the limit', async () => {
    const { line } = await seedLine();
    for (let i = 0; i < MAX_PHOTOS_PER_LINE; i++) {
      await addPhoto(line.id, fakeFile());
    }
    await expect(addPhoto(line.id, fakeFile())).rejects.toBeInstanceOf(PhotoLimitError);
  });
});
