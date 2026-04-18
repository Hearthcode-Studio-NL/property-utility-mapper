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
 * One of three stroke-width presets for a drawn line. Added in v2.3.1.
 * Kept as an enum rather than a raw pixel number so the design system
 * can tune the visual relationship (and the line casing) centrally.
 */
export type LineThickness = 'dun' | 'normaal' | 'dik';

export const LINE_THICKNESSES: readonly LineThickness[] = [
  'dun',
  'normaal',
  'dik',
];

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
   * Stroke-width preset. Added in v2.3.1 — pre-existing lines were
   * backfilled to 'normaal' by the v4→v5 Dexie migration, so every
   * line on disk has this field.
   */
  thickness: LineThickness;
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
