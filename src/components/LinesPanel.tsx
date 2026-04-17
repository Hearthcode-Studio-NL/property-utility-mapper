import type { UtilityLine, UtilityType, UUID } from '../types';
import { UTILITY_META, UTILITY_TYPES } from '../lib/utilityColors';
import type { GpsStatus } from '../hooks/useGpsWalk';
import Legend from './Legend';

export type Mode = 'idle' | 'drawing' | 'walking' | 'editing' | 'measuring' | 'sketching';

interface LinesPanelProps {
  lines: UtilityLine[];
  mode: Mode;
  draftType: UtilityType;
  draftCount: number;
  gpsStatus: GpsStatus;
  gpsError: string | null;
  gpsAccuracy: number | null;
  editingCanDeleteVertex: boolean;
  measureCount: number;
  measureDistanceLabel: string;
  exporting: null | 'geojson' | 'png' | 'pdf';
  exportError: string | null;
  onDraftTypeChange: (t: UtilityType) => void;
  onStartDraw: () => void;
  onStartWalk: () => void;
  onStartSketch: () => void;
  onStartMeasure: () => void;
  onFinishDraft: () => void;
  onCancelDraft: () => void;
  onUndoVertex: () => void;
  onDeleteSelectedVertex: () => void;
  onFinishEditing: () => void;
  onUndoMeasurePoint: () => void;
  onFinishMeasure: () => void;
  onEditLine: (id: UUID) => void;
  onExportGeoJson: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
}

const GPS_STATUS_LABEL: Record<GpsStatus, string> = {
  idle: '',
  starting: 'GPS zoeken…',
  watching: 'GPS actief',
  denied: 'Locatietoestemming geweigerd',
  unavailable: 'GPS niet beschikbaar',
  error: 'GPS-fout',
};

