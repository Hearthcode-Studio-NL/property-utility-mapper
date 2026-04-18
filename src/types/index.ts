export type UUID = string;
export type ISODate = string;

export type UtilityType =
  | 'water'
  | 'gas'
  | 'electricity'
  | 'sewage'
  | 'internet'
  | 'irrigation'
  | 'garden-lighting'
  | 'drainage';

/**
 * Integer stroke width for a drawn line. Range 1..8, default 4.
 * v2.3.5 replaced the three-preset enum (`'dun' | 'normaal' | 'dik'`)
 * with a bare number so users can dial a width between the old
 * presets. The Dexie v6→v7 migration mapped the legacy strings to
 * `'dun' → 2`, `'normaal' → 4`, `'dik' → 6` so visual widths are
 * preserved for existing lines.
 */
export const LINE_THICKNESS_MIN = 1;
export const LINE_THICKNESS_MAX = 8;
export const LINE_THICKNESS_DEFAULT = 4;

export interface Property {
  id: UUID;

  street: string;
  houseNumber: string;
  city: string;
  postcode?: string;
  country?: string;
  fullAddress: string;

  centerLat: number;
  centerLng: number;

  /**
   * Free-text notes about the property (access, keys, quirks). `null` when
   * the owner hasn't written anything. Added in v2.2.1.
   */
  notes: string | null;
  /**
   * Opt-in reference to an existing Photo id to use as the property's cover
   * image. Sourced from photos attached to any utility line on this
   * property — there is no separate upload. `null` when unset. Added in
   * v2.2.1. Orphan references (photo deleted elsewhere) render as a
   * placeholder and get lazily cleared — see src/routes/Property.tsx.
   */
  coverPhotoId: UUID | null;

  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface UtilityLine {
  id: UUID;
  propertyId: UUID;
  type: UtilityType;
  vertices: [number, number][];
  /**
   * Integer stroke width in pixels (1..8, default 4). Added in v2.3.1
   * as a 3-value enum, migrated to a number in v2.3.5 (v6→v7 Dexie
   * upgrade). Pre-existing lines were backfilled to 4 or to the
   * numeric equivalent of their old preset.
   */
  thickness: number;
  depthCm?: number;
  material?: string;
  diameterMm?: number;
  installDate?: ISODate;
  notes?: string;
  photoIds: UUID[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

/**
 * A photo is either:
 *   - a LINE photo — bound to a specific utility line via `lineId`; also
 *     surfaces in that line's photo gallery. `propertyId` is undefined.
 *   - a PROPERTY photo — standalone, tied to a property for cover-image
 *     use. `lineId` is null, `propertyId` is the target property id.
 *
 * Added in v2.3.2: before this slice, every Photo was a line photo
 * (`lineId: UUID`). The v5→v6 Dexie migration added a `propertyId`
 * index; existing rows are untouched and remain line photos.
 */
export interface Photo {
  id: UUID;
  lineId: UUID | null;
  propertyId?: UUID;
  blob: Blob;
  thumbnailBlob: Blob;
  mimeType: string;
  caption?: string;
  createdAt: ISODate;
}

export interface KlicFile {
  id: UUID;
  propertyId: UUID;
  filename: string;
  blob: Blob;
  uploadedAt: ISODate;
}
