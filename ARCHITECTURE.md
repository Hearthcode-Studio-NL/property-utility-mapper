# Architecture

This document explains the *how* — the tech choices, the data shape, the folder layout, and the main user flows. Read this alongside `SPEC.md` (the *what and why*).

## Tech stack

| Layer            | Choice                         | Why                                                                                                                                |
| ---------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Build tool       | **Vite**                       | Instant dev server, zero config for React + TS. Beats Create React App on every axis and is the current default.                   |
| UI framework     | **React 18**                   | Massive ecosystem, excellent hooks model, `useSyncExternalStore` pairs well with Dexie's live queries.                             |
| Language         | **TypeScript (strict)**        | Catches whole classes of bugs at edit time. Strict mode means `null` and `undefined` are explicit — crucial for IndexedDB records. |
| Styling          | **Tailwind CSS**               | Utility-first, no naming fatigue, easy to keep consistent. One `index.css` file, no per-component stylesheets.                     |
| Router           | **react-router-dom v6**        | Two routes is plenty. Declarative, well documented, integrates with Vite out of the box.                                           |
| Map              | **Leaflet via react-leaflet**  | Free, OSM-friendly, good mobile support, simple API. Mapbox GL would be prettier but needs a token and costs money.                |
| Tiles            | **OpenStreetMap (tile.osm.org)** | Free, acceptable for low-volume personal use. Must attribute. Switch to a paid provider if traffic grows.                          |
| Geocoding        | **Nominatim**                  | Free OSM-backed geocoder. Fine for one address per property creation. Rate-limited: 1 req/s.                                       |
| Local storage    | **Dexie.js (IndexedDB)**       | Wraps IndexedDB with a sane API, supports compound indices, and ships `useLiveQuery` for React.                                    |
| State management | **React state + Dexie live queries** | No Redux/Zustand. `useLiveQuery` re-renders components when the DB changes. Component state handles everything else.          |

### What we deliberately do not use

- **Redux / Zustand / MobX** — Dexie's reactivity is enough, and global state for a single-user single-tab app is mostly a trap.
- **Next.js / Remix** — SPA is fine. No SEO concerns. No server.
- **A backend** — v1 is 100% local. Adding a backend turns "free personal tool" into "service I must keep running."
- **A CSS-in-JS library** — Tailwind covers it; no need for emotion/styled-components.
- **Yarn / pnpm** — npm is bundled with Node. One tool fewer to install.

## Data model

All records live in IndexedDB via Dexie. IDs are `crypto.randomUUID()` strings. Timestamps are ISO 8601 strings (`new Date().toISOString()`).

```ts
type UUID = string;
type ISODate = string;

type UtilityType =
  | 'water'
  | 'gas'
  | 'electricity'
  | 'sewage'
  | 'internet'
  | 'irrigation'
  | 'garden-lighting'
  | 'drainage';

interface Property {
  id: UUID;

  // Structured address. Required fields are enforced at save time by
  // validateProperty(); see src/db/properties.ts. UI labels ALWAYS go through
  // formatDisplayAddress(property) — never read these fields directly for
  // display, and never use fullAddress in user-facing strings.
  street: string;              // required, trimmed, non-empty
  houseNumber: string;         // required, string (supports "12A", "1-3")
  city: string;                // required
  postcode?: string;
  country?: string;
  fullAddress: string;         // verbose Nominatim display_name, reference/export only

  centerLat: number;
  centerLng: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

interface UtilityLine {
  id: UUID;
  propertyId: UUID;         // FK → Property.id
  type: UtilityType;
  vertices: [number, number][]; // [[lat, lng], ...]
  depthCm?: number;
  material?: string;
  diameterMm?: number;
  installDate?: ISODate;
  notes?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

interface Photo {
  id: UUID;
  utilityLineId: UUID;      // FK → UtilityLine.id
  blob: Blob;               // JPEG/PNG bytes stored directly in IndexedDB
  caption?: string;
  createdAt: ISODate;
}

interface KlicFile {
  id: UUID;
  propertyId: UUID;         // FK → Property.id
  filename: string;
  blob: Blob;               // the uploaded PDF/image
  uploadedAt: ISODate;
}
```

### Dexie schema (version 1)

```ts
db.version(1).stores({
  properties:   'id, address, createdAt',
  utilityLines: 'id, propertyId, type, createdAt',
  photos:       'id, utilityLineId, createdAt',
  klicFiles:    'id, propertyId, uploadedAt',
});
```

The first string in each `stores` line is the **primary key**. The rest are **indexed fields** — they make `where('propertyId').equals(...)` fast. Non-indexed fields are still stored, just not queryable without a scan.

