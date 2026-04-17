import Dexie, { type Table } from 'dexie';
import type { KlicFile, Photo, Property, UtilityLine } from '../types';

class PropertyUtilityMapperDB extends Dexie {
  properties!: Table<Property, string>;
  utilityLines!: Table<UtilityLine, string>;
  photos!: Table<Photo, string>;
  klicFiles!: Table<KlicFile, string>;

  constructor() {
    super('property-utility-mapper');

    // v1 — pre-structured-address layout. Kept so Dexie detects and runs
    // the v2 upgrade on users who created data before that refactor.
    this.version(1).stores({
      properties: 'id, address, createdAt',
      utilityLines: 'id, propertyId, type, createdAt',
      photos: 'id, utilityLineId, createdAt',
      klicFiles: 'id, propertyId, uploadedAt',
    });

    // v2 — structured address. The old `address` / `lat` / `lng` fields
    // couldn't be reliably split without a network round-trip, so we wiped
    // pre-v2 records on upgrade (v1 had no user-visible features worth
    // preserving). See ARCHITECTURE.md "Open questions".
    this.version(2)
      .stores({
        properties: 'id, city, createdAt',
        utilityLines: 'id, propertyId, type, createdAt',
        photos: 'id, utilityLineId, createdAt',
        klicFiles: 'id, propertyId, uploadedAt',
      })
      .upgrade(async (tx) => {
        await tx.table('properties').clear();
        await tx.table('utilityLines').clear();
        await tx.table('photos').clear();
        await tx.table('klicFiles').clear();
      });

    // v3 — photos. Renames photos.utilityLineId -> photos.lineId (index
    // too) and adds utilityLines.photoIds: string[]. This time the upgrade
    // preserves existing data — properties + lines survive, and any prior
    // photos get their FK renamed in place.
    this.version(3)
      .stores({
        properties: 'id, city, createdAt',
        utilityLines: 'id, propertyId, type, createdAt',
        photos: 'id, lineId, createdAt',
        klicFiles: 'id, propertyId, uploadedAt',
      })
      .upgrade(async (tx) => {
        // Each existing UtilityLine gets an empty photoIds array.
        await tx
          .table('utilityLines')
          .toCollection()
          .modify((line: UtilityLine & { photoIds?: UUID[] }) => {
            if (!Array.isArray(line.photoIds)) line.photoIds = [];
          });
        // Each existing Photo gets utilityLineId -> lineId.
        await tx
          .table('photos')
          .toCollection()
          .modify((photo: Photo & { utilityLineId?: string }) => {
            if (photo.utilityLineId && !photo.lineId) {
              photo.lineId = photo.utilityLineId;
              delete photo.utilityLineId;
            }
          });
      });
  }
}

type UUID = string;

export const db = new PropertyUtilityMapperDB();
