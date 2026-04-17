# Property Utility Mapper — Specification

## Problem

Homeowners rarely have accurate documentation of the utility lines running under and across their property: water supply, gas, electricity, sewage, internet/coax/fiber, irrigation, garden lighting, and drainage. When a contractor comes to dig — for a fence, a pond, a terrace, a tree — the homeowner cannot hand over a clear map. The result is either a nervous guess, an expensive KLIC-melding for a small private job, or a damaged line.

Professional tools (AutoCAD, QGIS, GIS platforms) are overkill and unaffordable for a homeowner. Paper sketches are unstructured and get lost. Photos on a phone are not geo-referenced. There is a gap between "nothing" and "professional GIS".

## Goals

1. Let a non-technical homeowner (Dutch audience first) produce an accurate, geo-referenced map of their property's utility lines.
2. Support two capture methods: drawing on a 2D map (desktop), and walking a line with the phone's GPS (mobile browser).
3. Store rich attributes per line (type, depth, material, diameter, install date, photos, notes).
4. Export a file the homeowner can email to a contractor: PDF (printable), PNG (for a chat message), GeoJSON (for anyone with GIS tooling).
5. Work entirely in the browser with no account, no backend, no cost to the user. Data lives locally.
6. Be installable as a PWA on a phone so the homeowner can open it in the garden without re-downloading tiles every time.

## Non-goals (v1)

Explicitly out of scope. Do not build these:

- Native mobile apps (no Tauri, Expo, Capacitor, React Native).
- Multi-user collaboration, sharing, or real-time sync.
- User accounts, login, authentication, or any backend.
- DXF export (AutoCAD format).
- Submitting data back to KLIC (the Dutch cable registry). KLIC is read-only reference for v1.
- Offline mode beyond what the browser's tile cache and IndexedDB provide naturally.
- State management libraries (Redux, Zustand, MobX, Jotai). React state + Dexie live queries are enough.
- Server-side rendering or Next.js. It's a SPA.
- Playwright or other end-to-end tests. Vitest + Testing Library cover unit + integration scope. E2E is a v2 decision.
- UI component libraries other than shadcn/ui (MUI, Chakra, Mantine, Ant Design, HeadlessUI, etc.). shadcn owns the design system.
- Hand-coded Tailwind colour classes for UI chrome (e.g. `bg-slate-900`, `text-white`, `bg-emerald-600`). Use CSS-variable classes so dark mode works without per-component fixes. Exception: map-layer colours that encode data (utility-type colour map).

## Users and user stories

### Persona

Marieke, 42, owns a house in Utrecht with a garden. She is planning to install a small pond and wants to avoid hitting the irrigation line she put in three years ago. She is not technical, uses her iPhone for everything, and occasionally opens her laptop.

### User stories

Priority: **P0** = must-have for v1 launch. **P1** = next. **P2** = nice-to-have.

**P0**

1. *As a homeowner, I can create a new property by typing an address; the app forward-geocodes it via Nominatim and shows a **confirmation card** with street / house number / city fields I can edit before saving.* The backing record stores structured fields + the verbose `fullAddress` for export reference.
2. *As a homeowner on a phone, I can tap "Use my location"; the browser supplies coordinates, the app **reverse-geocodes** them to a structured address, and the same confirmation card appears pre-filled for me to edit/confirm.* If Geolocation or reverse geocoding fails, I see a clear message and can fall back to typing.
3. *As a homeowner, I can toggle a Kadaster cadastral overlay ("Kadastrale Kaart") on top of the base map, so I see my parcel boundaries and can draw utility lines relative to them.* Uses PDOK's BRK WMS service (`https://service.pdok.nl/kadaster/kadastralekaart/wms/v5_0`, layer `KadastraleKaart`).
4. *As a homeowner, I can switch between Light / Dark / System themes at any time from the top-right of the app header, and my choice persists across reloads.* Implemented with shadcn/ui's Vite dark-mode pattern (`ThemeProvider` + `ModeToggle`) using CSS variables so both palettes work out of the box.
5. *As a homeowner, I can upload a KLIC PDF / image as a reference layer under the drawing canvas, so I can trace public utilities from it.* (The KLIC file stays as a reference; we do not extract data from it in v1.)
6. *As a homeowner, I can draw a utility line on the 2D map by clicking vertices, so I can capture lines I know the route of.*
7. *As a homeowner on a phone, I can press "Start walking" and have the browser record my GPS track as a new line, so I can capture lines while physically walking them.*
8. *As a homeowner, I can set attributes on each line: type (water/gas/electricity/sewage/internet/irrigation/garden-lighting/drainage), depth in cm, material, diameter in mm, install date, notes, and **attach up to 10 photos**.* Photos are stored locally as JPEG (full-size ≤ 1920 px long edge / 256 px thumbnail), decoded with EXIF orientation respected so portrait phone shots render upright. Photo thumbnails appear in the PDF export; GeoJSON carries a `photoCount` per line but does not embed images.
9. *As a homeowner, I can export the full property map as PDF, PNG, and GeoJSON so I can send it to a contractor.*

