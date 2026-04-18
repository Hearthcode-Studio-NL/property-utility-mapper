import type { Property, UtilityLine, UtilityType } from '../../types';
import {
  LINE_THICKNESS_DEFAULT,
  LINE_THICKNESS_MAX,
  LINE_THICKNESS_MIN,
} from '../../types';
import { UTILITY_META, UTILITY_TYPES } from '../utilityColors';
import { db } from '../../db/dexie';
import { formatDisplayAddress } from '../address';
import { generateId } from '../ids';
import { exportFilename, triggerDownload } from './download';

type PointGeometry = { type: 'Point'; coordinates: [number, number] };
type LineStringGeometry = { type: 'LineString'; coordinates: [number, number][] };

interface Feature {
  type: 'Feature';
  geometry: PointGeometry | LineStringGeometry;
  properties: Record<string, unknown>;
}

export interface PropertyFeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

export function buildGeoJson(
  property: Property,
  lines: UtilityLine[],
): PropertyFeatureCollection {
  const features: Feature[] = [
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [property.centerLng, property.centerLat],
      },
      properties: {
        kind: 'property',
        id: property.id,
        street: property.street,
        houseNumber: property.houseNumber,
        city: property.city,
        postcode: property.postcode,
        country: property.country,
        fullAddress: property.fullAddress,
        displayAddress: formatDisplayAddress(property),
        // v2.2.1: notes round-trip; cover photo only exposes presence
        // (the binary blob stays in IndexedDB — never embed in exports).
        ...(property.notes !== null && property.notes.length > 0
          ? { notes: property.notes }
          : {}),
        hasCoverPhoto: property.coverPhotoId !== null,
        createdAt: property.createdAt,
        updatedAt: property.updatedAt,
      },
    },
  ];

  for (const line of lines) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: line.vertices.map(([lat, lng]) => [lng, lat]),
      },
      properties: {
        kind: 'utility-line',
        id: line.id,
        type: line.type,
        typeLabel: UTILITY_META[line.type].label,
        color: UTILITY_META[line.type].color,
        thickness: line.thickness,
        depthCm: line.depthCm,
        material: line.material,
        diameterMm: line.diameterMm,
        installDate: line.installDate,
        notes: line.notes,
        photoCount: line.photoIds?.length ?? 0,
        createdAt: line.createdAt,
        updatedAt: line.updatedAt,
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

export function exportGeoJson(property: Property, lines: UtilityLine[]): void {
  const fc = buildGeoJson(property, lines);
  const blob = new Blob([JSON.stringify(fc, null, 2)], {
    type: 'application/geo+json',
  });
  triggerDownload(exportFilename(formatDisplayAddress(property), 'geojson'), blob);
}

export interface ImportResult {
  property: Property;
  linesCreated: number;
}

export async function importGeoJsonFromText(text: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Kan het bestand niet lezen: geen geldige JSON.');
  }
  if (!isFeatureCollection(parsed)) {
    throw new Error('Dit is geen GeoJSON FeatureCollection.');
  }

  const features = parsed.features;
  const propFeature = features.find(
    (f) =>
      f.properties?.kind === 'property' &&
      f.geometry !== null &&
      f.geometry.type === 'Point',
  );
  if (!propFeature || !propFeature.geometry || propFeature.geometry.type !== 'Point') {
    throw new Error('Geen locatie gevonden in het bestand.');
  }

  if (!isLngLat(propFeature.geometry.coordinates)) {
    throw new Error('Ongeldige coördinaten voor de locatie.');
  }
  const [lng, lat] = propFeature.geometry.coordinates;

  const rawProps = propFeature.properties ?? {};
  const street = asString(rawProps.street);
  const houseNumber = asString(rawProps.houseNumber);
  const city = asString(rawProps.city);
  if (!street || !houseNumber || !city) {
    throw new Error(
      'GeoJSON mist gestructureerde adresvelden (street, houseNumber, city).',
    );
  }

  const now = new Date().toISOString();
  const property: Property = {
    id: generateId(),
    street,
    houseNumber,
    city,
    postcode: asString(rawProps.postcode),
    country: asString(rawProps.country),
    fullAddress: asString(rawProps.fullAddress) ?? `${street} ${houseNumber}, ${city}`,
    centerLat: lat,
    centerLng: lng,
    // notes round-trip through GeoJSON; coverPhotoId does NOT because photos
    // aren't embedded in exports. Import always clears the cover reference.
    notes: asString(rawProps.notes) ?? null,
    coverPhotoId: null,
    createdAt: asString(rawProps.createdAt) ?? now,
    updatedAt: now,
  };

  const lineFeatures = features.filter(
    (f): f is RawFeature & { geometry: { type: 'LineString'; coordinates: unknown } } =>
      f.properties?.kind === 'utility-line' && f.geometry?.type === 'LineString',
  );

  const lines: UtilityLine[] = [];
  for (const feature of lineFeatures) {
    const rawCoords = feature.geometry.coordinates;
    if (!isLineStringCoords(rawCoords) || rawCoords.length < 2) continue;
    lines.push({
      id: generateId(),
      propertyId: property.id,
      type: normalizeType(feature.properties?.type),
      vertices: rawCoords.map(([ln, lt]) => [lt, ln]),
      // v2.3.1: thickness round-trips via GeoJSON when present, defaults
      // to 'normaal' otherwise. Older exports (pre-v2.3.1) don't carry
      // the field, so every imported line lands at a sane preset.
      thickness: normalizeThickness(feature.properties?.thickness),
      depthCm: asNumber(feature.properties?.depthCm),
      material: asString(feature.properties?.material),
      diameterMm: asNumber(feature.properties?.diameterMm),
      installDate: asString(feature.properties?.installDate),
      notes: asString(feature.properties?.notes),
      photoIds: [],
      createdAt: asString(feature.properties?.createdAt) ?? now,
      updatedAt: now,
    });
  }

  await db.transaction('rw', db.properties, db.utilityLines, async () => {
    await db.properties.add(property);
    if (lines.length > 0) await db.utilityLines.bulkAdd(lines);
  });

  return { property, linesCreated: lines.length };
}

interface RawFeature {
  type: 'Feature';
  geometry: { type: string; coordinates?: unknown } | null;
  properties: Record<string, unknown> | null;
}
interface RawFeatureCollection {
  type: 'FeatureCollection';
  features: RawFeature[];
}

function isFeatureCollection(v: unknown): v is RawFeatureCollection {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return obj.type === 'FeatureCollection' && Array.isArray(obj.features);
}

function isLngLat(v: unknown): v is [number, number] {
  return (
    Array.isArray(v) &&
    v.length >= 2 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1])
  );
}

function isLineStringCoords(v: unknown): v is [number, number][] {
  return Array.isArray(v) && v.every(isLngLat);
}

function normalizeType(v: unknown): UtilityType {
  return typeof v === 'string' && (UTILITY_TYPES as string[]).includes(v)
    ? (v as UtilityType)
    : 'water';
}

function normalizeThickness(v: unknown): number {
  // v2.3.5: accepts numbers 1..8. Also accepts the legacy enum strings
  // from older exports so import round-trips cleanly with pre-v2.3.5
  // files. Everything else falls back to the default.
  if (typeof v === 'number' && Number.isInteger(v)) {
    if (v < LINE_THICKNESS_MIN) return LINE_THICKNESS_MIN;
    if (v > LINE_THICKNESS_MAX) return LINE_THICKNESS_MAX;
    return v;
  }
  if (v === 'dun') return 2;
  if (v === 'normaal') return 4;
  if (v === 'dik') return 6;
  return LINE_THICKNESS_DEFAULT;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
