import type { Property, UUID } from '../types';
import { db } from './dexie';

export interface NewPropertyInput {
  address: string;
  lat: number;
  lng: number;
}

export async function addProperty(input: NewPropertyInput): Promise<Property> {
  const now = new Date().toISOString();
  const property: Property = {
    id: crypto.randomUUID(),
    address: input.address,
    lat: input.lat,
    lng: input.lng,
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
  await db.transaction('rw', db.properties, db.utilityLines, db.photos, db.klicFiles, async () => {
    const lines = await db.utilityLines.where('propertyId').equals(id).toArray();
    const lineIds = lines.map((l) => l.id);
    if (lineIds.length > 0) {
      await db.photos.where('utilityLineId').anyOf(lineIds).delete();
    }
    await db.utilityLines.where('propertyId').equals(id).delete();
    await db.klicFiles.where('propertyId').equals(id).delete();
    await db.properties.delete(id);
  });
}
