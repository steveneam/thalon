# The Workspace spec — every surface, one system

> **Status: DRAFT — the founder's verdict is the gate.** Commissioned s87, his
> words: *"plan, spec and structure all the surfaces together, in the context of
> research, so that they are coherent, have a flow and order and function to them,
> before the mock and build and wiring … that ensures cohesion in terms of backend
> and frontend, as well as being able to identify whats missing."* This document
> BINDS the existing specs (`docs/create-engine/spec.md` · `docs/video-arc/spec.md`
> · the distribution charter · `ux-refinement-program.md`) into one structure; it
> supersedes none of them. Division of homes: **this file owns STRUCTURE** (what
> each surface is, how they join, what is missing); the programme file owns PASS
> STATUS (the coverage ledger); each feature spec owns its own depth.

## 0. The definition of done governs everything below

A surface untouched by the Postiz/Mobbin research is NOT finished or ready
(founder ruling, s87 — programme file §THE DEFINITION OF DONE). This spec is the
map of that debt and the plan that pays it, **in structure-first order: research →
coherent per-surface contracts → sheet amendments → founder verdict → build**.
Nothing mocks, builds or wires ahead of its research.

## 1. The one loop, and the acts

Thalon's product frame is one loop: **profile + prompt → generate → judge →
approve → ship → measure → learn**. The workspace is that loop made walkable.
Every surface belongs to exactly one act (its JOB), even where it links across:

| act | job | surfaces |
|---|---|---|
| **ORIENT** | what is the machine doing; what needs me | Dashboard · Board (lens) · Runs |
| **KNOW** | what is out there; what do we know | Intel · Leads · Library/Transcription · Source Media |
| **MAKE** | turn intent into judged drafts | Create (+ wizard) · Composer (checkpoint) · Videos Overview / Dossier / Editor · Sites |
| **GATE** | the human decision of record | Approve |
| **SHIP** | when and where it goes out | Schedule · Channels |
| **LEARN** | what happened; feed it back | Analytics |
| **IDENTITY** | who we are; what powers the loop | Profiles · Settings/Integrations |

Two chrome families (Header/System frames in the sheets) serve all acts.

## 2. The structural finding: the workspace is split in half

Laying every sheet against every route exposed the real shape, which no
per-surface pass could see:

- **Designed-but-UNBUILT (research done, no route):** Analytics · Channels ·
  Composer · Schedule (the app still runs `/app/calendar` on the superseded
  Calendar sheet). The D4 four — the best-researched surfaces in the product —
  do not exist in the app.
- **Built-but-UNRESEARCHED (route live, no research):** Dashboard · Approve ·
  Board · Intel · Leads · Library+Transcription · Profiles · Runs · Sites ·
  Settings · Source Media. Eleven live surfaces, all exact-mock ports of
  PRE-research sheets — by the definition of done, none is ready.

Cohesion means closing both halves against ONE structure, not polishing either
half in isolation.

## 3. Per-surface contracts

Format: **job** (one sentence) · **joins** (doors in/out — every fact is a door)
· **backend truth** (what real state it renders) · **state** (research/sheet/
build) · **passthrough questions** (P = Postiz flow/functionality · M = Mobbin
interface/design).

### ORIENT

**Dashboard** (`/app`) — job: the day's triage in one glance — needs-you counts,
pulse, the work calendar, the pipeline schematic. Joins: → Approve (needs-you),
→ Runs, → Schedule, → every act (tiles are doors). Backend: events spine,
approvals queue counts, planned_slots, create_runs ("Latest runs" moves here or
stays on Create — decide in research). State: built, **unresearched**.
P: Postiz launch/home — what do they surface first, what do they NOT put on a
home? M: command-center/ops-home patterns; needs-you inbox patterns.

