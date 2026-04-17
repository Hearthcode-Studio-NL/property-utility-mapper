import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { addProperty, deleteProperty, listProperties } from '../db/properties';
import { geocodeAddress } from '../lib/geocode';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

export default function Home() {
  const navigate = useNavigate();
  const properties = useLiveQuery(() => listProperties(), [], []);
  const { installable, install } = useInstallPrompt();

  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const hit = await geocodeAddress(address);
      if (!hit) {
        setError('Geen resultaten voor dit adres. Probeer het specifieker.');
        return;
      }
      const created = await addProperty({
        address: hit.displayName,
        lat: hit.lat,
        lng: hit.lng,
      });
      setAddress('');
      navigate(`/property/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Deze locatie en alle bijbehorende leidingen verwijderen?')) return;
    await deleteProperty(id);
  }

  async function handleImportChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setImporting(true);
    try {
      const text = await file.text();
      const { importGeoJsonFromText } = await import('../lib/export/geojson');
      const result = await importGeoJsonFromText(text);
      navigate(`/property/${result.property.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import mislukt.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Leidingen in kaart</h1>
          <p className="mt-1 text-slate-600">
            Breng water-, gas-, stroom- en andere leidingen op uw perceel in kaart.
          </p>
        </div>
        {installable && (
          <button
            onClick={install}
            className="shrink-0 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
          >
            App installeren
          </button>
        )}
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Locatie toevoegen</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Herengracht 1, Amsterdam"
            className="flex-1 rounded border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
            disabled={submitting || importing}
            required
          />
          <button
            type="submit"
            disabled={submitting || importing || !address.trim()}
            className="rounded bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Zoeken…' : 'Toevoegen'}
          </button>
        </form>

        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <span>of</span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting || importing}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {importing ? 'Importeren…' : 'Importeer GeoJSON'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            className="hidden"
            onChange={handleImportChange}
          />
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Opgeslagen locaties</h2>
        {properties === undefined ? (
          <p className="text-slate-500">Laden…</p>
        ) : properties.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="flex flex-col gap-2">
            {properties.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white p-3 shadow-sm"
              >
                <Link to={`/property/${p.id}`} className="flex-1 truncate hover:underline">
                  <span className="font-medium">{p.address}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  </span>
                </Link>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  aria-label={`${p.address} verwijderen`}
                >
                  Verwijderen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        fill="none"
        className="text-slate-400"
        aria-hidden
      >
        <circle cx="28" cy="22" r="9" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="28" cy="22" r="3" fill="currentColor" />
        <path d="M28 31 L28 42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M10 48 L46 48"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="4 4"
        />
      </svg>
      <p className="text-sm text-slate-600">Nog geen locaties.</p>
      <p className="text-xs text-slate-400">Voeg hierboven een adres toe om te beginnen.</p>
    </div>
  );
}
