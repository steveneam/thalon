# WRAP — lane `sites-deepen` (the preview fix · the Site Dossier rebuild · the old gallery's keepers)

Branch `agent/sites-deepen`. All three jobs from the kickoff are done, in the
order it set them. The founder's two observations were both real and both are
closed: the thumbnails were broken **for him and not for the box**, and the
dossier was still the old design.

---

## 1. The broken previews — fixed by making the workspace serve them

**Chosen: the same-origin route.** `/api/sites/preview/[...path]` proxies
whichever upstream the catalog read already uses. **Rejected: static poster
capture at catalog-build time** — for one decisive reason and two supporting
ones:

- **It only fixes half the report.** Posters would repair the gallery
  thumbnails and leave the dossier's live iframe pointing at
  `127.0.0.1:8899`, still broken from the founder's laptop. The report was
  about both, and the dossier preview is the more valuable of the two (it is
  the case-study artifact).
- It adds a headless browser to the templates image build for something the
  portfolio already has: real hero images on disk.
- It would freeze the previews at capture time, so a re-minted asset shows
  stale until someone rebuilds — the exact class of bug that made
  `preview-server.py` no-cache in the first place (s55).

B-media.0's poster work is untouched by this and still wants doing; this lane
did **not** pre-empt it.

**What changed.** `DEV_PREVIEW_ORIGIN` is gone — that constant was the bug's
home. `SitesSource` no longer carries a browser-resolvable origin at all; it
carries `previewUpstream`, a *provenance string* for the footer line. The
surfaces build URLs through `lib/sites/preview.ts`, which is pure and
node-free so client components can import it.

One decision function serves both the catalog read and the media route, so the
two can never disagree about which portfolio is being served. It is split the
way `lib/auth/gate.ts` splits its gate — `chooseUpstream()` is pure string
logic, `resolvePreviewUpstream()` is the thin resolver that supplies
`process.cwd()` and the filesystem. **That split was bought with a real
failure:** the first version was one function, and its test passed in
isolation and went red under the root runner, whose cwd makes the local-dir
constant resolve elsewhere. The rule is now testable without either. Its branches are unchanged from before: `SITES_BASE_URL` →
that origin · else the local template dir (`SITES_PREVIEW_ORIGIN` still
overrides it with an HTTP origin for anyone who wants the 8899 server) ·
else unconfigured. **In dev the route now reads the template directory
directly, so the workspace no longer needs the preview server running at
all** (the systemd `thalon-preview` unit stays — it serves founder review of
raw templates, and it is still the `SITES_PREVIEW_ORIGIN` escape hatch).

**Fail-closed, three independent layers** — this route serves files, so it was
built like it:
1. the workspace gate: `/api/…` is not on the public allowlist, so previews
   keep the stealth posture (`lib/auth/gate.ts` untouched);
