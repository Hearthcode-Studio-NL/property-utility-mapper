import { useMemo } from 'react';
import { Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { findSnapTarget, type Coord } from '../lib/snap';

interface EditableLineLayerProps {
  vertices: Coord[];
  color: string;
  selectedIndex: number | null;
  onVertexMove: (index: number, pos: Coord) => void;
  onVertexMoveEnd: () => void;
  onVertexSelect: (index: number) => void;
  onInsertBetween: (afterIndex: number) => void;
  snapCandidates?: Coord[];
}

export default function EditableLineLayer({
  vertices,
  color,
  selectedIndex,
  onVertexMove,
  onVertexMoveEnd,
  onVertexSelect,
  onInsertBetween,
  snapCandidates = [],
}: EditableLineLayerProps) {
  const map = useMap();

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
        pathOptions={{ color, weight: 5, opacity: 0.9, interactive: false }}
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
              onVertexMove(i, [ll.lat, ll.lng]);
            },
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              const raw: Coord = [ll.lat, ll.lng];
              const snap = findSnapTarget(
                raw,
                snapCandidates,
                (c) => map.latLngToContainerPoint(c),
              );
              if (snap) {
                onVertexMove(i, snap);
                (e.target as L.Marker).setLatLng(snap);
              }
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
    </>
  );
}
