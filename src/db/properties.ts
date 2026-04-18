import type { Property, UtilityLine, UUID } from '../types';
import { generateId } from '../lib/ids';
import { db } from './dexie';
import {
  deletePhotosForLineTx,
  deletePhotosForPropertyTx,
} from './photos';

export interface NewPropertyInput {
  street: string;
  houseNumber: string;
  city: string;
  postcode?: string;
  country?: string;
  fullAddress: string;
  centerLat: number;
  centerLng: number;
}

export class PropertyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PropertyValidationError';
  }
}

function validate(input: NewPropertyInput): NewPropertyInput {
  const street = input.street.trim();
  const houseNumber = input.houseNumber.trim();
  const city = input.city.trim();
  if (!street) throw new PropertyValidationError('Straat is verplicht.');
  if (!houseNumber) throw new PropertyValidationError('Huisnummer is verplicht.');
  if (!city) throw new PropertyValidationError('Plaats is verplicht.');
  if (!Number.isFinite(input.centerLat) || !Number.isFinite(input.centerLng)) {
    throw new PropertyValidationError('Coördinaten ontbreken.');
  }
  return {
    street,
    houseNumber,
    city,
    postcode: input.postcode?.trim() || undefined,
    country: input.country?.trim() || undefined,
    fullAddress: input.fullAddress.trim(),
    centerLat: input.centerLat,
    centerLng: input.centerLng,
  };
}

export async function addProperty(input: NewPropertyInput): Promise<Property> {
  const clean = validate(input);
  const now = new Date().toISOString();
  const property: Property = {
    id: generateId(),
    ...clean,
    notes: null,
    coverPhotoId: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.properties.add(property);
  return property;
}

/**
 * Mutable fields a caller is allowed to patch. Timestamps, id, and derived
 * fields (createdAt) are deliberately excluded so accidental overwrites
 * don't slip through.
 */
export type PropertyPatch = Partial<
  Pick<
    Property,
    | 'street'
    | 'houseNumber'
    | 'city'
    | 'postcode'
    | 'country'
    | 'fullAddress'
    | 'centerLat'
    | 'centerLng'
    | 'notes'
    | 'coverPhotoId'
  >
>;

export class CoverPhotoNotFoundError extends Error {
  constructor(id: UUID) {
    super(`Coverfoto met id ${id} bestaat niet.`);
    this.name = 'CoverPhotoNotFoundError';
  }
}

/**
 * Patch a property in place. Runs inside a transaction that also holds
 * `db.photos` so we can validate `coverPhotoId` references against live
 * data without a TOCTOU race. Throws `CoverPhotoNotFoundError` when a
 * non-null `coverPhotoId` points at a missing photo — clearing is always
 * allowed (`coverPhotoId: null`).
 */
export async function updateProperty(
  id: UUID,
  patch: PropertyPatch,
): Promise<Property> {
  return db.transaction('rw', db.properties, db.photos, async () => {
    const existing = await db.properties.get(id);
    if (!existing) {
      throw new Error(`Property ${id} not found.`);
    }
    if (patch.coverPhotoId !== undefined && patch.coverPhotoId !== null) {
      const photo = await db.photos.get(patch.coverPhotoId);
      if (!photo) throw new CoverPhotoNotFoundError(patch.coverPhotoId);
    }
    const updated: Property = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await db.properties.put(updated);
    return updated;
  });
}

/**
 * Clone a property into a new row, carrying its utility lines forward
 * with freshly-generated ids. DELIBERATELY not cloned (v2.2.2 scope):
 *
 *   - photos: they belong to the original's lines; cloning would
 *     double-store every blob. Cloned lines start with `photoIds: []`.
 *   - notes (property-level): the new property begins blank so the
 *     user is nudged to describe this specific address.
 *   - coverPhotoId: it references a photo on the original — following
 *     that link across the clone would leak photos between properties.
 *
 * Line-level attributes (type, vertices, depthCm, material, diameterMm,
 * installDate, notes) DO carry over — they describe the physical utility
 * geometry, which is what a user "dupliceer" usually wants to keep.
 *
 * The single `fullAddressLabel` string becomes the new property's
 * `fullAddress`. Structured fields (street, houseNumber, city, postcode,
 * country) and coordinates are copied from the source as-is. See the
 * v2.2.2 commit message / CLAUDE.md for the trade-off.
 */
export async function duplicateProperty(
  sourceId: UUID,
  fullAddressLabel: string,
): Promise<Property> {
  const trimmed = fullAddressLabel.trim();
  if (trimmed.length === 0) {
    throw new PropertyValidationError('Adres is verplicht.');
  }
  return db.transaction(
    'rw',
    db.properties,
    db.utilityLines,
    async (): Promise<Property> => {
      const source = await db.properties.get(sourceId);
      if (!source) {
        throw new Error(`Property ${sourceId} not found.`);
      }
      const sourceLines = await db.utilityLines
        .where('propertyId')
        .equals(sourceId)
        .toArray();

      const now = new Date().toISOString();
      const cloned: Property = {
        id: generateId(),
        street: source.street,
        houseNumber: source.houseNumber,
        city: source.city,
        postcode: source.postcode,
        country: source.country,
        fullAddress: trimmed,
        centerLat: source.centerLat,
        centerLng: source.centerLng,
        notes: null,
        coverPhotoId: null,
        createdAt: now,
        updatedAt: now,
      };
      await db.properties.add(cloned);

      for (const line of sourceLines) {
        const clonedLine: UtilityLine = {
          id: generateId(),
          propertyId: cloned.id,
          type: line.type,
          vertices: line.vertices.map(([lat, lng]) => [lat, lng]),
          thickness: line.thickness,
          depthCm: line.depthCm,
          material: line.material,
          diameterMm: line.diameterMm,
          installDate: line.installDate,
          notes: line.notes,
          photoIds: [],
          createdAt: now,
          updatedAt: now,
        };
        await db.utilityLines.add(clonedLine);
      }

      return cloned;
    },
  );
}

export function getProperty(id: UUID): Promise<Property | undefined> {
  return db.properties.get(id);
}

export function listProperties(): Promise<Property[]> {
  return db.properties.orderBy('createdAt').reverse().toArray();
}

export async function deleteProperty(id: UUID): Promise<void> {
  await db.transaction(
    'rw',
    db.properties,
    db.utilityLines,
    db.photos,
    db.klicFiles,
    async () => {
      const lines = await db.utilityLines.where('propertyId').equals(id).toArray();
      for (const line of lines) {
        await deletePhotosForLineTx(line.id);
      }
      // v2.3.2: property-scoped (cover) photos live in the photos table
      // with propertyId === this property. Cascade them too so no blob
      // orphans linger after the property row is gone.
      await deletePhotosForPropertyTx(id);
      await db.utilityLines.where('propertyId').equals(id).delete();
      await db.klicFiles.where('propertyId').equals(id).delete();
      await db.properties.delete(id);
    },
  );
}
