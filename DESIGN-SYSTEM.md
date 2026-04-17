# Property Utility Mapper — Design System

**Owner:** Wijnand
**Last updated:** 2026-04-17
**Use:** The single source of truth for look, feel, and interaction. Commit this alongside `CLAUDE.md`, `ROADMAP.md`, `SPEC.md`, and `ARCHITECTURE.md`. Every coding session that touches UI must load this first.

---

## Purpose

A design system is the set of deliberate choices that make every screen in the app feel like the same app. Colours, spacing, corner rounding, typography, how buttons look, how errors are worded, how a panel opens. Consistency is not cosmetic — it's how users learn the app without instructions.

This document **is the rule**. If a component violates these rules, fix the component rather than loosen the rules. If the rule itself turns out to be wrong in practice, update the rule here (with a note on why) rather than quietly drift.

---

## Principles

These are the compass when a decision is ambiguous.

1. **Friendly but serious.** The app is used by homeowners who aren't technical and by contractors who need precise information. Every design decision should make the homeowner feel welcome without making the contractor feel like it's a toy.
2. **Map first.** This is a mapping tool. UI chrome exists to serve the map, never compete with it. Chrome colours stay soft; map data stays bold.
3. **Dutch by default.** All copy is Dutch — labels, aria-labels, error messages, tooltips. English strings in UI are bugs.
4. **One primary action per view.** Primary (green) buttons are rare. They mark the single most important action. Secondary and ghost variants handle everything else.
5. **Accessibility isn't a finishing step.** WCAG AA is the minimum; keyboard parity is non-negotiable; `prefers-reduced-motion` is respected.

---

## Colour tokens

All colours are defined as CSS variables in the shadcn token file (usually `src/styles/globals.css` or `src/index.css`). Components read from variables, never from hardcoded hex.

Values below are in Tailwind v3's HSL-triplet form (`H S% L%`), so they work with `hsl(var(--primary))`. If the repo is on Tailwind v4, ask in the session and we'll convert to the `oklch()` equivalent.

### Light mode (`:root`)

```
--background: 0 0% 100%
--foreground: 222 47% 11%
--card: 0 0% 100%
--card-foreground: 222 47% 11%
--popover: 0 0% 100%
--popover-foreground: 222 47% 11%

--primary: 142 72% 29%             /* green-700 — forest green brand */
--primary-foreground: 0 0% 98%

--secondary: 210 40% 96%
--secondary-foreground: 222 47% 11%

--muted: 210 40% 96%
--muted-foreground: 215 16% 47%

--accent: 210 40% 96%
--accent-foreground: 222 47% 11%

--destructive: 0 84% 60%           /* red-500 */
--destructive-foreground: 0 0% 98%

--border: 214 32% 91%
--input: 214 32% 91%
--ring: 142 72% 29%                /* matches primary */

--radius: 0.625rem                 /* 10px — soft */
```

### Dark mode (`.dark`)

```
--background: 222 47% 8%
--foreground: 210 40% 98%
--card: 222 47% 11%
--card-foreground: 210 40% 98%
--popover: 222 47% 11%
--popover-foreground: 210 40% 98%

--primary: 142 71% 55%             /* green-400 — lighter for dark bg */
--primary-foreground: 222 47% 11%

--secondary: 217 33% 17%
--secondary-foreground: 210 40% 98%

--muted: 217 33% 17%
--muted-foreground: 215 20% 65%

--accent: 217 33% 17%
--accent-foreground: 210 40% 98%

--destructive: 0 63% 50%
--destructive-foreground: 210 40% 98%

--border: 217 33% 17%
--input: 217 33% 17%
--ring: 142 71% 55%
```

Radius is unchanged between modes.

---

## Radius

One variable, cascades to everything.

```
--radius: 0.625rem
```

Components use Tailwind's `rounded-lg`, `rounded-md`, `rounded-sm` — shadcn's `tailwind.config` maps these as `calc(var(--radius) - Npx)` so the relationship is proportional. Do not hardcode `rounded-[12px]` anywhere. Always use the tokens.

---

## Typography

Inter (with `system-ui` fallback). No custom weights or loaded fonts.

- `text-xs` (12px) — captions, legend labels
- `text-sm` (14px) — body text, button labels, form labels (default in most of the app)
- `text-base` (16px) — prominent body text, dialog content
- `text-lg` (18px) — secondary headings
- `text-xl` / `text-2xl` — primary headings, dialog titles

Weights: `font-normal` (400), `font-medium` (500) for emphasis, `font-semibold` (600) for headings. No `font-bold` in body UI — it looks heavy next to Inter's regular weight.

---

## Density

Comfortable — shadcn "new-york" defaults. Do not compress spacing to fit more on screen; do not inflate it to look premium. If the layout feels cramped, the content is wrong, not the padding.

---

## Motion

- Transitions: 150–200ms, `ease-out` for appear, `ease-in` for disappear.
- shadcn primitives handle enter/exit animations via Radix. Use them; don't write custom motion.
- `prefers-reduced-motion: reduce` must disable all non-essential animation. Most shadcn animations already respect this — verify when adding a new one.
- Map pan and zoom are direct manipulation, not animation. Leave Leaflet's defaults alone.

---

## Utility line colours

The 8 colour-coded utility types are defined in the codebase (single source of truth, not duplicated here). They are app-specific data colours and are **not** part of the shadcn/brand palette.

### Audit rule

Before V2.1 Phase C ships, an accessibility audit runs on these 8 colours. For each colour, verify:

