# B-create — the Create engine + Create dashboard

> **Status: APPROVED — founder, 2026-07-29 s86 close ("approve, wrap up and prepare for next session"). Both specs approved in the same word.** Authored s86 on the founder's direct
> brief (2026-07-29): *"the Create needs its own feature and engine because everything
> depends on it … try to have an idea of the structure, flow, UX/UI, engine, then run it
> through mobbin-mcp … then have a rough spec on how you want it all to connect so that
> when comes building, you're not lost again."* The Composer orphan — a sheet asserting
> a flow that was never specced — is the failure this document exists to prevent.

## What

Create becomes Thalon's front door: one feature with its own dashboard, wizard, and a
run engine that unifies today's five separate generation doors (fan-out, single draft,
one-prompt video, staged video direction, email compose, page) behind one contract —
**Brief → Plan → Generate → Composer → Approve**. Two authoring modes feed the same
engine: **Prompt** (pure AI, today's hero, kept) and **Wizard** (deterministic, staged,
media-importing). Intel context seeds either. Platform choice happens up front and the
content is fitted per platform; the Composer is the run's post-generation checkpoint —
previews, fit, judge verdicts, an edit rail and AI edit — before anything reaches the
Approve queue.

## Context

**Why now.** The founder's product frame (2026-07-05, standing) already says the
content-creation feature spans three output families riding one spine: profile + prompt
→ generate → judge → approve → ship. What shipped since then is real but *fragmented*:

| exists today | where | gap |
|---|---|---|
| One-prompt hero + family seg + Intel pick chip w/ per-field pruning | `apps/web/src/components/create/` (exact-mock from `Create.dc.html`) | only 2 of 4 family doors armed (video, email); "Advanced · staged flow →" is a dead link on the sheet |
| Fan-out: multi-platform drafts, judged, exemplar-aware, targetTerms | `packages/engine/src/fanout/` | not reachable from the Create surface as a run you configure |
| Staged video direction (storyboard → scenes → polish, deterministic prefill) | `packages/engine/src/direction/` | reachable only through the video pipeline, not as Create's "advanced" mode |
| One-prompt video | `packages/engine/src/origination/` | armed |
| Page family | `packages/engine/src/webpage/` | no Create door |
| Composer sheet (per-platform tabs, fit lines, judge card, preview, settings rail) | `docs/research/mock-sheets/Composer.dc.html` (s86, rebuilt on founder's 3-column call) | **no route, no flow position — the orphan** |
| Capability matrix + validator (D0) | shipped s82 | not surfaced pre-generation |
| Connector seam + vault (D1) | shipped s83–s85 | — |
| Media: content-addressed object store, Source Media surface, public-asset door | `packages/engine/src/assets/`, `webpage/public-assets` | no operator *import* door, no media roles |

**The founder's brief maps onto this** (his words → spec elements):
- *"Create … might need its own dashboard"* → §Design/Surfaces.
- *"choose to create for different platforms (based on our option/choice, like
  Kompozy)"* → the routing table, §Design/Routing.
- *"option to import images and such for inspiration or copying"* → media roles,
  §Design/Media.
- *"import (or a Create topic came from) info from the Intel feature (meta data to
  help fill out the wizard or prompt)"* → the wizard prefill, §Design/Wizard.
- *"fitted into particular platforms … edited (ourselves/editing rail) or via Ai"* →
  Composer edit rail + AI edit, §Design/Composer.
- *"all this can be created purely with Ai/prompts"* → Prompt mode unchanged.
- *"once it's generated we can have the Composer window appear after to do some
  previews and checks of the stats and compatibility with each platform, before
  approving"* → **the flow answer**, §Design/Flow.