**Teaching note:** IndexedDB is an object store, not a relational DB. There are no real foreign keys. `propertyId` is just a string we agree to treat as one. When we delete a Property we must delete its lines, photos, and KLIC files ourselves — Dexie won't cascade.

## Folder layout

```
src/
├── main.tsx                      # React root, router setup
├── App.tsx                       # Route definitions
├── index.css                     # Tailwind directives only
├── types/
│   └── index.ts                  # All shared TS types (Property, UtilityLine, etc.)
├── db/
│   ├── dexie.ts                  # Dexie instance + schema
│   ├── properties.ts             # CRUD helpers for Property
│   └── utilityLines.ts           # CRUD helpers for UtilityLine
├── lib/
│   ├── geocode.ts                # Nominatim forward + reverse
│   ├── address.ts                # formatDisplayAddress (single source of truth for UI labels)
│   ├── distance.ts               # Haversine + path length + formatMeters
│   ├── simplify.ts               # Douglas-Peucker (pure, equirectangular projection)
│   ├── snap.ts                   # findSnapTarget (pure, takes projector fn)
│   ├── utilityColors.ts          # Type → label + color map
│   └── export/
│       ├── download.ts           # Shared download + filename helpers
│       ├── geojson.ts            # Build + export FeatureCollection
│       ├── png.ts                # Rasterize map via html-to-image
│       └── pdf.ts                # Compose PDF with jsPDF (reuses png)
├── hooks/
│   ├── useGpsWalk.ts             # watchPosition hook with accuracy / distance filters
│   ├── useInstallPrompt.ts       # captures beforeinstallprompt for "App installeren" button
│   └── useLocalStorageBool.ts    # persisted boolean state (Kadaster toggle, etc.)
├── components/
│   ├── MapCanvas.tsx             # Leaflet map wrapper (accepts layer children)
│   ├── AddPropertyPanel.tsx      # Two-mode entry (typed / GPS) + confirmation card
│   ├── DrawingLayer.tsx          # Click-to-draw in-progress polyline
│   ├── WalkingLayer.tsx          # GPS track + current-position + accuracy circle
│   ├── EditableLineLayer.tsx     # Draggable vertex handles + insert/delete midpoints
│   ├── SketchLayer.tsx           # Freehand drag-to-draw (mousedown/move/up with pixel throttle)
│   ├── MeasureLayer.tsx          # Ephemeral measurement polyline (click to add points)
│   ├── CadastreOverlay.tsx       # PDOK BRK WMS (Kadastrale Kaart) overlay
│   ├── Legend.tsx                # Collapsible type → color reference
│   ├── LinesLayer.tsx            # All saved polylines for a property
│   ├── LinesPanel.tsx            # Side panel: toolbar + saved line list
│   └── UtilityLineEditor.tsx     # Modal for editing line attributes
└── routes/
    ├── Home.tsx                  # / — add & list properties
    └── Property.tsx              # /property/:id — map + draw/walk + edit
```

### Conventions

- **Types** go in `src/types/index.ts` and are imported from there. Avoid re-defining them locally.
- **DB access** never happens inside a component directly. Components call helpers from `src/db/*.ts`, which hide the Dexie API. This keeps components easy to read and the DB easy to refactor.
- **External APIs** (Nominatim today, PDOK/KLIC later) live in `src/lib/`. One file per service.
- **Components** are folders only once they need sub-files (styles, tests, sub-components). Until then a single `.tsx` file is fine.

## Interaction flows

### Create a property — two flows, one confirmation card

Both flows converge on `AddPropertyPanel`'s **confirmation card** — an editable form with `street`, `houseNumber`, `city`, `postcode`, `country`. Save button is disabled until the three required fields are non-empty. The card is the single gate that enforces the save-validation invariant.

**Flow A — "Enter address" (typed):**

1. User types an address into the text input.
2. On submit: `geocodeAddress(query)` → Nominatim `/search?q=…&format=json&addressdetails=1&limit=1`.
3. Parse the returned structured address (`address.road`, `address.house_number`, `address.city || address.town || address.village`, `address.postcode`, `address.country`) + `display_name` → pre-fill confirmation card.
4. User confirms / edits → `addProperty({...})` writes to Dexie → navigate to `/property/:id`.

**Flow B — "Use my location" (GPS):**

1. User taps the "Use my location" button.
2. `navigator.geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })` returns a `GeolocationPosition`.
3. `reverseGeocode(lat, lng)` → Nominatim `/reverse?lat=…&lon=…&format=json&addressdetails=1` → same structured address shape as Flow A.
4. Pre-fill confirmation card → user confirms / edits → save → navigate.
5. **Failure modes:** permission denied, timeout, no address found → show a specific error ("Locatie geweigerd", "Geen adres gevonden op deze locatie") and keep the Enter-address tab available as fallback. Do NOT save a property from coordinates alone.

### View a property

