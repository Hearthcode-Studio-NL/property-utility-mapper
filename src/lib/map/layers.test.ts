import { describe, expect, it } from 'vitest';
import { LAYERS, findLayer, type BaseLayerId, type OverlayId } from './layers';

describe('layer catalogue', () => {
  it('has at least one entry', () => {
    expect(LAYERS.length).toBeGreaterThan(0);
  });

  it('every layer has a non-empty attribution', () => {
    for (const layer of LAYERS) {
      expect(layer.attribution.trim().length).toBeGreaterThan(0);
    }
  });

  it('every non-virtual layer has a non-empty tileUrl; virtual overlays have tileUrl=null', () => {
    for (const layer of LAYERS) {
      if (layer.kind === 'virtual-overlay') {
        expect(layer.tileUrl).toBeNull();
      } else {
        expect(typeof layer.tileUrl).toBe('string');
        // TypeScript narrows tileUrl to string when kind !== 'virtual-overlay'
        // after the branch above at runtime, but the const tuple types widen
        // to `string | null` in the else clause, hence the explicit narrowing.
        expect((layer.tileUrl as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('exactly one base layer has defaultOn=true', () => {
    const bases = LAYERS.filter((l) => l.kind === 'base');
    expect(bases.length).toBeGreaterThan(0);
    const defaults = bases.filter((l) => l.defaultOn === true);
    expect(defaults).toHaveLength(1);
  });

  it('has no duplicate ids', () => {
    const ids = LAYERS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('findLayer returns the right entry by id and undefined for unknown ids', () => {
    expect(findLayer('osm')?.kind).toBe('base');
    expect(findLayer('pdok-brt-grijs')?.kind).toBe('base');
    expect(findLayer('kadaster-brk')?.kind).toBe('overlay');
    expect(findLayer('user-drawings')?.kind).toBe('virtual-overlay');
    expect(findLayer('does-not-exist')).toBeUndefined();
  });

  describe('pdok-brt-grijs (neutral greyscale topographic base, v2.1.3 default)', () => {
    const grijs = findLayer('pdok-brt-grijs');

    it('is a base layer', () => {
      expect(grijs).toBeDefined();
      expect(grijs?.kind).toBe('base');
    });

    it('is the default base from v2.1.3 on', () => {
      expect(grijs?.defaultOn).toBe(true);
    });

    it('points at the PDOK BRT-Achtergrondkaart WMTS REST endpoint (grijs, EPSG:3857)', () => {
      expect(grijs?.tileUrl).toMatch(
        /^https:\/\/service\.pdok\.nl\/brt\/achtergrondkaart\/wmts\/v2_0\/grijs\/EPSG:3857\//,
      );
      // No wmsLayerName — WMTS REST is served as XYZ by <TileLayer>.
      expect(grijs?.wmsLayerName).toBeUndefined();
    });

    it('attributes the Kadaster BRT-Achtergrondkaart data source', () => {
      expect(grijs?.attribution).toMatch(/Kadaster/);
      expect(grijs?.attribution).toMatch(/BRT/);
    });
  });

  describe('pdok-luchtfoto-hr (PDOK Actueel_orthoHR, 8 cm)', () => {
    const hr = findLayer('pdok-luchtfoto-hr');

    it('is a base layer alongside the existing 25 cm Satelliet entry', () => {
      expect(hr).toBeDefined();
      expect(hr?.kind).toBe('base');
      // The existing 25 cm layer must stay put — adding HR is additive.
      expect(findLayer('pdok-luchtfoto')?.kind).toBe('base');
    });

    it('has a non-empty attribution string', () => {
      expect(hr?.attribution).toBeTruthy();
      expect(hr?.attribution.trim().length).toBeGreaterThan(0);
    });

    it('points at the PDOK Luchtfoto WMS endpoint with wmsLayerName Actueel_orthoHR', () => {
      expect(hr?.tileUrl).toMatch(/^https:\/\/service\.pdok\.nl\/.+\/wms\//);
      expect(hr?.wmsLayerName).toBe('Actueel_orthoHR');
    });

    it('is not defaultOn', () => {
      expect(hr?.defaultOn).not.toBe(true);
    });
  });

  /**
   * Compile-time type assertions.
   *
   * The runtime body of these tests is trivial — the real assertion is the
   * `@ts-expect-error` pragmas on the wrong-type lines. If the derived
   * unions `BaseLayerId` / `OverlayId` were incorrect (e.g. widened to
   * `string`, or missing a member), the pragma would itself become an
   * error when `tsc --noEmit` runs, failing `npm run typecheck`.
   */
  describe('derived types', () => {
    it('BaseLayerId is the union of every base-entry id', () => {
      const grijs: BaseLayerId = 'pdok-brt-grijs';
      const osm: BaseLayerId = 'osm';
      const luchtfoto: BaseLayerId = 'pdok-luchtfoto';
      const luchtfotoHr: BaseLayerId = 'pdok-luchtfoto-hr';
      // @ts-expect-error — overlay ids must not be assignable to BaseLayerId
      const kadaster: BaseLayerId = 'kadaster-brk';
      // @ts-expect-error — unknown ids must not be assignable to BaseLayerId
      const bogus: BaseLayerId = 'made-up';

      expect([grijs, osm, luchtfoto, luchtfotoHr, kadaster, bogus]).toHaveLength(6);
    });

    it('OverlayId is the union of every overlay + virtual-overlay id', () => {
      const kadaster: OverlayId = 'kadaster-brk';
      const drawings: OverlayId = 'user-drawings';
      // @ts-expect-error — base ids must not be assignable to OverlayId
      const osm: OverlayId = 'osm';
      // @ts-expect-error — unknown ids must not be assignable to OverlayId
      const bogus: OverlayId = 'dragons';

      expect([kadaster, drawings, osm, bogus]).toHaveLength(4);
    });
  });
});