2. path containment: segments are rejected for `..`, `.`, empty, embedded
   `/` `\` `\0` (Next has already percent-decoded, so `%2e%2e` and `%2f`
   arrive here as what they are), **and** the resolved path is proven to sit
   under the root before any read;
3. a **closed content-type set** — an extension the portfolio does not ship
   is a 404. Nothing else in the tree is reachable even if it is sitting
   right there.

Nothing from the incoming request is forwarded upstream, and the response
type comes from our map plus `nosniff`, never from what an upstream claimed.

**The honest states survive and gained one:** unconfigured origin (the route
answers **503 with the reason**, not a 404 that reads like missing media),
origin error (502 naming the status), empty catalog. The surface's three card
states are unchanged.

**Two details worth knowing.** A directory request 308s to
`<path>/index.html`: Next strips a trailing slash before a route handler
runs, so only an explicit document URL lets a page's own `assets/…` and the
guide's `../fonts/…` resolve. And the dossier iframe now carries
`sandbox="allow-scripts"` — the bytes are same-origin now, so the frame is
sandboxed *out* of the workspace. Scripts still run (the pages carry real
motion); the document sits in an opaque origin and cannot reach the workspace
around it. **Named cost:** `navigator.clipboard` in truebore's copy button
will not work *inside the preview frame* (it works on the real page via
"Open the site"). That matters more later than now — these pages are
hand-built today and generated per tenant once B-sitegen lands.

### How the fix was tested for a viewer who is not on the box

The real route handler was mounted on a **non-loopback** address
(`172.17.0.1`, via a throwaway scratchpad harness — nothing shipped) and
driven over real HTTP:

| Probe | Before (what the founder's browser does) | After |
|---|---|---|
| `hero-dusk.webp` from `127.0.0.1:8899` | **200** | — |
| `hero-dusk.webp` from `172.17.0.1:8899` | **connection refused** | — |
| the same asset through the route | — | **200 · image/webp · 123,878 B** |
| all 20 `index.html` | — | **20 × 200** |
| all 20 `guide/index.html` | — | **20 × 200** |
| every card image the gallery requests | — | **all 200** |
| `sparkwright/guide` (directory) | — | **308 → …/guide/index.html** |
| `../../../etc/passwd` | — | **404** |
| `secrets.pem` beside a real page | — | **404** |

Then a **real browser** loaded `sparkwright/index.html` through it: 8/8
requests 200 (document, hero, six woff2 faces — every relative path resolved),
zero console errors, page renders correctly. `loopwell` (external CSS + JS,
`?v=s58` query strings) also loads clean.

That is the founder's exact failure mode reproduced and then closed. What it
does *not* prove is internet reachability from his laptop — the workspace's
own reachability is unchanged by this lane, and the URLs are now relative to
whatever host he loads the workspace from.

---

## 2. The dossier — rebuilt, old file replaced in the same change

**There is no `Site Dossier.dc.html`, but the mock DOES draw a dossier** —
`Video Dossier.dc.html`, for the sibling artifact. So this is not the Search
case of designing into open space: nearly every atomic is that sheet's helmet
ported 1:1 — `.dgrid` (1fr 320px), `.fact-row`/`.fact-k`/`.fact-v`,
`.strip`, `.clipcard`/`.clip-cap`/`.clip-kind` — plus the shared shell classes
(`.card`, `.card-head`, `.seg`, `.pill*`, `.btn*`, `.thumb-md`, `.tile-arrow`,
the type roles). A site dossier and a video dossier are one idea about two
artifacts, and they now read as the same product. **`site-dossier.css` is
scoped under `.site-dossier-surface`** — this mattered more than usual: the
`videos-rebuild` lane is porting the same helmet in the same wave, and two
unscoped copies of `.fact-row` would be one surface silently restyling the
other.

**Every capability of the s61 dossier survives** — re-expression, not
reduction: the live preview with its desktop/390 toggles (now the sheet's own
`.seg`), the site record, the manifest's mint facts (dimensions +
pinned-hash tails), the `/guide` links, the verdict.

**Design decisions, each named:**

1. **The mint facts became media.** The old dossier listed
   `file · w×h · …hash` as a mono list in the sidebar. It is now the sheet's
   clip-strip — a `.thumb-md` of the actual asset over the same facts
   (media-first). The strip scrolls horizontally and its head states the true
   count (up to 11 real assets vs the fixture's 4).
2. **The design brief got its own card, and this was a real find.** The
   catalog's `axisNote`/`paletteSeed`/`typeDirection`/`motionBudget` are
   100–300-character *paragraphs*; `.fact-row` is a one-**line** fact
   ("3 sources · cited verbatim"). Pouring them into the 320px rail keeps the
   class name and destroys the density the class exists to hold — the first
   screenshot was a wall of text. They now read in the wide column as
   "The design brief", in the sheet's own type roles (`.t-label` key,
   `.t-body.muted` body). Nothing dropped, nothing truncated. The rail is back
   to seven scannable one-line facts.
3. **A fact is a door only when it opens something.** Vertical, primary axis,
   secondary axis and wave open the portfolio filtered to themselves; the
   guide opens the guide. Built and Verdict are plain rows with no arrow and
   no hover wash — the sheet gives every `.fact-row` `cursor: pointer`
   because in that fixture everything opens, and copying that here would
   have been a row pretending. Head sub-line: "the arrows are doors".
4. **Those doors are real, which cost one small thing beyond the dossier:**
   `/app/sites` now reads `?vertical=`/`?axis=`/`?wave=` server-side (the
   shape Intel uses for `?tab=`) and lands pre-filtered, with the responsible
   chip expanded and lit so a deep link never hides its own reason.
5. **The guide has two doors, deliberately.** The headline's ghost button is
   the pitch action (top-right, where a prospect conversation reaches); the
   record card's last row is the narrated provenance door, with the explainer
   the button has no room for. I considered collapsing them and kept both —
   naming it here so it reads as a choice, not an oversight.
6. **The stage is not the player.** The sheet's `.player` is a 264px black
   rectangle with a play button. A live page needs height and a device width,
   so `.stage` plays that role at 560px with the iframe at full width or
   390px. Its backdrop is **`var(--n-rail)`, not the sheet's hard-coded
   near-black literal** — the kickoff's rule (if it is not in `theme.css`,
   stop) outranks copying another surface's one-off value.

**Deleted:** the old `site-dossier.tsx` implementation — rewritten in place in
the commit that ships the rebuild, `19 → 0` bridged tokens.

---

## 3. The old gallery's good features — every one's fate

The kickoff said verify before assuming. I did: `git show ccd200c^` for the
deleted `sites-gallery.tsx`, against the shipped rebuild.

| Old gallery feature | Fate |
|---|---|
| Facet filtering (`applyFilters`/`facetValues`) | **Already carried** by the estate lane into the sheet's chip row. Verified, not re-done. |
| Count honesty (`countLine`) | **Already carried** into the headline pills ("N of M built"). |
| Media-first card image | **Already carried**; now served same-origin. |
| Honest source states | **Already carried**; the route gained a matching 503. |
| j/k/↵ keyboard grammar | **Already carried**, marking with `.row.sel`. |
| **The per-card one-liner** | **RE-ENTERED** — as a state, below. |
| **The per-card axis chips** | **RE-ENTERED** — same state, as `Primary · Secondary` humanized. |
| **The per-card build date** | **RE-ENTERED** — same state, right-aligned, `.t-data`. |
| List `aria-label="Portfolio sites"` | **RE-ENTERED** — the grid is now a `<section>` with that name, so it is a real landmark rather than a label on a generic div. |
| Hover-to-select (`onMouseEnter`) | **RETIRED, deliberately.** It fights the keyboard grammar — a mouse crossing the grid would steal the j/k pick — and the rebuild's "nothing selected at rest" is what keeps the resting grid byte-true. The hover *reveal* below gives back what hover was actually useful for. |
| First card selected on load | **RETIRED, deliberately** (the estate lane's call, kept): a resting selection is a mark the sheet does not draw. |

**How the three card facts re-entered** — per the re-entry rule, a keeper
comes back as a state behind byte-true resting chrome, never as an extra band.
They live in a caption **inside the shot the sheet already draws**, at
`opacity: 0`, rising on hover / focus / the keyboard pick. Measured in a
browser: card height **195px in every state**, caption opacity **0 at rest,
1 when picked**. A resting screenshot is still the sheet.

**One bug this surfaced, invisible to every test:** the sheet's
`.site-shot span` rule — written for the striped placeholder's mono caption —
also matched the caption's spans, rendering the one-liner as 10px mono. Fixed
by narrowing the sheet's rule to `> span` (declaration untouched, selector
narrowed to the element it was written for) and **pinned** with a regression
assertion, because only a screenshot caught it.

---

## Pin deltas (my rows only)

- `lib/__tests__/bridge-burndown.test.ts` — **`components/sites/site-dossier.tsx` removed** (was 19; the rebuild is at 0). `components/sites/*` is now entirely off the map.
- `lib/__tests__/mono-ratchet.test.ts` — **no delta**: no sites row existed and the rebuild introduced none (the mint tails and the build date ride `.t-data`, mono without uppercase, which that scan ignores by design).
- `lib/workspace/__tests__/selected-row.test.ts` — **no delta**: sites left that list at s75 and the dossier has no list selection.
- `lib/__tests__/surface-css-scope.test.ts` — one new stylesheet (`site-dossier.css`), every rule scoped; no change to the test.

## Files

**New:** `lib/sites/preview.ts` · `app/api/sites/preview/[...path]/route.ts` + `route.test.ts` · `lib/sites/__tests__/preview.test.ts` · `lib/sites/__tests__/provider.test.ts` · `components/sites/site-dossier.css` · `components/sites/__tests__/site-dossier.test.tsx`

**Rewritten (old implementation deleted in the same change):** `components/sites/site-dossier.tsx`

**Edited:** `lib/sites/provider.ts` · `components/sites/sites.tsx` · `sites.css` · `sites-model.ts` (+`cardFacts`) · `app/app/sites/page.tsx` · `app/app/sites/[slug]/page.tsx` · the two sites test files · the bridge pin

## Test deltas

| File | Δ | Cases |
|---|---|---|
| `app/api/sites/preview/[...path]/route.test.ts` | new | 10 |
| `lib/sites/__tests__/preview.test.ts` | new | 6 |
| `lib/sites/__tests__/provider.test.ts` | new | 6 |
| `components/sites/__tests__/site-dossier.test.tsx` | new | 10 |
| `components/sites/__tests__/sites.test.tsx` | +3 | 12 |
| `components/sites/__tests__/sites-model.test.ts` | +2 | 6 |

## Verify

**`npm run verify` at the repo root — GREEN (exit 0).** Guard + full suite +
typecheck + lint, unfiltered, redirected to a file and read.

- Suite: **284 files passed / 4 skipped · 2078 tests passed / 9 skipped**, 272.8s.
- Typecheck: clean across every workspace.
- Lint: **0 errors, 12 warnings** — all pre-existing (`api/health`,
  `app/page.tsx`, `ui/empty-art`, four `components/videos/*`); **zero from this
  lane's files** (both `<img>` uses carry a reasoned disable).
- Grep guard: PASS, and on every commit via the box's pre-commit hook.

Box discipline: load was 8.96 with another lane's `verify` already running when
this lane finished coding, so the full run was **armed behind a watcher** and
started at 02:59:27Z the moment that lane's suite exited. Targeted suites, the
repo typecheck and the repo lint ran during the wait. Output was redirected to
a file and read, never piped through `tail` (the pinned main-RED #3 pattern).

*Three honest notes on the road there.* It came back **RED** on two of my own new
provider tests — they assumed `process.cwd()`, passed in isolation, and failed
under the root runner. That is the failure that produced the pure/impure split
described above; the fix is in the tree and the suite below is the re-run. And
the watcher itself had a bug worth not repeating: `pgrep -f "npm run verify"`
matches the watcher's *own* shell command line, so the second arming waited on
itself. The box was quiet by then (load 0.27) and the re-run went direct.
**If you reuse that pattern, match on something the watcher's own command line
cannot contain.**

The re-run then went **green on all 2078 tests and red on TYPECHECK** — the
pure-function refactor typed its env parameter with named keys, which makes it
a weak type `process.env`'s index signature cannot satisfy. Caught by
`npm run verify`, exactly the post-merge catch the gate exists for; fixed with
`Record<string, string | undefined>`. **A green suite is not a green lane** —
the third run below is the one that counts.

## For the lead's merge gate

- **Screenshot-vs-sheet targets:** `/app/sites` (against `Sites.dc.html`) and
  `/app/sites/<slug>` (against `Video Dossier.dc.html`'s *grammar* — there is
  no site-dossier sheet to diff pixel-for-pixel).
- **Cross-lane collision watch:** `site-dossier.css` ports the **same helmet**
  the `videos-rebuild` lane is porting. Both must stay scoped. If that lane
  put any of `.dgrid`/`.fact-row`/`.strip`/`.clipcard` into `workspace.css`
  instead of its own scoped file, that is the collision to catch at the gate —
  mine would then be a duplicate and should defer to the shared one.
- **`.site-shot > span`** is a deliberate narrowing of a sheet rule, pinned by
  a test. If a future port re-widens it, the one-liner goes mono again.
- I did not touch `workspace.css`, `components/videos/**`, `components/leads/**`
  or `components/board/**`.
- **One thing only production can prove:** with `WORKSPACE_BASIC_AUTH` set, the
  sandboxed iframe's subresources are same-origin requests from an opaque-origin
  document. Browsers key HTTP auth to the request's origin, not the document's,
  so the cached credential should ride along — but dev is ungated and staging
  serves `unconfigured`, so nothing here exercised it. Worth one look the first
  time the templates service is pointed at a gated workspace.

## Above this lane's pay grade

1. **A minted asset that 404s shows the browser's broken-image glyph over the
   striped `.thumb-md`.** The verdicted sheets have no broken state;
   `Source Media.dc.html` proposes one (**"broken" · "loading"**) but it is in
   the README's *Proposals — do not port* section, so I did not. **This is the
   concrete case for ruling on that sheet** — the dossier is the first surface
   that can actually hit the state.
2. **The gallery's `Build site` door is still honestly disabled** (B-sitegen
   uncharted). Unchanged from s75; restating it because the founder's ask was
   "have Sites a bit more built" and this is the one remaining dead-looking
   control on the surface.
3. **`SITES_BASE_URL` is still unset everywhere**, so staging serves the
   `unconfigured` state. The route makes that a 503 that names the fix instead
   of a silent 404, but the templates-preview service is still the open
   founder console item in NEEDS-STEVEN — this lane did not close it.
4. **The dossier facts now deep-link into a filtered gallery.** If the founder
   wants the curated chip vocabulary from the sheet's fixture ("Café · warm"),
   that still needs a category field on the site record — the s75 open call,
   unchanged, and now slightly more valuable because the URL carries it.
