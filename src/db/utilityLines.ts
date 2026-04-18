import type { UtilityLine, UtilityType, UUID } from '../types';
import { LINE_THICKNESS_DEFAULT } from '../types';
import { generateId } from '../lib/ids';
import { db } from './dexie';
import { deletePhotosForLineTx } from './photos';

export interface NewUtilityLineInput {
  propertyId: UUID;
  type: UtilityType;
  vertices: [number, number][];
  /**
   * Integer stroke width 1..8. Optional at call-site — callers without
   * a preference (GeoJSON import, seed scripts) get LINE_THICKNESS_DEFAULT
   * so every persisted line has a defined thickness.
   */
  thickness?: number;
}

export async function addUtilityLine(input: NewUtilityLineInput): Promise<UtilityLine> {
  const now = new Date().toISOString();
  const line: UtilityLine = {
    id: generateId(),
    propertyId: input.propertyId,
    type: input.type,
    vertices: input.vertices,
    thickness: input.thickness ?? LINE_THICKNESS_DEFAULT,
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

export class LineNotFoundError extends Error {
  constructor(id: UUID) {
    super(`Leiding met id ${id} bestaat niet.`);
    this.name = 'LineNotFoundError';
  }
}

/**
 * Replace the geometry of an existing line (v2.3.6 "Opnieuw GPS-en").
 * Only `vertices` and `updatedAt` move — type, attributes, photos,
 * thickness, notes, propertyId and createdAt all survive. Runs inside a
 * Dexie transaction so a throw mid-step rolls the whole write back and
 * the user's original geometry is preserved.
 */
export async function reGpsLine(
  id: UUID,
  vertices: [number, number][],
): Promise<UtilityLine> {
  return db.transaction('rw', db.utilityLines, async (): Promise<UtilityLine> => {
    const existing = await db.utilityLines.get(id);
    if (!existing) throw new LineNotFoundError(id);
    const updated: UtilityLine = {
      ...existing,
      vertices,
      updatedAt: new Date().toISOString(),
    };
    await db.utilityLines.put(updated);
    return updated;
  });
}

export async function deleteUtilityLine(id: UUID): Promise<void> {
  await db.transaction('rw', db.utilityLines, db.photos, async () => {
    await deletePhotosForLineTx(id);
    await db.utilityLines.delete(id);
  });
}
