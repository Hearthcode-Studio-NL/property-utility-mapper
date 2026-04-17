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
