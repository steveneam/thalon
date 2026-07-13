# Proposal: Leads engine — gated CRM + lead scoring (charter candidate)

_Status: **APPROVED 2026-07-13** (session-26 checkpoint, amendment A16 / ADR 0008) —
B-crm.1+2 interleave late in Sprint 7 so the portfolio outreach dogfoods them;
B-crm.3–5 queue for the next checkpoint. Detailed B-crm.1+2 build plan appended below
(§Build plan)._
_Inputs: founder idea 2026-07-13 ("CRM component: onboarding + ranking/scoring leads
with contact details against our criteria/profile") · same-day landscape research
(open-source CRMs, Clay-pattern enrichment, cold-outreach tooling) · the engine's
existing primitives._

## Why

The engine's spine (profiles, scoring-with-reasons, judge → approve gating, multi-tenant
data) currently points only at content. Pointed at revenue, the same spine is a lead
engine: capture a contact, enrich it, score it against the operator profile, and draft
outreach that passes the same judge and approval queue every other draft passes. Four
primitives already exist in the repo — the public waitlist POST (inbound lead capture,
live on the landing), per-tenant operator profiles (the criteria source), the trend
ranker's plain-language-reasons scoring pattern, and the draft→judge→approve pipeline.

The differentiation is the gate. The cold-outreach market's open-source tier is
immature and its commercial tier (Smartlead/Instantly-class) competes on volume and
deliverability tricks. Nobody credible competes on **quality-per-send with an
approval gate and grounded, profile-true drafts** — which is Thalon's entire stance
applied to bizdev. "No ungated contact, ever" is both the safety rule and the pitch.

**Dogfood synergy with Sprint 7:** the template-portfolio outreach (Sprint-7 Phase 5,
founder-led) is itself a lead pipeline — prospect local businesses per vertical, score
against a "good template client" profile, draft gated pitch emails. The first tenant of
the leads engine can be us selling the portfolio.

## Shape (one pipeline, five seams)

```
intake → enrich → score-vs-profile → gated outreach → learn
```

1. **Intake** — tenant-scoped `leads` table + repo; sources: the existing waitlist
   (bridge its POSTs into leads), CSV import, and official-API sources only (same
   acquisition rule as trend intel — no scraping, no purchased lists).
2. **Enrich** — an `EnrichmentSource` driver seam (mirrors TrendSource/AssetSource):
   waterfall across providers, bring-your-own API keys as per-tenant config, every
   provider a swap path. Enrichment results are data with provenance, never baked in.
3. **Score** — criteria derived from the operator profile (ICP fields join the profile
   schema); every score ships with readable reasons, graded with the same explicit
   thermal language the intel cards use (hot/warm/stale). No black-box numbers.
4. **Gated outreach** — email drafts generated per-lead through the existing
   draft→judge→approve queue; the judge gains compliance checks as first-class rules
   (denylist, suppression list, unsubscribe line present, CAN-SPAM/GDPR fields).
   Sending is operator-configured (their SMTP/provider credentials as tenant config)
   and only ever fires from an approved card. No warmup farms, no inbox rotation
   tricks.
5. **Learn** — approve/override/reply outcomes become eval rows in the same change
   (repo rule 6); score weights tune against them.

## What the research says to borrow (and what not to)

- **Atomic CRM (MIT, marmelab)** — the one embeddable-license codebase; borrow data
  model + UI shapes freely.
- **Twenty (AGPL core)** — *reference-only, never embed*; study its lead object model
  and its **native MCP server** (an agent-facing CRM API is where this converges with
  our own architecture).
- **EspoCRM / Frappe CRM (GPL-family)** — reference-only; feature checklists.
- **Clay-pattern repos** (enrichment-kit, opengtm, YALC) — the waterfall/BYO-keys
  composition pattern; opengtm additionally overlaps our B6.8 AEO surface (ICP scoring
  + AEO health check) and deserves a teardown before we build B-crm.3.
- Do **not** borrow: scraping acquisition, deliverability-trick playbooks, anything
  AGPL/GPL beyond patterns.

## Buckets (sized, dependency-ordered)

- **B-crm.1 Leads spine** — table + repo + intake (waitlist bridge, CSV import),
  contract-window discipline. *Small.*
- **B-crm.2 Profile scoring + ranked queue** — ICP criteria in the profile schema,
  scoring with reasons, ranked lead cards in the workspace (heat grading). *Medium.*
- **B-crm.3 Enrichment seam** — `EnrichmentSource` driver + waterfall + BYO-keys
  config; one real provider + fake driver for tests. *Medium.*
- **B-crm.4 Gated outreach channel** — per-lead email drafts through judge/approve;
  compliance rules in the judge; operator-SMTP send from approved cards only;
  suppression + unsubscribe handling. *Medium-large; the publish-door reviews apply.*