**Board** (`/app/board`) — job: the SAME pipeline as a kanban lens (columns =
stages, heat carried). Joins: card → its draft/run. Backend: same spine as
Dashboard. State: built, unresearched. **Structure question for the verdict: is
Board a surface or a Dashboard view-toggle?** (s71 drew it as a toggle;
the build split it into a route.) P/M: does anyone ship pipeline-kanban for
content ops, or is this a lens nobody uses?

**Runs** (`/app/runs`) — job: every generation run, outcome-first, with cost and
error honesty. Joins: run → its children (drafts/video project) → Approve;
**s87: `create_runs` is now the parent record — Runs becomes Create-run-first,
family runs nest under it.** Backend: create_runs (s87 window) + fanout_runs +
usage_ledger. State: built, unresearched; the s87 window makes its current shape
stale. M: job-history/run-log patterns (Vercel deployments, CI runs).
P: their post-history/log equivalent.

### KNOW

**Intel** (`/app/intel`) — job: monitored areas → scored trend cards →
dossiers → launchpads into Create (context chips, never retyped). Joins: →
Create (per-family exits), → search targets, ← Analytics (the learn loop, D2
flying car). Backend: trend engine, monitored_areas, captures. State: built,
unresearched (the s71 dossier doctrine predates the research era).
P: none (Postiz has no intel — our moat; say so). M: research-feed / signal
dashboards / news-triage patterns; dossier-card patterns.

**Leads** (`/app/leads`) — job: CRM-lite — scored leads, outreach state, the
email exit. Joins: lead → Create email family (leadId context), → outreach
send door (armed separately). Backend: leads/scores/outreach_sends. State:
built, unresearched. M: lightweight-CRM tables, lead detail rails.
P: none directly (no CRM in Postiz) — mark n/a rather than force it.

**Library / Transcription** (`/app/library` AND `/app/transcription` — **two
routes exist for one idea; the sheet still says "Library"**) — job: the
knowledge sources the judge grounds on: ingested docs/URLs/transcripts, free
by default, AI-enhance per ingest (s86). Joins: source → Create grounding
picks, → chunks/embeddings. Backend: sources/source_chunks, ingest engine.
State: built, unresearched, **naming/IA drift is a structure defect: resolve
to ONE surface** (proposal: "Library" = the knowledge shelf; transcription is
an ingest KIND, not a sibling surface). M: knowledge-base/library patterns
(Notion, Mem, Readwise-style source lists).

**Source Media** (media components; verdicted sheet s77, pre-programme) — job:
the media the product holds — every image/poster/audio with provenance and
roles (`use|reference`, s87). Joins: → Create wizard's media dialog
(Uploads/Generations/Library tabs), → Composer media control. Backend: object
store, media envelopes + roles. State: partially built as components,
**no research pass on record**. M: asset-library/DAM patterns (the Leonardo
Select-Media dialog is already banked in the Create spec — extend, don't
re-search).

### MAKE

**Create home** — job: the front door; prompt hero + wizard offer + latest
runs. **Spec of record: `docs/create-engine/spec.md` (APPROVED).** Research:
✅ (its Mobbin pass: HubSpot·Jasper·Linktree·Profound·Midjourney·Runway·Krea·
Leonardo). Next: sheet update (B-create.3).

**Create wizard** (new sheet) — per the Create spec: rail-accordion beside a
live brief; What → Platforms → Sources & media → Review plan → Generate.
Research ✅. Next: the sheet.

