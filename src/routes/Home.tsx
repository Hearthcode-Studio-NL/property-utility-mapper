import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';

import { db } from '@/db/dexie';
import { listProperties } from '@/db/properties';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import AddPropertyPanel from '@/components/AddPropertyPanel';
import DeletePropertyDialog from '@/components/DeletePropertyDialog';
import DuplicatePropertyDialog from '@/components/DuplicatePropertyDialog';
import PropertyTile from '@/components/PropertyTile';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  const navigate = useNavigate();
  const properties = useLiveQuery(() => listProperties(), [], []);
  const { installable, install } = useInstallPrompt();

  // Line counts per property in a single query — simpler than firing one
  // count per tile. At the v1 scale (dozens to low hundreds of properties)
  // pulling every row is cheap; if it ever gets slow we swap for a
  // compound index or keep a denormalised count on Property.
  const lineCountsByPropertyId = useLiveQuery<
    Map<string, number>,
    Map<string, number>
  >(
    async () => {
      const all = await db.utilityLines.toArray();
      const map = new Map<string, number>();
      for (const l of all) {
        map.set(l.propertyId, (map.get(l.propertyId) ?? 0) + 1);
      }
      return map;
    },
    [],
    new Map(),
  );

  const [importing, setImporting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDuplicateId, setPendingDuplicateId] = useState<string | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingDeleteProperty = useMemo(
    () =>
      pendingDeleteId
        ? (properties?.find((p) => p.id === pendingDeleteId) ?? null)
        : null,
    [pendingDeleteId, properties],
  );
  const pendingDuplicateProperty = useMemo(
    () =>
      pendingDuplicateId
        ? (properties?.find((p) => p.id === pendingDuplicateId) ?? null)
        : null,
    [pendingDuplicateId, properties],
  );

  async function handleImportChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const { importGeoJsonFromText } = await import('@/lib/export/geojson');
      const result = await importGeoJsonFromText(text);
      navigate(`/property/${result.property.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import mislukt.');
    } finally {
      setImporting(false);
    }
  }

  function scrollToAddPanel() {
    // Empty-state CTA — the AddPropertyPanel is always mounted at the top
    // of the page, so "Adres toevoegen" just puts it in view and tries to
    // focus the first input. Graceful degradation if the input can't be
    // found (e.g. the panel was restructured later).
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const firstInput = document.querySelector<HTMLInputElement>(
      'input[data-add-property-focus]',
    );
    firstInput?.focus();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Leidingen in kaart</h1>
          <p className="mt-1 text-muted-foreground">
            Breng water-, gas-, stroom- en andere leidingen op uw perceel in kaart.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {installable && (
            <Button variant="outline" size="sm" onClick={install}>
              App installeren
            </Button>
          )}
          <ModeToggle />
        </div>
      </header>

      <AddPropertyPanel />

      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <span>of</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? 'Importeren…' : 'Importeer GeoJSON'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          className="hidden"
          onChange={handleImportChange}
        />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Opgeslagen locaties</h2>
        {properties === undefined ? (
          <p className="text-muted-foreground">Laden…</p>
        ) : properties.length === 0 ? (
          <EmptyState onAdd={scrollToAddPanel} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map((p) => (
              <li key={p.id}>
                <PropertyTile
                  property={p}
                  lineCount={lineCountsByPropertyId.get(p.id) ?? 0}
                  onDuplicate={() => setPendingDuplicateId(p.id)}
                  onDelete={() => setPendingDeleteId(p.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingDeleteProperty && (
        <DeletePropertyDialog
          property={pendingDeleteProperty}
          open={pendingDeleteId !== null}
          onOpenChange={(next) => {
            if (!next) setPendingDeleteId(null);
          }}
        />
      )}

      {pendingDuplicateProperty && (
        <DuplicatePropertyDialog
          property={pendingDuplicateProperty}
          open={pendingDuplicateId !== null}
          onOpenChange={(next) => {
            if (!next) setPendingDuplicateId(null);
          }}
          onDuplicated={(newId) => navigate(`/property/${newId}`)}
        />
      )}
    </main>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 border border-dashed border-muted-foreground/40 bg-transparent p-8 text-center">
        <MapPin
          className="h-10 w-10 text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden
        />
        <p className="text-base text-muted-foreground">
          Je hebt nog geen adressen toegevoegd.
        </p>
        <Button onClick={onAdd}>Adres toevoegen</Button>
      </CardContent>
    </Card>
  );
}
