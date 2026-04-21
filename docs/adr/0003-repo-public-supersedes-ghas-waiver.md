# ADR-0003 — Repo made public; supersedes GHAS-related parts of ADR-0002

- **Status:** Accepted
- **Date:** 2026-04-21
- **Owner:** Wijnand (Hearthcode-Studio-NL)
- **Supersedes:** the Code-scanning / GHAS portion of [ADR-0002](./0002-testing-baseline-phase-2-gaps.md). The remaining Phase 2 items (smoke/E2E, automated a11y) and the waivers for visual regression + Lighthouse are **unchanged**.

---

## Context

ADR-0002 documented two categories of gap:

1. **Capability gaps we could fix** — Playwright smoke tests and automated accessibility, targeted for 2026-06-01.
2. **Capability gaps caused by a paid-plan constraint** — CodeQL upload required GitHub Advanced Security on private repos. On HCS's free plan this was blocked, so the CodeQL job ran as `continue-on-error: true`, and branch protection was unavailable (requires Pro).

Today the repo was made **public** (MIT-licensed). Public GitHub repos get CodeQL upload and branch protection **for free**. That removes the paid-plan constraint entirely.

## Decision

1. **Remove `continue-on-error: true` from the `codeql` CI job.** Done in the same commit series that records this ADR. CodeQL upload now works; high-severity findings block merges.
2. **Add `CodeQL static analysis` to `main`'s required status checks.** Branch protection now enforces all three CI jobs (`Fast checks`, `Dependency audit`, `CodeQL static analysis`).
3. **Close the GHAS portion of ADR-0002.** That waiver is obsolete — the constraint no longer exists.
4. **Phase 2 items from ADR-0002 remain open and unchanged:** Playwright smoke tests and automated a11y, still targeted for 2026-06-01.
5. **The internal-tool waivers from ADR-0002 stay in force:**
   - Visual regression — this project has no public branded surface that warrants screenshot baselines.
   - Lighthouse CI — this is a tool, not a content site; Core Web Vitals are not a meaningful quality signal here.
   - *If scope ever changes (public marketing surface added), both waivers must be re-evaluated.*

## Consequences

### Positive

- Policy baseline is now fully enforced in CI — no GHAS-related exceptions.
- Branch protection blocks merges to `main` if any required check fails.
- Code scanning findings surface on the Security tab and generate review requests.
- The repo is now a public portfolio piece, demonstrating HCS's standards to anyone who looks.

### Neutral

- The MIT license invites forks. That's the point; for this kind of tool it's low-risk and high-signal.

### Negative / trade-offs

- Source code is now public. Pre-flip checklist was run (`gitleaks`, env-history scan, author identity rewrite via `git filter-repo`) so no secrets or personal emails should be searchable. Any future secret committed by mistake would be immediately exposed — push protection is enabled to catch this before it reaches origin.

## What still needs doing (Phase 2 from ADR-0002, unchanged)

- **Smoke / E2E tests** — Playwright setup + 2-3 critical-path tests, target **2026-06-01**.
- **Automated accessibility** — jest-axe at component level + `@axe-core/playwright` at E2E level, same target date.
- **Manual a11y walkthrough** — remains a per-release requirement; no automation replaces it.

## Review history

| Date       | Reviewer | Notes                                                                |
| ---------- | -------- | -------------------------------------------------------------------- |
| 2026-04-21 | Wijnand  | Accepted. Repo flipped public, CodeQL now blocking, branch protection updated. Phase 2 items inherited from ADR-0002 remain open. |

## References

- [ADR-0001](./0001-testing-waiver-vite-plugin-pwa-audit.md) — dependency-audit scoping waiver (unchanged; workbox-build chain still flagged via manifests).
- [ADR-0002](./0002-testing-baseline-phase-2-gaps.md) — partially superseded by this ADR.
- [[../../../../HearthCode-Vault/04-Standards/Testing-Policy|Testing Policy]]
- [[../../../../HearthCode-Vault/04-Standards/Open-Sourcing-a-Repo|Open-Sourcing a Repo]] — the checklist followed today.