**Composer** — job: the run-scoped checkpoint (previews · fit · judge ·
settings rail · edit/AI edit). Research ✅ s86; **unbuilt — the route is
B-create.4**, engine verbs land via the `create-shells` lane. P (queued for the
passthrough): Postiz launcher end-to-end — field order, per-platform overrides,
error surfaces — as FLOW facts (their editor's shape is already partly taken).

**Videos Overview / Dossier / Editor** — spec of record: `docs/video-arc/spec.md`
(corrected s87 — engine ALL built; remaining work is surface). Research ✅ all
three (s85/s87 banks). Next: sheets pass 1 (thumbnails · track colour · credit
badges · the version rail that collapses four of the five no-affordance jobs).

**Sites** (`/app/sites`) — job: the page family's artifacts — generated pages,
the blog loop, publish-to-own-site. Joins: ← Create page family, → blog (the
SEO/AEO farm, s70c doctrine: social mirrors the blog). Backend: webpage engine,
public-assets door. State: built, unresearched. M: site-builder galleries /
page-manager patterns. P: none (no site builder) — n/a stated.

### GATE

**Approve** (`/app/approve`) — job: THE human gate — scan, judge-verdicts
visible, edit, approve/reject; batch by run. **s71 doctrine: the priority
surface for media-first.** Joins: ← every family's drafts, → Composer re-entry
("Open in Composer", per the Create spec), → Schedule on approve. Backend:
drafts state machine, judge_results, edit_diffs, eval rows. State: built,
unresearched — **the highest-stakes unresearched surface in the product**.
P: their approval/review flow if any (teams feature — verify; likely thin).
M: review-queue / moderation-queue / email-triage patterns (superhuman-style
keyboard triage; the DESIGN.md j/k grammar already exists — research validates
or replaces it).

### SHIP

**Schedule** — job: planned (intent) vs queued (commitment) vs published
(fact); cadence flags; the expanded chip with media. Research ✅ s86, sheet
DONE; **build = the rename + re-true of `/app/calendar`** (founder's open call;
route + component + sheet all say Calendar today). Backend: planned_slots,
publish_queue, social_publications.

**Channels** — job: the connect dance and channel health (CURRENT/NOT
CONNECTED, validate, live lines). Research ✅ s86, sheet DONE; **unbuilt.**
Backend: connector seam (D1), vault, capability matrix. **Structure question
for the verdict: Channels vs Integrations vs Settings — three names, overlapping
jobs (see §5 gap 4).**

### LEARN

**Analytics** — job: per-channel + per-post truth with absence-honesty
(`deferred` for X now in the vocabulary). Research ✅ s85b, sheet DONE;
**unbuilt**, and the sheet's Facebook fixture is WRONG (Meta retired the
metric — capability table is the truth, COORDINATION §s87 lead item 1).
Backend: publication_metrics + read-model (s87, live). Build after fixture
reconciliation; D2 data is already real.

### IDENTITY

**Profiles** (`/app/profiles`) — job: the tenant's brand/voice/identity/
routing config — what powers generation; versioned; "what this profile powers".
Backend: brand_profiles (incl. s87 `platformRouting`). State: built (6-step
wizard sheet, s71), unresearched. M: settings-wizard / workspace-profile
patterns. P: their settings IA.

**Settings / Integrations** (`/app/settings` route EXISTS; Integrations sheet
EXISTS; **no Settings sheet exists**) — job: seams/drivers health, AI seats
(BYO-AI), env-ish operator config. State: built-ish, unresearched, and the
sheet↔route mapping is broken in both directions. Resolution proposal in §5.

### Retired / historical

