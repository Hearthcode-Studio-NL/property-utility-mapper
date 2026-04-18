import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';

import { listProperties } from '@/db/properties';
import { formatDisplayAddress } from '@/lib/address';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import AddPropertyPanel from '@/components/AddPropertyPanel';
import DeletePropertyDialog from '@/components/DeletePropertyDialog';
import DuplicatePropertyDialog from '@/components/DuplicatePropertyDialog';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Home() {
  const navigate = useNavigate();
  const properties = useLiveQuery(() => listProperties(), [], []);
  const { installable, install } = useInstallPrompt();

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

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
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
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-2">
            {properties.map((p) => (
              <li key={p.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-3">
                    <Link
                      to={`/property/${p.id}`}
                      className="flex-1 truncate hover:underline"
                    >
                      <span className="font-medium">{formatDisplayAddress(p)}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.centerLat.toFixed(5)}, {p.centerLng.toFixed(5)}
                      </span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPendingDuplicateId(p.id)}
                      aria-label={`${formatDisplayAddress(p)} dupliceren`}
                    >
                      Dupliceer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPendingDeleteId(p.id)}
                      aria-label={`${formatDisplayAddress(p)} verwijderen`}
                    >
                      Verwijderen
                    </Button>
                  </CardContent>
                </Card>
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

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 border border-dashed border-muted-foreground/40 bg-transparent p-8 text-center">
        <MapPin className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
        <p className="text-sm">Nog geen locaties.</p>
        <p className="text-xs text-muted-foreground">
          Voeg hierboven een adres toe om te beginnen.
        </p>
      </CardContent>
    </Card>
  );
}
