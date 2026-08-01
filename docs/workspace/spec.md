# The Workspace spec — every surface, one system

> **Status: APPROVED — founder verdict s88 (2026-07-29), verbatim: *"yes to
> all."*** All five open calls in the §8 bundle are ruled AS RECOMMENDED; §8
> carries each ruling with its consequence, and the gaps in §5 carry theirs.
> **What this unblocks:** the wave programme in §6 is now the surface plan of
> record — W1 (Approve · Dashboard · Runs) is next, and no surface build starts
> ahead of its wave. **What it does NOT cover:** the app-side Calendar → Schedule
> rename, the Composer POPOUT state, and YouTube as a destination were never in
> this bundle and remain his open calls.
>
> Commissioned s87, his
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
approvals queue counts, planned_slots, create_runs. State: built, **researched
W1/s89** (library §Dashboard+Board). **Researched shape:** a needs-you strip of
count tiles that carry their TIME WINDOW in words ("in the last 7 days" —
Jira/Gorgias), an activity feed whose items carry state chips, and the
**Pipeline | Board view toggle** absorbing Board (§5.9; Jira ships
Summary·Board as tabs of one space). **DECIDED (was "decide in research"):
"Latest runs" STAYS on Create home** — the Create spec owns that block;
Dashboard shows run COUNTS in the strip and doors to `/app/runs`, never a
second run list. First-run: the Dashboard carries the onboarding setup band
(§5.1's answer) above its tiles, and every tile's empty state names one CTA.
P walked: Postiz's home IS its calendar — rejected; Schedule owns ours.

**Board** (`/app/board`) — **RULED s88 (§5.9): retires as a route, becomes the
Dashboard's Board toggle.** The kanban lens survives as a VIEW of the same
spine (columns = stages, heat carried; card → its draft/run). W1's Dashboard
sheet draws the toggle; the route deletes only after the wave's verdict —
nothing is deleted before its replacement is drawn. Research W1/s89: Jira's
Summary/Board tabs are the drawn precedent.

**Runs** (`/app/runs`) — job: every generation run, outcome-first, with cost and
error honesty. Joins: run → its children (drafts/video project) → Approve;
**s87: `create_runs` is now the parent record — Runs becomes Create-run-first,
family runs nest under it.** Backend: create_runs (s87 window) + fanout_runs +
usage_ledger. State: built, **researched W1/s89** (library §Runs); the s87
window made its pre-window shape stale. **Researched re-shape (§5.8, now
concrete):** a running-now band above the history (Cloudflare); parent rows in
the Cursor run-history grammar — trigger/prompt · family · **status with its
duration beside it** (Vercel "● Error 19s") · judge outcome as a chip on the
row (Hume) · output THUMBNAILS on rows that made media (ElevenLabs; the
founder's thumbnails-everywhere note) — with a status multi-filter; the run
detail's cost roll-up groups by what spent it and ends in a TOTAL row (Clay,
per `usage_ledger`). Fanout/family runs nest under their create-run parent;
an orphan family run (pre-s87 history) stays a top-level row rather than
minting a fake parent.

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

**Library / Transcription** (`/app/library` AND `/app/transcription` — the
two routes collapse to ONE at the rebuild) — job: the knowledge sources the
judge grounds on: ingested docs/URLs/transcripts, free by default, AI-enhance
per ingest (s86). Joins: source → Create grounding picks, → chunks/embeddings.
Backend: sources/source_chunks, ingest engine. State: built, **researched +
DRAWN s90 (W2; library §Library — the §5.3 ruling made legible)**: the ingest
band names every kind it takes and carries the Free-transcript | AI-enhance
seg (free default, enhance metered); kind is a qtab FILTER with counts, never
a route; a mid-transcription source is a row state ("Transcribing · ~3m
left"), not an absence. `/app/transcription` retires when the rebuild lands
(build task, its own go). Awaiting the W2 verdict.

**Source Media** (media components; verdicted sheet s77, pre-programme) — job:
the media the product holds — every image/poster/audio with provenance and
roles (`use|reference`, s87). Joins: → Create wizard's media dialog
(Uploads/Generations/Library tabs), → Composer media control. Backend: object
store, media envelopes + roles. State: partially built as components. **IA
RESOLVED s90 (W2): its own component family, reached through the wizard's
media dialog — knowledge shelf (Library) and media shelf are different jobs,
never merged.** Research ◐: the banked Leonardo dialog + Runway roles were
APPLIED in the W2 wizard draw; its own sheet's pass is still owed.
M: asset-library/DAM patterns (the Leonardo
Select-Media dialog is already banked in the Create spec — extend, don't
re-search).

### MAKE

**Create home** — job: the front door; prompt hero + wizard offer + latest
runs. **Spec of record: `docs/create-engine/spec.md` (APPROVED).** Research:
✅ (its Mobbin pass: HubSpot·Jasper·Linktree·Profound·Midjourney·Runway·Krea·
Leonardo). **Sheet UPDATED s90 (W2)**: the dead "Advanced · staged flow"
link is a real "Start guided" door in the hero; Intel task shortcuts; run
rows carry their Composer door. Awaiting the W2 verdict.

**Create wizard** (`Create Wizard.dc.html` — EXISTS since s90) — per the
Create spec: rail-accordion beside a live brief; What → Platforms → Sources
& media → Review plan → Generate. Research ✅. **Sheet DRAWN s90 (W2)** at
the Sources & media step: capability on the platform chips before spend
(R3), role chips at every attach (use | reference, the fact visible on the
row), the plan an honest dashed PENDING until Review. Awaiting the W2
verdict.

**Composer** — job: the run-scoped checkpoint (previews · fit · judge ·
settings rail · edit/AI edit). Research ✅ s86; **unbuilt — the route is
B-create.4**, engine verbs landed via the `create-shells` + `judge-candidate`
lanes. **P ANSWERED s90 (W2; library §Postiz launcher):** their launcher is
per-integration bundles with per-platform `settings` discriminated by
`__type` — REJECTED as our model (no master, no divergence, no way back; our
fork-with-provenance stays) · their pre-validation endpoint (maxLength +
rules + settings schema) VALIDATES R3 and the D3 slice · their docs carry NO
multi-platform failure contract — our Error Behavior stands alone.

**Videos Overview / Dossier / Editor** — spec of record: `docs/video-arc/spec.md`
(corrected s87 — engine ALL built; remaining work is surface). Research ✅ all
three (s85/s87 banks). Next: sheets pass 1 (thumbnails · track colour · credit
badges · the version rail that collapses four of the five no-affordance jobs).

**Sites** (`/app/sites`) — job: the page family's artifacts — generated pages,
the blog loop, publish-to-own-site. Joins: ← Create page family, → blog (the
SEO/AEO farm, s70c doctrine: social mirrors the blog). Backend: webpage engine,
public-assets door. State: built, **researched + DRAWN s90 (W2; library
§Sites)**: state badge ON the preview shot (Lovable), live cards carry their
hostname / drafts say "previews only" (Squarespace's the-address-is-the-fact),
the h1 pills became the state filter seg, and the blog-loop join got its
door (the published ledger). P: none (no site builder) — n/a stated.
Awaiting the W2 verdict.

### GATE

**Approve** (`/app/approve`) — job: THE human gate — scan, judge-verdicts
visible, edit, approve/reject; batch by run. **s71 doctrine: the priority
surface for media-first.** Joins: ← every family's drafts, → Composer re-entry
("Open in Composer", per the Create spec), → Schedule on approve. Backend:
drafts state machine, judge_results, edit_diffs, eval rows. State: built,
**researched W1/s89** (library §Approve). **Researched grammar:** queue tabs
named by STATE with counts (Reddit's mod queue); each draft renders at FULL
fidelity in the queue — avatar, body, media — never a title row (Sprout, and
the same in-row-post idea Analytics already ships); the judge's verdict rides
the card as a chip with its reason (Reddit's "This is spam"); **the keyboard
grammar is VALIDATED and sharpened** — every verb carries its key inline on
the control (Plain's "Reply R / Done E"), not in a help overlay; batch
verbs carry their COUNT ("Approve run · 4" — Deel); **reject asks for a
reason, and that reason is the `eval_cases` row** (Klaviyo's guidance
pattern) — the control that collects it is the learn loop's front door.
P walked: Postiz approval = an agency permission gate inside the post
lifecycle — rejected as a model; our gate is a first-class surface because
the verdict is a record, not a permission.

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
| Schedule | `apps/web/src/app/app/schedule/page.tsx` (renamed s89 on his GO) | `apps/web/src/components/schedule/` | `docs/research/mock-sheets/Schedule.dc.html` | `packages/db/src/repos/planned-slots.ts` · `packages/db/src/repos/publish-queue.ts` · `packages/db/src/repos/social-publications.ts` |
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

**Six of these ten were ruled by the founder s88 (*"yes to all"*, §8); the
rulings are written in-place below.** The four unmarked ones are lead work or
still his call — say which, never let a gap sit in an undefined state.

1. **Onboarding/first-run** — nothing owns journey 1. **DECIDED s88:
   research-first** — no route is scaffolded for it; W1's research decides the
   shape, and the standing expectation is a thin guided state over existing
   surfaces rather than a new surface. **ANSWERED W1/s89 (library §Onboarding),
   and the expectation held:** the shape is a **dismissible setup band on the
   Dashboard** ("Set up your workspace · 2 of 4" — Hex) whose steps expand
   inline (connect a channel → make a profile → first create → first approve),
   every step skippable (Grain), plus per-surface EMPTY STATES that name the
   same one CTA (HubSpot), plus the demo-tenant stating itself in a banner
   (Steep). No route, no wizard, no new surface. The band is drawn in W1's
   Dashboard sheet; building it is a build slot after the wave's verdict.
2. **A Settings sheet** — the route ships real function with no spec of record.
   *(Lead work, now scoped by the §5.4 ruling: Settings = operator/seams/env.
   Its sheet is drawn in W3 alongside the split.)*
3. **Library/Transcription split** — two routes, one sheet, three names.
   **DECIDED s88: ONE Library surface**; transcription becomes an ingest kind +
   a filter, not a second route. Un-parks the collapse the s87 hygiene audit
   left queued on this verdict. Landed in **W2** (s90 draw).
   **RE-CONFIRMED s90 against the s74 record:** the founder asked *"wasn't
   Library supposed to be called Transcript?"* — the two-rulings history was
   put to him plainly (s74: his "Library → Transcription" call, which minted
   `/app/transcription`; s88: his "yes to all" on this spec reversing it) and
   he ruled **"Keep Library"** with the reasoning restated (3+ of the shelf's
   6 source kinds aren't transcripts). Three rulings deep now — do not
   re-open without new facts.
4. **Channels vs Integrations vs Settings** — three overlapping names.
   **DECIDED s88, as proposed:** **Channels** = social destinations (the D4
   sheet, build it) · **Integrations** = AI seats + providers (its sheet
   re-aimed at exactly that) · **Settings** = operator/seams/env. Lands in
   **W3**; unblocks the D4 Channels build.
5. **Calendar→Schedule rename** — **RULED AND EXECUTED s89** (founder: *"yes
   change from calendar to schedule"*; done same session): route
   `/app/schedule`, `components/schedule/`, `Schedule*` symbols, rail label,
   door copy ("Open schedule →"), the API route `/api/schedule/slots`, and the
   saved-view key. CSS class internals (`.calendar-surface`, `.cal`) were
   deliberately NOT renamed — the exact-mock rebuild to `Schedule.dc.html`
   (the D4 build slot) replaces that stylesheet wholesale, and renaming shared
   class vocabulary early is blast radius for zero visible gain.
6. **Notifications/alerts** — needs-you counts exist; no alert center, no
   "what changed since I left". **DECIDED s88: research-first** (P: their
   notification model; M: activity-feed patterns), riding W1's research.
   Nothing is invented ahead of it. **ANSWERED W1/s89 (library §Onboarding +
   Notifications): the shape of record is bundled-by-reason** — groups like
   "3 drafts blocked since you left", day-grouped, with a manage door (Asana's
   Inbox; ClickUp's Primary/Later/Cleared buckets as the triage variant;
   Postiz ships only an org-scoped notification list — thin, noted). **Not
   drawn and not built yet, deliberately:** until publish failures, judge
   blocks and metrics ticks produce real signal volume, the Dashboard's
   needs-you strip + activity feed carry the job; an alert center earns its
   wave when the signals exist. The research-first ruling is satisfied — the
   shape is recorded, and it waits.
7. **Global search / command palette** — s74 built a Search tab inside Intel;
   nothing global. **DECIDED s88: research-first, and it stays a question**
   until a wave earns it — not a commitment.
8. **The Runs↔create_runs re-shape** — the s87 window made Runs' current shape
   stale (§3 ORIENT). *(Lead work, inside W1 — Runs is a W1 surface.)*
   **SPECCED W1/s89** — the concrete shape is in §3 ORIENT's Runs contract
   (running-now band · Cursor-grammar parent rows · nested family runs ·
   Clay-style cost totals); the sheet amendment draws it this wave.
9. **Board's existence** as a route vs a Dashboard toggle (§3 ORIENT).
   **DECIDED s88: a Dashboard toggle, not its own route** — it duplicates
   Dashboard's job. The route retires in W1's ORIENT pass; nothing is deleted
   before the wave draws its replacement. **W1/s89: the toggle is drawn in the
   Dashboard sheet this wave** (Jira's Summary/Board tabs = the precedent);
   route deletion is a build task gated on the wave's verdict.
10. **Wave-0 sheet retirement** (§3 Retired). *(Lead work; the s87 hygiene audit
    already SUPERSEDED + archived the wave-0 sheet.)*

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
| **W1 — the spine's gate + home** | Approve · Dashboard · Runs (+Board decision) · onboarding+notifications questions | highest-stakes unresearched surfaces; journey 2 end-to-end. **RAN s89 · VERDICT: APPROVED — founder, same session, verbatim: *"yes to all, W1 approved."*** Research ✓ · contracts ✓ · questions answered ✓ · sheets amended ✓ · **builds UNBLOCKED: the Approve/Dashboard/Runs rebuilds to the amended sheets, the Board route retirement, and the setup band.** |
| **W2 — MAKE completion** | Create home+wizard sheets (research already ✅ — this wave DRAWS) · Composer Postiz-launcher flow facts · Sites · Library/Source-Media IA resolution | B-create.3 rides here; the founder's named priority stays first among equals. **RAN s90: all four sheets drawn/amended + measured (every bottom ≤ 940, zero truncation), the launcher walk answered the standing P-question, §5.3 drawn, Source-Media IA resolved (own component family, never merged). VERDICT: OPEN — no W2 surface builds before it.** |
| **W3 — SHIP + IDENTITY** | Channels/Integrations/Settings split (his §5.4 verdict applied) · Schedule build-prep · Profiles | closes journey 6; unblocks the D4 builds |
| **W4 — KNOW + video draw** | Intel · Leads · video sheets pass 1 (research ✅ — draws) | the moat surfaces, with the loop's joins now fixed |

Analytics needs no wave (research ✅); its build waits only on the fixture
reconciliation + a build slot.

## 7. Sequencing against everything else

- **Engine lanes are orthogonal and continue**: `analytics-honesty` (GO on
  record, HOLDING for budget) + `create-shells` (**LAUNCHED s88** on his named
  word) build seams this spec's surfaces will consume.
  ~~Recommend holding both until the Jul 31 budget reset, and spending what
  remains of this cycle on W1 research.~~ **OVERRULED s88 — he spent the cycle
  on the lane instead**, then ruled the research half too: *"hold off on the W1
  research, reassess after merge is done."* So **W1 research is NOT this
  session's work**; it is reassessed once `create-shells` is merged, against
  real headroom (90% of the weekly limit was already spent at launch; resets
  Jul 31, 11pm UTC). This bullet is kept struck-through rather than deleted
  because an unmarked superseded recommendation reads later as if it were
  followed.
- **No surface build starts ahead of its wave's verdict.** The D4 builds
  (Schedule rename · Channels · Analytics · Composer/B-create.4) queue behind
  their structure decisions (§5.4, fixture reconciliation, Create sheets).
- The coverage ledger (programme file) stays the pass record; every wave moves
  its rows same-commit.

## 8. Decisions this spec asks of the founder (the verdict bundle) — ALL RULED

**CLOSED s88. His verdict, verbatim: *"yes to all."*** Every call went as
recommended; each is written below with the consequence it triggers, because a
ruling recorded without its consequence is a ruling that gets re-litigated.

1. **The act structure + per-surface jobs (§1, §3) — APPROVED.** The acts are the
   workspace's structure of record; per-surface contracts in §3 bind. A surface
   that wants a job not in its contract amends this file first.
2. **Gap resolutions §5.3 and §5.4 — APPROVED as proposed.** §5.3: **ONE Library
   surface**; transcription becomes an ingest kind + a filter, not a second route
   — this un-parks the Library/Transcription collapse the s87 hygiene audit
   deliberately left queued on this verdict (W2). §5.4: **Channels** = social
   destinations · **Integrations** = AI seats + providers · **Settings** =
   operator/seams/env (W3, and it unblocks the D4 Channels build).
3. **Board — APPROVED as a Dashboard toggle, not its own route** (§5.9). It
   duplicates Dashboard's job. The route retires as part of W1's ORIENT pass;
   nothing is deleted before its wave draws the replacement.
4. **Wave order — APPROVED as written** (§6): **W1 = Approve · Dashboard · Runs**
   (+ the Board decision, now made) first, because those are the highest-stakes
   surfaces the definition-of-done ruling marks NOT READY.
5. ~~Lanes hold until reset per §7, or run now.~~ **CLOSED s87→s88, and §7's
   recommendation was OVERRULED in the founder's favour.** He ruled on budget —
   *"can we just do one lane next session since we're low on usage"* — then named
   the lane himself: *"i'll do the create shells next session."* So: ONE lane,
   `create-shells`, launched at the s88 boot without a re-ask; `analytics-honesty`
   holds with its GO still on record, first in line when budget allows two again.
   §7 recommended holding BOTH until the Jul 31 reset and spending the remainder
   on W1 research; he chose to spend it on the seam the Composer needs. Recorded
   because a superseded recommendation that stays unmarked reads later as if it
   were followed.
6. **Onboarding / notifications / global search — APPROVED research-first.**
   Nothing gets invented for these three: each is a research question before it
   is a surface. Onboarding + notifications ride W1's research (§6); global
   search stays a question until a wave earns it. **No new route is scaffolded
   for any of the three on the strength of this ruling** — research-first means
   the research decides the shape.

## Out of scope

Publishing/arming changes · any engine work (the lanes' kickoffs own theirs) ·
landing/marketing · pricing/billing surfaces · teams (charter-rejected).
