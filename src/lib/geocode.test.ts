import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress } from './geocode';

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

  it('returns parsed coordinates when Nominatim finds a match', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify([
          { lat: '52.3676', lon: '4.9041', display_name: 'Amsterdam, Nederland' },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await geocodeAddress('Amsterdam');

    expect(result).toEqual({
      lat: 52.3676,
      lng: 4.9041,
      displayName: 'Amsterdam, Nederland',
    });
    expect(fetch).toHaveBeenCalledOnce();
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/nominatim\.openstreetmap\.org/);
    expect(String(url)).toMatch(/q=Amsterdam/);
  });

  it('returns null when Nominatim has no matches', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await geocodeAddress('nonexistent place');
    expect(result).toBeNull();
  });

  it('throws on a non-OK response from Nominatim', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('not found', { status: 404 }));

    await expect(geocodeAddress('whatever')).rejects.toThrow(/Nominatim error: 404/);
  });

  it('propagates network errors from fetch', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(geocodeAddress('whatever')).rejects.toThrow(/Failed to fetch/);
  });
});
