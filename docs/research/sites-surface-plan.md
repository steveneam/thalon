> **Status: live** — drives the W-sites build (GO s61). (Marker added at the s61 hygiene pass; see docs/research/README.md.)

# W-sites — the Sites surface: research + build plan (s60, queued for s61)

> Founder direction (s60, live): the portfolio sites live in a repo directory
> today, but the workspace (the page builder) "is where I intended them to be
> in the first place" — plan a workspace surface that gets to them, with the
> right UX. This doc is the research + decisions; the design pass and build
> ride s61 on founder approval (every lane launch = fresh approval).

## 1. What exists already (repo survey, s60)

- **Per-site record**: every site ships `site.json` (slug, name, vertical,
  oneLiner, axes {primary, secondary}, paletteSeed, typeDirection,
  motionBudget, wave, built) + `assets/manifest.json` (derived images with
  pinned hashes) + an honest `/guide` route. 15 sites at time of writing (s61).
  **No verdict field exists** — verdicts live in board prose only.
- **Serving, local**: `scripts/preview-server.py` (no-cache, 127.0.0.1:8899)
  over `proprietary/templates/sites/` — the founder's review channel.
- **Serving, deployable — THE KEY FIND**: `Dockerfile.templates` +
  `.github/workflows/templates-image.yml` already build an nginx image of the
  whole portfolio (each site at `/<slug>/`, blank stealth index, healthz,
  long-cache asset rules) and push it to GHCR on every change. The Dokploy
  deploy step is **dormant** until the founder creates the preview service and
  sets `TEMPLATES_PREVIEW_ARMED=true`. So "sites reachable from the workspace"
  is one founder console action + config away from having a live origin — no
  new serving code.
- **The web image does NOT contain the sites** (`Dockerfile.web` ships
  standalone Next + prompts/profiles only) — the staging workspace cannot read
  site dirs from disk. Any workspace listing must come from a catalog that
  travels with the *templates* image (or, in dev, the local filesystem).
- **Symmetric precedent in the app**: the Videos surface (project browser +
  detail) is the outputs-surface pattern; the intel dossier (s60) is the
  detail-panel grammar; HeatGrade/chips/Bounded-List/selected-row recipes all
  reusable as-is.

## 2. Product decisions (recommended)

1. **IA: "Sites" is an outputs surface, symmetric with Videos** — Library is
   inputs, Videos is video outputs, Sites is page outputs. It gets its own
   rail icon (frame/window metaphor, canonical set) rather than living inside
   Create; the fan-out/"page" family gains a real destination.
2. **UX: card gallery, not a list** (industry pattern: Vercel/Netlify project
   grids, Framer/Webflow dashboards — screenshot card + status chip; the s61
   design pass does its own look-first). Card = image + name + vertical word +
   two axes chips + built date + **verdict chip** (bronze "awaiting verdict"
   = the one signal-channel element; verdicted sites wear a quiet word).
   Filters: vertical · axis · wave. Keyboard j/k/enter (useListKeys); the
   selected card wears SELECTED_ROW. Bounded-List Rule: normal scroll now,
   pagination stated past ~24, count always stated.
3. **Detail = the site's dossier**: live preview iframe with device-width
   toggles (desktop/390) + the record beside it — one-liner, axes + axisNote,
   palette-seed line, type direction, mint facts from the manifest (file,
   dimensions, pinned hash tail), links to `/guide` and "Open full ↗" (new
   tab). Every site becomes its own case study — which is also the sales
   artifact when a prospect asks how a page was made.
4. **Card image v1 = the site's own hero asset** (already in every
   `assets/`; catalog marks the first manifest entry, overridable by an
   optional `cardImage` in site.json). Real full-page screenshots are a
   later polish (lead-driven chrome capture or CI puppeteer — not v1; no new
   deps on the hot path).
5. **Verdict data**: extend `site.json` with optional
   `verdict: {status: "approved"|"awaiting"|"fix-round", note?, at?}`
   maintained at verdict time (backfill the 13 verdicted sites in the same
   change). Convention/opinion, not contract — no schema, no migration.

## 3. Architecture (decided, pending design-pass confirmation)

- **Catalog**: a build step in the templates image assembles
  `/catalog.json` deterministically from every `site.json` + manifest (slug,
  record, cardImage path). Nginx serves it beside the sites.
- **Workspace read seam**: one provider (`lib/sites/`) with two sources —
  dev/self-tenant: read the local directory when it exists; staging/prod:
  fetch `catalog.json` from a configured sites base URL (env: the armed
  preview service origin; unset = the surface renders its honest "no sites
  origin configured" state, never a fake empty gallery). This seam is where
  a real tenant's object-store sites plug in later — **v1 is explicitly the
  self/demo tenant read-only; per-tenant generated sites need the future
  `sites` table (contract work, ride a later window with the Phase-I one)**.
- **Iframes/auth**: if the templates service goes up behind the stealth edge
  auth, the iframe prompts once per origin (founder-only audience —
  acceptable); revisit only if it annoys. CORS: catalog fetch is server-side
  in the workspace (route handler), so no browser CORS surface.
- **Stealth invariants unchanged**: neutral hostname, blank index, noindex;
  the workspace links to slugs it learned from the catalog, the public root
  still enumerates nothing.

## 4. Open questions for the s61 design pass

- Q1 Gallery density: uniform grid vs size-by-recency/wave? (survey both;
  uniform is the safe default.)
- Q2 Does the detail panel embed `/guide` inline (second tab) or link out?
- Q3 Verdict chip vocabulary: exact words for approved / fix-round /
  awaiting (Four-Verbs adjacent — pick once, everywhere).
- Q4 Where does spend/credits display live (per-site total from manifests is
  derivable; is it founder-facing here or /guide-only)?
- Q5 The 8899 preview server's future once the armed service exists (keep
  for local; likely unchanged).

## 5. Build plan (one lane + two founder actions)

- **Founder actions (gates, can precede or follow the lane)**: create the
  Dokploy templates-preview service (neutral hostname, edge auth) and set
  `TEMPLATES_PREVIEW_ARMED=true`; approve the W-sites lane launch at the
  s61 opener.
- **Lead pre-work**: catalog build step in `Dockerfile.templates` + the
  local catalog script; `site.json` verdict backfill; Phase-D-style design
  mock in claude-design (Fable-authored per the standing rule) if the
  founder wants a design checkpoint first — his call at the opener:
  **design-first (one mock, then build) vs straight-to-build against this
  doc**.
- **Lane W-sites (UI-only)**: owns NEW `components/sites/**` + NEW
  `app/app/sites/**` + `lib/sites/**` (provider seam) + the rail entry in
  `lib/workspace/nav.ts` (lead-owned file — lead adds it at merge, same as
  Calendar). No contract edits; honest states for unconfigured origin.
- **Est**: one session interleaved, 0cr (no minting — card images are
  existing heroes).

*Owner: lead. Written s60 on founder direction; supersedes nothing. The s61
design/look-first pass may amend §2/§3 — record deltas here.*
