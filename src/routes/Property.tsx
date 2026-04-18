import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { getProperty } from '../db/properties';
import DeletePropertyDialog from '@/components/DeletePropertyDialog';
import PropertyNotesCover from '@/components/PropertyNotesCover';
import { Button } from '@/components/ui/button';
import {
  addUtilityLine,
  deleteUtilityLine,
  listLinesForProperty,
  updateUtilityLine,
  type UtilityLinePatch,
} from '../db/utilityLines';
import type { UtilityLine, UtilityType, UUID } from '../types';
import { UTILITY_META } from '../lib/utilityColors';
import { useThicknessDefault } from '../hooks/useThicknessDefault';
import { formatDisplayAddress } from '../lib/address';
import { ModeToggle } from '@/components/mode-toggle';
import LayerManagerButton from '@/components/map/LayerManagerButton';
import { formatMeters, pathLengthMeters } from '../lib/distance';
import { useGpsWalk } from '../hooks/useGpsWalk';
import { useLayerSelection } from '@/hooks/useLayerSelection';
import MapCanvas from '../components/MapCanvas';
import DrawingLayer from '../components/DrawingLayer';
import LinesLayer from '../components/LinesLayer';
import WalkingLayer from '../components/WalkingLayer';
import EditableLineLayer from '../components/EditableLineLayer';
import MeasureLayer from '../components/MeasureLayer';
import LinesPanel, { type Mode } from '../components/LinesPanel';
import UtilityLineEditor from '../components/UtilityLineEditor';

type ExportKind = 'geojson' | 'png' | 'pdf';

