export interface StructuredAddress {
  street: string;
  houseNumber: string;
  city: string;
  postcode?: string;
  country?: string;
  fullAddress: string;
  lat: number;
  lng: number;
}

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';

interface NominatimRaw {
  lat?: string | number;
  lon?: string | number;
  display_name?: string;
  error?: string;
  address?: {
    road?: string;
    pedestrian?: string;
    path?: string;
    house_number?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    suburb?: string;
    postcode?: string;
    country?: string;
  };
}

function parseNominatim(raw: NominatimRaw): StructuredAddress | null {
  if (!raw || raw.error) return null;
  const lat = typeof raw.lat === 'number' ? raw.lat : Number.parseFloat(raw.lat ?? '');
  const lng = typeof raw.lon === 'number' ? raw.lon : Number.parseFloat(raw.lon ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const details = raw.address ?? {};
  const street = details.road || details.pedestrian || details.path || '';
  const city =
    details.city || details.town || details.village || details.hamlet || details.suburb || '';

  return {
    street,
    houseNumber: details.house_number ?? '',
    city,
    postcode: details.postcode,
    country: details.country,
    fullAddress: raw.display_name ?? '',
    lat,
    lng,
  };
}

export async function geocodeAddress(query: string): Promise<StructuredAddress | null> {
  const q = query.trim();
  if (!q) return null;

  const url = `${NOMINATIM_SEARCH}?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);

  const data = (await res.json()) as NominatimRaw[];
  const first = data[0];
  if (!first) return null;
  return parseNominatim(first);
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<StructuredAddress | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);

  const data = (await res.json()) as NominatimRaw;
  return parseNominatim(data);
}
