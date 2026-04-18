import { useState, type FormEvent } from 'react';
import type { LineThickness, UtilityLine, UtilityType } from '@/types';
import { LINE_THICKNESSES } from '@/types';
import type { UtilityLinePatch } from '@/db/utilityLines';
import { CASING_COLOR, UTILITY_META, UTILITY_TYPES } from '@/lib/utilityColors';
import { formatMeters, pathLengthMeters } from '@/lib/distance';
import {
  LINE_THICKNESS_LABEL_NL,
  LINE_WIDTH,
} from '@/lib/lineThickness';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import PhotoUploader from '@/components/PhotoUploader';
import PhotoGrid from '@/components/PhotoGrid';

interface UtilityLineEditorProps {
  line: UtilityLine;
  onSave: (patch: UtilityLinePatch) => void;
  onDelete: () => void;
  onEditGeometry: () => void;
  onClose: () => void;
}

export default function UtilityLineEditor({
  line,
  onSave,
  onDelete,
  onEditGeometry,
  onClose,
}: UtilityLineEditorProps) {
  const [type, setType] = useState<UtilityType>(line.type);
  const [thickness, setThickness] = useState<LineThickness>(line.thickness);
  const [depthCm, setDepthCm] = useState(line.depthCm?.toString() ?? '');
  const [material, setMaterial] = useState(line.material ?? '');
  const [diameterMm, setDiameterMm] = useState(line.diameterMm?.toString() ?? '');
  const [installDate, setInstallDate] = useState(line.installDate?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(line.notes ?? '');

  function applyChanges() {
    onSave({
      type,
      thickness,
      depthCm: depthCm === '' ? undefined : Number(depthCm),
      material: material.trim() || undefined,
      diameterMm: diameterMm === '' ? undefined : Number(diameterMm),
      installDate: installDate ? new Date(installDate).toISOString() : undefined,
      notes: notes.trim() || undefined,
    });
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    applyChanges();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle>Leiding bewerken</DialogTitle>
          <DialogDescription className="sr-only">
            Pas de eigenschappen van deze leiding aan, bewerk de punten, of
            verwijder de leiding.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleFormSubmit}
          className="flex flex-1 flex-col gap-3 overflow-y-auto px-6 py-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as UtilityType)}>
                <SelectTrigger id="type">
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
            <div className="flex flex-col gap-1.5">
              {/*
                Read-only — length is a computed view of line.vertices
                (haversine sum of adjacent segments). Not a schema field;
                there's nothing to save.
              */}
              <Label>Lengte</Label>
              <div
                aria-label="Lengte van de leiding"
                className="flex h-9 items-center text-sm text-muted-foreground"
              >
                {formatMeters(pathLengthMeters(line.vertices))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Dikte</Label>
            <RadioGroup
              value={thickness}
              onValueChange={(v) => setThickness(v as LineThickness)}
              aria-label="Lijndikte"
              className="grid grid-cols-3 gap-2"
            >
              {LINE_THICKNESSES.map((t) => (
                <label
                  key={t}
                  htmlFor={`thickness-${t}`}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-1.5 rounded-md border p-2 transition-colors',
                    thickness === t
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-input hover:bg-accent',
                  )}
                >
                  <RadioGroupItem
                    id={`thickness-${t}`}
                    value={t}
                    className="sr-only"
                  />
                  <ThicknessPreview
                    thickness={t}
                    color={UTILITY_META[type].color}
                  />
                  <span className="text-sm">{LINE_THICKNESS_LABEL_NL[t]}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="depth">Diepte (cm)</Label>
              <Input
                id="depth"
                type="number"
                inputMode="numeric"
                min={0}
                value={depthCm}
                onChange={(e) => setDepthCm(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="diameter">Diameter (mm)</Label>
              <Input
                id="diameter"
                type="number"
                inputMode="numeric"
                min={0}
                value={diameterMm}
                onChange={(e) => setDiameterMm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="material">Materiaal</Label>
            <Input
              id="material"
              type="text"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              placeholder="bv. PE, PVC, koper"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="installDate">Aanlegdatum</Label>
            <Input
              id="installDate"
              type="date"
              value={installDate}
              onChange={(e) => setInstallDate(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notities</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Foto's</Label>
              <PhotoUploader lineId={line.id} photoCount={line.photoIds?.length ?? 0} />
            </div>
            <PhotoGrid lineId={line.id} />
          </div>
        </form>

        <DialogFooter className="flex-col gap-2 border-t px-6 py-4 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            className="sm:mr-auto"
          >
            Verwijderen
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onEditGeometry}>
              Punten bewerken
            </Button>
            <Button type="button" onClick={applyChanges}>
              Opslaan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Small inline SVG that previews a single line at the given thickness,
 * with the standard dark casing underneath. Mirrors what the map will
 * draw, so the user can see Dun/Normaal/Dik at a glance.
 */
function ThicknessPreview({
  thickness,
  color,
}: {
  thickness: LineThickness;
  color: string;
}) {
  const { fill, casing } = LINE_WIDTH[thickness];
  const H = 14;
  const X1 = 4;
  const X2 = 44;
  return (
    <svg
      width={X2 + X1}
      height={H}
      viewBox={`0 0 ${X2 + X1} ${H}`}
      aria-hidden
    >
      <line
        x1={X1}
        y1={H / 2}
        x2={X2}
        y2={H / 2}
        stroke={CASING_COLOR}
        strokeWidth={casing}
        strokeLinecap="round"
      />
      <line
        x1={X1}
        y1={H / 2}
        x2={X2}
        y2={H / 2}
        stroke={color}
        strokeWidth={fill}
        strokeLinecap="round"
      />
    </svg>
  );
}