export default function LinesPanel({
  lines,
  mode,
  draftType,
  draftCount,
  gpsStatus,
  gpsError,
  gpsAccuracy,
  editingCanDeleteVertex,
  measureCount,
  measureDistanceLabel,
  exporting,
  exportError,
  onDraftTypeChange,
  onStartDraw,
  onStartWalk,
  onStartSketch,
  onStartMeasure,
  onFinishDraft,
  onCancelDraft,
  onUndoVertex,
  onDeleteSelectedVertex,
  onFinishEditing,
  onUndoMeasurePoint,
  onFinishMeasure,
  onEditLine,
  onExportGeoJson,
  onExportPng,
  onExportPdf,
}: LinesPanelProps) {
  const exportsDisabled = mode !== 'idle' || exporting !== null;
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-3">
        {mode !== 'editing' && mode !== 'measuring' && (
          <label className="mb-2 flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Type leiding
            </span>
            <select
              value={draftType}
              onChange={(e) => onDraftTypeChange(e.target.value as UtilityType)}
              className="rounded border border-slate-300 px-2 py-1"
            >
              {UTILITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {UTILITY_META[t].label}
                </option>
              ))}
            </select>
          </label>
        )}

        {mode === 'idle' && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={onStartDraw}
                className="rounded bg-slate-900 px-2 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Tekenen
              </button>
              <button
                onClick={onStartSketch}
                className="rounded bg-indigo-600 px-2 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Schetsen
              </button>
              <button
                onClick={onStartWalk}
                className="rounded bg-emerald-600 px-2 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Lopen
              </button>
            </div>
            <button
              onClick={onStartMeasure}
              className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              Afstand meten
            </button>
          </div>
        )}

        {mode === 'drawing' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-500">
              Klik op de kaart om punten toe te voegen. {draftCount} geplaatst.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onUndoVertex}
                disabled={draftCount === 0}
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ongedaan
              </button>
              <button
                onClick={onFinishDraft}
                disabled={draftCount < 2}
                className="flex-1 rounded bg-green-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Klaar
              </button>
              <button
                onClick={onCancelDraft}
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-100"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}

        {mode === 'walking' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{GPS_STATUS_LABEL[gpsStatus] || '\u00A0'}</span>
              <span>
                {gpsAccuracy !== null ? `±${Math.round(gpsAccuracy)} m` : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Loop de leiding. {draftCount} {draftCount === 1 ? 'punt' : 'punten'} vastgelegd.
            </p>
            {gpsError && <p className="text-xs text-red-600">{gpsError}</p>}
            <div className="flex gap-2">
              <button
                onClick={onFinishDraft}
                disabled={draftCount < 2}
                className="flex-1 rounded bg-green-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Klaar
              </button>
              <button
                onClick={onCancelDraft}
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-100"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}

        {mode === 'sketching' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-500">
              Sleep over de kaart om te schetsen. {draftCount}{' '}
              {draftCount === 1 ? 'punt' : 'punten'}.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onFinishDraft}
                disabled={draftCount < 2}
                className="flex-1 rounded bg-green-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Klaar
              </button>
              <button
                onClick={onCancelDraft}
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-100"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}

        {mode === 'editing' && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Punten bewerken
            </h3>
            <p className="text-xs text-slate-500">
              {draftCount} {draftCount === 1 ? 'punt' : 'punten'}. Sleep om te verplaatsen. Klik een
              stippelcirkel tussen twee punten om er een toe te voegen.
            </p>
            <div className="flex gap-2">
              <button
                onClick={onDeleteSelectedVertex}
                disabled={!editingCanDeleteVertex}
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Verwijder punt
              </button>
              <button
                onClick={onFinishEditing}
                className="flex-1 rounded bg-slate-900 px-2 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Klaar
              </button>
            </div>
          </div>
        )}

        {mode === 'measuring' && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Afstand meten
            </h3>
            {measureCount < 2 ? (
              <p className="text-xs text-slate-500">
                Klik op twee of meer punten op de kaart.
              </p>
            ) : (
              <p className="text-sm">
                <span className="font-semibold">{measureDistanceLabel}</span>
                <span className="ml-2 text-xs text-slate-500">
                  ({measureCount} punten)
                </span>
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={onUndoMeasurePoint}
                disabled={measureCount === 0}
                className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ongedaan
              </button>
              <button
                onClick={onFinishMeasure}
                className="flex-1 rounded bg-slate-900 px-2 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Klaar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Opgeslagen leidingen ({lines.length})
        </h3>
        {lines.length === 0 ? (
          <EmptyLines />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {lines.map((line) => (
              <li key={line.id}>
                <button
                  onClick={() => onEditLine(line.id)}
                  className="flex w-full items-center gap-2 rounded border border-slate-200 p-2 text-left text-sm hover:bg-slate-50"
                >
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded"
                    style={{ backgroundColor: UTILITY_META[line.type].color }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">
                    <span className="font-medium">{UTILITY_META[line.type].label}</span>
                    <span className="ml-2 text-xs text-slate-500">
                      {line.vertices.length} pt
                    </span>
                  </span>
                  {line.depthCm !== undefined && (
                    <span className="shrink-0 text-xs text-slate-500">{line.depthCm} cm</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Legend />

      <div className="border-t border-slate-200 p-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Exporteren
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onExportGeoJson}
            disabled={exportsDisabled}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === 'geojson' ? '…' : 'GeoJSON'}
          </button>
          <button
            onClick={onExportPng}
            disabled={exportsDisabled}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === 'png' ? '…' : 'PNG'}
          </button>
          <button
            onClick={onExportPdf}
            disabled={exportsDisabled}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {exporting === 'pdf' ? '…' : 'PDF'}
          </button>
        </div>
        {mode !== 'idle' && (
          <p className="mt-2 text-xs text-slate-500">
            Rond uw tekening af of annuleer om te exporteren.
          </p>
        )}
        {exportError && <p className="mt-2 text-xs text-red-600">{exportError}</p>}
      </div>
    </div>
  );
}

function EmptyLines() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        className="text-slate-400"
        aria-hidden
      >
        <path
          d="M6 12 Q 14 4 20 14 T 34 10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M6 24 L34 24"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
        <circle cx="6" cy="24" r="2.5" fill="currentColor" />
        <circle cx="34" cy="24" r="2.5" fill="currentColor" />
      </svg>
      <p className="text-sm text-slate-500">Nog geen leidingen.</p>
      <p className="text-xs text-slate-400">Teken of loop er hierboven een.</p>
    </div>
  );
}
