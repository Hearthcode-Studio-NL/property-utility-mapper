import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { addProperty, PropertyValidationError } from '../db/properties';
import {
  geocodeAddress,
  reverseGeocode,
  type StructuredAddress,
} from '../lib/geocode';

type Mode = 'typed' | 'gps';

interface Draft {
  street: string;
  houseNumber: string;
  city: string;
  postcode: string;
  country: string;
  fullAddress: string;
  centerLat: number;
  centerLng: number;
}

function draftFromStructured(s: StructuredAddress): Draft {
  return {
    street: s.street,
    houseNumber: s.houseNumber,
    city: s.city,
    postcode: s.postcode ?? '',
    country: s.country ?? '',
    fullAddress: s.fullAddress,
    centerLat: s.lat,
    centerLng: s.lng,
  };
}

export default function AddPropertyPanel() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('typed');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  async function handleTypedSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const hit = await geocodeAddress(query);
      if (!hit) {
        setError('Geen resultaten voor dit adres. Probeer het specifieker.');
        return;
      }
      setDraft(draftFromStructured(hit));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Zoeken mislukt.');
    } finally {
      setBusy(false);
    }
  }

  function handleUseLocation() {
    setError(null);
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setError('Locatie wordt niet ondersteund in deze browser.');
      return;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError('Locatie vereist HTTPS of localhost.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const hit = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (!hit) {
            setError(
              'Geen adres gevonden op deze locatie. Typ het adres in plaats daarvan.',
            );
            return;
          }
          setDraft(draftFromStructured(hit));
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Omgekeerd geocoderen mislukt.');
        } finally {
          setBusy(false);
        }
      },
      (geoErr) => {
        setBusy(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setError('Locatietoestemming geweigerd. Geef toegang of typ het adres.');
        } else if (geoErr.code === geoErr.POSITION_UNAVAILABLE) {
          setError('Locatie niet beschikbaar. Probeer het buiten opnieuw.');
        } else if (geoErr.code === geoErr.TIMEOUT) {
          setError('Locatie ophalen duurde te lang.');
        } else {
          setError('Locatie kon niet worden opgehaald.');
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  async function handleSave() {
    if (!draft) return;
    setError(null);
    try {
      const created = await addProperty({
        street: draft.street,
        houseNumber: draft.houseNumber,
        city: draft.city,
        postcode: draft.postcode || undefined,
        country: draft.country || undefined,
        fullAddress: draft.fullAddress,
        centerLat: draft.centerLat,
        centerLng: draft.centerLng,
      });
      setDraft(null);
      setQuery('');
      navigate(`/property/${created.id}`);
    } catch (err) {
      if (err instanceof PropertyValidationError) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    }
  }

  function handleCancelConfirm() {
    setDraft(null);
    setError(null);
  }

  const canSave =
    draft !== null &&
    draft.street.trim() !== '' &&
    draft.houseNumber.trim() !== '' &&
    draft.city.trim() !== '';

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Locatie toevoegen</h2>

      {draft === null && (
        <>
          <div
            role="tablist"
            className="mb-3 flex gap-1 rounded border border-slate-200 bg-slate-50 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'typed'}
              onClick={() => {
                setMode('typed');
                setError(null);
              }}
              className={`flex-1 rounded px-2 py-1 text-sm transition ${
                mode === 'typed' ? 'bg-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Adres invullen
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'gps'}
              onClick={() => {
                setMode('gps');
                setError(null);
              }}
              className={`flex-1 rounded px-2 py-1 text-sm transition ${
                mode === 'gps' ? 'bg-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Gebruik mijn locatie
            </button>
          </div>

          {mode === 'typed' ? (
            <form onSubmit={handleTypedSubmit} className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Herengracht 1, Amsterdam"
                className="flex-1 rounded border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
                disabled={busy}
                required
              />
              <button
                type="submit"
                disabled={busy || !query.trim()}
                className="rounded bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Zoeken…' : 'Zoeken'}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={busy}
              className="w-full rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Locatie ophalen…' : 'Gebruik mijn locatie'}
            </button>
          )}
        </>
      )}

      {draft !== null && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            Controleer het adres en pas het waar nodig aan.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-2 flex flex-col gap-1 text-xs">
              <span className="font-medium">Straat *</span>
              <input
                type="text"
                value={draft.street}
                onChange={(e) => setDraft({ ...draft, street: e.target.value })}
                className="rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Nr. *</span>
              <input
                type="text"
                value={draft.houseNumber}
                onChange={(e) => setDraft({ ...draft, houseNumber: e.target.value })}
                className="rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Postcode</span>
              <input
                type="text"
                value={draft.postcode}
                onChange={(e) => setDraft({ ...draft, postcode: e.target.value })}
                className="rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium">Plaats *</span>
              <input
                type="text"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                className="rounded border border-slate-300 px-2 py-1.5"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500">
            {draft.centerLat.toFixed(5)}, {draft.centerLng.toFixed(5)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancelConfirm}
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Opslaan
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </section>
  );
}
