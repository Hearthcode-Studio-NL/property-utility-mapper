import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { addProperty, PropertyValidationError } from '@/db/properties';
import {
  geocodeAddress,
  reverseGeocode,
  type StructuredAddress,
} from '@/lib/geocode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  const [draft, setDraft] = useState<Draft | null>(null);

  async function handleTypedSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const hit = await geocodeAddress(query);
      if (!hit) {
        toast.error('Geen resultaten voor dit adres. Probeer het specifieker.');
        return;
      }
      setDraft(draftFromStructured(hit));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Zoeken mislukt.');
    } finally {
      setBusy(false);
    }
  }

  function handleUseLocation() {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      toast.error('Locatie wordt niet ondersteund in deze browser.');
      return;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      toast.error('Locatie vereist HTTPS of localhost.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const hit = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (!hit) {
            toast.error(
              'Geen adres gevonden op deze locatie. Typ het adres in plaats daarvan.',
            );
            return;
          }
          setDraft(draftFromStructured(hit));
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : 'Omgekeerd geocoderen mislukt.',
          );
        } finally {
          setBusy(false);
        }
      },
      (geoErr) => {
        setBusy(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          toast.error('Locatietoestemming geweigerd. Geef toegang of typ het adres.');
        } else if (geoErr.code === geoErr.POSITION_UNAVAILABLE) {
          toast.error('Locatie niet beschikbaar. Probeer het buiten opnieuw.');
        } else if (geoErr.code === geoErr.TIMEOUT) {
          toast.error('Locatie ophalen duurde te lang.');
        } else {
          toast.error('Locatie kon niet worden opgehaald.');
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  async function handleSave() {
    if (!draft) return;
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
      if (err instanceof PropertyValidationError) toast.error(err.message);
      else toast.error(err instanceof Error ? err.message : 'Opslaan mislukt.');
    }
  }

  function handleCancelConfirm() {
    setDraft(null);
  }

  const canSave =
    draft !== null &&
    draft.street.trim() !== '' &&
    draft.houseNumber.trim() !== '' &&
    draft.city.trim() !== '';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Locatie toevoegen</CardTitle>
      </CardHeader>
      <CardContent>
        {draft === null && (
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="typed">Adres invullen</TabsTrigger>
              <TabsTrigger value="gps">Gebruik mijn locatie</TabsTrigger>
            </TabsList>

            <TabsContent value="typed" className="mt-4">
              <form onSubmit={handleTypedSubmit} className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Herengracht 1, Amsterdam"
                  disabled={busy}
                  required
                  className="flex-1"
                  data-add-property-focus
                />
                <Button type="submit" disabled={busy || !query.trim()}>
                  {busy ? 'Zoeken…' : 'Zoeken'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="gps" className="mt-4">
              <Button
                type="button"
                onClick={handleUseLocation}
                disabled={busy}
                className="w-full"
              >
                {busy ? 'Locatie ophalen…' : 'Gebruik mijn locatie'}
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {draft !== null && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Controleer het adres en pas het waar nodig aan.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="street">Straat *</Label>
                <Input
                  id="street"
                  value={draft.street}
                  onChange={(e) => setDraft({ ...draft, street: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="houseNumber">Nr. *</Label>
                <Input
                  id="houseNumber"
                  value={draft.houseNumber}
                  onChange={(e) => setDraft({ ...draft, houseNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={draft.postcode}
                  onChange={(e) => setDraft({ ...draft, postcode: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="city">Plaats *</Label>
                <Input
                  id="city"
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {draft.centerLat.toFixed(5)}, {draft.centerLng.toFixed(5)}
            </p>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelConfirm}
                className="flex-1"
              >
                Annuleren
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="flex-1"
              >
                Opslaan
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