- **B-crm.5 Learn loop** — outcomes → eval rows → score tuning. *Small.*

B-crm.1+2 alone already deliver the founder's ask (onboard + rank/score); 3–5 make it
a product feature.

## Explicitly not doing

Scraping or purchased lists · auto-send without human approval (no "autopilot" for
outreach until the graduation-ladder bucket exists AND the founder arms it per-tenant) ·
deliverability tricks (warmup farms, rotation) · embedding AGPL/GPL code · storing
enrichment-provider data beyond what the provider's terms allow.

## Success criteria

B-crm.1/2: a CSV of contacts + the self profile → ranked lead queue with readable
reasons, suite green, tenancy grep-proven. B-crm.4: zero paths from draft to send that
bypass the judge + approve click (grep-proven like the other publish doors); compliance
rules carry eval rows.

## Founder decisions needed at the checkpoint

1. Priority: interleave with Sprint 7 (B-crm.1+2 are contract-window-sized) vs. queue
   as Sprint 8 — recommendation: **B-crm.1+2 late in Sprint 7** so the portfolio
   outreach dogfoods it, rest next sprint. → **APPROVED 2026-07-13 (A16).**
2. First enrichment provider(s) to wire (BYO-keys shortlist to approve). → *Deferred
   with B-crm.3 to the next checkpoint.*
3. Outreach send path for dogfood (which operator mailbox/provider, volume comfort).
   → *Deferred with B-crm.4 to the next checkpoint.*

---

## Build plan — B-crm.1+2 (appended at approval, 2026-07-13 / A16)

### Contract-window items (join Sprint 7's ONE window, opened at B7.3)

New schema file `packages/db/src/schema/leads.ts` (additive; tenancy ratchet covers it
automatically via the tenant-id schema test):

