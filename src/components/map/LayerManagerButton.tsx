import { Layers } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { cn } from '@/lib/utils';
import LayerManagerPanel from './LayerManagerPanel';

/**
 * Map toolbar button that opens the layer manager. Uses a Popover on
 * desktop (md+) and a Sheet on mobile.
 *
 * We intentionally do NOT use `asChild` with a nested `<Button>` here —
 * in the real browser (inside the Leaflet container) that composition
 * failed to open the popover. Rendering the Radix Trigger element
 * directly with button styling via `buttonVariants()` is the more
 * robust pattern. Portal content gets a z-index above Leaflet's highest
 * pane (popup pane at 700).
 */
export default function LayerManagerButton() {
  const isDesktop = useIsDesktop();

  const triggerClass = cn(
    buttonVariants({ variant: 'outline', size: 'icon' }),
  );

  if (isDesktop) {
    return (
      <Popover>
        <PopoverTrigger className={triggerClass} aria-label="Kaartlagen">
          <Layers className="h-4 w-4" aria-hidden />
        </PopoverTrigger>
        <PopoverContent align="end" className="z-[1100] w-72">
          <LayerManagerPanel />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet>
      <SheetTrigger className={triggerClass} aria-label="Kaartlagen">
        <Layers className="h-4 w-4" aria-hidden />
      </SheetTrigger>
      <SheetContent side="bottom" className="z-[1100] pt-10">
        <SheetHeader>
          <SheetTitle className="text-left">Kaartlagen</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <LayerManagerPanel />
        </div>
      </SheetContent>
    </Sheet>
  );
}