**Calendar sheet** — superseded s85 (rail sweep), kept as history. **Wave 0 –
Triage spine sheet** — the pre-doctrine mock; mark SUPERSEDED in its header at
the next sheet commit (it is nobody's spec now).

### 3b. THE DEPENDENCY MAP — ground truth per surface (founder directive, s87)

His words: *"include all the dependencies, exact paths, schemas, and so on when
planning/speccing … so we can keep track and design the flow, frontend and
backend properly."* Exact paths; a `(planned)` mark is the ONLY way to cite what
does not exist yet — **checked, not asked for**, by the spec-ground-truth ratchet
(`packages/contracts/src/__tests__/spec-ground-truth.test.ts`), which fails this
document on any unmarked dead citation and fails on citation rot forever after.

| surface | route (frontend) | components / lib | sheet | backend truth (engine · db) |
|---|---|---|---|---|
| Dashboard | `apps/web/src/app/app/page.tsx` | `apps/web/src/components/dashboard/` | `docs/research/mock-sheets/Dashboard.dc.html` | `packages/db/src/repos/events.ts` · `packages/db/src/repos/approvals.ts` · `packages/db/src/repos/planned-slots.ts` · `packages/db/src/repos/create-runs.ts` |
| Board | `apps/web/src/app/app/board/page.tsx` | `apps/web/src/components/board/` | `docs/research/mock-sheets/Board.dc.html` | same spine as Dashboard (a lens, §5.9) |
| Runs | `apps/web/src/app/app/runs/page.tsx` | `apps/web/src/components/runs/` | `docs/research/mock-sheets/Runs.dc.html` | `packages/db/src/repos/fanout-runs.ts` · `packages/db/src/repos/create-runs.ts` (s87 — re-shape pending, §5.8) · `packages/db/src/repos/usage-ledger.ts` |
| Intel | `apps/web/src/app/app/intel/page.tsx` | `apps/web/src/components/intel/` + `apps/web/src/lib/intel/types.ts` | `docs/research/mock-sheets/Intel.dc.html` | `packages/engine/src/trend/` · `packages/engine/src/search/` · `packages/db/src/repos/monitored-areas.ts` · `packages/db/src/repos/intel-captures.ts` |
| Leads | `apps/web/src/app/app/leads/page.tsx` | `apps/web/src/components/leads/` | `docs/research/mock-sheets/Leads.dc.html` | `packages/engine/src/leads/` · `packages/engine/src/outreach/` · `packages/db/src/repos/leads.ts` · `packages/db/src/repos/outreach-sends.ts` |
| Library / Transcription | `apps/web/src/app/app/library/page.tsx` **AND** `apps/web/src/app/app/transcription/page.tsx` (the §5.3 drift) | `apps/web/src/components/transcription/` + `apps/web/src/lib/library/` | `docs/research/mock-sheets/Library.dc.html` | `packages/engine/src/ingest/` · `packages/db/src/repos/sources.ts` · `packages/db/src/repos/source-chunks.ts` |
| Source Media | no route — component family | `apps/web/src/components/media/` | Source Media sheet (s77, in `docs/research/mock-sheets/`) | `packages/platform/src/object-store.ts` · `packages/contracts/src/media.ts` (roles s87) |
| Create home + wizard | `apps/web/src/app/app/create/page.tsx` · run route (planned — B-create.4) | `apps/web/src/components/create/` + `apps/web/src/lib/create/families.ts` | `docs/research/mock-sheets/Create.dc.html` · wizard sheet (planned — B-create.3) | `packages/engine/src/create/` · `packages/contracts/src/create-run.ts` · `packages/db/src/repos/create-runs.ts` |
| Composer | `apps/web/src/app/app/create/run/` (planned — B-create.4) | (planned) | `docs/research/mock-sheets/Composer.dc.html` | `packages/engine/src/create/` (+ `packages/engine/src/create/edit.ts` (planned — create-shells lane)) · `packages/contracts/src/platform-settings.ts` |
| Videos ×3 | `apps/web/src/app/app/videos/` | `apps/web/src/components/videos/` | Videos Overview · Video Dossier · Videos sheets (in `docs/research/mock-sheets/`) | `packages/engine/src/edl/` · `packages/engine/src/render/` · `packages/engine/src/direction/` · `packages/db/src/repos/video-cuts.ts` · `packages/db/src/repos/video-projects.ts` |
| Sites | `apps/web/src/app/app/sites/page.tsx` | `apps/web/src/components/sites/` | `docs/research/mock-sheets/Sites.dc.html` | `packages/engine/src/webpage/` |
| Approve | `apps/web/src/app/app/approve/page.tsx` | `apps/web/src/components/approve/` | `docs/research/mock-sheets/Approve.dc.html` | `packages/db/src/repos/drafts.ts` · `packages/db/src/repos/judge-results.ts` · `proprietary/judge/` |
| Schedule | `apps/web/src/app/app/calendar/page.tsx` (rename pending, §5.5) | `apps/web/src/components/calendar/` | `docs/research/mock-sheets/Schedule.dc.html` | `packages/db/src/repos/planned-slots.ts` · `packages/db/src/repos/publish-queue.ts` · `packages/db/src/repos/social-publications.ts` |
| Channels | (planned — D4 build) | (planned) | `docs/research/mock-sheets/Channels.dc.html` | `packages/engine/src/integrations/` · `packages/engine/src/social/registry.ts` · `packages/db/src/repos/tenant-credentials.ts` · `packages/contracts/src/platform-capability.ts` |
| Analytics | (planned — after fixture reconciliation) | (planned) | `docs/research/mock-sheets/Analytics.dc.html` | `packages/engine/src/social/metrics/` · `packages/db/src/repos/publication-metrics.ts` |
| Profiles | `apps/web/src/app/app/profiles/page.tsx` | `apps/web/src/components/profiles/` | `docs/research/mock-sheets/Profiles.dc.html` | `packages/db/src/repos/brand-profiles.ts` · `packages/contracts/src/brand-profile.ts` (incl. s87 `platformRouting`) |
| Settings / Integrations | `apps/web/src/app/app/settings/page.tsx` | `apps/web/src/components/settings/` | `docs/research/mock-sheets/Integrations.dc.html` (mis-aimed, §5.4) · Settings sheet (planned — gap §5.2) | `scripts/doctor.mjs` · `packages/engine/src/integrations/` |

## 4. The flows (what "coherent" means, concretely)

Named journeys, each crossing acts; pass 2 walks THESE, not surfaces:

1. **First run** — connect a channel → make a profile → first create → first
   approve → first scheduled post. **No surface owns any step of this today
   (gap 1).**
2. **Daily triage** — Dashboard needs-you → Approve (keyboard grammar) →
   Schedule check → done. The operator's morning; must be walkable in minutes.
3. **The content loop** — Intel card → Create (context chips ride) → Generate →
   Composer (fit/judge/settings) → Approve → Schedule → published → Analytics →
   back into Intel/profile. THE spine; every join is specced (Create spec flow +
   D2), none is fully built.
4. **The video loop** — Create video (one-prompt | staged) → Dossier → Editor →
   cut → use-role media on a post run → Composer video tab → Approve → Schedule.
5. **Repurpose** — Dossier "Repurpose" → waterfall → derived post set (video
   spec §Joins; engine exists).
6. **Connect** — Channels offer-card → OAuth dance → CURRENT card with live
   line → capability constraints visible at Create (R3).
7. **Outreach** — Intel/waitlist → Leads → email family (leadId) → Approve →
   send door (two-key, founder-gated).
8. **The learn loop** — Analytics → exemplars/evals → generation gets better
   (D2 flying car; B-learn). Longest-horizon, name it so joins reserve seams.

## 5. WHAT IS MISSING (the gaps only a structure pass could name)

1. **Onboarding/first-run** — nothing owns journey 1. Research question, then
   likely a thin guided state over existing surfaces, not a new surface.
2. **A Settings sheet** — the route ships real function with no spec of record.
3. **Library/Transcription split** — two routes, one sheet, three names.
   Proposal: ONE Library surface; transcription = an ingest kind + filter.
4. **Channels vs Integrations vs Settings** — three overlapping names.
   Proposal: **Channels** = social destinations (the D4 sheet, build it) ·
   **Integrations** = AI seats + providers (its sheet re-aimed at exactly
   that) · **Settings** = operator/seams/env. Founder picks the split.
5. **Calendar→Schedule rename** — route, component and app copy still Calendar.
6. **Notifications/alerts** — needs-you counts exist; no alert center, no
   "what changed since I left". Research question (P: their notification
   model; M: activity-feed patterns) before inventing anything.
7. **Global search / command palette** — s74 built a Search tab inside Intel;
   nothing global. Research question, not a commitment.
8. **The Runs↔create_runs re-shape** — the s87 window made Runs' current shape
   stale (§3 ORIENT).
9. **Board's existence** as a route vs a Dashboard toggle (§3 ORIENT).
10. **Wave-0 sheet retirement** (§3 Retired).

## 6. The research passthrough — plan (his two halves, made concrete)

**Postiz half — flow, ideas, functionality** (AGPL: patterns only, never code;
much is BANKED in the distribution charter — the passthrough re-aims it at FLOW):
walk their app/docs per act and record flow facts → take/adapt/reject rows in
the programme file's reference library. Standing questions: launcher end-to-end
(field order, per-platform overrides, failure surfaces) · calendar interactions
(drag, slot affordances) · channel settings + reconnect states · analytics
pages · autopost/evergreen · onboarding · notification model · their settings
IA. Marked n/a rather than forced: intel, CRM, sites, video editor (verified
absent s85).

**Mobbin half — interface, design, flow**: per-surface searches for the
unresearched eleven + the named gaps. BANKED (never re-search): the D4 four ·
the Create set · the video three · Source Media's dialog pattern. Budget rule:
≤2 searches per surface, batched by wave, TAKEN/REJECTED recorded same-commit
in the reference library, ledger row moved same-commit.

**Waves (each = one lead session: research → contract updates HERE → sheet
amendments → founder verdict):**

| wave | surfaces | why this order |
|---|---|---|
| **W1 — the spine's gate + home** | Approve · Dashboard · Runs (+Board decision) · onboarding+notifications questions | highest-stakes unresearched surfaces; journey 2 end-to-end |
| **W2 — MAKE completion** | Create home+wizard sheets (research already ✅ — this wave DRAWS) · Composer Postiz-launcher flow facts · Sites · Library/Source-Media IA resolution | B-create.3 rides here; the founder's named priority stays first among equals |
| **W3 — SHIP + IDENTITY** | Channels/Integrations/Settings split (his §5.4 verdict applied) · Schedule build-prep · Profiles | closes journey 6; unblocks the D4 builds |
| **W4 — KNOW + video draw** | Intel · Leads · video sheets pass 1 (research ✅ — draws) | the moat surfaces, with the loop's joins now fixed |

Analytics needs no wave (research ✅); its build waits only on the fixture
reconciliation + a build slot.

## 7. Sequencing against everything else

- **Engine lanes are orthogonal and continue**: `analytics-honesty` (GO on
  record) + `create-shells` (pending his word) build seams this spec's surfaces
  will consume. **Recommend holding both until the Jul 31 budget reset**, and
  spending what remains of this cycle on W1 research — his stated intent for
  the "last remaining usages".
- **No surface build starts ahead of its wave's verdict.** The D4 builds
  (Schedule rename · Channels · Analytics · Composer/B-create.4) queue behind
  their structure decisions (§5.4, fixture reconciliation, Create sheets).
- The coverage ledger (programme file) stays the pass record; every wave moves
  its rows same-commit.

## 8. Decisions this spec asks of the founder (the verdict bundle)

1. The act structure + per-surface jobs (§1, §3) — approve/amend.
2. Gap resolutions §5.3 (Library) and §5.4 (Channels/Integrations/Settings).
3. Board: surface or Dashboard toggle (§5.9).
4. The wave order (§6) — W1 = Approve/Dashboard/Runs first, or reorder.
5. Lanes hold until reset per §7, or run now.
6. Onboarding/notifications/search: research-first (recommended) or park.

## Out of scope

Publishing/arming changes · any engine work (the lanes' kickoffs own theirs) ·
landing/marketing · pricing/billing surfaces · teams (charter-rejected).
