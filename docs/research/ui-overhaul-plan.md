> **Status: phase-0 deliverable — awaiting founder re-charter.** Produced by the
> `ui-overhaul-p0` research lane (s71, 2026-07-25) off the founder's s70b verdict:
> the workspace look and flow are "not working"; benchmark = Supabase/Vercel-class;
> consider Meta's Astryx; **overhaul completely**. This document is report-only —
> no UI code, no dependencies were changed. Every stack-fit claim below marked
> *[tested]* was verified empirically in a scratch project outside the repo on this
> box; nothing load-bearing is assumed from marketing copy.

# Workspace UI/UX overhaul — teardown and plan (phase 0)

## 0. Recommendation, up front

**Adopt Astryx as the component and token layer, as a hybrid: an Astryx custom
theme carries the Thalon brand, Tailwind v4 stays for layout through Astryx's
own bridge, and the signature components (HeatGrade, magnitude bars, the video
takes surface) are rebuilt as custom pieces on Astryx tokens.** License is
clean (MIT, StyleX MIT and not even a consumer dependency), stack fit is proven
on our exact stack — Next 16 + Tailwind v4 + Turbopack production build passed
in a scratch project — and the agent-readable contract (CLI + hosted MCP
server) matches how this repo is actually built. The honest caveat: Astryx is
beta (core v0.1.8) and its charts are unstable, so charts stay custom and the
version gets pinned with a codemod upgrade cadence. The deeper finding of the
audit is that the incumbent's failure is only partly the component library —
Supabase's own UI library is itself built on shadcn — so the plan pairs the
Astryx adoption with the system fixes the benchmarks actually teach: a graded
neutral ramp, a typographic role scale, labeled navigation, one-accent
discipline, and the removal of the workspace's self-narrating HUD voice.

---

## 1. Astryx evaluation (verified, not assumed)

### 1.1 What it actually ships

`facebook/astryx` — Meta's design system, open-sourced June–July 2026, grown
internally ~8 years, "most-used design system in the company." **Beta**, core
package `@astryxdesign/core` v0.1.8. Four packages: `core` (components +
theme system), `cli`, `build` (optional StyleX plugins), `theme-*` (7 published
themes). 10.7k stars at time of writing.

**Component coverage vs our surfaces** (106 component directories inspected in
the cloned source): the full app-shell family (`AppShell`, `TopNav`, `SideNav`,
`NavMenu`, `MobileNav`, `Breadcrumbs`), triage machinery we currently hand-roll
(`CommandPalette`, `Kbd`, `Toast`, `Banner`, `EmptyState`, `Skeleton`,
`StatusDot`, `Timestamp`, `Table`, `List`, `TreeList`, `OverflowList`,
`Pagination`), a complete form suite (Field/FormLayout + Text/Number/Date/
DateRange/DateTime/Time/File inputs, Checkbox/Radio lists, Selector,
MultiSelector, Switch, Slider, SegmentedControl, Tokenizer/Token, Typeahead,
PowerSearch), plus `Calendar`, `Resizable`, `Lightbox`, `Thumbnail`,
`Markdown`, `Citation`, `CodeBlock`, `Dialog`/`AlertDialog`, `Popover`,
`Tooltip`, `ContextMenu`, `DropdownMenu`. Templates exist as CLI-emitted page
patterns (dashboard, settings, forms, detail pages) composed on `Layout`.

**Not covered — stays custom:** charts (`@astryxdesign/charts` + `vega` are
published only under `@canary`; no stable release), kanban/board surfaces, the
video takes/cut editor, HeatGrade and the thermal grammar, brand-mark art.

