import type { Photo, UUID } from '@/types';
import { generateId } from '@/lib/ids';
import { generateThumbnail, resizeFull } from '@/lib/photos';
import { db } from './dexie';

export const MAX_PHOTOS_PER_LINE = 10;

export class PhotoLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoLimitError';
  }
}

export async function addPhoto(lineId: UUID, file: File): Promise<Photo> {
  const line = await db.utilityLines.get(lineId);
  if (!line) throw new Error('Leiding niet gevonden.');
  if ((line.photoIds?.length ?? 0) >= MAX_PHOTOS_PER_LINE) {
    throw new PhotoLimitError(
      `Maximaal ${MAX_PHOTOS_PER_LINE} foto's per lijn.`,
    );
  }

  // Process OUTSIDE the transaction — IndexedDB transactions must stay
  // responsive, and image encoding is both CPU-heavy and async in a way
  // Dexie's idb-shim may treat as "inactive".
  const [fullBlob, thumbBlob] = await Promise.all([
    resizeFull(file),
    generateThumbnail(file),
  ]);

  const photo: Photo = {
    id: generateId(),
    lineId,
    blob: fullBlob,
    thumbnailBlob: thumbBlob,
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
  };

  await db.transaction('rw', db.photos, db.utilityLines, async () => {
    await db.photos.add(photo);
    await db.utilityLines.update(lineId, {
      photoIds: [...(line.photoIds ?? []), photo.id],
      updatedAt: new Date().toISOString(),
    });
  });

  return photo;
}

export function getPhoto(id: UUID): Promise<Photo | undefined> {
  return db.photos.get(id);
}

export function listPhotosForLine(lineId: UUID): Promise<Photo[]> {
  return db.photos.where('lineId').equals(lineId).sortBy('createdAt');
}

export async function deletePhoto(id: UUID): Promise<void> {
  await db.transaction('rw', db.photos, db.utilityLines, async () => {
    const photo = await db.photos.get(id);
    if (!photo) return;
    const line = await db.utilityLines.get(photo.lineId);
    await db.photos.delete(id);
    if (line) {
      await db.utilityLines.update(photo.lineId, {
        photoIds: (line.photoIds ?? []).filter((p) => p !== id),
        updatedAt: new Date().toISOString(),
      });
    }
  });
}

// Cascade helper used when a UtilityLine itself is being deleted.
// Callers already hold a 'rw' transaction on db.photos + db.utilityLines,
// so we only clear the photos rows here — the line row (and its photoIds)
// is about to be removed by the caller anyway.
export async function deletePhotosForLineTx(lineId: UUID): Promise<void> {
  await db.photos.where('lineId').equals(lineId).delete();
}

export async function deletePhotosForLine(lineId: UUID): Promise<void> {
  await db.transaction('rw', db.photos, db.utilityLines, async () => {
    await deletePhotosForLineTx(lineId);
    const line = await db.utilityLines.get(lineId);
    if (line && (line.photoIds?.length ?? 0) > 0) {
      await db.utilityLines.update(lineId, {
        photoIds: [],
        updatedAt: new Date().toISOString(),
      });
    }
  });
}
