import { LAYERS } from '@/lib/map/layers';
import { useLayerSelection } from '@/hooks/useLayerSelection';
import type { BaseLayerId, OverlayId } from '@/types/map';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

/**
 * Panel body for the layer manager. Rendered inside either a Popover
 * (desktop) or a Sheet (mobile) — see LayerManagerButton for the
 * responsive wrapping.
 *
 * All layer metadata (id, label, kind) comes from the catalogue in
 * `src/lib/map/layers.ts`. Adding a new layer there automatically
 * surfaces it here — no code change needed in this file.
 */
export default function LayerManagerPanel() {
  const { base, overlays, setBase, toggleOverlay } = useLayerSelection();

  const bases = LAYERS.filter((l) => l.kind === 'base');
  const overlayEntries = LAYERS.filter(
    (l) => l.kind === 'overlay' || l.kind === 'virtual-overlay',
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Achtergrond</h3>
        <RadioGroup
          value={base}
          onValueChange={(id) => setBase(id as BaseLayerId)}
          aria-label="Achtergrondkaart"
        >
          {bases.map((layer) => {
            const inputId = `layer-base-${layer.id}`;
            return (
              <div key={layer.id} className="flex items-center gap-2">
                <RadioGroupItem id={inputId} value={layer.id} />
                <Label htmlFor={inputId} className="cursor-pointer font-normal">
                  {layer.labelNl}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </section>

      <Separator />

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Overlays</h3>
        <div
          role="group"
          aria-label="Overlay-kaartlagen"
          className="flex flex-col gap-2"
        >
          {overlayEntries.map((layer) => {
            const inputId = `layer-overlay-${layer.id}`;
            return (
              <div key={layer.id} className="flex items-center gap-2">
                <Checkbox
                  id={inputId}
                  checked={overlays.has(layer.id as OverlayId)}
                  onCheckedChange={() => toggleOverlay(layer.id as OverlayId)}
                />
                <Label htmlFor={inputId} className="cursor-pointer font-normal">
                  {layer.labelNl}
                </Label>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
