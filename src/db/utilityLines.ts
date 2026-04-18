import type { LineThickness, UtilityLine, UtilityType, UUID } from '../types';
import { generateId } from '../lib/ids';
import { db } from './dexie';
import { deletePhotosForLineTx } from './photos';

export interface NewUtilityLineInput {
  propertyId: UUID;
  type: UtilityType;
  vertices: [number, number][];
  /**
   * Stroke-width preset. Optional at call-site — callers without a
   * preference (e.g. GeoJSON import, seed scripts) get 'normaal' so
   * every persisted line has a defined thickness.
   */
  thickness?: LineThickness;
}

export async function addUtilityLine(input: NewUtilityLineInput): Promise<UtilityLine> {
  const now = new Date().toISOString();
  const line: UtilityLine = {
    id: generateId(),
    propertyId: input.propertyId,
    type: input.type,
    vertices: input.vertices,
    thickness: input.thickness ?? 'normaal',
    photoIds: [],
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
    await deletePhotosForLineTx(id);
    await db.utilityLines.delete(id);
  });
}
