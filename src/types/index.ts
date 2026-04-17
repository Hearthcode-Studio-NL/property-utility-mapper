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
  address: string;
  lat: number;
  lng: number;
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
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Photo {
  id: UUID;
  utilityLineId: UUID;
  blob: Blob;
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
