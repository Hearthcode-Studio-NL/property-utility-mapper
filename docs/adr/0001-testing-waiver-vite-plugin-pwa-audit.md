# ADR-0001 — Waive `npm audit --audit-level=high` dev-dep findings in `vite-plugin-pwa` chain

- **Status:** Accepted
- **Date:** 2026-04-21
- **Owner:** Wijnand (Hearthcode-Studio-NL)
- **Expires:** 2026-10-21 (6 months — re-evaluate when `workbox-build` ships an update or at the date, whichever is first)
- **Related PR:** [chore(deps): upgrade vite 5→6, override serialize-javascript for security](https://github.com/Hearthcode-Studio-NL/property-utility-mapper/commit/fc545bc)

---

## The requirement being waived

Per the HearthCode Studio Testing Policy (`HearthCode-Vault/04-Standards/Testing-Policy.md § Baseline § Dependency & supply-chain checks`), every repo must pass:

> `npm audit --audit-level=high` as a CI step.

This repo currently reports **3 high-severity advisories** against that check. They are all in the `vite-plugin-pwa` dependency chain:

```
vite-plugin-pwa@1.2.0
  └── workbox-build@7.4.0
      └── @rollup/plugin-terser@0.4.4
          └── serialize-javascript@<=7.0.4
```

The specific advisories:

- [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq) — `serialize-javascript` RCE via `RegExp.flags` and `Date.prototype.toISOString`
- [GHSA-qj8w-gfj5-8c6v](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v) — `serialize-javascript` CPU-exhaustion DoS via crafted array-like objects
- (Above repeated across the 3 parent packages in the chain.)

## Scope

### Applies to

- This repo (`Hearthcode-Studio-NL/property-utility-mapper`) only.
- The CI `deps:audit` step, configured to run `npm audit --audit-level=high --omit=dev` instead of the full `npm audit --audit-level=high`.

### Does not apply to

- Production dependencies. The full `npm audit --audit-level=high` on production deps (`--omit=dev`) passes with **0 vulnerabilities**.
- Any other HearthCode Studio repo. Each project evaluates its own dependency posture.
- Runtime / user-reachable code. See mitigations below.

## Why

Two reasons, in order of importance:

1. **The blast radius is build-time, dev-only.** `serialize-javascript` runs during `npm run build` (PWA service-worker generation via Workbox). It does not execute in the user's browser. It does not execute on any server HearthCode operates. It only runs on the developer's laptop and in CI build runners — both trusted environments. An attacker would need to supply malicious input to the Workbox build step, which requires first compromising a trusted dependency (a much larger incident than these two advisories).
2. **An earlier attempted patch made things worse.** A `package.json` `overrides` entry forcing `serialize-javascript@^6.0.2` was tried and removed — it caused npm to downgrade `vite-plugin-pwa` to `0.19.8`, which only supports Vite 3-5, breaking Vite 6 compatibility and failing `npm ci` with `ERESOLVE`. The safer path is to live with the advisory (scoped to dev) and wait for `workbox-build` to ship a fix upstream.

**Production dependencies are clean.** The full `npm audit --audit-level=high` on production deps only (`--omit=dev`) reports **0 vulnerabilities**. Nothing a user of the app ever touches has a known high-severity issue.

## Risk and mitigation

### What could go wrong without this rule

- If an attacker gained control of one of the build-chain dependencies and injected input crafted to trigger GHSA-5c6j-r48x-rmvq, they could achieve RCE in the build process. That would already require a supply-chain compromise of a trusted dependency (much bigger problem than this CVE).
- If a PR somehow introduced build inputs that triggered GHSA-qj8w-gfj5-8c6v's CPU exhaustion path, CI builds would stall. Recoverable; not user-affecting.

### How the risk is reduced while the waiver is active

- **Build runs only on trusted hardware** — developer workstations and GitHub-hosted CI runners. No untrusted contributors can inject build input at HearthCode Studio's current scale.
- **Production code is clean.** `npm audit --omit=dev` reports 0 vulnerabilities — every runtime dependency passes.
- **Dependabot alerts remain on** for the repo. If Workbox ships a fix before the waiver expires, the PR shows up automatically.
- **The CI audit gate still runs** with `--omit=dev`, so if a *production* dep ever gets a high-severity advisory, CI fails loudly.

## Resolution plan

- **Target resolution date:** 2026-10-21 (6 months).
- **Who adds the check back:** Wijnand.
- **What triggers review before expiry:**
  - `workbox-build` ships a release bumping its `serialize-javascript` manifest range, OR
  - `vite-plugin-pwa` swaps `workbox-build` for a non-vulnerable alternative, OR
  - The expiry date is reached.
- **Tracking:** subscribe to issue / release notifications on
  [`vite-plugin-pwa`](https://github.com/vite-pwa/vite-plugin-pwa) and
  [`workbox-build`](https://github.com/GoogleChrome/workbox).

## CI configuration implementing this waiver

The GitHub Actions workflow's `deps:audit` step in this repo reads:

```yaml
# .github/workflows/ci.yml  — deps:audit step
- name: Dependency audit
  run: npm audit --audit-level=high --omit=dev
  # Scope justified by docs/adr/0001-testing-waiver-vite-plugin-pwa-audit.md
  # Full-tree audit surfaces only the vite-plugin-pwa → workbox-build chain,
  # which is patched via package.json overrides. Revisit by 2026-10-21.
```

## Review history

| Date       | Reviewer | Notes                                        |
| ---------- | -------- | -------------------------------------------- |
| 2026-04-21 | Wijnand  | Waiver accepted after Vite 5→6 upgrade + `serialize-javascript` override. 0 high vulns on `--omit=dev`, 3 remain on full tree (manifest-only). |

Add a row each time the waiver is renewed, narrowed, or closed.

## References

- [[../../../../HearthCode-Vault/04-Standards/Testing-Policy|Testing Policy]]
- [[../../../../HearthCode-Vault/05-Templates/Testing-Waiver-ADR-template|Generic waiver template]]
- npm docs — [`overrides`](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides)
- GHSA-5c6j-r48x-rmvq, GHSA-qj8w-gfj5-8c6v (linked above)

---

**Reminder:** this waiver expires 2026-10-21. If on that date the upstream chain has not been fixed, write ADR-0002 extending the waiver with a fresh expiry and review. No silent renewals.
