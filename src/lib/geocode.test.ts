import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress, reverseGeocode } from './geocode';

describe('geocodeAddress', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null for empty input without calling fetch', async () => {
    const result = await geocodeAddress('   ');
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns a structured address when Nominatim finds a match', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: '52.3676',
            lon: '4.9041',
            display_name: 'Herengracht 1, 1015 BA Amsterdam, Noord-Holland, Nederland',
            address: {
              road: 'Herengracht',
              house_number: '1',
              city: 'Amsterdam',
              postcode: '1015 BA',
              country: 'Nederland',
            },
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await geocodeAddress('Herengracht 1');

    expect(result).toEqual({
      street: 'Herengracht',
      houseNumber: '1',
      city: 'Amsterdam',
      postcode: '1015 BA',
      country: 'Nederland',
      fullAddress: 'Herengracht 1, 1015 BA Amsterdam, Noord-Holland, Nederland',
      lat: 52.3676,
      lng: 4.9041,
    });

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/addressdetails=1/);
    expect(String(url)).toMatch(/q=Herengracht%201/);
  });

  it('falls back to town/village when city is missing', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: '53.2194',
            lon: '6.5665',
            display_name: 'Dorpsstraat 5, 9999 AA Kleindorp, Groningen',
            address: {
              road: 'Dorpsstraat',
              house_number: '5',
              village: 'Kleindorp',
              postcode: '9999 AA',
              country: 'Nederland',
            },
          },
        ]),
        { status: 200 },
      ),
    );

    const result = await geocodeAddress('Dorpsstraat 5');
    expect(result?.city).toBe('Kleindorp');
  });

  it('returns null when Nominatim has no matches', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    expect(await geocodeAddress('nowhere')).toBeNull();
  });

  it('throws on a non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('nope', { status: 404 }));
    await expect(geocodeAddress('whatever')).rejects.toThrow(/Nominatim error: 404/);
  });

  it('propagates network errors', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(geocodeAddress('whatever')).rejects.toThrow(/Failed to fetch/);
  });
});

describe('reverseGeocode', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null for non-finite coordinates without calling fetch', async () => {
    expect(await reverseGeocode(Number.NaN, 4.9)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns a structured address from the reverse endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          lat: '52.3676',
          lon: '4.9041',
          display_name: 'Herengracht 1, 1015 BA Amsterdam, Noord-Holland, Nederland',
          address: {
            road: 'Herengracht',
            house_number: '1',
            city: 'Amsterdam',
            postcode: '1015 BA',
            country: 'Nederland',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await reverseGeocode(52.3676, 4.9041);
    expect(result?.street).toBe('Herengracht');
    expect(result?.city).toBe('Amsterdam');
    expect(result?.lat).toBe(52.3676);

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/reverse\?/);
    expect(String(url)).toMatch(/lat=52\.3676/);
    expect(String(url)).toMatch(/lon=4\.9041/);
  });

  it('returns null when the reverse endpoint reports no address', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unable to geocode' }), { status: 200 }),
    );
    expect(await reverseGeocode(0, 0)).toBeNull();
  });

  it('throws on a non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('boom', { status: 503 }));
    await expect(reverseGeocode(52.37, 4.9)).rejects.toThrow(/Nominatim error: 503/);
  });
});
