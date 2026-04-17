import { UTILITY_META, UTILITY_TYPES } from '@/lib/utilityColors';

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
              className="inline-block h-3 w-3 shrink-0 rounded"
              style={{ backgroundColor: UTILITY_META[t].color }}
              aria-hidden
            />
            <span>{UTILITY_META[t].label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
