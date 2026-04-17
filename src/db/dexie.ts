import Dexie, { type Table } from 'dexie';
import type { KlicFile, Photo, Property, UtilityLine } from '../types';

class PropertyUtilityMapperDB extends Dexie {
  properties!: Table<Property, string>;
  utilityLines!: Table<UtilityLine, string>;
  photos!: Table<Photo, string>;
  klicFiles!: Table<KlicFile, string>;

  constructor() {
    super('property-utility-mapper');
    this.version(1).stores({
      properties: 'id, address, createdAt',
      utilityLines: 'id, propertyId, type, createdAt',
      photos: 'id, utilityLineId, createdAt',
      klicFiles: 'id, propertyId, uploadedAt',
    });
  }
}

export const db = new PropertyUtilityMapperDB();
