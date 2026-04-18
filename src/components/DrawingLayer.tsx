import { CircleMarker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { findSnapTarget, type Coord } from '../lib/snap';
import { CASING_COLOR } from '../lib/utilityColors';
import { casingWidth } from '../lib/lineWidth';

interface DrawingLayerProps {
  vertices: Coord[];
  color: string;
  /** Integer 1..8 — fill stroke width; casing is fill + 3 (v2.3.5). */
  thickness: number;
  onVertexAdded: (v: Coord) => void;
  snapCandidates?: Coord[];
}

export default function DrawingLayer({
  vertices,
  color,
  thickness,
  onVertexAdded,
  snapCandidates = [],
}: DrawingLayerProps) {
  const map = useMap();
  const fill = thickness;
  const casing = casingWidth(fill);

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
              weight: casing,
              dashArray: '6,8',
              opacity: 0.9,
              interactive: false,
            }}
          />
          <Polyline
            positions={vertices}
            pathOptions={{ color, weight: fill, dashArray: '6,8', interactive: false }}
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
