import type { Property, UtilityLine, UtilityType } from '../../types';
import { UTILITY_META, UTILITY_TYPES } from '../utilityColors';
import { db } from '../../db/dexie';
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
      geometry: { type: 'Point', coordinates: [property.lng, property.lat] },
      properties: {
        kind: 'property',
        id: property.id,
        address: property.address,
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
        depthCm: line.depthCm,
        material: line.material,
        diameterMm: line.diameterMm,
        installDate: line.installDate,
        notes: line.notes,
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
  triggerDownload(exportFilename(property.address, 'geojson'), blob);
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

  const now = new Date().toISOString();
  const property: Property = {
    id: crypto.randomUUID(),
    address: asString(propFeature.properties?.address) ?? 'Geïmporteerde locatie',
    lat,
    lng,
    createdAt: asString(propFeature.properties?.createdAt) ?? now,
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
      id: crypto.randomUUID(),
      propertyId: property.id,
      type: normalizeType(feature.properties?.type),
      vertices: rawCoords.map(([ln, lt]) => [lt, ln]),
      depthCm: asNumber(feature.properties?.depthCm),
      material: asString(feature.properties?.material),
      diameterMm: asNumber(feature.properties?.diameterMm),
      installDate: asString(feature.properties?.installDate),
      notes: asString(feature.properties?.notes),
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

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
