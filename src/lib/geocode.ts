export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const q = address.trim();
  if (!q) return null;

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=0`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Nominatim error: ${res.status}`);
  }

  const data: Array<{ lat: string; lon: string; display_name: string }> = await res.json();
  const hit = data[0];
  if (!hit) return null;

  return {
    lat: Number.parseFloat(hit.lat),
    lng: Number.parseFloat(hit.lon),
    displayName: hit.display_name,
  };
}
