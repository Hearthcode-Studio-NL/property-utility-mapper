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
    createdAt: now,
    updatedAt: now,
  };
  await db.properties.add(property);
  return property;
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
