import { useMemo, useState } from 'react';
import { CircleMarker, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { findBestSnap, type Coord, type Segment } from '../lib/snap';
import { CASING_COLOR } from '../lib/utilityColors';
import { casingWidth } from '../lib/lineWidth';

interface DrawingLayerProps {
  vertices: Coord[];
  color: string;
  /** Integer 1..8 — fill stroke width; casing is fill + 3 (v2.3.5). */
  thickness: number;
  onVertexAdded: (v: Coord) => void;
  snapCandidates?: Coord[];
  /** v2.3.7 — segments of every in-scope saved line for T-junction snap. */
  segmentCandidates?: Segment[];
}

export default function DrawingLayer({
  vertices,
  color,
  thickness,
  onVertexAdded,
  snapCandidates = [],
  segmentCandidates = [],
}: DrawingLayerProps) {
  const map = useMap();
  const fill = thickness;
  const casing = casingWidth(fill);
  // v2.3.7 — ghost crosshair preview. null when the cursor isn't within
  // snap threshold of any vertex or segment; lat/lng of the resolved snap
  // target otherwise. State only drives the visual; the click handler
  // resolves the snap itself so the two paths stay independent.
  const [snapPreview, setSnapPreview] = useState<Coord | null>(null);

  const ghostIcon = useMemo(
    () =>
      L.divIcon({
        className: 'snap-ghost',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        html: '',
      }),
    [],
  );

  useMapEvents({
    click(e) {
      const raw: Coord = [e.latlng.lat, e.latlng.lng];
      const snap = findBestSnap(
        raw,
        snapCandidates,
        segmentCandidates,
        (c) => map.latLngToContainerPoint(c),
      );
      onVertexAdded(snap ?? raw);
      setSnapPreview(null);
    },
    mousemove(e) {
      const raw: Coord = [e.latlng.lat, e.latlng.lng];
      const snap = findBestSnap(
        raw,
        snapCandidates,
        segmentCandidates,
        (c) => map.latLngToContainerPoint(c),
      );
      setSnapPreview(snap);
    },
    mouseout() {
      setSnapPreview(null);
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
      {snapPreview && (
        <Marker
          position={snapPreview}
          icon={ghostIcon}
          interactive={false}
          keyboard={false}
        />
      )}
    </>
  );
}