**Theming** *[read from source + CLI docs]*: a theme is CSS custom-property
overrides generated from a `defineTheme` config — token-level color (one
accent hex + `neutralStyle: warm|cool|neutral` + `contrast`), typographic
scale (base px + ratio + font families incl. self-hosted URLs), radius scale,
motion tokens, and **semantic component-level style overrides** (keys like
`variant:value`, not raw selectors — `astryx theme build` errors on private
var abuse). Themes can `extends` another theme. Dark mode is built into the
provider: `<Theme mode="system|light|dark">`; themes carry paired light/dark
values per token (the shipped `neutral` theme is a pure-OKLCH derivation with
documented AA-passing stops — the same discipline as our `tokens-contrast`
ratchet, natively). Density: sizes ride the token scale; no separate density
switch — spacing tightening is a theme-level decision.

**Agent tooling** *[tested]*: `astryx component <Name>` (full prop/theming
docs), `search`, `template`, `swizzle` (eject component source), `upgrade
--apply` (codemods between versions), `doctor`, `theme build`, with `--json`
and `--dense` (token-efficient) output modes; `astryx init` writes the
component index into `AGENTS.md`/`CLAUDE.md`. A **hosted MCP server**
(`https://astryx.atmeta.com/mcp`, tools: `search(query)` / `get(name)`) works
with any MCP-compatible client. For a repo whose UI is built by agents under
an `AGENTS.md` protocol, this is a real fit signal, not marketing: the design
system carries its own machine-readable source of truth, which is exactly the
class of ratchet this protocol prefers.

### 1.2 License

- **Astryx: MIT** (LICENSE inspected in the clone — Meta Platforms, 2026). ✔ hygiene rule.
- **StyleX: MIT** (v0.19.0 on npm). ✔ — and on the pre-built path StyleX is
  **not a consumer dependency at all**: the published package ships compiled
  CSS (`dist/astryx.css`) and plain JS; no Babel/PostCSS/bundler plugin enters
  our tree. `@astryxdesign/build` (the StyleX source-build path) is optional
  and also MIT.
- No copyleft or commercial gate found in the dependency chain. **No swap path
  needed.**

### 1.3 Stack fit — tested on our exact stack, not the vendor's