1. Contrast ratio against both the OSM base layer (light tiles, ~`#F2EFE9`) and the PDOK satellite imagery (averaged mid-tone) meets WCAG AA for non-text (3:1 minimum).
2. Contrast ratio against `--background` in both light and dark mode (the colour appears in the legend).
3. No perceptual collision with the brand green (`--primary`) — visibly distinguishable even for users with deuteranopia or protanopia. Test with a colourblind simulator.
4. No perceptual collision with destructive red (`--destructive`).

If any colour fails, document the adjustment with a note and ship the fix. If all pass, record "audit passed YYYY-MM-DD" in this section and move on.

---

## Component rules

### Buttons

- `variant="default"` (brand green): exactly one per view — the main save / confirm / create action.
- `variant="secondary"`: non-primary actions in the same flow (cancel, back).
- `variant="outline"`: toolbar buttons, map chrome, neutral actions alongside a primary.
- `variant="ghost"`: icon-only buttons in toolbars, tertiary links.
- `variant="destructive"` (red): deletion, permanent data loss.
- `variant="link"`: inline text links inside prose.

### Dialogs and sheets

- `Dialog` for neutral forms and content (edit line attributes, import file).
- `AlertDialog` for destructive confirmations (delete property, wipe drawings).
- `Sheet` sliding from the bottom for mobile panels with lists of controls (layer manager, line toolbar on small screens). Desktop uses `Popover` for the same content, anchored to the trigger.
- `Drawer` is not used in this app — stick to Sheet.

### Toasts (sonner)

- Success: brand green, icon = check, duration 3s.
- Info: neutral slate, icon = info, duration 4s.
- Error: destructive red, icon = alert, duration 5s (long enough to read).
- Never stack more than 3 visible; dismiss older ones.

### Inputs

- Always use a visible `Label`. Never placeholder-as-label.
- Error state: `ring-destructive` on focus, error text below in `text-destructive text-xs`, `aria-describedby` wires label and error.
- Helper text (neutral): below input in `text-muted-foreground text-xs`.

### Legend and map chrome

- Map chrome (zoom buttons, layer button, mode toggle) uses `variant="outline"` on a light-in-light-mode / dark-in-dark-mode background. Chrome never uses brand green — that's reserved for save/confirm.
- Legend uses the 8 utility colours as bold 16px swatches. Legend text in `text-xs text-foreground`. Not `text-muted-foreground` — users need to read these clearly.

---

## States

### Empty

Always have:

- A neutral Lucide icon at 32–48px in `text-muted-foreground`.
- A short message in `text-base text-muted-foreground`.
- One verb-led CTA in the appropriate button variant.

Example: properties list with no properties → "Je hebt nog geen adressen toegevoegd" + primary "Adres toevoegen" button.

### Loading

- `Skeleton` component for shapes of known content (list rows, cards).
- Inline spinner only when the user has triggered an action and is waiting (< 2 seconds typical).
- Never spin longer than ~5 seconds without surfacing either progress or an explanation.

### Error

Tone matches the error category:

- **Technical** (network, parse): neutral, offer retry. "Geen internetverbinding. Probeer opnieuw."
- **User input** (missing field): warm, short, points to the fix. "Vul eerst een adres in."
- **Unexpected / bug**: apologetic, offer a recovery path. "Er ging iets mis. Ververs de pagina om opnieuw te proberen."

Never silently swallow an error; always tell the user something happened.

---

## Iconography

Lucide (shadcn's default). Default stroke weight. Sizes:

- 16px inside text lines
- 20px standalone
- 24px for toolbar buttons

Don't mix icon libraries. Don't recolour icons ad-hoc — they inherit `currentColor` from their parent.

---

## Dark mode

- Toggle via existing `ThemeProvider` + `ModeToggle`. Users who don't set a preference follow their OS (`prefers-color-scheme`).
- Every new component must render correctly in both modes. Verify both before calling it done.
- Map tiles (OSM and PDOK) look identical in both modes. This is expected — imagery is imagery.

---

## Accessibility baseline

- WCAG 2.1 AA minimum.
- All interactive elements reachable via Tab; composite widgets navigable with arrows + Enter/Space.
- `focus-visible` styling on every interactive element, ring colour from `--ring`.
- Touch targets ≥ 44×44px on mobile.
- Meaningful images and icons have `aria-label` (Dutch) or are marked `aria-hidden`.
- Colour is never the only way to convey information (the utility type legend always pairs swatch + type name).
- `prefers-reduced-motion: reduce` disables non-essential animation.

---

## How to evolve this document

Adding a new pattern:

1. Add the rule to the relevant section with a one-line "why".
2. Update CSS variables in `globals.css` if the change is token-level.
3. Run the test suite; fix anything that broke.
4. Note big changes (new semantic colour, new component category) in the commit message.

Finding a component that violates these rules:

1. Fix the component to follow the rules.
2. Exception: if real-world use proved the rule wrong, update the rule here with a note.

---

## Phase 0 — Apply these tokens to the codebase

A short session that lands the design system in `globals.css` without touching any components. Run this any time before V2.1 Phase C — it's independent of Phases A and B and can slot in whenever convenient.

**What this phase delivers:** updated CSS variables (light + dark), a verified `tailwind.config` radius mapping, and a visual sanity check. Zero component code changes.

**Expected time:** 20–40 minutes.

---

## Pending

- [ ] Utility-line-colour accessibility audit (before V2.1 Phase C)
- [ ] Any existing component that hardcodes a colour or radius gets flagged and migrated to tokens (ongoing, pick up as we touch each component)