1. Route `/property/:id` mounts `Property.tsx`.
2. Component reads `id` from `useParams()`.
3. `useLiveQuery(() => db.properties.get(id))` fetches the record.
4. Header renders `formatDisplayAddress(property)` — e.g. `"Herengracht 1, Amsterdam"`. Coordinates shown separately in small text.
5. Renders `<MapCanvas lat={p.centerLat} lng={p.centerLng}>` with layer children.

### Kadaster cadastral overlay

1. `CadastreOverlay` wraps react-leaflet's `<WMSTileLayer>` pointed at PDOK's BRK service: `https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0` with `layers="KadastraleKaart"`, `format="image/png"`, `transparent`, `opacity=0.7`.
2. Mounted conditionally as a child of `<MapCanvas>` when `showCadastre` state is true. Default: **on** (the Dutch user's main use case is tracing utilities relative to their parcel).
3. A small floating checkbox control at top-right of the map toggles it. State lives in `Property.tsx`; not persisted for v1.
4. WMS tile requests are served directly from PDOK. They're not currently in the Workbox runtimeCaching config — if offline parcel view becomes important we'll add a rule.

## Testing strategy

Three-tier plan, no end-to-end in v1.

| Layer | Tool | What lives here |
| --- | --- | --- |
| **Unit — pure functions** | Vitest | `lib/distance.ts`, `lib/geocode.ts`, parsers/formatters in `lib/export/*`. No React, no DOM. Fast. |
| **Unit — DB helpers** | Vitest + `fake-indexeddb/auto` | Everything in `src/db/*.ts`. Real Dexie API against an in-memory IndexedDB. Reset tables between tests. |
| **Integration — components** | Vitest + Testing Library + `userEvent` | Render under `<MemoryRouter>`, spy child routes, mock external deps (geocode, export modules). Assert DOM + DB side-effects. |

### Conventions

- Tests live next to the source as `*.test.ts` / `*.test.tsx`. No separate `__tests__/` folder.
- `src/test/setup.ts` is loaded before every test file: imports `fake-indexeddb/auto` (stubs `globalThis.indexedDB`) and `@testing-library/jest-dom/vitest` (adds matchers like `toBeInTheDocument`).
- Vitest globals (`describe`, `it`, `expect`, `vi`) are turned on via `test: { globals: true }` in `vite.config.ts` and `types: ["vitest/globals"]` in `tsconfig.app.json`. No per-file imports needed, but explicit imports also work.
- **Do not render `Property.tsx` in tests.** It pulls in Leaflet, which needs DOM APIs (ResizeObserver, layout) that jsdom doesn't supply cleanly. Test routes that consume it with a fake route component (`FakeProperty` pattern in `Home.test.tsx`).
- Mock external modules at the top of the test file with `vi.mock('…')`. Reset mocks in `beforeEach` via `vi.clearAllMocks()`.
- For DB tests, `beforeEach` runs `resetDb()` inside a transaction over all four tables so state is clean even when a prior test bailed mid-transaction.

### What we don't test (yet)

- Leaflet map rendering, WMS fetches, GPS `watchPosition`, PWA service worker, PDF/PNG rasterization. These need a real browser (Playwright) which is a v2 decision.
- UI snapshot tests. Too brittle for the iteration speed we need right now.

## Open questions

These are decisions we have deferred. When the time comes to answer them, update this section.

- **Migrating pre-refactor local records** — before the structured-address refactor, Property had `address: string` + `lat` + `lng`. Any records in a user's IndexedDB created before the upgrade have the old shape. Options: (a) Dexie `version(2).upgrade(tx)` that splits the old `address` into best-effort structured fields (risky — Nominatim formats vary); (b) wipe the old table on upgrade (dev-stage loss, acceptable with warning); (c) add a `fullAddress`-only fallback display and force re-confirmation on first open. For this session's local dev data, (b) is simplest; we'll decide before any public deploy.

- **Tile caching for offline use** — service worker with Workbox? Manual `caches` API? Skip until PWA phase.
- **PDF export layout** — A4 portrait with a map thumbnail + attribute table, or a full-bleed map? Decide during Phase 4.
- **GPS smoothing** — raw `watchPosition` points are jittery. Apply a Kalman filter, a simple moving average, or just show raw? Decide during Phase 2 after testing outdoors.
- **KLIC overlay** — KLIC PDFs are not georeferenced. Do we let the user manually pin two corners to georeference, or show the PDF in a side panel only? Revisit in Phase 3.
- **Photo storage size** — IndexedDB quotas vary by browser (roughly 60% of free disk). Should we downscale photos on import? Probably yes, to 1600px max dimension.
- **Migrations** — when we add fields, bump `db.version(2).stores(...).upgrade(...)`. Document the migration in this file.
