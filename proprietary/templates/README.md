# Template portfolio — scaffolding contract

> **The mechanism, picked once (session 33), carrying all ~25 template sites.**
> Method artifacts: `meta-prompt.md` (the factory prompt) ·
> `iteration-pass-checklist.md` (the two-lane pass every page runs ≥3×).
> Wave plans + axis draws live in `COORDINATION.md` session messages.

## Where template code lives

- Every demo site is a **self-contained static page** under
  `sites/<slug>/` where `<slug>` is the neutral fictional business name
  (tracked-safe by the wave plan's naming rule). The vertical is metadata,
  not the directory name — `site.json` records it.
- **Layout per site:**

  ```
  sites/<slug>/
    site.json          machine-readable metadata (slug, name, vertical, axis draw)
    index.html         the single-page landing — served at /<slug>/
    guide/index.html   the honest method note — served at /<slug>/guide/
    assets/
      manifest.json    derived file → pinned-original hash + size + quality
      *.webp           derived web copies (generated, never hand-edited)
    css/ js/           plain, local, zero-dependency by default
  ```

- **Zero-dependency static is the default.** No framework, no build step, no
  external hosts (fonts, CDNs, analytics — nothing). A site whose drawn axis
  genuinely needs a library (e.g. WebGL) may vendor a pinned MIT/Apache file
  under `js/vendor/` with its license header intact — licensing hygiene rules
  apply, AGPL never. Web fonts are vendored OFL woff2 files under `fonts/`
  with their OFL license texts alongside.
- **Generic code is tracked; client instantiations are data.** A real client
  site = a copy of the vertical's template with client data swapped in, kept
  gitignored under `.context/clients/` (grocer precedent), per the
  multi-tenant rule.
- The `sites/` boundary is deliberate: the preview image's docroot is built
  from `sites/` ONLY, so the factory method docs in this directory can never
  leak onto a prospect-visible host.

## Assets (B7.1, same chain as the landing's L-set)

1. Mint on the **paid tier only** → pin immediately via
   `npx tsx scripts/pin-mint.ts` (bytes + full provenance into the object
   store).
2. Add a manifest entry in `sites/<slug>/assets/manifest.json`
   (`{ file, pinnedHash, width, height, quality }`).
3. Regenerate derived copies: `npx tsx scripts/export-template-assets.ts <slug>`
   — hash-verified store read → sharp resize → webp. Derived files are
   committed; originals stay pinned in the store as the durable source.

No page ever references a vendor URL or an unpinned asset; the repo-ratchet
test (`tests/template-portfolio.test.ts`) enforces structure, manifest
integrity, self-containment, and the `/guide` honesty note.

## How neutral previews deploy

Through the **established channel**, as a second, separate service — never
mixed into the product app:

- `Dockerfile.templates`: nginx-alpine serving `sites/<slug>/` at `/<slug>/`.
- `.github/workflows/templates-image.yml`: on push touching `sites/**` —
  build → smoke (every site's `/` and `/guide/` must 200) → GHCR
  (`thalon-previews`) → Dokploy pin+deploy with the same update+deploy
  semantics as web-image.yml. The deploy+probe steps are gated on the repo
  var `TEMPLATES_PREVIEW_ARMED` until the founder creates the neutral-named
  Dokploy service (one-time console action: service + hostname + scoped
  key/app-id secrets); until then the workflow still builds and pushes the
  image so arming is a variable flip, not a code change.
- Separation is the point (invariant): the product staging host stays
  edge-authed and never shows demo pages; the gallery host carries a neutral
  name, no real domain, no brand-linkable naming, and can be opened to
  prospects independently at the founder's call.

## Definition of done per site (restates the meta-prompt gates)

≥3 two-lane passes logged in the site's `/guide` · browser-verified ·
assets pinned paid-tier with provenance · suite + guard green · honest copy
only, and the `/guide` page says the business is fictional and the imagery
AI-generated.

---
*v1, 2026-07-14 (session 33). Tag: opinion, except the pinning/licensing/
stealth/honesty/leak-boundary lines, which restate invariants.*