- **`leads`** — `id` · `tenant_id` (FK, not null) · `source` enum
  `waitlist | csv | api` · contact fields (`name` · `email` · `company` · `role` ·
  `website` · `notes`, email required) · `email_hash` (normalized, the dedupe key) ·
  `status` enum **`new | scored | dismissed`** (deliberately minimal — the
  contacted/replied lifecycle arrives with B-crm.4's state machine, additive) ·
  `meta` jsonb (source-specific extras: waitlist referral context, CSV row remainder) ·
  timestamps. Unique `(tenant_id, email_hash)` — import idempotency made structural,
  the `waitlist` table's pattern. Hot-path indexes `(tenant_id, status)` ·
  `(tenant_id, created_at)`.
- **`lead_scores`** — `id` · `tenant_id` · `lead_id` (FK) · `score` · `reasons` jsonb
  (one readable string per armed signal — the ranker convention) · `signals` jsonb
  (per-component values, for tuning) · `profile_hash` (hash of the ICP block that
  produced the score — re-score on profile change is detectable, cache-key style) ·
  `scored_at`. Append-only like `trend_snapshots`: scoring history accrues, the queue
  reads the latest per lead. Index `(tenant_id, lead_id, scored_at)`.
- **ICP block on the profile schema** (contracts + `brand_profiles` config): optional
  `icp` object — `description` (free text, the embedding target) ·
  `verticals: string[]` · `regions: string[]` · `roles: string[]` ·
  `companySize: {min?, max?}` · `dealbreakers: string[]` · per-tenant
  `leadRankerWeights` (defaults mirror `rankerWeightsSchema`'s shape). Additive and
  optional: tenants without an `icp` block simply have no lead scoring armed.

### B-crm.1 — Leads spine (small)

- `packages/db/src/repos/leads.ts` + `lead-scores.ts`: insert-or-return-existing on
  the dedupe key (waitlist repo pattern) · status transitions guarded (only
  `new→scored`, `*→dismissed` for now) · every state-changing write emits an `events`
  row (the B4.4 coverage test enforces this the moment the repo exists).
- **Waitlist bridge** (`packages/engine/src/leads/intake.ts`): pure function from
  waitlist rows → lead candidates (source `waitlist`, referral context into `meta`),
  driven by an idempotent sync job — re-running bridges only new signups (dedupe key
  does the work). Auto-bridge per tenant, on by default for tenant #0 [question 3
  below].
- **CSV import**: server-side parse (header-mapped: name/email/company/role/website/
  notes; unknown columns → `meta`), normalize + hash emails, per-row
  insert-or-skip with a returned import report (`added/duplicate/invalid` counts +
  row-level reasons). No file persistence — parse, ingest, discard.
- Tests: repo CRUD + tenancy + dedupe · bridge idempotency (run twice, second run
  adds zero) · CSV edge cases (BOM, quoted commas, missing email, dup within file).

### B-crm.2 — Profile scoring + ranked queue (medium)

- `packages/engine/src/leads/scorer.ts` — **pure tested math, the
  `trend/ranker.ts` shape reused**: components in [0,1], weight-normalized sum over
  ARMED signals only (a lead with no website disarms relevance rather than dragging
  the score), reason string per armed signal. Components v1:
  - `relevance`: embedding similarity (lead's `company + role + notes + website-title`
    text vs `icp.description`) — embeddings via the existing platform embedding tier;
  - `fit`: deterministic structured matches (vertical/region/role hits, dealbreaker
    = hard zero with its own reason);
  - `completeness`: fraction of contact fields present (a proxy until B-crm.3
    enrichment arms real firmographics);
  - `recency`: freshness half-life on `created_at` (saturating form, ranker
    convention).
  Scoring inputs are **intake-provided fields only** in this cut — no fetching, no
  enrichment calls (that is B-crm.3's seam; the component design leaves `fit` ready
  to consume enriched firmographics without re-shaping).
- Scoring runs as a deterministic job (score all `new`/re-score on `profile_hash`
  drift), writes `lead_scores`, flips `new→scored`. **No LLM call anywhere in
  B-crm.1+2** — zero gateway spend, judge untouched (the judge enters with B-crm.4's
  outreach drafts).
- **Workspace surface** (`apps/web`): a Leads queue — ranked cards with the thermal
  heat pills (hot/warm/stale, the system-wide grading), per-card reasons, actions:
  **dismiss** (→ eval row: operator override of the ranking) · **mark hot** (pin +
  eval row) · CSV import + "sync waitlist" affordances. One web writer rule applies
  if lanes are live.
- Eval: dismissals/pins land as eval rows in the same change (rule 6); the golden
  set seeds from the first dogfood pass over the founder's real prospect list.
- Success gate (unchanged from §Success criteria): CSV + self profile → ranked queue
  with readable reasons; tenancy grep-proven; suite green.

### Founder answers (2026-07-13, same session — all three resolved)

1. **ICP draft: lead drafts, founder edits.** Seed draft in §ICP below; it becomes
   tenant #0's `icp` block verbatim when the contract window opens.
2. **No existing contact list.** The importer aligns with the de-facto CRM
   import/export column conventions (HubSpot-style contact headers first — the
   format every list-export tool speaks — with Salesforce/Pipedrive/Atomic-CRM
   header aliases mapped); a verification pass against real template files from
   the web happens at B-crm.1 build time. Our own minimal template ships too.
3. **Waitlist auto-bridge: approved** — every signup auto-becomes a lead (dismissal
   is one click). NOTE the founder's wider framing: waitlist is only the first
   intake — see §Discovery below.
4. **Bulk actions**: the leads queue ships multi-select + mass dismiss/edit from
   day one — and this is now a Thalon-wide QoL convention, recorded in
   `docs/FRONTEND.md` §0 (extend the B1.4 batch-approve pattern, never per-surface
   reinvention).

### ICP seed draft — tenant #0 "good template client" (founder to edit)

- **description** (the embedding target): "Owner-operated local service business
  (1–20 people) with weak or no web presence, in a vertical where a polished
  single-page site plus steady social content visibly wins customers. Decision-maker
  reachable directly (owner/GM). Values speed and done-for-you; no in-house
  marketing. Sydney/AU first, then EN-speaking markets."
- **verticals**: the Sprint-7 portfolio list (trades/plumbing/electrical/HVAC ·
  food/café/restaurant · grocer · beauty/salon · health/fitness · real estate ·
  auto · cleaning · landscaping · pet services · photography · education/tutoring —
  the ~25-vertical set, weighted toward the pilot three).
- **regions**: AU (Sydney metro first) · NZ · then EN-speaking.
- **roles**: owner · founder · general manager · marketing manager.
- **companySize**: 1–20.
- **dealbreakers** (hard zero + reason): franchise HQ / enterprise chains ·
  agencies reselling to their own clients · adult/gambling · anyone demanding
  guaranteed rankings (honest-claims rule) · contacts of unknown/scraped
  provenance (structural anyway).

### Discovery — the launch-shape framing (founder, 2026-07-13)

The founder's product frame: at full launch the CRM is a **client-facing tool
Thalon's tenants use to FIND customers**, not just to rank inbound contacts.
"Based on what" = **the ICP block** — the same criteria that score inbound leads
generate discovery queries (verticals × regions × roles), exactly how monitored
areas drive trend sweeps. Candidate **B-crm.6 (next checkpoint): `LeadSource`
discovery seam** — ICP-derived queries → official-API prospecting sources only
(Google Places/Business Profile APIs, government business registries — e.g. the
AU ABN lookup API — professional directories that offer real APIs) → intake with
per-lead source provenance → the same B-crm.2 scorer. The acquisition invariant
is unchanged and non-negotiable: official APIs or operator-supplied data, never
scraping, never purchased lists. Discovery is what makes tenant #0's dogfood the
product demo: "Thalon found, scored, and drafted — you approved."
