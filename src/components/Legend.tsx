import { CASING_COLOR, UTILITY_META, UTILITY_TYPES } from '@/lib/utilityColors';

// The legend swatch mirrors how the line is drawn on the map: a dark casing
// border around a coloured fill. Without the casing, bright fills (gas
// yellow, irrigation light blue) read differently on a white card background
// than they do on a map tile, and the legend becomes a lie.
const SWATCH_BORDER_PX = 1;

export default function Legend() {
  return (
    <details className="p-3">
      <summary className="cursor-pointer list-none text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Legenda
      </summary>
      <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
        {UTILITY_TYPES.map((t) => (
          <li key={t} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-sm"
              style={{
                backgroundColor: UTILITY_META[t].color,
                boxShadow: `0 0 0 ${SWATCH_BORDER_PX}px ${CASING_COLOR}`,
              }}
              aria-hidden
            />
            <span>{UTILITY_META[t].label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
