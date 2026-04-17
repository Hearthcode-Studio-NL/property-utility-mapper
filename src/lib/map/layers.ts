import type { LayerEntry } from '@/types/map';

/**
 * The map-layer catalogue.
 *
 * `as const satisfies readonly LayerEntry[]` keeps every field as a string
 * literal type (so `id` becomes `'osm' | 'pdok-luchtfoto' | …`) while still
 * enforcing conformance to `LayerEntry`. The derived `BaseLayerId` and
 * `OverlayId` unions below are what the rest of the app uses as stable
 * identifiers.
 *
 * No UI consumes this yet — that's Phase B / C of V2.1.
 */
export const LAYERS = [
  {
    id: 'osm',
    kind: 'base',
    labelNl: 'Kaart',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers',
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxNativeZoom: 19,
    maxZoom: 22,
    defaultOn: true,
  },
  {
    // PDOK Luchtfoto Actueel Ortho 25 cm, via WMS.
    // The WMTS REST variant at /Actueel_ortho25/EPSG:3857/{z}/{y}/{x}.jpeg
    // returned blank tiles in our setup; WMS is the reliable path and uses
    // the same pattern as Kadaster (see below). PDOK serves RGB photo at
    // image/jpeg — we flag that in MapCanvas via the base-kind branch.
    id: 'pdok-luchtfoto',
    kind: 'base',
    labelNl: 'Satelliet',
    attribution:
      '&copy; <a href="https://www.kadaster.nl">Kadaster</a> / <a href="https://www.pdok.nl">PDOK</a>',
    tileUrl: 'https://service.pdok.nl/hwh/luchtfotorgb/wms/v1_0',
    wmsLayerName: 'Actueel_ortho25',
    maxZoom: 22,
    defaultOn: false,
  },
  {
    // Served as WMS (GetMap), not XYZ. `tileUrl` is the base service URL;
    // `wmsLayerName` tells MapCanvas which layer to request when it
    // builds a `<WMSTileLayer>` for this entry.
    id: 'kadaster-brk',
    kind: 'overlay',
    labelNl: 'Kadastrale Kaart',
    attribution: '&copy; <a href="https://www.kadaster.nl">Kadaster</a>',
    tileUrl: 'https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0',
    wmsLayerName: 'KadastraleKaart',
    maxZoom: 22,
    defaultOn: true,
  },
  {
    // Virtual: rendered by the app itself (the SVG lines layer), not a
    // remote tile service. `tileUrl` is null on purpose — Phase C will
    // gate the rendering of `LinesLayer` on the selection of this id.
    id: 'user-drawings',
    kind: 'virtual-overlay',
    labelNl: 'Getekende leidingen',
    attribution: 'Eigen tekeningen',
    tileUrl: null,
    defaultOn: true,
  },
] as const satisfies readonly LayerEntry[];

/** Union of every `id` whose `kind` is `'base'`. */
export type BaseLayerId = Extract<(typeof LAYERS)[number], { kind: 'base' }>['id'];

/** Union of every `id` whose `kind` is an overlay (either kind). */
export type OverlayId = Extract<
  (typeof LAYERS)[number],
  { kind: 'overlay' | 'virtual-overlay' }
>['id'];

/** Lookup helper — O(n) over a tiny static array, safe to use anywhere. */
export function findLayer(id: string): LayerEntry | undefined {
  return LAYERS.find((l) => l.id === id);
}
