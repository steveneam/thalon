# Proposal: Leads engine — gated CRM + lead scoring (charter candidate)

_Status: PROPOSED 2026-07-13 · a candidate for the Sprint-7 checkpoint, competing for
priority against (or interleaving with) the visual-uplift phases — founder sequencing
call._
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
   outreach dogfoods it, rest next sprint.
2. First enrichment provider(s) to wire (BYO-keys shortlist to approve).
3. Outreach send path for dogfood (which operator mailbox/provider, volume comfort).