Scratch project at `~/lane-scratch/astryx-eval` (outside the repo; the
worktree's preinstall guard untouched): `create-next-app` → **Next 16.2.11
(App Router, Turbopack) + React 19 + Tailwind v4**, i.e. the repo's stack
(`apps/web` is Next 16.2.10 / React 19.2.4 / Tailwind v4).

| Question | Verdict |
|---|---|
| Turbopack production build | **PASS** *[tested]* — `next build` compiles the full Astryx + Tailwind v4 layer cascade in ~13s, zero config beyond the documented CSS imports. No webpack fallback, no build plugin. |
| App Router / RSC | **PASS** *[tested]* — Astryx components render from a server-component page and statically prerender. Components are client components under the hood (208 `'use client'` files), which is the same posture as radix/shadcn interactive parts today. |
| SSR / theme flash | **PASS** *[tested]* — the `/built` theme import pairs with pre-compiled CSS (no runtime injection); the served page renders styled HTML first paint. Theme scoping is a `data-astryx-theme` attribute synced to `<html>`. |
| Tailwind v4 coexistence | **PASS** *[tested]* — first-class, documented recipe: one `@layer` declaration ordering `reset → theme → base → astryx-base → astryx-theme → components → utilities`. The shipped `tailwind-theme.css` bridge maps Astryx tokens into Tailwind utilities (`bg-surface`, `text-primary`, `border-border`, `rounded-lg`, spacing base = `--spacing-1`), so hand-rolled surfaces keep being written in Tailwind **on Astryx tokens** — this is the coexistence-during-migration story and the permanent custom-surface story at once. |
| Bundle impact | Acceptable *[measured]*: `astryx.css` is 128 KB raw; the scratch app's total CSS chunk (Astryx + theme + Tailwind) was 156 KB pre-gzip (≈25–30 KB gzipped, est.). JS is tree-shaken per-component subpath imports. The optional source-build path exists if CSS weight ever matters. |
| Version risk | Next example apps in the Astryx repo pin Next 15; **Next 16 is proven by the scratch build above**. Core is 0.x: breaking changes are expected and the project ships codemods (`astryx upgrade --apply`) — pin the version, upgrade deliberately. |

**API character (affects effort honestly):** Astryx APIs are prop-driven and
a11y-enforcing — `Button label="…"` (required), `Heading level={…}`
(required), controlled inputs (`value` required). Migration is therefore a
**markup rewrite per surface, not a class swap**. The scratch build hit all
three of these as type errors before passing — the type contract is strict,
which is good news for agent-written code and honest news for effort.

### 1.4 Migration shape

The shadcn footprint is far smaller than "built on shadcn" suggests:
`components/ui/` is **6 primitives, 392 LOC** (badge, button, card, skeleton,
empty-art, icons), radix is imported in exactly **2 files**, and 47 files
consume these primitives. The real estate is the **16 hand-rolled component
families, ~14.5k LOC across 103 tsx files** — which is precisely why craft is
uneven: every list, toast, palette, pagination, and form row is bespoke.

| Today | Astryx |
|---|---|
| `ui/button`, `ui/badge`, `ui/card`, `ui/skeleton` | `Button`, `Badge`, `Card`, `Skeleton` (direct) |
| `ui/empty-art` + per-surface empty states | `EmptyState` (+ our art as its illustration slot) |
| hand-rolled command palette | `CommandPalette` |
| hand-rolled action-toast | `Toast` |
| hand-rolled bulk bar | `Toolbar` + `Button`/`Kbd` composition |
| hand-rolled tables/rows/pagination | `Table`, `List`, `Item`, `Pagination` |
| hand-rolled form fields (create, connect flows) | `Field`/`FormLayout` + input suite |
| sidebar/topbar shell | `AppShell` + `SideNav`/`TopNav` (labels included) |
| week/month grids | evaluate `Calendar`; keep custom if it fights us |
| HeatGrade, magnitude bar, thermal pills | **custom, rebuilt on Astryx tokens** (the signature) |
| video takes/cut surfaces, boards | **custom on Astryx tokens** |
| charts (dashboard sparks, future) | **custom until `@astryxdesign/charts` leaves `@canary`** |

---

## 2. Benchmark teardown — what "world-class" concretely means

Extracted as systems, not screenshots:

**Geist (Vercel).** The load-bearing idea is a **usage-mapped neutral ramp**:
10 steps per scale where each step *is* a rule — 100/200/300 = default/hover/
active background, 400/500/600 = default/hover/active border, 700/800 =
high-contrast backgrounds, 900/1000 = secondary/primary text. Interaction
states are a ladder you index into, never a per-surface improvisation.
Typography is **three roles** (heading / label / copy) at fixed sizes with
mono as *paired variants* (`label-13-mono` beside `label-14`), not a free
channel. Thalon today has four neutrals (paper, card-white, muted-wash,
hairline) and no ladder — which is why hover, selection, and hierarchy feel
flat and every surface solves emphasis differently.

**Supabase.** The honest counter-fact: **Supabase UI is built on shadcn/ui**
(their words). "Looking like Supabase" is a discipline outcome — dense
labeled-nav chrome, table-first density, one brand accent used almost
exclusively for the primary action — not a component-library outcome. This
kills the simplest reading of the s70b verdict ("shadcn is why it looks bad")
and is why the plan pairs library adoption with system rules.

**The swordfish cockpit (the ops dashboard on this box — the founder's own
"reads better" reference).** Its stack is hand-rolled static HTML/CSS/JS — no
framework, no design system — and it still outreads our workspace, which is
the whole lesson. Why it reads: (1) **labeled navigation** — icon + word for
every section, active item filled; (2) a **stat-tile grammar** — every tile is
exactly *small muted label → one big fact → one context line*, so seven tiles
scan in two seconds; (3) **one alarm accent** (red/amber) used only when
something needs a human, on a calm dark neutral field; (4) sentence-case
prose-first rows — bold lead, plain text, tiny timestamp — almost zero
uppercase mono; (5) headline numbers are facts ("23", "89.9% of cap"), never
explanations. Every one of these is portable to the workspace tomorrow.

**Linear-class patterns** (kept short): keyboard-first with a visible palette
(we already have both — j/k grammar and ⌘K survive), few type sizes, muted
surfaces with a single accent, and 100–200ms state-conveying motion.

**The seven systems to adopt** (the concrete meaning of "modern SaaS" for the
re-charter): ① graded neutral ramp with mapped interaction steps; ② three-role
type scale with mono demoted to paired data variants; ③ labeled navigation;
④ stat-tile grammar for every "number + context" moment; ⑤ one-accent
discipline plus a semantic status set (the two-channel rule survives as its
spine); ⑥ a single empty/loading/error language (Astryx `EmptyState`/
`Skeleton`/`Banner` as the one grammar); ⑦ motion tokens (fast/medium ranges)
instead of per-surface durations.

---

## 3. Honest audit of the current workspace

Method: every surface walked live in a real browser at 1440×900 (dev server on
this box, demo tenant, s70 build). The incumbent docs (`DESIGN.md`,
`PRODUCT.md`, `workspace-ux-v2.md`) were read as the thing being judged.

### 3.1 The five cross-cutting diseases

1. **Mono-eyebrow-as-scaffolding.** DESIGN.md scopes the uppercase tracked
   mono eyebrow as "a scoped HUD label, not section scaffolding" — and the
   built product violates that rule on every surface. The dashboard alone
   carries station codes (`01 · INTEL`), sweep stamps, judge codes; the intel
   card stacks six mono micro-labels; Create appends a mono clause to every
   field label. The workspace *is dressed as the HUD the docs forbid*. This is
   the single biggest reason it doesn't read as Supabase/Vercel-class: those
   products use mono for data, never for structure.
2. **The UI narrates its own design rules.** "LIST IS BOUNDED — SCROLLS
   INTERNALLY PAST 6" (intel), "the list is bounded — the page never grows
   with it" (dashboard), "ADVANCED … LIVES BEHIND THE TOGGLE — THE ONE-PROMPT
   PATH IS THE DEFAULT DOOR" (create), "SLOTS ARE PLANS" (calendar), plus
   explainer headlines ("The pipeline, left to right — every asset walks this
   line"). These are design-doc sentences printed at operators. World-class
   surfaces express rules structurally; the words disappear. This habit is
   also *why* "i dont get the flow" coexists with so much explanatory text —
   explanation is compensating for structure.
3. **Jargon leakage.** Raw UUIDs as row subtitles (videos list and header),
   run hexes as row identity (`RUN #A16F69FD`), judge gate codes
   (`G1 · PASS G3_SCREEN`), env var names as operator copy
   (`TENANT_DAILY_TOKEN_BUDGET`, `RENDER_DRIVER`), driver ids on integration
   cards ("powers `linkedin-rest-posts`"), model ids, underscore format names
   (`direction_doc`), even escaped characters rendered in approve rows. An
   operator-grade product shows *titles, people, thumbnails, and outcomes*;
   identifiers demote to tooltips/detail.
4. **No interaction ramp, wrong emphasis economy.** Four neutrals and no
   graded ladder (§2): hover, selected, and active improvise per surface.
   Primary actions are small `h-8` buttons visually lost mid-card (dashboard
   stations, library's washed-out disabled primary) while Integrations shows
   five identical primary-blue "Set up" buttons on one screen — starvation and
   inflation of the same channel. Approve's status pills use three different
   treatments for three states of the same enum.
5. **Dead geometry and imagery starvation.** Create, videos, library, approve,
   and runs are 50–95% empty at desktop width — content pinned top-left,
   single-column stacks on a 1440px canvas, station cards holding a giant "0".
   Meanwhile **Sites — the one surface with real thumbnails — instantly reads
   best in the app**, and the founder-preferred cockpit leads every row with a
   fact. The engine's outputs are *visual media*; the workspace shows them as
   filenames (`beat-01.mp4` rows with no frames — a video editor that never
   shows a picture until pressed).

### 3.2 Surface notes (one line each, specifics on file in the lane log)

- **Dashboard/spine:** right idea (stations + needs-you + week), wrong dress —
  five stations carry seven text styles each, two of five stations are empty
  numerals, primary buttons buried; needs-you list is the best column.
- **Intel:** the dossier card is functionally the product's best thinking and
  visually its densest noise — six mono label bands, raw ranker math
  ("embedding cosine 0.68") at operator eye level; exits are correct.
- **Create:** strong bones (stage rail, one-prompt door, prefilled settings),
  buried under label-clause mono and a half-empty page; the settings panel's
  right-aligned value column wraps chaotically.
- **Videos + editor:** list rows lead with UUIDs; the "editor" is a filename
  list plus one dark player and an empty provenance panel — no frames, no
  timeline visual, no stage identity. Needs re-conception, not re-skin.
- **Calendar:** honest and filterable, but a month of dead cells for two busy
  days, uppercase chips inside events, and a page titled "Fan-out" under a nav
  item called "Calendar."
- **Approve:** a consequential review queue rendered as a text wall — no
  draft preview beside the list, native unstyled `<select>` controls in the
  header, three status dress codes, run hexes as metadata.
- **Leads:** closest to the dossier ideal; six actions repeated on every card
  make a button farm past three leads.
- **Library:** two stacked full-width forms + shelf empty state on a vast
  page; "provider: hosted-vendor" chip is seam language.
- **Runs:** ten identical rows, hex-first, "open queue →" ×10, no day
  grouping, no failure visible — history without a story.
- **Settings/Integrations:** honest-state cards are genuinely good (the s70
  work shows); the copy is seam-engineer voice, action dress is inconsistent,
  and the settings grid is unbalanced.
- **Shell/nav:** the icon-only rail is unlabeled (the cockpit's labeled nav
  is the direct fix); ⌘K and tenant switcher are keepers.

### 3.3 What is already right (and must survive the overhaul)

Honest states everywhere (nothing fake renders), the Four-Verbs vocabulary,
Source-Link lineage (approve's consent strip, intel's original-post links),
bounded lists, the j/k + palette keyboard culture, judge-gate visibility,
empty-states-as-tutorials, the Sites grid, and the two-channel color doctrine
as an *idea*. The bones are right. The visual language wearing them is what
the founder rejected, and he's right.

---

## 4. The plan (for re-charter)

### 4.1 Recommendation with its spine

**Astryx adoption, hybrid shape.** Argued from evidence:

- *Why not token-level redesign on the current stack?* It's the cheapest path
  and it would fix color/spacing — but we'd still be hand-rolling ~90% of
  every surface (14.5k LOC and growing), which is the proven source of uneven
  craft, and we'd get no palette, no toast, no table, no form suite, no
  templates, no agent contract. The disease returns with the next surface.
- *Why not "just build like the cockpit" with no library?* The cockpit proves
  discipline beats stack at dashboard scale; it doesn't scale to a 12-surface
  product app with forms, queues, editors, and per-tenant theming.
- *Why Astryx over staying shadcn?* Coverage (106 vs our 6 primitives),
  theming-as-config that matches this product's own brand-as-data doctrine
  (per-tenant themes are literally `defineTheme` objects — a future product
  feature, not just our chrome), the strict typed API that agents write
  correctly against, the CLI/MCP contract that matches this repo's build
  process, MIT throughout, and an empirically clean fit on Next 16 +
  Tailwind v4 + Turbopack. The cost is beta churn (pinned + codemods) and a
  markup-rewrite migration — priced into the waves below.

**Flagged:** Astryx charts stay out (unstable `@canary`); the version gets
pinned; `swizzle` is the escape hatch if any component fights the doctrine.

### 4.2 Wave map

> **RE-CUT s72 (founder verdict — read §5 DOCTRINE 0 first).** Wave 0 shipped
> and merged (`2ace279`), but its "coexistence bridge" framing — and the
> migration language in waves 1–3 below — is DEAD. From wave 1 on, each wave
> means: the lead REBUILDS each surface exactly from its sheet in
> `docs/research/mock-sheets/` (starting with the shell chrome re-true +
> Home/Dashboard, then Approve → Intel, then the §4.2 order below), deletes
> the old surface implementation in the same change, ships the sheet's
> placeholder treatment wherever backend data is missing, and
> screenshot-verifies against the sheet before calling it done. The bridge
> shrinks every wave and a burn-down pin keeps it honest. The bullets below
> stay for scope/order; read every "migrates"/"adopts" as "is rebuilt exactly
> from its sheet."

- **Wave 0 — foundation (1 lane, ~1–2 sessions).** Add `@astryxdesign/core` +
  CLI to `apps/web`; author the **Thalon theme** as `defineTheme` config (warm
  neutral ramp honoring §2's usage-mapped ladder, action-blue accent, bronze
  signal + thermal scale as extended token families, radius/motion from
  DESIGN.md, fonts per checkpoint Q3); wire the layer cascade + Tailwind
  bridge; adopt `AppShell`/`SideNav` with **labeled navigation**; re-pin
  `tokens-contrast.test.ts` to the new token source; `astryx init` writes the
  component index into the repo's agent docs. Exit: shell + theme live, every
  old surface still functional inside the new chrome (coexistence is CSS
  layers — proven in the scratch build — so untouched surfaces keep rendering).
- **Wave 1 — the triage spine (dashboard · approve · intel).** Highest
  founder-visible payoff; where "i dont get the flow" lives. Stat-tile grammar
  on the dashboard; approve becomes list-with-preview on `Table`/`Item` +
  `Toast`; the intel dossier keeps its content and loses four of its six label
  bands. The UX-copy purge (diseases 1–3) rides each surface as it migrates —
  it is not a separate later pass.
- **Wave 2 — the making surfaces (create · calendar · videos).** Create on
  `FormLayout` + the input suite; calendar keeps its engine but adopts week
  default + agenda density (evaluate Astryx `Calendar` vs keeping ours);
  **videos is a re-conception** (frames-first: thumbnails in lists, filmstrip
  takes, stage identity) — it gets its own mini-spec inside the wave.
  **Founder-directed s72 (mocked on the canvas, three sheets — the spec of
  record for the videos mini-spec):** (a) **Videos overview** — the surface is
  a grid of PROJECTS, media-first poster cards; each card folds its family
  behind a count strip of doors ("2 versions · 4 clips · 3 platforms");
  derivatives never appear at grid level — that is the anti-congestion rule.
  Plus the **bring-your-own import strip** (video/images/music → the media
  pool, provenance `imported by you`, publish gates unchanged). (b) **Video
  dossier** — per-video organization on ONE DIMENSION PER BAND: an attributed
  version rail across time (brief → cut v1 → re-brief v2, each naming what
  changed it), a clips shelf per selected version (cut-downs + standalone,
  each a recorded derivation), platform chips per clip carrying honest publish
  state; right rail = "The record" facts-as-doors (prompt/grounding/judge/
  runs/published/media-used). The family never flattens into a matrix.
  (c) **Editor is agent-native, not a bare NLE** (founder: "modern AI
  power/helper like") — a "Direct the edit" prompt bar with quick-action
  chips, answered by PROPOSALS: an amber proposal banner over the timeline
  with Review diff / Apply / Dismiss and the affected blocks marked;
  nothing applies silently (the EDL propose→approve loop made visible).
- **Wave 3 — the long tail (leads · library · runs · settings/integrations ·
  sites · profiles).** Mostly mechanical on the by-then-established kit;
  sites is already close.
- **Wave 4 — landing (separate register, separate decision).** The landing
  shares tokens, not components; re-skinning it is a brand moment post-workspace.

Waves 1–3 parallelize as the usual disjoint-file lanes after wave 0 merges;
per the standing rule every lane launch gets fresh founder approval.

### 4.3 Test and ratchet impact

`tokens-contrast.test.ts` re-derives from the new token source (the ratchet
survives, values change); `selected-row.test.ts` and the list-grammar
conformance tests re-pin to the Astryx-era class/selector surface per wave;
the Four-Verbs/Source-Link/Bounded-List rules are unchanged as review gates;
the impeccable hook keeps running per surface; each wave ends with a live
browser screenshot pass on the preview (the phase-0 method, kept). New
ratchet candidate: a lint/test that fails any `u-eyebrow`/mono-uppercase
usage outside an allowlisted set of data labels — the executable form of
disease #1.

### 4.4 Effort, honestly

~15k LOC of surface code across 103 files. Wave 0: 1–2 sessions. Wave 1: 2–3
sessions (approve's preview split is the big one). Wave 2: 3–4 sessions
(videos re-conception dominates). Wave 3: 2–3 sessions across parallel lanes.
Total: **8–12 lane-sessions** end-to-end, checkpointed per wave, workspace
fully usable between waves.

### 4.5 What survives (unless the founder revokes it)

Warm/organic mark and register · deliberate asymmetry · honest states ·
Four-Verbs · Source-Link · Bounded-List · amber=signal channel discipline ·
j/k + palette keyboard grammar · judge-gate visibility · empty-states-as-
tutorials. These are carried as *requirements on the new language*. The visual
language itself — the mono-HUD voice, the current neutrals, the flat
hierarchy, the shadcn primitive layer — is what's being replaced.

### 4.6 Checkpoint questions for the founder (answer before wave 0)

1. **Light or dark default?** The ratified light-first doctrine (s16: operators
   work beside white platform surfaces) is *not* in your s70b list of surviving
   signals — and every benchmark you named (Supabase, Vercel, the cockpit) is
   dark-first. Astryx gives us both modes from one theme; the question is only
   which is the workspace **default**. My read: ship both, default dark,
   let the light doctrine live as the toggle — but this is yours to call.
2. **Theme base:** extend Astryx `stone`/`neutral` (faster, their curves) or
   author the Thalon ramp from scratch in `defineTheme` (full control, keeps
   our oklch heritage)? Recommendation: from scratch — the theme *is* the brand.
3. **Fonts:** keep Geist/Geist Mono (it is literally Vercel's face) or pick an
   owned pairing at wave 0 (Astryx themes carry font config natively)?
4. **Signal channel:** keep strict two-channel (blue acts / amber signals) or
   relax to benchmark-style semantic status (green/amber/red) with amber
   reserved for *needs-you*? (The thermal scale survives either way.)
5. **Beta risk:** accept pinned-version + deliberate codemod upgrades on a 0.x
   design system? (Mitigations: MIT, swizzle ejection, tiny primitive surface
   if we ever had to walk away.)
6. **Videos:** wave-2 re-conception as scoped above, or split into its own
   charter bucket?
7. **Mono policy:** cockpit-grade near-zero mono, or keep a small allowlisted
   data-label set (timestamps, ids in detail views, judge codes in tooltips)?

---

## 5. Founder mock-round doctrines (s71 — binding on every wave build)

> **DOCTRINE 0 — THE MOCK IS THE BLUEPRINT, NOT INSPIRATION (founder verdict
> s72, supersedes every migration framing below and in §4).** Wave 0 shipped
> the theme + a token bridge that repainted the OLD surfaces, and the founder
> rejected the result on sight: "the redesign looks nothing like the claude
> design mock … I wanted to demolish the house and build a new one, not
> renovate. I want the claude design as EXACT, and put in any placeholders
> (like the thumbnails) as needed if the backend is not ready yet." The only
> keeper he named from the wave is LIGHT MODE. Consequences, binding:
> (a) the 16 mock sheets + theme.css are checked in at
> `docs/research/mock-sheets/` — the spec of record, with the contract in its
> README (exact match · placeholders over drift · old surface code DELETED as
> each rebuild ships · the bridge burns to zero);
> (b) surface rebuilds are LEAD-DIRECT work — the founder assigned exactness
> to the lead personally; no lane delegation for design implementation;
> (c) every rebuilt surface is verified by SCREENSHOT-AGAINST-SHEET in a real
> browser before it counts as done — same layout, bands, density, copy
> grammar, type roles as the sheet;
> (d) wave-0's KEEPERS are plumbing only: token/theme infra (the tokens ARE
> the mock's values), the light-mode mapping, the contrast + mono ratchets.
> The visible chrome (rail/topbar) gets re-trued to the sheets too.

Three earlier doctrines from the s71 live rounds remain in force below.

The wave-0 claude-design mock (project `f5d304cb`, all 8 surfaces + the theme
system) went through live founder rounds on 2026-07-25. Three doctrines came
out of them, RATIFIED by direction and now requirements on the build, not
suggestions. Executable ratchet candidates land with wave 1 (conformance
tests beside `tokens-contrast`), documentary form lives here until then:

1. **MEDIA-FIRST.** Every row that references real media shows it — clip
   frames, post images, page heroes, YouTube thumbnails — and text drafts
   show their excerpt (the actual first line, not a type label). The founder's
   words: without this "the workspace just becomes a wall of text." Approve
   is the surface where this matters MOST (scan-and-decide); needs-you rows
   carry excerpt + thumb; intel rising rows carry source thumbnails.
   Wave-1 ratchet candidate: a conformance test that fails any approve/needs-
   you row rendering a media-bearing draft without its media slot.
2. **EVERY FACT IS A DOOR.** Tiles, rows, stamps, and cards all deep-link to
   the surface that owns them (dashboard week card → Calendar; needs-you →
   the exact draft in Approve; intel exits carry the pick). Views offer scope
   toggles where density varies (the week card's Today/This-week segmented
   control). Nothing is a dead label.
3. **BRAND-MARK SCOPING.** The mark wears the landing amber
   (`--brand-hi/lo` token pair) on the dark workspace — one DNA with the
   landing — while STATUS amber stays needs-you-only. Brand is never status;
   an amber interactive element or amber decoration remains a defect.
4. **VISIBLE PROVENANCE (founder round 6).** Nothing important works
   invisibly: (a) discoverability targets show as chips at Create (editable,
   primary entity marked) AND as a named entry in Approve's checks band with
   term-coverage state — a missing target warns in amber right on the draft
   (the LinkedIn miss rendered impossible to repeat); (b) every draft carries
   an attributed version strip — engine draft v1 → your edit v2 → (future)
   agent-proposed-you-approved — with a diff view, and re-judges stamp the
   version they ran on; (c) the invariant is stated in operator copy: **the
   judge gates — it never rewrites**. Wave-1 ratchet candidates: a
   conformance test that any surfaced judge row set includes discoverability
   when targetTerms exist, and a pin that body-version attribution renders on
   every draft detail.

Also founder-directed in the same rounds: intel reads all posting platforms
eventually (homed in ROADMAP §B-learn L2), and YouTube thumbnails ride the
existing `thumbnailUrl` capture — no new plumbing needed.

---

*Phase-0 lane, branch `agent/ui-overhaul-phase0`. Evidence trail: cloned
Astryx source + scratch build at `~/lane-scratch/` (outside the repo), live
surface walk on the dev preview, Geist/Supabase public docs, the cockpit on
this box. No repo dependencies or UI code were touched.*
