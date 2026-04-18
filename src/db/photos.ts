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

/**
 * Add a property-scoped photo (cover-image use). Standalone — doesn't
 * attach to any utility line, doesn't appear in line galleries, and
 * doesn't count against MAX_PHOTOS_PER_LINE. Added in v2.3.2 when the
 * cover picker grew a real upload flow.
 */
export async function addPropertyPhoto(
  propertyId: UUID,
  file: File,
): Promise<Photo> {
  const property = await db.properties.get(propertyId);
  if (!property) throw new Error('Adres niet gevonden.');

  const [fullBlob, thumbBlob] = await Promise.all([
    resizeFull(file),
    generateThumbnail(file),
  ]);

  const photo: Photo = {
    id: generateId(),
    lineId: null,
    propertyId,
    blob: fullBlob,
    thumbnailBlob: thumbBlob,
    mimeType: 'image/jpeg',
    createdAt: new Date().toISOString(),
  };

  await db.photos.add(photo);
  return photo;
}

/**
 * All property-scoped photos for this property (NOT line photos). Used
 * by the cover picker to include standalone uploads alongside line
 * photos when rendering the radio grid.
 */
export function listPropertyPhotos(propertyId: UUID): Promise<Photo[]> {
  return db.photos.where('propertyId').equals(propertyId).sortBy('createdAt');
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
    await db.photos.delete(id);
    // Only line photos carry a lineId reference to unlink. Property
    // photos (lineId === null) don't live in any line's photoIds list.
    if (photo.lineId !== null) {
      const lineId = photo.lineId;
      const line = await db.utilityLines.get(lineId);
      if (line) {
        await db.utilityLines.update(lineId, {
          photoIds: (line.photoIds ?? []).filter((p) => p !== id),
          updatedAt: new Date().toISOString(),
        });
      }
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

/**
 * Cascade helper for property-scoped photos. Callers hold the outer
 * transaction (see deleteProperty in src/db/properties.ts). Parallel
 * to deletePhotosForLineTx — the two together clear every photo that
 * belongs to the property being deleted.
 */
export async function deletePhotosForPropertyTx(
  propertyId: UUID,
): Promise<void> {
  await db.photos.where('propertyId').equals(propertyId).delete();
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