export default function Property() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const property = useLiveQuery(
    async () => (id ? ((await getProperty(id)) ?? null) : null),
    [id],
  );
  const lines = useLiveQuery<UtilityLine[], UtilityLine[]>(
    async () => (id ? await listLinesForProperty(id) : []),
    [id],
    [],
  );

  const [mode, setMode] = useState<Mode>('idle');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draftType, setDraftType] = useState<UtilityType>('water');
  const [draftThickness, setDraftThickness] = useThicknessDefault();
  const [clickVertices, setClickVertices] = useState<[number, number][]>([]);
  const [editingLineId, setEditingLineId] = useState<UUID | null>(null);
  const [editingGeometryLineId, setEditingGeometryLineId] = useState<UUID | null>(null);
  const [editingVertices, setEditingVertices] = useState<[number, number][]>([]);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
  const [measurePoints, setMeasurePoints] = useState<[number, number][]>([]);
  const layerSelection = useLayerSelection();
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const gps = useGpsWalk({ active: mode === 'walking' });
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const editingVerticesRef = useRef<[number, number][]>([]);

  const editingLine = useMemo(
    () => lines.find((l) => l.id === editingLineId) ?? null,
    [lines, editingLineId],
  );
  const editingLineRecord = useMemo(
    () => lines.find((l) => l.id === editingGeometryLineId) ?? null,
    [lines, editingGeometryLineId],
  );
  const measureDistanceLabel = useMemo(
    () => (measurePoints.length >= 2 ? formatMeters(pathLengthMeters(measurePoints)) : ''),
    [measurePoints],
  );
  const drawingSnapCandidates = useMemo<[number, number][]>(
    () => lines.flatMap((l) => l.vertices),
    [lines],
  );
  const editingSnapCandidates = useMemo<[number, number][]>(
    () =>
      lines.filter((l) => l.id !== editingGeometryLineId).flatMap((l) => l.vertices),
    [lines, editingGeometryLineId],
  );

  if (!id) return <Shell>Ongeldige URL.</Shell>;
  if (property === undefined) return <Shell>Laden…</Shell>;
  if (property === null) return <Shell>Locatie niet gevonden.</Shell>;

  const propertyId = id;
  const draftVertices =
    mode === 'walking' ? gps.points : clickVertices;
  const draftColor = UTILITY_META[draftType].color;

  function resetDrafts() {
    setClickVertices([]);
    gps.reset();
  }

  function startDraw() {
    resetDrafts();
    setMode('drawing');
  }

  function startWalk() {
    resetDrafts();
    setMode('walking');
  }

  function cancelDraft() {
    resetDrafts();
    setMode('idle');
  }

  async function finishDraft() {
    if (draftVertices.length < 2) return;
    await addUtilityLine({
      propertyId,
      type: draftType,
      vertices: draftVertices,
      thickness: draftThickness,
    });
    resetDrafts();
    setMode('idle');
  }

  function undoVertex() {
    setClickVertices((vs) => vs.slice(0, -1));
  }

  function addVertex(v: [number, number]) {
    setClickVertices((vs) => [...vs, v]);
  }

  async function saveLine(patch: UtilityLinePatch) {
    if (!editingLineId) return;
    await updateUtilityLine(editingLineId, patch);
    // Remember the user's thickness choice as the default for the next
    // fresh line — persisted via useThicknessDefault's localStorage write.
    if (patch.thickness) setDraftThickness(patch.thickness);
    setEditingLineId(null);
  }

  async function handleDeleteLine() {
    if (!editingLineId) return;
    if (!confirm('Deze leiding verwijderen?')) return;
    await deleteUtilityLine(editingLineId);
    setEditingLineId(null);
  }

  function applyEditingVertices(next: [number, number][]) {
    editingVerticesRef.current = next;
    setEditingVertices(next);
  }

  function startEditGeometry() {
    if (!editingLine) return;
    applyEditingVertices(editingLine.vertices);
    setEditingGeometryLineId(editingLine.id);
    setSelectedVertexIndex(null);
    setEditingLineId(null);
    setMode('editing');
  }

  function finishEditGeometry() {
    setMode('idle');
    setEditingGeometryLineId(null);
    setSelectedVertexIndex(null);
    applyEditingVertices([]);
  }

  function onVertexMove(index: number, pos: [number, number]) {
    const next = [...editingVerticesRef.current];
    next[index] = pos;
    applyEditingVertices(next);
  }

  async function onVertexMoveEnd() {
    const lineId = editingGeometryLineId;
    if (!lineId) return;
    await updateUtilityLine(lineId, { vertices: editingVerticesRef.current });
  }

  async function insertVertexBetween(afterIndex: number) {
    const current = editingVerticesRef.current;
    const a = current[afterIndex];
    const b = current[afterIndex + 1];
    if (!a || !b) return;
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const next = [...current.slice(0, afterIndex + 1), mid, ...current.slice(afterIndex + 1)];
    applyEditingVertices(next);
    setSelectedVertexIndex(afterIndex + 1);
    if (editingGeometryLineId) {
      await updateUtilityLine(editingGeometryLineId, { vertices: next });
    }
  }

  async function deleteSelectedVertex() {
    const current = editingVerticesRef.current;
    if (selectedVertexIndex === null || current.length <= 2) return;
    const next = current.filter((_, i) => i !== selectedVertexIndex);
    applyEditingVertices(next);
    setSelectedVertexIndex(null);
    if (editingGeometryLineId) {
      await updateUtilityLine(editingGeometryLineId, { vertices: next });
    }
  }

  function startMeasure() {
    setMeasurePoints([]);
    setMode('measuring');
  }

  function addMeasurePoint(p: [number, number]) {
    setMeasurePoints((pts) => [...pts, p]);
  }

  function undoMeasurePoint() {
    setMeasurePoints((pts) => pts.slice(0, -1));
  }

  function finishMeasure() {
    setMeasurePoints([]);
    setMode('idle');
  }

  async function runExport(kind: ExportKind): Promise<void> {
    if (exporting || !property) return;
    setExportError(null);
    setExporting(kind);
    try {
      if (kind === 'geojson') {
        const { exportGeoJson } = await import('../lib/export/geojson');
        exportGeoJson(property, lines);
      } else {
        const el = mapContainerRef.current;
        if (!el) throw new Error('Map not ready yet.');
        if (kind === 'png') {
          const { exportPng } = await import('../lib/export/png');
          await exportPng(el, property);
        } else {
          const { exportPdf } = await import('../lib/export/pdf');
          await exportPdf(el, property, lines);
        }
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  }

  const isDrafting = mode !== 'idle';
  const editingColor = editingLineRecord
    ? UTILITY_META[editingLineRecord.type].color
    : UTILITY_META[draftType].color;
  const editingCanDeleteVertex =
    mode === 'editing' && selectedVertexIndex !== null && editingVertices.length > 2;
  const bannerText =
    mode === 'drawing'
      ? `${UTILITY_META[draftType].label} tekenen — klik op de kaart`
      : mode === 'walking'
        ? `${UTILITY_META[draftType].label} lopen — beweeg om punten vast te leggen`
        : mode === 'editing' && editingLineRecord
          ? `${UTILITY_META[editingLineRecord.type].label} bewerken — sleep punten of klik tussenpunten`
          : mode === 'measuring'
            ? measureDistanceLabel
              ? `Afstand: ${measureDistanceLabel}`
              : 'Afstand meten — klik op de kaart'
            : '';

  return (
    <div className="flex min-h-full flex-col md:h-full">
      <header className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <Link to="/" className="text-sm text-muted-foreground hover:underline">
            ← Alle locaties
          </Link>
          <h1 className="truncate text-lg font-semibold">{formatDisplayAddress(property)}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {property.centerLat.toFixed(5)}, {property.centerLng.toFixed(5)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Verwijder adres
          </Button>
          <ModeToggle />
        </div>
      </header>

      <PropertyNotesCover property={property} />

      {/*
        Desktop: flex-row with overflow-hidden so the map + side panel
        split horizontally and neither scrolls the outer page.
        Mobile: stacked and natural page-flow (no overflow-hidden) so
        the LinesPanel below the map is reachable by page scroll —
        PropertyNotesCover + header can push the panel past the
        viewport edge and nothing clips. h-[55vh] keeps the map
        usable above the fold; users scroll down to reach the panel.
      */}
      <div className="flex flex-1 flex-col md:flex-row md:overflow-hidden">
        <div ref={mapContainerRef} className="relative h-[55vh] md:h-auto md:flex-1">
          <MapCanvas
            lat={property.centerLat}
            lng={property.centerLng}
            showMarker={false}
            selection={layerSelection}
          >
            {layerSelection.overlays.has('user-drawings') && (
              <LinesLayer
                lines={lines}
                onLineClick={setEditingLineId}
                interactive={!isDrafting}
                hideLineId={mode === 'editing' ? editingGeometryLineId : null}
              />
            )}
            {mode === 'drawing' && (
              <DrawingLayer
                vertices={clickVertices}
                color={draftColor}
                thickness={draftThickness}
                onVertexAdded={addVertex}
                snapCandidates={drawingSnapCandidates}
              />
            )}
            {mode === 'walking' && (
              <WalkingLayer
                points={gps.points}
                current={gps.latest}
                color={draftColor}
                follow
              />
            )}
            {mode === 'editing' && (
              <EditableLineLayer
                vertices={editingVertices}
                color={editingColor}
                thickness={editingLineRecord?.thickness ?? draftThickness}
                selectedIndex={selectedVertexIndex}
                onVertexMove={onVertexMove}
                onVertexMoveEnd={onVertexMoveEnd}
                onVertexSelect={setSelectedVertexIndex}
                onInsertBetween={insertVertexBetween}
                snapCandidates={editingSnapCandidates}
              />
            )}
            {mode === 'measuring' && (
              <MeasureLayer points={measurePoints} onPointAdded={addMeasurePoint} />
            )}
          </MapCanvas>
          {isDrafting && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-[500] -translate-x-1/2 rounded-full bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground shadow-lg">
              {bannerText}
            </div>
          )}
          <div className="absolute right-3 top-3 z-[1000]">
            <LayerManagerButton />
          </div>
        </div>
        <aside className="w-full border-t bg-background md:w-80 md:border-l md:border-t-0">
          <LinesPanel
            lines={lines}
            mode={mode}
            draftType={draftType}
            draftCount={mode === 'editing' ? editingVertices.length : draftVertices.length}
            gpsStatus={gps.status}
            gpsError={gps.error}
            gpsAccuracy={gps.latest?.accuracy ?? null}
            editingCanDeleteVertex={editingCanDeleteVertex}
            measureCount={measurePoints.length}
            measureDistanceLabel={measureDistanceLabel}
            exporting={exporting}
            exportError={exportError}
            onDraftTypeChange={setDraftType}
            onStartDraw={startDraw}
            onStartWalk={startWalk}
            onStartMeasure={startMeasure}
            onFinishDraft={finishDraft}
            onCancelDraft={cancelDraft}
            onUndoVertex={undoVertex}
            onDeleteSelectedVertex={deleteSelectedVertex}
            onFinishEditing={finishEditGeometry}
            onUndoMeasurePoint={undoMeasurePoint}
            onFinishMeasure={finishMeasure}
            onEditLine={setEditingLineId}
            onExportGeoJson={() => runExport('geojson')}
            onExportPng={() => runExport('png')}
            onExportPdf={() => runExport('pdf')}
          />
        </aside>
      </div>

      {editingLine && (
        <UtilityLineEditor
          line={editingLine}
          onSave={saveLine}
          onDelete={handleDeleteLine}
          onEditGeometry={startEditGeometry}
          onClose={() => setEditingLineId(null)}
        />
      )}

      <DeletePropertyDialog
        property={property}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => navigate('/')}
      />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Alle locaties
      </Link>
      <p className="mt-4 text-foreground">{children}</p>
    </main>
  );
}
