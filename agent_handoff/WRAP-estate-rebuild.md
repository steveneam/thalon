# WRAP — lane `estate-rebuild` (Sites · Settings/Integrations, exact-mock rebuild)

Branch `agent/estate-rebuild`, four commits, worktree clean. Both surfaces
went through the ratified TWO-STEP: pure sheet port (the founder's structural
verdict point) → wire + keepers, with the old implementation deleted in the
same step. `workspace.css` was never touched; both surface stylesheets are
scoped under their own root class.

| Surface | Step 1 (pure port) | Step 2 (wire + keepers) |
|---|---|---|
| Sites | `91b6ae7` | `ccd200c` |
| Settings → Integrations | `8bb28d5` | `dcc81f0` |

---

## Sites — `Sites.dc.html`

Bands ported: the headline row with its two count pills · the build card
(prompt box + primary button + the portfolio category chips) · the
three-column `.site-grid`, each card a preview shot over a meta row (name ·
state pill · Dossier door) · the closing record line.

**Keepers woven back in** (each named, all behind byte-true resting chrome):

- **The ONE list keyboard grammar** (`lib/workspace/keyboard.ts`) — j/k move ·
  ↵ opens. Nothing is selected at rest, so the resting grid is exactly the
  sheet's; the pick wears the sheet's own `.row.sel` accent on a card.
- **The old gallery's facet filtering** — `applyFilters`/`facetValues` carried
  over verbatim into `sites-model.ts`; vertical, design register and build
  wave each toggle independently, exactly as the three old facet rows did.
  They re-enter through the sheet's own chip row + its "More →" chip.
- **Bounded-List honesty** — the old `countLine`'s job now lives in the
  headline pills: a filter reads "N of M built", never hiding the total.
- **Honest states** from the old route — unconfigured origin, origin error,
  empty catalog — re-expressed in the sheet's card/row grammar, each naming
  what is true (a missing setting, a read failure, an answered-but-empty
  catalog) instead of rendering as an empty portfolio.
- **Media-first** — the card shot is the site's own hero from the preview
  origin; the sheet's striped placeholder + mono caption stays for a record
  without one.
- **Visible provenance** — the footer states which origin answered (local
  template dir vs `catalog.json`) and where previews come from.

**Honest deviations from the fixture — flagged, not improvised:**

1. **The state pill reads the VERDICT** (`Approved` / `Fix round` / `Awaiting
   verdict`), not the fixture's `Live` / `Draft`. The sites catalog carries no
   deploy state at all — nothing in `site.json` or the assembler records a
   published site — so calling an approved site "Live" would be a fabricated
   value. Same reason the second headline pill counts approvals, not "live".
2. **The chips are the catalog's own vocabulary**, humanized in the sheet's
   `·` grammar ("Trade · electrician", "Editorial print", "Wave 3"). The
   fixture's short curated names ("Café · warm") are a vocabulary the catalog
   does not carry; authoring one is a B-sitegen charter decision, not a lane's.
   *Founder call available:* if you want the curated names, they need a
   category field on each site record.
3. **The build door is disabled and says so.** Generating a site from a prompt
   is not wired to this surface (B-sitegen is an uncharted candidate), so
   rather than a dead primary button the card carries one honest `t-label`
   line — "Building from a prompt isn't wired to this surface yet — the
   portfolio below is what has actually been built, and the chips filter it."
   That line is the one addition inside the sheet's card band.
4. **"More →" becomes "Fewer ←" when expanded.** Resting label is byte-true;
   only the expanded state renames it so the row can collapse again.
5. **`.cat-chip.on` and `.site-card.sel` are not drawn by the sheet.** Both
   are composed from the sheets' OWN values — the active chip uses
   `.seg-opt.on`'s treatment, the selected card uses `.row.sel`'s accent — so
   no new design vocabulary enters.
6. **The SITE DOSSIER (`/app/sites/[slug]`) has no sheet in the mock** and is
   therefore untouched: it still wears bridged tokens (pin held at 19) and
   will look like the old design when opened from a rebuilt card. **This needs
   a founder/lead call** — port it in the sheets' language the way Search was
   designed at s74, or leave it until a dossier sheet exists. I did not
   improvise one.

## Settings → Integrations — `Integrations.dc.html`

Bands ported: the breadcrumbed headline with the published-ledger door · the
three-column `.int-grid` (glyph, name, state pill, one sub-line, actions) ·
the "Your AI" card with a `.seat-row` per model seat.

**The honesty-critical rules, as shipped** (all pinned by tests):

- Card state is the ONE engine derivation (`listIntegrationCards`); the
  surface re-derives nothing.
- An **env-filled seat never reads "Not connected"** (the s70 founder catch) —
  it wears the sheet's own "Connected via env" and offers "Move into vault".
  Extended slightly: when a vault row exists *underneath* an env override and
  is itself broken/expiring, the sub-line says so, so a key rotation isn't
  flying blind.
- **The plan gate outranks the env seat**: a `plan_gated` destination shows
  the gate and offers no action at all, rather than a button that cannot work.
- **`connectedAs` stamps its card**, beside the last verification age and the
  **driver name** that consumes the credential (visible provenance).
- **A validate failure prints the platform's own refusal verbatim** — the
  LinkedIn 426-vs-400 versioned-pin proof lands as evidence, in the error
  channel, never softened.
- **The PUBLISHED VIEW** is the ledger of what actually went out, newest
  first, every row carrying its way back (permalink, or the external id when
  the platform gives no link), bounded at 12 with the total stated.

