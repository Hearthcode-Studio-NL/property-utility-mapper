# ADR-0002 — Testing baseline: Phase 2 gaps + internal-tool waivers

- **Status:** Accepted
- **Date:** 2026-04-21
- **Owner:** Wijnand (Hearthcode-Studio-NL)
- **Expires:** 2026-07-21 (3 months — shorter than ADR-0001 because these are gaps *we* can close, not upstream blockers)
- **Related PR:** first CI workflow commit on `main`
- **Tracking issue:** [#1 — wire up Phase 2 accessibility setup](https://github.com/Hearthcode-Studio-NL/property-utility-mapper/issues/1) (target 2026-06-01)

---

## Context

`property-utility-mapper` pre-dates HearthCode Studio's [[../../../../HearthCode-Vault/04-Standards/Testing-Policy|Testing Policy]]. When the project was brought into the HearthCode workspace, not all baseline testing requirements were in place. This ADR:

1. Documents **what is in place today** (Phase 1 CI gates).
2. Tracks **what is missing** with concrete target dates (Phase 2).
3. Explicitly **waives** the policy items that don't apply to this project type (internal-tool SPA).

The goal is visibility, not a rubber stamp. Every gap below is either scheduled or waived — nothing is silently ignored.

---

## Phase 1 — in place today (CI enforces)

| Policy requirement             | Status        | How it's enforced                                  |
| ------------------------------ | ------------- | -------------------------------------------------- |
| Unit tests                     | ✅ 234 tests   | Vitest via `npm test` in CI `fast` job             |
| Integration / component tests  | ✅ covered     | Vitest + jsdom + Testing Library (same suite)      |
| Lint                           | ✅             | ESLint via `npm run lint`                          |
| Type-check                     | ✅             | tsc strict via `npm run typecheck`                 |
| Code scanning                  | ✅             | GitHub CodeQL in CI `security` job                 |
| Secret scanning                | ✅ (platform)  | GitHub repo setting                                |
| Dependency audit               | ✅ (scoped)    | `npm audit --audit-level=high --omit=dev` — see ADR-0001 |

---

## Phase 2 — gaps with target dates

These baseline items from the Testing Policy are **not yet in the repo**. Each has a concrete target date; when it hits, either the item is added or this ADR is superseded by a fresh one extending the deadline.

### Smoke / E2E tests — target 2026-06-01

Policy requires 1–3 automated tests covering the critical user journey ("app loads, user can add a property, can draw a utility line, save works").

**Current state:** no Playwright installed, no smoke tests exist.

**To close:**

1. `npm install -D @playwright/test` + `npx playwright install --with-deps`
2. Write 2–3 tests in `e2e/`:
   - App loads, user is taken to the empty-state home.
   - Add an address, property persists across reload.
   - Draw one utility line, see it render on the map.
3. Add a `test:smoke` script to `package.json`.
4. Add a `smoke` job to `.github/workflows/ci.yml` that runs `npx playwright test` in the Playwright Docker image.

**Owner:** Wijnand. **Target:** 2026-06-01.

### Automated accessibility — target 2026-06-01

Policy requires `@axe-core/playwright` (E2E) or `jest-axe` (component) in CI.

**Current state:** no automated a11y checks. Manual keyboard + screen-reader spot-checks are expected but not enforced.

**To close:**

1. `npm install -D jest-axe @axe-core/playwright`
2. Add jest-axe assertions to the most visually-dense component tests (`PropertyTile`, `LayerManagerPanel`).
3. When Playwright lands (above), add one `AxeBuilder` test per major route.

**Owner:** Wijnand. **Target:** 2026-06-01 (same wave as Playwright setup).

### Maintenance test — one per bug fix

Policy hard rule: if a regression reaches `main`, a test catching it must ship before the fix merges.

**Current state:** policy-compliant going forward, but the existing 234 tests don't have a "scar list" — no way to tell which ones trace to past regressions vs. proactive coverage.

**To close:** not a technical task — a process commitment. No action required beyond compliance from here on out.

---

## Explicitly waived for this project type

These policy items apply only to public, branded surfaces. `property-utility-mapper` is an **internal-tool SPA** with no marketing footprint, no public user base, no SEO requirement. The waivers below apply only to this repo.

### Visual regression tests — waived

Policy says visual regression is required for "public, branded surfaces." This tool is not that. No hero pages, no marketing copy, no brand trust moments. Its UI is functional (maps, forms, layer panels).

**If the scope changes** — e.g., the tool gets a marketing landing page or a customer-facing demo — this waiver no longer applies and visual regression must be added. Superseding ADR required at that point.

### Lighthouse CI / Core Web Vitals — waived

Policy says performance budgets + Core Web Vitals RUM are required for public web apps. This tool is not a public web app. It's used on known hardware (developer's laptop, client's phone during a site walk) with known network conditions. LCP and CLS budgets are not a meaningful quality signal here.

**If the scope changes** to include public access or a marketing surface, this waiver is void.

### Contract tests — not applicable

No service boundary. The app is a local-first PWA talking to IndexedDB (Dexie). No API, no backend, no cross-service dependency. Contract tests require two sides; there's only one.

---

## Risk and mitigation

### What could go wrong without the Phase 2 items

- **No smoke test:** a regression breaking the sign-in / add-property / save flow could reach `main` and not be caught until the next manual test. Blast radius: limited to whoever uses this tool in the gap window.
- **No automated a11y:** keyboard-only or screen-reader regressions could ship unnoticed.

### How the risk is reduced while Phase 2 is open

- **Manual smoke test before each release:** after every merge to `main`, the author manually runs `npm run dev` and walks the critical path (load → add property → add line → reload → verify persistence) before considering the release done.
- **Tests pass gate is still enforced:** all 234 existing Vitest tests must pass, and they cover a lot of the component and business logic already.
- **Solo-studio scope:** with one active developer, regressions are caught faster in practice than they would be in a larger team with long PR queues.

---

## Resolution plan

- **Target for Phase 2 items:** 2026-06-01.
- **Review trigger:** on 2026-06-01 OR when the tool gains a public surface (whichever comes first).
- **On expiry (2026-07-21):** if Phase 2 isn't closed, write ADR-0003 extending with a fresh 3-month expiry and explain why the delay was acceptable.

## Review history

| Date       | Reviewer | Notes                                                      |
| ---------- | -------- | ---------------------------------------------------------- |
| 2026-04-21 | Wijnand  | Accepted. Phase 1 CI in place; Phase 2 scheduled for 2026-06-01. |

## References

- [[../../../../HearthCode-Vault/04-Standards/Testing-Policy|Testing Policy]]
- [[../../../../HearthCode-Vault/05-Templates/Testing-Waiver-ADR-template|Generic waiver template]]
- [`ADR-0001`](./0001-testing-waiver-vite-plugin-pwa-audit.md) — the complementary waiver for the `npm audit` scoping
