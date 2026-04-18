import { useState } from 'react';
import { toast } from 'sonner';

import { duplicateProperty } from '@/db/properties';
import { formatDisplayAddress } from '@/lib/address';
import type { Property, UUID } from '@/types';
import { Button } from '@/components/ui/button';
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

interface Props {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires after the DB write + toast; receives the new property's id. */
  onDuplicated?: (newPropertyId: UUID) => void;
}

/**
 * Single-field duplicate dialog per the v2.2.2 prompt.
 *
 * Pre-fill is "{formatDisplayAddress(source)} (kopie)" — the "(kopie)"
 * suffix nudges the user to edit. The edited string becomes the new
 * property's `fullAddress`; structured fields (street/houseNumber/city)
 * and coordinates are copied from the source as-is by the repository.
 * See duplicateProperty's docstring for the scope trade-offs.
 */
export default function DuplicatePropertyDialog({
  property,
  open,
  onOpenChange,
  onDuplicated,
}: Props) {
  const defaultLabel = `${formatDisplayAddress(property)} (kopie)`;
  const [label, setLabel] = useState<string>(defaultLabel);
  const [busy, setBusy] = useState(false);

  // "Adjust state during render" pattern: reset the field to the pre-fill
  // every time the dialog (re-)opens. Avoids a useEffect + setState that
  // the react-hooks/set-state-in-effect rule flags.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setLabel(defaultLabel);
  }

  const trimmed = label.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  async function handleConfirm() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const copy = await duplicateProperty(property.id, trimmed);
      toast.success('Adres gedupliceerd');
      onOpenChange(false);
      onDuplicated?.(copy.id);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Dupliceren mislukt: ${err.message}`
          : 'Dupliceren mislukt.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adres dupliceren</DialogTitle>
          <DialogDescription>
            Maak een kopie van dit adres met dezelfde leidingen. Pas het
            adres hieronder aan om het onderscheid duidelijk te maken.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleConfirm();
          }}
          className="flex flex-col gap-2"
        >
          <Label htmlFor="duplicate-property-address">Adres</Label>
          <Input
            id="duplicate-property-address"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
            required
          />

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {busy ? 'Dupliceren…' : 'Dupliceer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
