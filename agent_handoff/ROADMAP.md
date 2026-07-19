# ROADMAP — Thalon forward plan (the "gogogo" work list)

> **This is the plan of record.** `gogogo` (a fresh session with no other prompt)
> boots via `agent_handoff/CURRENT.md`, which points here. **Work down the
> Recommended sequence below, top to bottom.** Items marked **[lead-serial]** need
> no founder input — start them immediately. Items marked **[founder GO]** need his
> word: present them at the opener and proceed on his reply, but **never block** —
> always have a [lead-serial] item in flight.
>
> **One home.** This file owns "what to do next + the full open backlog." `CURRENT.md`
> owns the boot pointer + last session's delta. `NEEDS-STEVEN.md` owns open founder
> actions. `COORDINATION.md` owns live lane state + the append-only history. Update
> this file at every wrap: move shipped items to "Recently shipped", re-rank the rest.

---

## Recommended sequence — next session

Ordered by what I'd actually do. Phase 1 is buildable with zero founder input, so
`gogogo` always has productive work; Phases 2–3 are his GOs, surfaced at the opener.

### Phase 1 — B-int.1: the vault core **[lead-serial — START HERE]**
The natural continuation of the frozen B-int.0 window (PR #66). Build envelope
crypto behind the already-frozen `tenantCredentials` doors:
- AES-256-GCM per-row data key, wrapped by `THALON_VAULT_MASTER_KEY` (env, already
  in the schema); Node built-in `crypto`, $0/self-hostable; cloud KMS is the
  recorded swap path behind the wrap/unwrap seam.
- The vault's `seal`/`open` functions the repo doors call (repo validates shape,
  crypto layer seals/opens — the split is already designed in the B-int.0 comments).
- A read-only **validate-ping** seam (per-destination probes that flip a card to
  `connected`/`needs_reauth`) and **redaction ratchets** (a secret must never reach
  an event, log, error, or API response — extend the b-int0 redaction pin).
- Move the self/dogfood tenant onto the vault (env arming stays as emergency
  override) so Thalon's own launch runs the exact path a client will.
- Detail: `docs/adr/0011-integrations-surface-charter.md` · `docs/proposals/2026-07-19-integrations-surface.md` (B-int.1 row).

### Phase 2 — Pillar #1 mint + render **[founder GO — present at opener]**
Deferred by founder call until the loops proved end-to-end; they now have (blog live,
post caller wired). The video chain (project / planned takes / EDL / cut) sits
planned + judged in the DB.
- Present the per-take **cost plan first** (`get_cost` each; ≥40cr = ping the founder).
- On his GO: mint the takes → box-local `$0` render.
- Standing mint rules live in memory (`higgsfield-kompozy-assignment` + the standing
  mint-discipline notes): text-in-scene = text-precise seat, soul-2 letters, hero =
  best roster model, reference-guided minting doctrine.

### Phase 3 — Post loop goes live, per platform **[founder GO — LinkedIn first]**
The production caller is wired (`POST /api/drafts/[id]/publish-social`, disarmed).
Arming each platform is the founder's:
- his `SOCIAL_<P>_ACCESS_TOKEN` + `SOCIAL_<P>_ARMED="true"` + the platform in the
  tenant's social block;
- **before the first real post** (checklist `WRAP-pub2-drivers.md` §Before-a-first-live-post):
  re-verify the two API version pins (LinkedIn `202512`, Graph `v23.0` — both checked
  live-good s67) + make the LinkedIn Little-Format escaping call.
- One reviewed test post each; his call every time. Stealth holds otherwise.

### Phase 4 — B-int.2: the Integrations surface **[lead-serial — after Phase 1's seam lands]**
Settings → Integrations, once the vault core exists:
- A card per destination grouped by what it powers (Intel · Social · **Your website** ·
  Outreach/Newsletter), honest states (not-connected / connected-as-@handle /
  needs-reauth / expiring / plan-gated / review-pending — the frozen card-state vocab).
- Guided-manual (mode 2) connect flows: step list + paste fields + validate ping,
  authored generic/platform-neutral (nothing copied from gitignored notes).
- The **published-view** joining the social ledger + web deployRefs — this closes
  FEATURE-MAP's `/blog` "partial" (no workspace path to what got published).

---

## Full open backlog (everything that needs doing)

Grouped by stream. Each item: **[owner/gate]**. Nothing here is lost between sessions.

### Content origination (the loops)
- Pillar #1 mint + render — **[founder GO]** — Phase 2 above.
- Post loop live per platform — **[founder GO, per platform]** — Phase 3 above.
- Public `/blog` unwire → wire — **[parked: the launch call]** — stays staging-side until
  the founder says go public (stealth: thalon.org unwired, CT-log risk).

