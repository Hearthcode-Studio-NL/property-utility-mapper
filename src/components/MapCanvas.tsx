import type { ReactNode } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface MapCanvasProps {
  lat: number;
  lng: number;
  zoom?: number;
  showMarker?: boolean;
  children?: ReactNode;
}

export default function MapCanvas({
  lat,
  lng,
  zoom = 18,
  showMarker = true,
  children,
}: MapCanvasProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      maxZoom={22}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={22}
        maxNativeZoom={19}
      />
      {showMarker && <Marker position={[lat, lng]} />}
      {children}
    </MapContainer>
  );
}