### Design system & branding

- **shadcn/ui** is the UI library. Every interactive UI surface (buttons, inputs, cards, dialogs, tabs, forms, switches, dropdowns, toasts, tooltips) is built from shadcn primitives. Style preset `new-york`, base colour `slate`, CSS variables enabled. No custom button / input components exist unless a shadcn primitive can't express the need.
- **Dark mode** is a first-class concern. Every color used in the UI comes from shadcn's CSS variables (`bg-background`, `bg-primary`, `text-foreground`, etc.) so both palettes work without per-component changes. Hard-coded Tailwind colour classes are forbidden in UI chrome; they are allowed only for data-semantic colours (e.g. utility-type colours — water = blue, gas = yellow — which are not theme-dependent).
- **Icons**: `favicon.ico`, `favicon-32.png`, `icon-192.png`, `icon-512.png` live in `public/` and are referenced from `index.html` and the PWA manifest. The PWA manifest is generated by `vite-plugin-pwa` (no separate `site.webmanifest` file) with name `Property Utility Mapper`, short name `Utility Mapper`, theme + background colours keyed off the shadcn palette, and the 192/512 icons as any + maskable purposes.

### Address invariants

Two hard rules derived from stories 1 and 2:

- **Save-validation.** A `Property` is only persisted if `street`, `houseNumber`, and `city` are all non-empty after trim. Bare coordinates without a confirmed address are rejected. The confirmation card is the single gate that enforces this.
- **Display rule.** Anywhere in the UI (headers, list rows, toolbars, export labels), a property is shown as `${street} ${houseNumber}, ${city}` via the single helper `formatDisplayAddress(property)` — never as `fullAddress` (which is verbose: postcode + province + country) and never by concatenating raw fields inline. `fullAddress` stays in the DB and in the GeoJSON export as reference data only.

**P1**

7. Edit an existing line's geometry (drag vertices, insert/delete vertices).
8. Measure distance between two points.
9. Snap new vertices to existing ones.
10. Color-code lines by type with a legend.
11. Duplicate a property (to version a plan before/after renovation).
12. Import a previously exported GeoJSON back into the app.

**P2**

13. KLIC WMS/WFS integration: pull official utility data for the property's postcode.
14. Elevation lookup per vertex (PDOK AHN height grid).
15. Share a read-only link (requires backend — out of v1).
16. Sketch freehand (not just polyline clicks).
17. Multi-language: English alongside Dutch.

## Requirements

### Functional

- Property: address (string), coordinates (lat, lng), created/updated timestamps.
- UtilityLine: belongs to a property, has a type (enum), an ordered list of `[lat, lng]` vertices, plus attributes (depth, material, diameter, install date, notes).
- Photo: belongs to a utility line, stored as a Blob in IndexedDB plus metadata (caption, created timestamp).
- KlicFile: belongs to a property, the original uploaded file (Blob) plus metadata (filename, uploaded timestamp).
- Geocoding: address → coordinates via Nominatim (OpenStreetMap). Respect their usage policy (1 req/s, include a contact email in the User-Agent string when self-hosting — for a browser app we rely on the default).
- Map: OpenStreetMap raster tiles via Leaflet.
- All persistence is local (IndexedDB via Dexie). No network calls except tiles and geocoding.

### Non-functional

- Works on current Chrome, Firefox, Safari (desktop + iOS + Android).
- Responsive layout. Mobile-first for the Property page (map + toolbar).
- TypeScript strict mode. No `any` escapes without a comment explaining why.
- Tailwind for all styling. No separate CSS files except `index.css` for Tailwind directives and a small reset.
- UUID string IDs (`crypto.randomUUID()`). ISO 8601 timestamps as strings.

## Success metrics

v1 is a success if:

- A homeowner can go from "I just heard about this app" to "I have a PDF I can email" in under 20 minutes on their first property.
- The GPS-walk feature captures a 30 m garden path within 2 m RMS error on a modern phone with a clear sky.
- The exported PDF is readable on a phone screen and prints correctly on A4.
- Zero server costs. Zero data leaves the user's device except geocoding and tile requests.

## Phased rollout

- **Phase 0 — Scaffolding** (current): Vite + React + TS + Tailwind + React Router + Leaflet + Dexie. Home page to add/list properties. Property page shows a map.
- **Phase 1 — Drawing**: Click-to-draw polylines on the map. Save to Dexie. List lines on a side panel. Edit attributes in a modal.
- **Phase 2 — GPS capture**: "Start walking" button records `geolocation.watchPosition` into a line. Stop button saves it.
- **Phase 3 — Photos & KLIC upload**: Attach photos to lines. Upload KLIC PDF as a reference overlay (image or georeferenced).
- **Phase 4 — Export**: GeoJSON (trivial), PNG (canvas screenshot of the map), PDF (jsPDF with the PNG + attribute table).
- **Phase 5 — Polish**: PWA manifest, offline tile cache, install prompt, Dutch UI copy, empty-state illustrations.
