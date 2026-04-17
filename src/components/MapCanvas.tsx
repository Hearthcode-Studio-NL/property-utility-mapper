import type { ReactNode } from 'react';
import { MapContainer, Marker, TileLayer, WMSTileLayer } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

import { LAYERS } from '@/lib/map/layers';
import type { LayerEntry, LayerSelection, OverlayId } from '@/types/map';

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Explicit z-order inside Leaflet's tilePane. Base tiles always below,
// overlays always above — regardless of mount order. Without these, a
// base-layer swap would remount the base AFTER the existing overlay,
// Leaflet would stack it on top, and overlays looked like they vanished.
const BASE_Z = 1;
const OVERLAY_Z = 10;

interface MapCanvasProps {
  lat: number;
  lng: number;
  zoom?: number;
  showMarker?: boolean;
  /**
   * Layer selection from `useLayerSelection`. MapCanvas renders the active
   * base layer and every active non-virtual overlay from the catalogue.
   * Virtual overlays (e.g. "user-drawings") are rendered by the parent —
   * MapCanvas just skips them here.
   */
  selection: LayerSelection;
  children?: ReactNode;
}

function renderLayer(
  layer: LayerEntry,
  zIndex: number,
  { opaque }: { opaque: boolean },
): ReactNode {
  if (!layer.tileUrl) return null;

  if (layer.wmsLayerName) {
    // Opaque bases (Luchtfoto) use JPEG + non-transparent.
    // Overlays (Kadaster) use PNG + transparent so the base shows through.
    return (
      <WMSTileLayer
        key={layer.id}
        url={layer.tileUrl}
        layers={layer.wmsLayerName}
        format={opaque ? 'image/jpeg' : 'image/png'}
        transparent={!opaque}
        opacity={opaque ? 1 : 0.7}
        maxZoom={layer.maxZoom}
        maxNativeZoom={layer.maxNativeZoom}
        zIndex={zIndex}
        attribution={layer.attribution}
      />
    );
  }

  return (
    <TileLayer
      key={layer.id}
      attribution={layer.attribution}
      url={layer.tileUrl}
      maxZoom={layer.maxZoom}
      maxNativeZoom={layer.maxNativeZoom}
      zIndex={zIndex}
    />
  );
}

export default function MapCanvas({
  lat,
  lng,
  zoom = 18,
  showMarker = true,
  selection,
  children,
}: MapCanvasProps) {
  const layers = LAYERS as readonly LayerEntry[];
  const baseLayer = layers.find(
    (l) => l.kind === 'base' && l.id === selection.base,
  );
  const activeOverlays = layers.filter(
    (l) =>
      l.kind === 'overlay' && selection.overlays.has(l.id as OverlayId),
  );

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      maxZoom={22}
      scrollWheelZoom
      className="h-full w-full"
    >
      {baseLayer && renderLayer(baseLayer, BASE_Z, { opaque: true })}

      {activeOverlays.map((overlay) =>
        renderLayer(overlay, OVERLAY_Z, { opaque: false }),
      )}

      {showMarker && <Marker position={[lat, lng]} />}
      {children}
    </MapContainer>
  );
}
