import type { UtilityLine, UtilityType, UUID } from '../types';
import { db } from './dexie';

export interface NewUtilityLineInput {
  propertyId: UUID;
  type: UtilityType;
  vertices: [number, number][];
}

export async function addUtilityLine(input: NewUtilityLineInput): Promise<UtilityLine> {
  const now = new Date().toISOString();
  const line: UtilityLine = {
    id: crypto.randomUUID(),
    propertyId: input.propertyId,
    type: input.type,
    vertices: input.vertices,
    createdAt: now,
    updatedAt: now,
  };
  await db.utilityLines.add(line);
  return line;
}

export function listLinesForProperty(propertyId: UUID): Promise<UtilityLine[]> {
  return db.utilityLines.where('propertyId').equals(propertyId).sortBy('createdAt');
}

export type UtilityLinePatch = Partial<
  Omit<UtilityLine, 'id' | 'propertyId' | 'createdAt' | 'updatedAt'>
>;

export async function updateUtilityLine(id: UUID, patch: UtilityLinePatch): Promise<void> {
  await db.utilityLines.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteUtilityLine(id: UUID): Promise<void> {
  await db.transaction('rw', db.utilityLines, db.photos, async () => {
    await db.photos.where('utilityLineId').equals(id).delete();
    await db.utilityLines.delete(id);
  });
}
