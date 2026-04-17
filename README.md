# Property Utility Mapper

A browser-based tool to map utility lines (water, gas, electricity, sewage, internet, irrigation, garden lighting, drainage) on your property. Draw on a 2D map or walk the line with your phone's GPS, add attributes, and export as PDF / PNG / GeoJSON.

See [`SPEC.md`](./SPEC.md) for the product brief, [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the technical design, and [`CLAUDE.md`](./CLAUDE.md) for conventions.

## Requirements

- [Node.js](https://nodejs.org) 20 or newer (includes `npm`)

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

The dev server prints a local URL (usually http://localhost:5173) and a LAN URL so you can open the app on your phone on the same Wi-Fi.

### Testing GPS on your phone

Browsers only expose geolocation on **secure contexts** — HTTPS or `localhost`. The Vite LAN URL is plain HTTP, so GPS will be blocked there. Options:

- **Easiest:** tunnel the dev server over HTTPS with [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) or `ngrok`, then open the HTTPS URL on your phone.
- **Chrome on Android:** open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add your LAN URL, and restart. Only do this on a trusted network.
- **Later:** deploy a build (Vercel/Netlify/Cloudflare Pages) — the deployed URL is HTTPS by default.

## Other commands

```bash
npm run build      # type-check and produce a production build in dist/
npm run preview    # serve the production build locally
npm run typecheck  # run tsc without emitting
npm run lint       # ESLint (flat config, react-hooks, react-refresh, TS-ESLint)
```

## Tests

```bash
npm test              # one-shot run of the whole suite
npm run test:watch    # watch mode, re-runs on save
npm run test:ui       # interactive Vitest UI at localhost
npm run coverage      # run with coverage, reports to coverage/ (gitignored)
```

Stack: Vitest + jsdom + Testing Library + `fake-indexeddb`. Tests live next to source as `*.test.ts(x)`. See `ARCHITECTURE.md` "Testing strategy" for the layered approach.

## Tech stack

Vite + React 18 + TypeScript (strict) + Tailwind CSS + React Router + Leaflet (OpenStreetMap tiles) + Dexie (IndexedDB). No backend — everything is stored locally in your browser.
