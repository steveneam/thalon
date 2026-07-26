# KICKOFF — lane `sites-deepen` (the Site Dossier rebuild + the broken-preview fix + the old gallery's good features)

> **FOUNDER-DIRECTED, s75 close:** *"can you also plan to have the Sites
> feature a bit more built as well. there thumbnails seem broken, and
> clicking on one of them seem to take me to the old design. there were some
> good features from the old design, so see if you can add them back in now
> that the design structure is in place now."*
>
> Both of his observations were confirmed by the lead before this kickoff was
> written — neither is a guess, and the causes are below. Parallel lanes are
> open (s73/s74/s75 rulings).

Read `CLAUDE.md` first, then IN ORDER:

- `docs/research/mock-sheets/README.md` — **THE CONTRACT.** Rule 0 (exact =
  the sheet's own HTML/CSS ported 1:1), rule 2 (placeholders over drift),
  rule 3 (demolish, don't renovate — the old implementation dies in the
  commit that replaces it), **rule 6 (scope every surface stylesheet)**, and
  the two newest sections: *Founder amendments* and *Proposals — NOT yet
  verdicted (do not port)*.
- `docs/research/mock-sheets/Sites.dc.html` + `theme.css` — the gallery,
  already shipped. **There is NO dossier sheet.** See "The dossier has no
  sheet" below; that is the one real design call in this lane.
- `apps/web/src/components/sites/sites.tsx` + `sites.css` + `sites-model.ts`
  — the s75 rebuild. Byte-true and shipped; your gallery work builds ON it.
- `apps/web/src/components/sites/site-dossier.tsx` — **the old design, still
  live.** Untouched since s61.
- `docs/research/old-design-keepers.md` — the re-entry rule.
- `agent_handoff/WRAP-estate-rebuild.md` — the lane that rebuilt the gallery
  last session; it names what it carried over and what it left.

## The three jobs, in this order

### 1. The broken previews — DIAGNOSED, fix it properly

`apps/web/src/lib/sites/provider.ts` has
`const DEV_PREVIEW_ORIGIN = "http://127.0.0.1:8899"`, and **both** the
gallery card images and the dossier's iframe resolve against it. On the box
all 20 thumbnails load; from any **other** machine — the founder's laptop or
phone — `127.0.0.1` is *their* loopback, so every image and the whole
dossier preview is broken. That is exactly what he is seeing. It is not a
rendering bug and the images are not missing.

`SITES_PREVIEW_ORIGIN` already overrides the constant, so an env change is
the trivial patch — but it is not the fix, because the correct origin
differs per viewer and staging has its own story (`SITES_BASE_URL`, and the
templates-preview service is still an open founder console item in
NEEDS-STEVEN).

**Recommended: make the workspace serve them same-origin.** A thin route
under the app (e.g. `/api/sites/preview/[...path]`) proxying the configured
origin means every viewer gets working images from wherever they load the
workspace, with no per-viewer env. Weigh it against capturing static poster
images at catalog-build time (which would also feed B-media.0's poster
work — see `docs/research/source-media-plan.md`). **Pick one, state why in
your wrap, and do not do both.** Keep the honest states the provider already
has: unconfigured origin, origin error, empty catalog.

### 2. The dossier — rebuild it, and it has NO sheet

Clicking a card lands on `site-dossier.tsx`, which is **the old design**:
19 bridged legacy tokens (it is pinned at exactly that in
`lib/__tests__/bridge-burndown.test.ts`), last touched in s61. Everything
around it is now the mock's language, so it reads as a different product.

**There is no `Site Dossier.dc.html`.** The precedent for this exact
situation is Intel's Search tab (s74): the mock drew the tab but no panel,
so it was **DESIGNED in the sheets' language** rather than ported — same
type roles, same `.card`/`.row`/`.pill` grammar, same density, byte-true
chrome — and the founder accepted it. Do that here. You are not inventing a
visual language; you are applying the one the other 14 surfaces already
speak. If you find yourself reaching for a value that is not in
`theme.css`, stop.

Keep every capability the old dossier has — this is a re-expression, not a
reduction: the live preview with its desktop/390 toggles, the site record,
the manifest mint facts (dimensions + pinned-hash tails), the `/guide`
links, and the verdict status. Delete the old file in the same commit that
replaces it.

### 3. The old gallery's good features

The founder asked for these back "now that the design structure is in
place". The estate lane already carried the facet filtering
(`applyFilters`/`facetValues`) and the count honesty into the rebuilt
gallery — **verify that before assuming anything is missing.** Then read
the old gallery's history (`git log -- apps/web/src/components/sites/sites-gallery.tsx`,
deleted at `ccd200c`) and the s61 build commit for what genuinely did NOT
come across, and re-enter it **behind byte-true resting chrome** per the
re-entry rule: a keeper returns as a state behind the sheet's own chrome,
never as an extra band. Name each one's fate in the wrap.

## Your file set

- `apps/web/src/components/sites/**` — yours entirely, including deletions
- `apps/web/src/app/app/sites/**`
- `apps/web/src/lib/sites/**`
- a new preview route under `apps/web/src/app/api/sites/**` if you take the
  proxy option
- the ratchet pins, resolved by the lead at the gate:
  `apps/web/src/lib/__tests__/bridge-burndown.test.ts` (the
  `components/sites/site-dossier.tsx` row at 19 comes OUT when you rebuild
  it), `mono-ratchet.test.ts`, `selected-row.test.ts`

**The other lanes this session are `videos-rebuild` (`components/videos/**`)
and `leadboard-wire` (`components/leads/**`, `components/board/**`). Do not
touch either.**

## Rules that have each cost this repo a real incident

- **Scope your stylesheets** under `.sites-surface` / a dossier root class.
  `src/lib/__tests__/surface-css-scope.test.ts` enforces it.
- **Never fabricate a value.** The provider's honest states exist for a
  reason; keep them saying what is true.
- **Thumbnails elsewhere stay placeholders** (founder s75: *"also have
  placeholder until bmedia ready"*). Sites is different — it has REAL
  preview media, which is why fixing its origin is worth doing now.
- **Never pipe a gate through `tail`** — it put main red twice. Write to a
  file and read it.
- **Sequence your verify against the other two lanes** — check `uptime`
  first; three suites on 6 vCPU contend badly.
- **Run the grep guard before every commit**: `pwsh scripts/ci-grep-guard.ps1`.

## Definition of done

Previews working for a viewer who is not on the box (say how you tested
that), the dossier rebuilt in the sheets' language with every old capability
accounted for, the old file deleted, `npm run verify` GREEN at the repo
root, worktree clean, branch pushed, and `agent_handoff/WRAP-sites-deepen.md`
written: the preview approach you chose and why, the dossier's design
decisions, every old feature's fate, pin deltas, and anything above this
lane's pay grade.