### Integrations (ADR 0011 — the sprint's big build)
- **B-int.0 contract window** — ✅ FROZEN (PR #66, migration 0018).
- **B-int.1 vault core** — **[lead-serial]** — Phase 1 above.
- **B-int.2 the surface** — **[lead-serial after B-int.1]** — Phase 4 above.
- **B-int.3 driver rewire** — **[lane after B-int.2]** — publisher/intel/outreach seams
  resolve credentials from the vault by tenant; per-platform arming becomes tenant DATA
  (connected + tenant-armed) instead of env; refusal ladder keeps its shape, only the
  rung's source changes; dogfood tenant moves onto the vault.
- **B-int.4 OAuth-Connect (mode 1), per platform** — **[founder files partner-app reviews]** —
  callback routes + token exchange into the vault + auto-refresh, platform-by-platform
  as approvals land (LinkedIn → Meta → X). **Gated by THE LANDING** (needs hosted
  Terms/Privacy pages); mode 2 never removed.

### The landing + visual arc **[founder sequencing call]**
- Visual arc HOLDS at 20 sites ("leave the landing pages at this for now").
- Checkpoint tail awaiting his sequencing: **the A+ animation family** (bloom-transition
  video · Orchard seasons-tree scroll · Wagtail scroll-dog) · **B-sitegen** (see below) ·
  **THE LANDING itself** (built last; the skill-compound target; also gates B-int.4's
  mode-1 filings, so it sequences before OAuth-Connect).

### Judge quality (observed s67, not blocking)
- Judge-prompt tuning candidate: the FINAL tier is over-strict on truism claims
  (golden g3-004/005 fail though expected pass) AND lenient on the invented-mechanism/
  topics class (g3-006/008 pass though expected fail) — a real tension worth a
  golden-guided prompt pass. **[lead-serial, low priority]** · `golden:g3` stays non-CI.

### Checkpoint decisions (COORDINATION row 4) **[founder, next checkpoint]**
- **B-sitegen charter candidate** — the meta-prompt behind Create's page family; input
  scope expanded s61 (prompt | URL-DNA extraction | template pick + purpose block +
  intel/lead autopopulate). Detail `docs/research/sites-surface-plan.md` §6.
- **Entitlements / tier-gating** — per-tier availability must be EASY TO FLIP (flags as
  config-data, per-tenant overridable; templates + CRM default to highest-tier). A
  contract-window schema candidate, not a build stopper.
- **Object-store durability** — DECIDED: VPS-local for now; AWS/S3 migration parked with
  an explicit trigger (real traffic/customers); the platform seam stays fail-loud.
- Also open: cache exemption · B-rls.2 charter candidate · standing scratch-admin role ·
  ms-fidelity caveat.

### CRM / outreach
- **B-crm.4 live send GO** — **[founder GO + the s28 stealth question]** — door built + merged,
  disarmed (`RESEND_API_KEY` + `OUTREACH_SEND_ARMED` both unset); needs Resend domain
  setup + the brand-domain-reveal decision (accept / neutral domain / wait).

### Ops / infra tails **[swordfish + founder]**
- Preview basicauth rotation + `DB_DUMP_TOKEN` retirement — founder-gated console pass,
  queued swordfish-side; lead swaps CI `STAGING_EDGE_AUTH` when the pair lands.
- db-dump route code removal — checkpoint cleanup candidate.
- GitHub Actions billing — DOWN until the monthly renewal (~Jul 24, founder decision);
  every push locally verified meanwhile; staging won't auto-redeploy until then.
- Concept film staging import — swordfish queued (transfer + import against tenant-pg).
- Dokploy templates-preview service + `TEMPLATES_PREVIEW_ARMED=true` — founder console,
  gives the workspace Sites surface a live origin (dev reads local meanwhile).

### Parked (charter-level, explicit triggers)
- AWS/S3 object-store migration — trigger: real traffic/customers.
- B6.7 domains launch · B-visual style-lock candidate (open-weight self-host + per-tenant
  LoRAs, cloud-GPU only) · film refine (revisit after the landing) · month-end credit call.

---

## Founder decisions outstanding
Live list in `agent_handoff/NEEDS-STEVEN.md`. At boot, none block starting Phase 1. The
GOs that unlock Phases 2–3 (mint cost-plan · per-platform live posts) arrive inline.

## Standing constraints (always in force)
Stealth (public /blog + thalon.org stay dark until the launch call) · hermes-relay =
founder · blanket workspace grant · **Mode B lanes on fresh founder approval** ·
`npm run verify` = the merge gate (10-min tool cap → split: suite backgrounded,
guard/typecheck/lint foreground) · ≥40cr mint ping · no AI attribution · wrap =
guard + commit + push + stamped resume prompt + this file re-ranked.

## Recently shipped (last session — s67)
Blog loop LIVE on dev (the ADR-0011 proof-of-product moment) · post-loop production
caller wired (disarmed) · **B-int.0 vault window FROZEN** (PR #66) · staged-flow live
projection · Settings discoverability · 3 judge eval rows. Zero credit spend. Full
per-session record: `COORDINATION.md` s67 close message.
