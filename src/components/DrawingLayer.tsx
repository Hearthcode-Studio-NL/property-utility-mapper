import { CircleMarker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { findSnapTarget, type Coord } from '../lib/snap';
import { CASING_COLOR } from '../lib/utilityColors';

interface DrawingLayerProps {
  vertices: Coord[];
  color: string;
  onVertexAdded: (v: Coord) => void;
  snapCandidates?: Coord[];
}

export default function DrawingLayer({
  vertices,
  color,
  onVertexAdded,
  snapCandidates = [],
}: DrawingLayerProps) {
  const map = useMap();

  useMapEvents({
    click(e) {
      const raw: Coord = [e.latlng.lat, e.latlng.lng];
      const snap = findSnapTarget(
        raw,
        snapCandidates,
        (c) => map.latLngToContainerPoint(c),
      );
      onVertexAdded(snap ?? raw);
    },
  });

  return (
    <>
      {vertices.length >= 2 && (
        <>
          <Polyline
            positions={vertices}
            pathOptions={{
              color: CASING_COLOR,
              weight: 7,
              dashArray: '6,8',
              opacity: 0.9,
              interactive: false,
            }}
          />
          <Polyline
            positions={vertices}
            pathOptions={{ color, weight: 4, dashArray: '6,8', interactive: false }}
          />
        </>
      )}
      {vertices.map((v, i) => (
        <CircleMarker
          key={i}
          center={v}
          radius={5}
          pathOptions={{
            color,
            fillColor: '#ffffff',
            fillOpacity: 1,
            weight: 2,
            interactive: false,
          }}
        />
      ))}
    </>
  );
}