**Keepers woven back in** (as STATE behind the sheet's chrome — doctrine vii):

- **Guided mode-2 connect** — the `GUIDED_STEPS` copy verbatim, paste fields
  derived from the destination's own zod schema, secret-shaped keys as
  password inputs, validate-on-connect, and mode 1 named honestly ("one-click
  connect arrives when the partner app clears this platform's review"). It
  opens as a panel from the sheet's own Set up / Move into vault action.
- **The disconnect confirm** — "the sealed credential is deleted; the ledger
  remembers what already went out" — as a line on the card it destroys; the
  card's own Disconnect steps aside while it is up.
- **The published view** (the s70 closer of the `/blog` partial) — behind the
  sheet's own header door, with its count in the door's label.
- **`platformLabel`** from `lib/workspace/format.ts` for ledger rows — the ONE
  home, not re-grown here.

**Honest deviations from the fixture — flagged, not improvised:**

1. **No TikTok card.** `packages/contracts` ships no TikTok destination on
   purpose (review-gated, no driver); the grid is the registry, so inventing
   the sheet's TikTok card would be a fabricated state.
2. **Eleven cards, engine labels verbatim** ("Hosted blog", "WordPress site",
   "Ghost site", "Webhook", "Newsletter", "YouTube intel", "Bluesky intel",
   "Facebook Page") where the sheet draws nine with its own names ("Blog ·
   your site", "Email · outreach"). Re-labelling in the UI would be a second
   derivation of a thing the engine already names.
3. **"Your AI" keeps the sheet's three seats.** The engine has four model
   settings because the judge runs two passes — so the Judge row names both
   models when they differ instead of inventing a fourth seat, and every row
   states how the model is actually reached (subscription vs metered gateway,
   or that the gateway is unconfigured and the seat cannot run). The count
   pill is derived.
4. **The connect panel introduces four classes the sheet does not draw**
   (`.connect-body`, `.connect-steps`, `.connect-fields`, `.connect-field`),
   because the sheet draws no flow. They are authored in the sheets' own
   spacing/type/control grammar and scoped under `.settings-surface`.
5. **The Settings ROOT (`/app/settings`) has no sheet in the mock** and is
   untouched — still bridged (pin held at 7). Same open call as the dossier.

## Pin deltas (my rows only)

- `lib/__tests__/bridge-burndown.test.ts`
  - removed `app/app/sites/page.tsx` (was 5 → the route now only renders the
    ported surface) — step 1;
  - removed `components/sites/sites-gallery.tsx` (was 21, file deleted) — step 2;
  - removed `components/settings/integrations-panel.tsx` (was 30, file
    deleted) — step 2;
  - **held on purpose:** `components/sites/site-dossier.tsx` 19 and
    `components/settings/settings-panel.tsx` 7 — neither has a mock sheet.
- `lib/workspace/__tests__/selected-row.test.ts` — `sites/sites-gallery.tsx`
  row removed; Sites now marks selection with the sheet's `.row.sel`.
- `lib/__tests__/mono-ratchet.test.ts` — **no delta**: neither surface had a
  row, and neither rebuild introduced one.
- `lib/__tests__/surface-css-scope.test.ts` — two new stylesheets, every rule
  scoped (`.sites-surface`, `.settings-surface`); no change to the test.

## Deletions

- `apps/web/src/components/sites/sites-gallery.tsx`
- `apps/web/src/components/sites/model.ts` → re-homed as `sites-model.ts`
  (the dossier's import updated in the same commit)
- `apps/web/src/components/sites/__tests__/model.test.ts` → renamed
  `sites-model.test.ts` (the image-side catalog **drift guard** inside it is
  preserved intact)
- `apps/web/src/components/settings/integrations-panel.tsx`
- `apps/web/src/components/settings/__tests__/integrations-panel.test.tsx`

## Test deltas

| File | Δ | Cases |
|---|---|---|
| `components/sites/__tests__/sites.test.tsx` | new | 9 |
| `components/sites/__tests__/sites-model.test.ts` | renamed + extended | 4 |
| `components/settings/__tests__/integrations.test.tsx` | new | 10 |
| `components/settings/__tests__/integrations-model.test.ts` | new | 7 |
| `components/settings/__tests__/integrations-panel.test.tsx` | deleted | −4 |

Every suite mirrors `create-surface.test.tsx`: MSW fixtures, the sheet's bands
pinned structurally, the doors, the honest states, the keyboard grammar, and a
"no bridged tokens survive" assertion per surface.

## Verify

`npm run verify` at the repo root, unfiltered, redirected to a file (never
piped through `tail`) — see the run note at the bottom of this file for the
box's state when it ran.

## For the lead's merge gate

- Screenshot-vs-sheet targets: `/app/sites` and `/app/settings/integrations`
  at 1440×940, dark and light.
- Two surfaces the diff will legitimately differ on: the site **dossier** and
  the Settings **root** — no sheets exist for them, so they are still the old
  design behind the rebuilt doors.
- Cross-lane collision check: the only reused class name in my files is
  `.prompt-box` (Create ≠ Sites — the named case), and it is scoped.
- Possible future consolidation: the destination→glyph map lives in
  `components/settings/integrations-model.ts`. It is deliberately NOT merged
  into `lib/workspace/format.ts`'s `platformLabel` — destination keys
  (`website_hosted`, `intel_youtube`) are the vault's vocabulary, a different
  namespace from platform ids. If a second surface ever needs glyphs, that is
  the moment to move it.
