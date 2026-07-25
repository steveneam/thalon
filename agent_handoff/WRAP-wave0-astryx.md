# WRAP — lane `wave0-astryx` (UI overhaul WAVE 0: the Astryx foundation)

Branch `agent/wave0-astryx`. Exit condition: every existing surface renders and
functions inside the new chrome; full `npm run verify` green. Status below.

## What shipped

**Pinned versions:** `@astryxdesign/core@0.1.8` (dep) + `@astryxdesign/cli@0.1.8`
(devDep), both EXACT pins (no `^`) in `apps/web/package.json` — 0.1.8 is the
latest stable and the version the phase-0 scratch build proved on this exact
stack. License audit of the 39 newly-installed packages: 35 MIT · 2 ISC ·
1 BSD-3-Clause · 1 legacy-"BSD" (css-mediaquery — permissive). No copyleft, no
commercial gate. NO `@astryxdesign/build`, NO charts (`@canary` — barred).
Install ran in the MAIN checkout per the preinstall-guard protocol (worktrees
share node_modules via the junction); main's manifests were restored clean and
the manifest diff rides this branch.

**The theme:** `apps/web/src/theme/thalon.theme.ts` — `defineTheme` from
scratch. The founder-verdicted mock's oklch values land VERBATIM in the dark
slots (dark is the workspace default); light slots carry the incumbent
AA-pinned light-workspace palette role-mapped onto the same tokens, so the
light toggle is continuity, not a second design. Extended Thalon-only families
ride the same config: `--color-background-rail`, `--color-neutral-100…1000`
(the usage-mapped ramp), `--color-brand-hi/lo` (mark ONLY), `--color-thermal-*`
(word-in-pill grammar, mode-independent). Typography = Geist/Geist Mono via the
next/font variables (scale base 14 / ratio 1.2 → body 14, headline 17 — the
mock's exact rhythm). Radius card 10 / control 7 / pill full; motion 130ms
`cubic-bezier(.3,.7,.4,1)`.

Build artifacts are generated + committed: `npm run theme:build` (new script) →
`src/theme/thalon-theme.css` + `thalon.js` + `thalon.d.ts`. The contrast test
pins the built CSS to the source token-for-token, so a source edit without a
rebuild goes red (executable drift ratchet).

**The cascade** (`globals.css` head): exactly the documented coexistence recipe —
```
@layer reset, theme, base, astryx-base, astryx-theme, components, utilities;
tailwindcss/theme.css → tw-animate-css → shadcn/tailwind.css →
tailwindcss/preflight.css → @astryxdesign/core/reset.css →
@astryxdesign/core/astryx.css → ../theme/thalon-theme.css →
@astryxdesign/core/tailwind-theme.css → tailwindcss/utilities.css
```
Below the token blocks sits the **wave-0 bridge**: under
`[data-astryx-theme="thalon"]` (stamped on `<html>` by the workspace `<Theme>`,
removed on unmount) every legacy token the 100+ existing surface files consume
(`--background`, `--card`, `--primary`, `--signal`, `--heat-*`, `--sidebar*`,
…) re-points at the Astryx theme tokens. That single block is how every
untouched surface renders on the new palette in both modes; the landing and
/brand never see it because the attribute never exists outside the workspace.

**The shell:** `workspace-shell.tsx` = `<Theme theme={thalonTheme} mode>` (built
theme, no runtime injection) + `LinkProvider(next/link)` + `AppShell`
(`variant="section"`, `height="auto"`) with:
- `workspace-sidenav.tsx` — LABELED nav, order and labels exactly the mock:
  Home · Intel · Create · Approve(count) · Calendar ┃ Leads · Library · Videos ·
  Sites · Runs ┃ Profiles · Settings (three `SideNavSection`s, headers
  a11y-only). Approve wears the needs-you count as an amber Badge (amber =
  needs-you ONLY). Brand mark in the header wears `--color-brand-hi/lo`.
  `lib/workspace/nav.ts` stays the ONE registry (nav + palette + topbar title);
  `Dashboard` is renamed `Home` per the mock, `rail:` becomes `section:`.
- `workspace-topnav.tsx` — tenant switcher (carried over verbatim) · surface
  title h1 · **async-work tray** · needs-you chip · + Create · ⌘K · light-mode
  toggle (dark default; localStorage + `useSyncExternalStore`).
- `work-tray.tsx` — founder round 8, the honest shell: neutral "N working"
  chip + Spinner while any fan-out run is pending/running (20s poll of
  `/api/runs` + focus refresh), green completion dot for runs that finished
  since last opened (session-watched set — pre-existing completions never raise
  it), Popover tray with per-job rows: label (platforms) · stage WORDS
  (`queued` / `composing · judging` / `done` / `failed` — never a fake %) ·
  `started Nm ago` (the honest ETA where none exists) · View→ deep-link
  (finished-with-waiting → Approve, else → Runs). Completion raises the dot,
  never a modal. Per-pipeline progress lands per-pipeline later, on these rows.
- `app/app/layout.tsx` — pre-paint inline script stamps `data-theme` +
  `data-astryx-theme` before first paint on hard loads (no flash); the Theme
  provider owns the attributes after hydration and removes them on unmount.
- Old `sidebar.tsx` (icon rail) + `topbar.tsx` deleted; `workspace-shell.test.tsx`
  re-pinned to the labeled-nav contract.

**Ratchets:**
- `tokens-contrast.test.ts` re-pinned to the theme source — every named pair
  tested in BOTH mode slots (32 pair checks), plus the §5 pairs: warn-on-100 ·
  err-on-100 · ok-on-100 · act-text-on-act, plus the built-CSS sync check.
- NEW `mono-ratchet.test.ts` (§4.3's named ratchet, disease #1 executable):
  every `u-eyebrow` use + same-line `font-mono`+`uppercase` pairing counts;
  per-file pins seeded at TODAY's counts — **starting count 117 violations
  across 40 files** (create-surface 18 is the worst; landing files included,
  they burn down at wave 4). Count above pin fails (new scaffolding = defect);
  count below pin fails until the pin is lowered in the same change — the seed
  only ratchets DOWN.

## Honest flags

1. **act-text-on-act (dark) = 3.28:1.** The mock's exact accent
   (`oklch(0.635 0.135 252)`) with its near-white text cannot reach 4.5:1 —
   this is a property of the verdicted values, kept verbatim per the kickoff.
   Pinned at ≥3.0 (WCAG UI-component threshold) with the rationale in the test;
   light mode passes 5.75. Founder call at wave 1: accept (Vercel/Linear-class
   products ship ~3.3 here) or darken the accent under button text.
2. **Light-slot retunes:** light `--color-warning` 0.55→0.54 L and
   `--color-error` 0.577→0.55 L (both hue-true) — the ONLY light deviations
   from the incumbent palette, forced by the new §5 warn/err-on-100 pairs
   (4.37/4.18 → 4.69/4.84). Dark slots untouched.
3. **Upstream typing warts** (Astryx 0.1.8 beta, priced in): `PopoverProps`
   marks `className`/`style` required (empty values passed); the `TokenName`
   union lags what `astryx theme build` accepts, so the extended families merge
   through one documented cast in the theme file.
4. **jsdom stubs:** `matchMedia` + `ResizeObserver` polyfills added to
   `src/test/setup.ts` (the Astryx shell needs both; jsdom ships neither).
5. **No swizzle used.** Component-level theming (rail color) went through
   `defineTheme` `components` overrides (`app-shell-sidenav` / `side-nav`).

## Agent docs

`astryx init` wrote the component index into `apps/web/AGENTS.md` (ASTRYX
markers) — 153 components + the discover-don't-guess workflow; a
THALON:ASTRYX-ADDENDUM section (outside the markers, upgrade-safe) records the
pin policy, theme-build ritual, dark-default/bridge shape, and the barred
charts. `apps/web/CLAUDE.md` restored to the `@AGENTS.md` include (init had
duplicated the block into both). Grep guard: PASS.

## Verification

- **Full `npm run verify` (repo root, never filtered): GREEN** — guard PASS ·
  278 test files / 1885 tests passed (0 failed, 9 pre-existing skips) ·
  typecheck clean · lint 0 errors (16 pre-existing `<img>`/unused-var
  warnings, same set as main). Run twice green: after the suite fixes and
  again after the final `suppressHydrationWarning` edit.
- Suite catches fixed along the way (all mine): the new jsdom `matchMedia`
  stub un-bailed the landing FeatureLoop's guarded autoplay effect, so jsdom's
  promise-less `HTMLMediaElement.play` broke 7 landing tests → setup now also
  gives `play()/pause()` their spec shapes; the palette test's "Dashboard"
  label re-pinned to "Home".
- **Live browser pass (headless Chrome, 1440×900, lane dev server on :3199):**
  the worktree can't run `next dev` over out-of-root node_modules symlinks, so
  the pass swapped them for `cp -al` hardlink trees (restored to symlinks
  after — Turbopack then boots in 485ms). Evidence (session scratchpad;
  reproducible with the same swap):
  - `shot-home.png` — /app dark: labeled 3-group nav exact mock order, Home
    selected, Approve amber count 25, brand mark in landing amber, tenant
    switcher + needs-you chip + Create + ⌘K + mode toggle in the topbar; the
    untouched dashboard fully re-skinned by the bridge.
  - `shot-approve.png` — the queue functional inside the new chrome (rows,
    statuses, j/k hints, bounded-list footer).
  - `shot-settings.png` — settings cards + seam values on the new tokens.
  - `shot-settings-light.png` — the light toggle: one attribute flips the
    whole workspace to the warm-paper set; localStorage round-trips.
  - `shot-landing.png` — `/?landing=1` (dev / redirects to /app, pre-existing
    config): the landing renders its own amber register, ZERO Astryx
    attributes on `<html>`, no dev-overlay issues.
- **One real browser catch, fixed:** React 19 diffs the pre-paint
  `data-theme`/`data-astryx-theme` stamps against the server-rendered `<html>`
  → one-line `suppressHydrationWarning` on the root `<html>` (the standard
  theme-stamping pattern, scoped to that element). Re-verified: fresh hard
  loads show zero issues.

## For the merge (lead)

- Post-merge: run `npm run verify` on merged main (the standing gate).
- The install already lives in the shared node_modules (main checkout install);
  main's package.json/lock arrive via this merge — no install step needed.
- s3-store / rebrief lanes: no file overlap (this lane touched only apps/web +
  root package-lock + agent docs).
