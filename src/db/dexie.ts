/**
 * Dexie migrations
 *
 * Every schema state the app has ever shipped is a `.version(N).stores(...)`
 * below, with a `.upgrade(...)` whenever N requires row transformation.
 *
 * To evolve the schema:
 *   1. ADD `.version(N+1).stores({...}).upgrade(tx => {...})` at the bottom.
 *   2. NEVER edit or remove existing `.version(N)` calls — users on any
 *      prior version step through every `.upgrade` in order on next load.
 *   3. Transforms run inside Dexie's implicit transaction; throws roll back.
 *      Keep them fast and data-safe.
 *
 * The v2 upgrade was originally a wipe because the structured-address
 * refactor couldn't reliably split the old single `address` string without
 * a Nominatim round-trip. As of v2.1.6 it's a best-effort migration that
 * preserves what it can — see the v2 upgrade fn for the parse heuristic and
 * fallbacks.
 */
import Dexie, { type Table } from 'dexie';
import type {
  KlicFile,
  LineThickness,
  Photo,
  Property,
  UtilityLine,
} from '../types';

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

    // v2 — structured address. Splits the old `address` string into
    // `street`, `houseNumber`, `city`, `fullAddress`; renames `lat`/`lng`
    // to `centerLat`/`centerLng`. Child tables (utilityLines, photos,
    // klicFiles) don't change shape at v1→v2, so their rows pass through
    // untouched — Dexie rebuilds the properties index from `address`
    // to `city` automatically.
    //
    // The parse is best-effort against Nominatim's display_name shape:
    //   "Herengracht 1A, 1015 BA Amsterdam, Noord-Holland, Nederland"
    // When the parse fails, `fullAddress` still holds the original string
    // and `street` falls back to it, so `formatDisplayAddress()` always
    // has something non-empty to show. `houseNumber` / `city` may end up
    // blank on unparseable rows; addProperty() rejects those at save time,
    // but migrated records aren't re-saved — the user can delete + recreate.
    this.version(2)
      .stores({
        properties: 'id, city, createdAt',
        utilityLines: 'id, propertyId, type, createdAt',
        photos: 'id, utilityLineId, createdAt',
        klicFiles: 'id, propertyId, uploadedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('properties')
          .toCollection()
          .modify((p) => {
            const old = p as {
              address?: string;
              lat?: number;
              lng?: number;
            };
            const addr = (old.address ?? '').trim();
            const match = addr.match(
              /^(.+?)\s+(\d+\S*),\s*(?:\d{4}\s?[A-Z]{2}\s+)?([^,]+)/,
            );
            p.street = match?.[1]?.trim() || addr || '(Onbekende straat)';
            p.houseNumber = match?.[2]?.trim() || '';
            p.city = match?.[3]?.trim() || '';
            p.fullAddress = addr;
            p.centerLat = old.lat ?? 0;
            p.centerLng = old.lng ?? 0;
            delete (p as Record<string, unknown>).address;
            delete (p as Record<string, unknown>).lat;
            delete (p as Record<string, unknown>).lng;
          });
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

    // v4 — property-level notes + cover photo reference. Neither field is
    // indexed (we only ever read them per-property), so .stores() is
    // unchanged from v3 on the properties table. Existing rows get
    // null-initialised so the new TypeScript Property type matches what
    // actually sits on disk — callers don't need to branch on undefined vs
    // null. Added in v2.2.1.
    this.version(4)
      .stores({
        properties: 'id, city, createdAt',
        utilityLines: 'id, propertyId, type, createdAt',
        photos: 'id, lineId, createdAt',
        klicFiles: 'id, propertyId, uploadedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('properties')
          .toCollection()
          .modify((p: Property & { notes?: string | null; coverPhotoId?: UUID | null }) => {
            if (p.notes === undefined) p.notes = null;
            if (p.coverPhotoId === undefined) p.coverPhotoId = null;
          });
      });

    // v5 — line thickness. Adds a `thickness` enum field to every
    // UtilityLine, backfilled to 'normaal' for existing rows. No index
    // change — thickness isn't queryable, only read per line. Added in
    // v2.3.1.
    this.version(5)
      .stores({
        properties: 'id, city, createdAt',
        utilityLines: 'id, propertyId, type, createdAt',
        photos: 'id, lineId, createdAt',
        klicFiles: 'id, propertyId, uploadedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table('utilityLines')
          .toCollection()
          .modify((line: UtilityLine & { thickness?: LineThickness }) => {
            if (line.thickness === undefined) line.thickness = 'normaal';
          });
      });

    // v6 — property-scoped photos. Adds a `propertyId` index to the
    // photos table so we can query property-level (cover) photos
    // independently of line photos. No row migration needed — existing
    // photos already have lineId set and no propertyId, which continues
    // to mean "line photo" under the new model. Added in v2.3.2.
    this.version(6).stores({
      properties: 'id, city, createdAt',
      utilityLines: 'id, propertyId, type, createdAt',
      photos: 'id, lineId, propertyId, createdAt',
      klicFiles: 'id, propertyId, uploadedAt',
    });
  }
}

type UUID = string;

export const db = new PropertyUtilityMapperDB();
