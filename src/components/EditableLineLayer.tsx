import { useMemo, useState } from 'react';
import { Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { findBestSnap, type Coord, type Segment } from '../lib/snap';
import { CASING_COLOR } from '../lib/utilityColors';
import { casingWidth } from '../lib/lineWidth';

interface EditableLineLayerProps {
  vertices: Coord[];
  color: string;
  /** Integer 1..8 — fill stroke width; casing is fill + 3 (v2.3.5). */
  thickness: number;
  selectedIndex: number | null;
  onVertexMove: (index: number, pos: Coord) => void;
  onVertexMoveEnd: () => void;
  onVertexSelect: (index: number) => void;
  onInsertBetween: (afterIndex: number) => void;
  snapCandidates?: Coord[];
  /** v2.3.7 — segments of every OTHER saved line for T-junction snap. */
  segmentCandidates?: Segment[];
}

export default function EditableLineLayer({
  vertices,
  color,
  thickness,
  selectedIndex,
  onVertexMove,
  onVertexMoveEnd,
  onVertexSelect,
  onInsertBetween,
  snapCandidates = [],
  segmentCandidates = [],
}: EditableLineLayerProps) {
  const map = useMap();
  const fill = thickness;
  const casing = casingWidth(fill);
  // v2.3.7 — ghost crosshair during an active drag. Tracks the resolved
  // snap target (vertex OR perpendicular foot) for the vertex currently
  // being dragged, so the user sees where the drop will land before
  // releasing the mouse. Cleared on dragend regardless of whether a snap
  // was applied.
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

  const vertexIcon = useMemo(
    () =>
      L.divIcon({
        className: 'vertex-handle',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        html: '',
      }),
    [],
  );
  const selectedVertexIcon = useMemo(
    () =>
      L.divIcon({
        className: 'vertex-handle vertex-handle-selected',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: '',
      }),
    [],
  );
  const midpointIcon = useMemo(
    () =>
      L.divIcon({
        className: 'midpoint-handle',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        html: '',
      }),
    [],
  );

  const midpoints = vertices.slice(0, -1).map((a, i): Coord => {
    const b = vertices[i + 1];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  });

  return (
    <>
      <Polyline
        positions={vertices}
        pathOptions={{
          color: CASING_COLOR,
          weight: casing,
          opacity: 0.9,
          interactive: false,
        }}
      />
      <Polyline
        positions={vertices}
        pathOptions={{ color, weight: fill, opacity: 1, interactive: false }}
      />
      {vertices.map((v, i) => (
        <Marker
          key={`v-${i}`}
          position={v}
          draggable
          icon={i === selectedIndex ? selectedVertexIcon : vertexIcon}
          eventHandlers={{
            drag: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              const raw: Coord = [ll.lat, ll.lng];
              onVertexMove(i, raw);
              // Preview the snap target live so the user sees where the
              // drop will land. No commit yet — dragend is the source of
              // truth.
              const snap = findBestSnap(
                raw,
                snapCandidates,
                segmentCandidates,
                (c) => map.latLngToContainerPoint(c),
              );
              setSnapPreview(snap);
            },
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              const raw: Coord = [ll.lat, ll.lng];
              const snap = findBestSnap(
                raw,
                snapCandidates,
                segmentCandidates,
                (c) => map.latLngToContainerPoint(c),
              );
              if (snap) {
                onVertexMove(i, snap);
                (e.target as L.Marker).setLatLng(snap);
              }
              setSnapPreview(null);
              onVertexMoveEnd();
            },
            click: () => onVertexSelect(i),
          }}
        />
      ))}
      {midpoints.map((mp, i) => (
        <Marker
          key={`m-${i}`}
          position={mp}
          icon={midpointIcon}
          eventHandlers={{
            click: () => onInsertBetween(i),
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
