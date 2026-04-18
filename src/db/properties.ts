import type { Property, UUID } from '../types';
import { generateId } from '../lib/ids';
import { db } from './dexie';
import { deletePhotosForLineTx } from './photos';

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
      await db.utilityLines.where('propertyId').equals(id).delete();
      await db.klicFiles.where('propertyId').equals(id).delete();
      await db.properties.delete(id);
    },
  );
}
