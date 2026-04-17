import type { UtilityLine, UtilityType, UUID } from '@/types';
import { UTILITY_META, UTILITY_TYPES } from '@/lib/utilityColors';
import type { GpsStatus } from '@/hooks/useGpsWalk';
import Legend from './Legend';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

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
      <div className="border-b p-3">
        {mode !== 'editing' && mode !== 'measuring' && (
          <div className="mb-3 flex flex-col gap-1.5">
            <Label htmlFor="type-select" className="text-xs uppercase tracking-wide text-muted-foreground">
              Type leiding
            </Label>
            <Select
              value={draftType}
              onValueChange={(v) => onDraftTypeChange(v as UtilityType)}
            >
              <SelectTrigger id="type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UTILITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {UTILITY_META[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {mode === 'idle' && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" onClick={onStartDraw}>Tekenen</Button>
              <Button size="sm" onClick={onStartSketch}>Schetsen</Button>
              <Button size="sm" onClick={onStartWalk}>Lopen</Button>
            </div>
            <Button variant="outline" size="sm" onClick={onStartMeasure}>
              Afstand meten
            </Button>
          </div>
        )}

        {mode === 'drawing' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Klik op de kaart om punten toe te voegen. {draftCount} geplaatst.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onUndoVertex}
                disabled={draftCount === 0}
              >
                Ongedaan
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={onFinishDraft}
                disabled={draftCount < 2}
              >
                Klaar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onCancelDraft}
              >
                Annuleren
              </Button>
            </div>
          </div>
        )}

        {mode === 'walking' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{GPS_STATUS_LABEL[gpsStatus] || '\u00A0'}</span>
              <span>
                {gpsAccuracy !== null ? `±${Math.round(gpsAccuracy)} m` : ''}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Loop de leiding. {draftCount} {draftCount === 1 ? 'punt' : 'punten'} vastgelegd.
            </p>
            {gpsError && <p className="text-xs text-destructive">{gpsError}</p>}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={onFinishDraft}
                disabled={draftCount < 2}
              >
                Klaar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onCancelDraft}
              >
                Annuleren
              </Button>
            </div>
          </div>
        )}

        {mode === 'sketching' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Sleep over de kaart om te schetsen. {draftCount}{' '}
              {draftCount === 1 ? 'punt' : 'punten'}.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={onFinishDraft}
                disabled={draftCount < 2}
              >
                Klaar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onCancelDraft}
              >
                Annuleren
              </Button>
            </div>
          </div>
        )}

        {mode === 'editing' && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Punten bewerken
            </h3>
            <p className="text-xs text-muted-foreground">
              {draftCount} {draftCount === 1 ? 'punt' : 'punten'}. Sleep om te verplaatsen. Klik een
              stippelcirkel tussen twee punten om er een toe te voegen.
            </p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
                onClick={onDeleteSelectedVertex}
                disabled={!editingCanDeleteVertex}
              >
                Verwijder punt
              </Button>
              <Button size="sm" className="flex-1" onClick={onFinishEditing}>
                Klaar
              </Button>
            </div>
          </div>
        )}

        {mode === 'measuring' && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Afstand meten
            </h3>
            {measureCount < 2 ? (
              <p className="text-xs text-muted-foreground">
                Klik op twee of meer punten op de kaart.
              </p>
            ) : (
              <p className="text-sm">
                <span className="font-semibold">{measureDistanceLabel}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  ({measureCount} punten)
                </span>
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={onUndoMeasurePoint}
                disabled={measureCount === 0}
              >
                Ongedaan
              </Button>
              <Button size="sm" className="flex-1" onClick={onFinishMeasure}>
                Klaar
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
                  className="flex w-full items-center gap-2 rounded-md border bg-card p-2 text-left text-sm text-card-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded"
                    style={{ backgroundColor: UTILITY_META[line.type].color }}
                    aria-hidden
                  />
                  <span className="flex-1 truncate">
                    <span className="font-medium">{UTILITY_META[line.type].label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {line.vertices.length} pt
                    </span>
                  </span>
                  {line.depthCm !== undefined && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {line.depthCm} cm
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Separator />
      <Legend />

      <div className="border-t p-3">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Exporteren
        </h3>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportGeoJson}
            disabled={exportsDisabled}
          >
            {exporting === 'geojson' ? '…' : 'GeoJSON'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExportPng}
            disabled={exportsDisabled}
          >
            {exporting === 'png' ? '…' : 'PNG'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExportPdf}
            disabled={exportsDisabled}
          >
            {exporting === 'pdf' ? '…' : 'PDF'}
          </Button>
        </div>
        {mode !== 'idle' && (
          <p className="mt-2 text-xs text-muted-foreground">
            Rond uw tekening af of annuleer om te exporteren.
          </p>
        )}
        {exportError && <p className="mt-2 text-xs text-destructive">{exportError}</p>}
      </div>
    </div>
  );
}

function EmptyLines() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-6 text-center">
      <svg
        width="40"
        height="40"
        viewBox="0 0 40 40"
        fill="none"
        className="text-muted-foreground"
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
      <p className="text-sm text-foreground">Nog geen leidingen.</p>
      <p className="text-xs text-muted-foreground">Teken of loop er hierboven een.</p>
    </div>
  );
}
