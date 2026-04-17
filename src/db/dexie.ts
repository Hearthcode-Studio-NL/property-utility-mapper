import Dexie, { type Table } from 'dexie';
import type { KlicFile, Photo, Property, UtilityLine } from '../types';

class PropertyUtilityMapperDB extends Dexie {
  properties!: Table<Property, string>;
  utilityLines!: Table<UtilityLine, string>;
  photos!: Table<Photo, string>;
  klicFiles!: Table<KlicFile, string>;

  constructor() {
    super('property-utility-mapper');

    // v1 — pre-structured-address layout. Kept so Dexie can detect and
    // run the v2 upgrade on users who created data before the refactor.
    this.version(1).stores({
      properties: 'id, address, createdAt',
      utilityLines: 'id, propertyId, type, createdAt',
      photos: 'id, utilityLineId, createdAt',
      klicFiles: 'id, propertyId, uploadedAt',
    });

    // v2 — structured address. The old `address` / `lat` / `lng` fields
    // can't be reliably split without a network round-trip, so we wipe
    // pre-v2 records; users re-add properties through the new flow.
    // See ARCHITECTURE.md "Open questions" for the migration rationale.
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
  }
}

export const db = new PropertyUtilityMapperDB();
