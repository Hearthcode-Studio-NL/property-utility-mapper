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
  depthCm?: number;
  material?: string;
  diameterMm?: number;
  installDate?: ISODate;
  notes?: string;
  photoIds: UUID[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Photo {
  id: UUID;
  lineId: UUID;
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