**Research this spec stands on** (cite, don't re-search):
- Kompozy teardown (memory `higgsfield-kompozy-assignment`): bucket→platform routing
  table, Persona Brief discipline, platform-cadence gate, autopilot graduation ladder.
- Postiz charter `docs/research/distribution-charter.md`: D0 matrix (HAVE), D3
  per-platform settings schemas (28 DTOs — TAKE), per-channel preview (TAKE),
  judge-gated evergreen + RSS-in (D3), analytics loop (D2). Patterns only — AGPL.
- Product frame (memory `product-feature-framing`): one-prompt vs advanced ~3-stage
  video doctrine; storyboard/direction.md as driving artifact; blog-mirror doctrine
  (s70c: social posts mirror the blog article; blog = the SEO/AEO/GEO farm).
- Mobbin pass (s86, this spec): HubSpot [generate-blog-post flow](https://mobbin.com/flows/da528cf9-aed1-4c09-992d-7642e79cbb2d)
  (stepper; **review-outline-before-generate**; AI-image toggle with editable prompt),
  Jasper [writing-task flow](https://mobbin.com/flows/213ae30f-b4f5-4f36-874d-e56b982b88a4)
  (**accordion rail of checkmarked slots beside the artifact** — the wizard-as-rail),
  Linktree [post-ideas flow](https://mobbin.com/flows/9c690fb1-9bf6-4a29-8c85-dc02ad2af01f)
  (idea cards: cheap divergence before expensive generation),
  Profound [content workflow](https://mobbin.com/flows/afa930d8-85d5-4e3c-95de-c6d1a1a6bff5)
  (platforms-in-config rail; **live progress checklist**; honest "5–10 minutes"),
  Midjourney [upload flow](https://mobbin.com/flows/5cb8b2cd-108a-4426-a041-c46928597110)
  (prompt-bar media attach), Runway [image references](https://mobbin.com/flows/8d99aa03-14fe-46e6-b0b4-df2a9e046ec5)
  (**named reference roles — style vs subject — the import-semantics pattern**),
  Krea (run config as prompt-bar chips), Leonardo (Select Media dialog:
  uploads / generations / collections tabs).

## Requirements

R1. One run contract: every Create path (prompt or wizard, any family) produces a
    `create_run` row recording brief, plan, and per-family child references. "Latest
    runs" and Runs read it.
R2. Prompt mode survives byte-true in spirit: prompt + family + Intel chip → Generate,
    no wizard steps forced. The wizard is an *offer*, never a wall.
R3. Platform selection is per-run, prefilled from tenant routing config by family,
    editable; every selected platform shows its D0 capability constraints *before*
    generation (media required, char limit, connect state).
R4. Media import: an operator can attach media to a run in one of two declared roles —
    **use** (mine; rides the draft as its media) or **reference** (inspiration;
    informs generation, never enters output). Role is explicit at attach time, stored
    on the ref, and visible everywhere the media shows.
R5. Wizard prefill is deterministic-first: Intel context fields, profile identity,
    routing defaults fill slots; AI fills only creative slots and only on the
    operator's click (the direction/prefill.ts doctrine, generalized).
R6. Plan preview before spend: the wizard's last step (and Prompt mode's "Preview
    plan") shows the resolved plan — platforms, sources, judge gates, per-family cost
    preview (video mint cost, metered calls) — HubSpot's review-outline pattern.
R7. Generation lands in the Composer: run completes → the Composer opens scoped to the
    run; tabs = the run's platforms; per tab: full-fidelity preview, fit line, judge
    verdict, settings rail. Nothing auto-advances to Approve.
R8. Editing: direct body edit per variant (the edit rail) and AI edit (instruction →
    regenerate that variant) — both re-judge before the variant can leave the
    Composer. The judge gates; it never rewrites unasked.
R9. "Send to Approve" moves the run's variants into the existing Approve queue
    unchanged — Approve remains the human gate of record; Composer is preflight and
    polish, never approval.
R10. Every gate is honest in words: a platform that refuses says why and names the fix;
     absent metrics/settings say so; no fabricated defaults (house rules).
R11. Multi-tenant: routing table, settings schemas, cadence norms are per-tenant
     config/data, never code. The repo ships the generic demo tenant defaults only.
R12. Ships disarmed end-to-end: nothing in B-create touches the publish sequence gate.
R13. Variant provenance: every platform variant records its master and a diverged flag;
     divergence is visible at the tab and reversible via "re-derive from master".
R14. Density: detail beyond the resting facts lives in popovers/popouts per the
     density doctrine; no surface grows an inline form where a popover is specified.

## Design

### Flow (the answer that un-orphans the Composer)

```
            ┌───────────── CREATE (the dashboard) ─────────────┐
            │  Prompt mode ──────────────┐                      │
Intel ──────┤  (hero, kept)              ├──► Brief ► Plan ─────┼─► Generate
 (context)  │  Wizard mode ──────────────┘    (preview,         │   (engine run,
            │  (rail: what → platforms →       cost, gates)     │    judged)
            │   sources+media → review)                         │
            └──────────────────────────────────────────────────┘
                                                                    │
              APPROVE  ◄── "Send to Approve" ◄── COMPOSER (run-scoped checkpoint:
              (queue,                            tabs per platform · preview · fit ·
               human gate)                       judge · settings rail · edit / AI edit)
                                                                    │
              Schedule ► publish (existing, untouched, gated)   re-entry: an Approve-queue
                                                                draft's "Open in Composer"
```

Create → Generate → **Composer** → Approve → Schedule. The s86 open decision
("per-draft from Approve, or one after Generate?") resolves as **both, with after-
Generate primary**: the Composer is born run-scoped; the Approve queue gains an
"Open in Composer" re-entry per draft group (same surface, same rules).

### The Composer's variant model — master + forks (s86 refinement, Mobbin-evidenced)

The founder asked whether per-platform tabs are the right call. Evidence from the
incumbents ([Sprout composer](https://mobbin.com/flows/699d2e17-fe4f-4c64-8948-317b48caf31f):
one body + a stacked Network Preview rail; [HubSpot](https://mobbin.com/flows/7fabb9a8-febe-4c5c-b593-30432efa4086):
per-network editor blocks with **"Duplicate post" to fork** and network-only fields
inline; [Later](https://mobbin.com/flows/05f0e819-43cc-493e-a41c-322d5bcee58d):
all per-profile detail in a **popout**): nobody ships N full editors side by side.
The synthesis we adopt:

- **A run has a MASTER body** (for post runs: the blog-mirror article/base). Each
  platform variant is a **fork with provenance**: it knows its master and whether it
  has diverged (generation fits it; hand/AI edits diverge it further). The tab strip
  keeps the s86 status dots and gains a **divergence badge** ("edited" / "as
  generated"); a diverged variant offers "re-derive from master" as a verb — never a
  silent overwrite.
- **Tabs stay** (Sprout's stacked previews collapse beyond 2–3 networks; we run 5+),
  but a tab is a *variant switch*, not a separate document.
- **Platform-only fields appear only on their platform's tab** (HubSpot's X
  first-reply pattern) — driven by the D3 schema, which is why the rail is generated.

### Density doctrine — pop-outs, popovers, tooltips (founder directive, s86)

Standing rule for every Create/Composer surface, extending the programme's tooltip
rule: **the resting surface shows facts; detail lives one click away; rationale lives
in tooltips.** Named applications, so builds don't re-derive them:
- Preview **popout** (decided s86): true platform width, Sprout-style
  [Desktop/Mobile pair](https://mobbin.com/flows/c44b3587-9e9f-4485-a2bd-76a5d8a53723).
- Media tools = icon toolbar with a **popover** for crop/alt detail (not inline forms).
- Settings rail shows the schema's *common* fields; the long tail sits behind a
  "More settings" **popover** per tab (Later's popout-per-profile, adapted).
- Per-platform fit detail (what gets cut, exact rules) = popover on the fit chip;
  the chip itself carries only the decisive fact.
- Wizard slot help = tooltips; a slot's AI-assist ("suggest") is a popover with
  candidates (Jasper's quick-picks), never an inline dump.
- The guard is unchanged: a popover/tooltip is never the only home of something that
  changes a decision.

### The engine — `packages/engine/src/create/`

New orchestrator, **no new generation code**: it dispatches to the family engines that
exist and records the run.

- `CreateBrief` (contracts): `{family, prompt?, context? (Intel CreateContext),
  platforms[], sourceRefs[] (grounding picks), mediaRefs[] ({ref, role: "use"|
  "reference"}), wizard? (slot values)}`.
- `CreatePlan` (derived, deterministic): resolved platforms + per-platform capability
  verdicts (D0 matrix), judge gate list, discoverability terms, family plan (video:
  beats estimate + mint-cost preview; post: variant list honoring blog-mirror pairing;
  email/page: their existing shapes). Plan derivation is pure and unit-testable.
- `runCreate(brief, deps)`: plan → dispatch (post→`fanout`, video one-prompt→
  `origination`, video staged→`direction`, email→compose, page→`webpage`) → collect
  child ids → `create_runs` row. Judging stays where it lives today (inside the family
  engines); the orchestrator never bypasses it.
- **Reference-role media**: a `describeReference` step (gateway vision call, metered,
  plan-visible) extracts style/subject notes that thread into the family prompt as
  grounding text — the license-clean *similar-but-different* doctrine from the
  template method. Reference bytes never enter drafts or the public-asset door.

### Data (contract window, additive)

- `create_runs`: tenant id, brief (jsonb), plan (jsonb), family, status, child refs
  (fanout run id / video project id / email id / page artifact id), timestamps.
  Existing `fanout_runs` etc. untouched.
- Media refs gain optional `role` meta (absent = today's behavior, i.e. "use").
- `platform_routing` config block (tenant-scoped, in the brand-profile config family):
  family → default platforms. Demo default = Kompozy's table: video→YT/TT/IG/FB ·
  image→IG/LI(/Pin later) · text→LI/FB/X/Bluesky · blog→own site · email→list.
- First slice of **D3 settings schemas** (zod, contracts): the per-platform settings
  the Composer rail renders. Start with the five connected platforms; shape follows
  the D0 matrix + Postiz DTO *pattern* (never their text).

### Surfaces (design is lead-direct; sheets before build, founder verdict between)

1. **Create home** (`Create.dc.html`, update): hero kept; wizard door beside it
   ("Start guided"); Latest runs → run rows that reopen the Composer; Jasper-style
   task shortcuts seeded from Intel picks.
2. **Create wizard** (new sheet): Jasper's accordion rail beside a live brief-artifact
   (not page-stepper) — slots: What (family+topic, Intel-prefilled) → Platforms
   (routing-prefilled, capability notes per chip) → Sources & media (Library/Intel
   picks; Leonardo-style media dialog: Uploads / Generations / Library; Runway-style
   role chips on each attach) → Review plan (HubSpot outline pattern + cost preview)
   → Generate. Progress while generating = Profound's checklist, honest durations.
3. **Composer** (sheet exists, s86): gains the run scope (header names the run, tab
   set = run platforms), the generating→ready state, and the AI-edit door beside the
   edit rail. Popout preview state = pass 3 (already queued).
4. Routes: `/app/create` (exists) · `/app/create/run/[id]` → Composer scoped to run.
   The Approve re-entry links here.

### Video + Postiz specifics (founder: "of course include")

- Wizard video family = the **advanced staged mode** the 2026-07-05 doctrine promised:
  its plan step IS storyboard/direction prefill (existing `direction/` engine);
  one-prompt video stays on the hero. After render, the run's Composer video tab
  carries the D3 *video* settings variant — cover frame (drawn s86) + YouTube
  title/thumbnail/made-for-kids + TikTok privacy/duet/stitch on their own tabs.
  Editor craft (Descript script-first evaluation, VEED timeline) stays in the video
  arc's own passes — Create hands off at the dossier, it does not absorb the editor.
  **The video arc has its own spec — `docs/video-arc/spec.md` — whose §Joins names
  the three Create↔Video links (video family in · rendered cuts as use-role media ·
  the waterfall Repurpose door).** The two specs share the D3 settings slice; it
  ships once.
- Postiz takes routed here: D3 settings schemas (this spec pulls the first slice
  forward), per-channel preview (the Composer IS it), validity rules pre-generation
  (R3). Deferred to D3 proper, unchanged: mention autocomplete, judge-gated evergreen,
  RSS-in, short-link seam (stealth call). D2 analytics feeds Composer stats later —
  the "stats" the founder named arrive when `publication_metrics` exists; until then
  the Composer shows fit/judge/capability only and says so.

## Decisions

1. **Composer position: after Generate, run-scoped; Approve re-entry secondary.**
   Alternatives: per-draft only from Approve (rejected: founder's stated flow), a
   modal inside Create (rejected: it's a full surface). Reversible (routing change).
2. **Wizard as accordion rail, not page-stepper.** Jasper pattern; keeps the artifact
   visible, matches the founder's "editing rail" instinct, and collapses gracefully to
   the Prompt hero. Alternative: HubSpot's full-page steps (rejected: heavier, hides
   context). Reversible. **AMENDED s90b by the founder's own later word (the
   minimal-interaction doctrine, programme file §mandate): the accordion stays and
   the page-stepper stays rejected, but "artifact always visible" softened to
   "artifact one click away" — the brief column was pure information, so it tucks
   behind a quiet line; the sheet of record draws it tucked. R6 unharmed: the plan
   still previews at Review before anything spends.**
3. **One orchestrator over existing engines, not a rewrite.** The family engines are
   proven and judged; Create adds brief/plan/record. Alternative: unify generation
   itself (rejected: high risk, no product gain now). Hard to reverse cheaply — keep
   the orchestrator thin.
4. **Media roles are two, explicit: use | reference.** Alternative: infer from
   context (rejected: silent inference on licensing-relevant semantics). Extending
   with more roles later is additive.
5. **Routing table lives in tenant config with Kompozy-shaped demo defaults.**
   Invariant-side: data, never code. Irreversible in spirit (product invariant).
6. **Assumption:** `create_runs` may reference children across families by id +
   kind rather than FKs into every family table — matches existing loose-coupling in
   runs surfaces. Flag at contract window if drizzle review disagrees.
7. **Deferred by choice, recorded (founder's "what's deferred and why"):**
   Linktree-style idea-cards divergence step (cheap ideas before generation — good,
   but adds a stage; revisit at wizard pass 2) · autopilot graduation ladder (needs
   approval-rate data → after D2) · platform-cadence gate at the producer (Schedule
   sheet already draws the pre-check; engine lands with D0 queue work) · Composer
   popout (pass 3, queued) · Descript script-first editor mode (video arc pass 2) ·
   mention autocomplete / evergreen / RSS-in / short links (D3 proper) · Composer
   stats (D2 dependency, honest absence until then).
8. **Rejected, so nobody re-litigates:** Blotato-style aggregator posting, cookie-
   extension posting, scraping identities (standing rules) · Rage-Bait/Controversial
   tone presets (Kompozy NOT-copying list) · marketplace (not our model).

## Invariants

- A fan-out never emits an ungated draft; the Composer's AI edit re-judges before a
  variant leaves. (AGENTS.md rule 4 — safety, never loosened.)
- Approve remains the human gate of record; nothing in Create/Composer publishes.
- Sequence gate untouched: bluesky-only test grant, per-platform GO, queue key EMPTY.
- Reference-role media never enters output artifacts or the public-asset door.
- Tenancy on every new table/config; brand/routing/settings are data.
- The sheets are the spec of record for surface chrome; a lane never amends a sheet.

## Error Behavior

- Plan derivation failures are refusals with reasons (unknown platform, disconnected
  channel, family/platform mismatch per matrix) — shown in the wizard before spend.
- Generation child failure: run records partial state; Composer shows the failed
  platform tab in words ("generation refused: <verbatim reason>"), others proceed.
- AI-edit judge rejection: the variant keeps its prior body; the refusal shows at the
  control (never a silent revert).
- Media import: unsupported type / oversize → refusal naming limits; a reference
  describe-call failure degrades to "reference attached, not yet analysed" (honest,
  non-blocking).

## Testing Strategy

- Plan derivation: pure-function suite (brief × routing × matrix → plan; every refusal
  reason pinned).
- Orchestrator: fake family engines; run row correctness; partial-failure recording.
- Media roles: reference never reaches draft mediaRefs (pin with a test whose comment
  says why); role serialization round-trips.
- Composer flow: run-scoped open, edit re-judge, Send-to-Approve lands in the queue
  (existing queue tests extended, not duplicated).
- Eval rows: every override/correction during dogfood becomes an eval row same-change
  (rule 6).

## Out of Scope

Publishing/arming changes · the video editor itself (own arc) · D2 analytics ingestion
(own phase; Composer degrades honestly) · D5 API/MCP exposure · billing/entitlement
enforcement beyond the existing seam · any landing-page work.

## Build order (proposed lanes/checkpoints — founder sequences)

1. **B-create.1 — contract window** (additive): `create_runs`, media `role`,
   `platform_routing` config, D3 settings-schema slice. Small, engine-only.
2. **B-create.2 — engine**: plan derivation + orchestrator + reference-describe seam
   (fake-driver tested, zero spend).
3. **B-create.3 — sheets** (lead-direct): Create home update + Wizard sheet + Composer
   run-scope states → founder verdict.
4. **B-create.4 — surface build**: wizard + run route + Composer wiring, exact-mock.
5. **B-create.5 — dogfood pass**: a real run end-to-end (bluesky test grant), eval
   rows, then the D3/D2 follow-ons under their own charter.

## Reconciliation ledger (what the research became)

| source | item | status here |
|---|---|---|
| Kompozy | routing table | **incorporated** (tenant config, demo defaults) |
| Kompozy | Persona Brief | **already ours** (brand profiles; no new work) |
| Kompozy | cadence gate | deferred → D0 queue engine (Schedule sheet draws it) |
| Kompozy | autopilot ladder | deferred → post-D2 (needs approval-rate data) |
| Kompozy | Blotato/X aggregator | rejected (official APIs; launch-gate note stands) |
| Postiz | 28 settings DTOs | **incorporated** as D3 slice (pattern only) |
| Postiz | per-channel preview | **incorporated** — the Composer is it |
| Postiz | validity pre-checks | **incorporated** (R3, D0 matrix surfaced) |
| Postiz | mention/evergreen/RSS/short-links | deferred → D3 proper (triggers in charter) |
| Postiz | analytics loop | deferred → D2 (Composer stats slot named, honest until) |
| Product frame 07-05 | one-prompt vs staged video | **incorporated** (wizard = staged mode) |
| s70c | blog-mirror pairing | **incorporated** (plan derivation honors pairing) |
| Template method | LOOK-FIRST / similar-but-different | **incorporated** (reference role semantics) |
| Mobbin s86 | outline-review, rail-wizard, progress checklist, media roles/dialog | **incorporated** (surfaces) |
| Mobbin s86 | idea-cards divergence | deferred (wizard pass 2, stated) |
