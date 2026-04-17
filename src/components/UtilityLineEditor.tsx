import { useEffect, useState, type FormEvent } from 'react';
import type { UtilityLine, UtilityType } from '../types';
import type { UtilityLinePatch } from '../db/utilityLines';
import { UTILITY_META, UTILITY_TYPES } from '../lib/utilityColors';

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
  const [depthCm, setDepthCm] = useState(line.depthCm?.toString() ?? '');
  const [material, setMaterial] = useState(line.material ?? '');
  const [diameterMm, setDiameterMm] = useState(line.diameterMm?.toString() ?? '');
  const [installDate, setInstallDate] = useState(line.installDate?.slice(0, 10) ?? '');
  const [notes, setNotes] = useState(line.notes ?? '');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({
      type,
      depthCm: depthCm === '' ? undefined : Number(depthCm),
      material: material.trim() || undefined,
      diameterMm: diameterMm === '' ? undefined : Number(diameterMm),
      installDate: installDate ? new Date(installDate).toISOString() : undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-editor-title"
      >
        <h2 id="line-editor-title" className="mb-4 text-lg font-semibold">
          Leiding bewerken
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as UtilityType)}
              className="rounded border border-slate-300 px-2 py-1"
            >
              {UTILITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {UTILITY_META[t].label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Diepte (cm)</span>
              <input
                type="number"
                value={depthCm}
                onChange={(e) => setDepthCm(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1"
                min="0"
                inputMode="numeric"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Diameter (mm)</span>
              <input
                type="number"
                value={diameterMm}
                onChange={(e) => setDiameterMm(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1"
                min="0"
                inputMode="numeric"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Materiaal</span>
            <input
              type="text"
              value={material}
              onChange={(e) => setMaterial(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
              placeholder="bv. PE, PVC, koper"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Aanlegdatum</span>
            <input
              type="date"
              value={installDate}
              onChange={(e) => setInstallDate(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Notities</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onDelete}
              className="rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            >
              Verwijderen
            </button>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onEditGeometry}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              >
                Punten bewerken
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Annuleren
              </button>
              <button
                type="submit"
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Opslaan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
