/**
 * Map-layer types.
 *
 * The shape types (`LayerKind`, `LayerEntry`) live here per CLAUDE.md's
 * convention (shared types in `src/types/*`). The concrete string-literal
 * unions `BaseLayerId` / `OverlayId` are derived from the runtime
 * catalogue in `src/lib/map/layers.ts` and re-exported here so consumers
 * have a single import path. Type-only imports avoid any runtime cycle.
 */

import type { BaseLayerId, OverlayId } from '@/lib/map/layers';

export type LayerKind = 'base' | 'overlay' | 'virtual-overlay';

export interface LayerEntry {
  /** Stable identifier, used as a key in state and localStorage. */
  id: string;
  kind: LayerKind;
  /** Dutch label for the UI. */
  labelNl: string;
  /** Attribution string. Shown by the map control / credits. */
  attribution: string;
  /**
   * Tile URL template (XYZ / WMTS-REST placeholders like `{z}/{x}/{y}`)
   * OR a WMS GetMap base URL when `wmsLayerName` is also set.
   * `null` only for `virtual-overlay` — those have no tile source.
   */
  tileUrl: string | null;
  /**
   * Set when this layer is served over WMS. The renderer passes it as
   * the `layers` parameter to `<WMSTileLayer layers=…>`. Omitted for
   * XYZ and WMTS-REST layers.
   */
  wmsLayerName?: string;
  /** Highest zoom the server actually serves; Leaflet upscales above. */
  maxNativeZoom?: number;
  /** Highest zoom the user can zoom to (independent of tile availability). */
  maxZoom?: number;
  /** Overlays: initial state when nothing is persisted. Base layers: exactly one must be true. */
  defaultOn?: boolean;
}

export type { BaseLayerId, OverlayId };

/**
 * Selection state for a property-page map.
 * `base` is a single pick (radio-style); `overlays` is a set of toggles.
 */
export interface LayerSelection {
  base: BaseLayerId;
  overlays: Set<OverlayId>;
}
