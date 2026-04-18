import { useState } from 'react';
import { toast } from 'sonner';

import { deleteProperty } from '@/db/properties';
import { formatDisplayAddress } from '@/lib/address';
import type { Property } from '@/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DeletePropertyDialogProps {
  property: Property;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Fires AFTER the repository call resolves and the success toast is
   * shown. The caller decides what to do next — the list page just lets
   * the useLiveQuery re-render; the detail page navigates home.
   */
  onDeleted?: () => void;
}

export default function DeletePropertyDialog({
  property,
  open,
  onOpenChange,
  onDeleted,
}: DeletePropertyDialogProps) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await deleteProperty(property.id);
      toast.success('Adres verwijderd');
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Verwijderen mislukt: ${err.message}`
          : 'Verwijderen mislukt.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Adres verwijderen?</AlertDialogTitle>
          <AlertDialogDescription>
            Dit verwijdert het adres, alle leidingen en alle foto&apos;s. Dit
            kan niet ongedaan worden gemaakt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="text-sm font-medium">
          {formatDisplayAddress(property)}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuleren</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: 'destructive' }))}
            disabled={busy}
            onClick={(e) => {
              // Radix's default is to close the dialog on action click. We
              // want to keep it open during the async delete so the busy
              // label has time to show and errors can be recovered from.
              e.preventDefault();
              void handleConfirm();
            }}
          >
            {busy ? 'Verwijderen…' : 'Verwijder'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
