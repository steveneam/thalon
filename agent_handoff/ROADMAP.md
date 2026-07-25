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

### Phase 0 — FINISH THE TUNING LAP, THEN POST ALL THREE **[lead-serial + the recorded founder GO]**
s68 close state: the judge tuning pass CORE LANDED (final v2 + screen v3, goldens
8→16, **30/30 tier-verdicts** on rows 1-15, final tier perfect twice consecutively;
commit `7b81e6f`). ONE residual, golden-pinned red: g3-016 — the demonstrative
"This is the result" passes isolated but fails in full-post context. The day's
token rail fired twice (2M, then the documented 3.5M raise in .env.local — revisit
at month-end); the lap rides the fresh daily budget. **s69 sequence: (1) fix the
context-dependence lap → golden 32/32 → (2) re-judge LinkedIn `491089d0` (punchy
body WITH the founder's line is the stored state, currently blocked) → (3) attach
the meme image to all three drafts (store content-addressed → meta.mediaRefs;
image `.context/social/horse-meme-2026-07-25.png`) → (4) pre-post checks (version
pins · X app display name neutral · Little-Format call = authored-side, done) →
(5) set the three ARMED flags → approve → publish LinkedIn + X + Facebook in one
pass — the founder's GO is RECORDED (s68: "post all 3 together next session").**
Queued drafts: x `a40e9c48` · facebook `74d77abb` · linkedin `491089d0` (pending).

### Phase 1 — B-int.2: the Integrations surface **[lead-serial — after Phase 0]**
The vault core (B-int.1) SHIPPED s68 — its seam is live, so the surface unblocked.
See the Phase-4-shaped spec below (cards + guided flows + published-view); doors to
build against: `connectDestination` / `listCredentialCards` / `validateDestination`
/ `disconnectDestination` in `packages/engine/src/integrations/`.

### Phase 2 — Pillar #1 MINT GO **[founder GO — cost plan PRESENTED s68]**
The chain is GREEN end-to-end (s68 re-brief fixed the s67 judge fails): project
"Pillar: the honest content engine", 9 planned takes (8 motion beats + $0
code-drawn CTA card), EDL + draft cut in the DB. Cost plan presented at the s68
close (recommended lane: kling3_0_turbo 1080p ≈ 94cr; hero-bump + retake buffer
≈ 110–150cr; every take <40cr so no standing ping triggers). **On his GO: mint
the takes → box-local $0 render.** Standing mint rules in memory apply; all
on-screen text is code-drawn at render (s62 doctrine), never minted.

### Phase 3 — THE MEME POST to all three platforms **[founder: caption sign-off + GO]**
s68 (second half) built B-pub.3 end-to-end: **image legs on all three text drivers**
(LinkedIn Images API · X v2 media upload · FB Page /photos), X OAuth 1.0a
standing-arm mode (OAuth2 X user tokens die in ~2h), and the pre-surface connect
CLI (`scripts/connect-destination.ts`). Credential state: **linkedin + facebook
LIVE IN THE VAULT** (first real vault credentials; both validate-pings green) ·
X 1.0a seats in env (signed probe live) · master key set · tenant social blocks
already carry all three (1/day). The meme image is built
(`.context/social/horse-meme-2026-07-25.png`, 6cr) + caption draft beside it.
**Remaining = founder only:** caption/image sign-off → the GO word → lead sets the
three ARMED flags, runs the post through draft→judge→approve, engine posts to all
three at once. Before the real post: re-verify version pins + the Little-Format
escaping call (standing checklist). Post #2 = the queued Thalon intro.

### Phase 4 — (spec for Phase 1 above) B-int.2 detail
Settings → Integrations, now that the vault core exists:
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
- **B-pub.4 blog images** — **[lead-serial, founder-directed s68]** — the own-site
  door learns to serve object-store images publicly (route + page references), so
  blog posts carry the same visuals as social. The founder's destination framing:
  4 post/image surfaces (LinkedIn · X · Facebook · blog), Threads additive when
  its Meta product activates. The public image URLs this produces are ALSO the
  unlock for Threads + Instagram media later (both require image_url, not bytes).
  Posts and the blog stay UNLINKED (no cross-references; stealth trace-path
  confirmed clean s68 — the only post↔post/post↔blog connection is the internal
  ledger). One check pre-first-tweet: the X app's display name (tweet `source`
  metadata) must read neutral.
- Public `/blog` unwire → wire — **[parked: the launch call]** — stays staging-side until
  the founder says go public (stealth: thalon.org unwired, CT-log risk).

### Integrations (ADR 0011 — the sprint's big build)
- **B-int.0 contract window** — ✅ FROZEN (PR #66, migration 0018).
- **B-int.1 vault core** — ✅ SHIPPED s68 (envelope crypto + doors + validate-ping
  seam + redaction ratchets + vault-first social arming; dev pg has 0018 applied).
- **B-int.2 the surface** — **[lead-serial — NEXT]** — Phase 1/4 above.
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

### Exemplar acquisition — LEARN FROM THE CROWD (founder intent, s68 close)
- **The founder's stated goal (verbatim intent): the engine exists because "there
  might be people out there that would write a more clever/viral/hook/trending
  post than me" — exemplars should come from THE BEST EXTERNAL POSTERS, not from
  the founder's voice** (his voice_sample was the s68 quick unlock, seasoning not
  base). Work items, lead-serial: (a) ARM automatic outlier→exemplar admission
  (area config needs outlier knobs — engagement metric names, floors, velocity
  multiples; today's sweep: 221 polled, 0 ingested, tenant had zero exemplars
  ever); (b) COVERAGE honesty: Bluesky's area feed = news-bot headlines, not
  viral posts — the hook-pattern pool needs YouTube titles/hooks (already
  polled), possibly X search (PAID API gate — month-end credit call), and (c) a
  zero-cost operator drop door: the founder pastes posts he admires → ingestExemplar
  (the s68 CLI pattern; his curation, the crowd's craft). Retrieval side is done
  (CREATE_EXEMPLAR_K).

### Judge quality (observed s67, not blocking)
- Judge-prompt tuning candidate: the FINAL tier is over-strict on truism claims
  (golden g3-004/005 fail though expected pass) AND lenient on the invented-mechanism/
  topics class (g3-006/008 pass though expected fail) — a real tension worth a
  golden-guided prompt pass. **[lead-serial — PROMOTED s68: no longer low priority;
  the meme-post dogfood added ~6 live data points in one day, including an apparent
  final-tier MISREAD (draft `74d77abb` round-4: "inverts the horse labeling" against
  a draft whose order matched the source verbatim)]** · `golden:g3` stays non-CI.
  **s68 TERMINAL EVIDENCE (draft `491089d0`, 12 laps): the final tier's objection
  set is UNSTABLE — "The architecture stays put" passed unflagged in one lap and
  failed a later lap on verbatim-absence; and the tier REJECTED an operator-attested
  lived-experience claim WHILE CITING the attestation chunk that grounds it. No
  fixed point is reachable by minimal edits. The tuning pass is now LOAD-BEARING:
  it blocks the founder-directed punchy LinkedIn post. Golden-row set for the pass:
  55108b92 · 3ebd7de1 · 14e05fa3 · 74d77abb · 491089d0 (each lap = one row).
  Also decided s68: exemplar+voice fixed generation punch in ONE lap (the
  voice_sample of the founder's own rework was the unlock) — the drafting side
  needs no tuning.**
- **Platform charLimit is UNENFORCED (found s68):** x.v1.json declares 280 but
  neither generation nor any gate checks it — a 600-char X draft sailed to queued;
  the platform API would reject it at publish. Ratchet candidate: a deterministic
  length gate reading the platform profile (belongs beside the judge, not in it).
- **s68 evidence — the tiers SPLIT on operator-brief-sourced quantity claims:** the
  claim "one prompt becomes a week of platform-ready content" (verbatim in the
  operator's PROMPT source chunk) passed g3_screen citing that chunk in all three
  runs, but g3_final failed it twice consecutively (drafts `55108b92`, `3ebd7de1`;
  the one 05:12 pass was the outlier). Two open questions for the tuning pass:
  (a) final-tier consistency, (b) DOCTRINE: does the operator's own brief text
  count as grounding for product claims, or only identity/profile sources? The s68
  call: treat the final tier as right — quantity/time promises need real grounding,
  so the brief dropped "a week". Candidate golden rows both ways. Run 4 (draft
  `14e05fa3`) adds a LIVE truism case: g3_final killed the rhetorical address "You
  know your business" as ungrounded (the g3-004/005 over-strict class) — plus a
  correct catch of the draft re-introducing "three formats every week", enforced via
  the operator constraint text itself (constraints-in-the-prompt ARE enforceable
  grounding — worth keeping as doctrine). Runs 6-7 (the meme-post fan-out) add the
  clearest characterization yet — the ENTAILMENT class: g3_final refused "launched
  in May" against a grounded "2026-05-28" (month paraphrase) and "three releases
  in eight weeks" against three grounded dates (derived arithmetic). The final
  tier demands near-verbatim grounding; correct entailments fail. Fix-side
  doctrine: enrich the fact base with the entailed forms. Tuning-side: the golden
  pass should decide whether simple entailment (calendar containment, date
  arithmetic) is admissible grounding.

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
- GitHub Actions billing — ✅ RESTORED (founder, 2026-07-25): ci-guard re-ran GREEN on
  head; web-image re-run dispatched (staging auto-redeploy resumes with it). Local
  verify stays the merge gate; CI is the second net again.
- Concept film staging import — swordfish-side; fell out of their queue after the
  07-19 ACK, re-queued 2026-07-25 (their honest-ledger note), still unranked.
- ~~syd4 systemd units for 8899 + sweeper~~ — ✅ DONE swordfish-side 2026-07-25:
  `thalon-preview.service` + `thalon-sweeper.service`, linger on, reboot-safe;
  never hand-start either again (a second sweeper double-fires schedules).
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

## Recently shipped (last session — s68)
**B-int.1 vault core** (envelope crypto AES-256-GCM w/ AAD row-binding · connect/
open/cards/disconnect doors · read-only validate-ping seam, all 11 destinations ·
redaction ratchets incl. the log-free/env-indirect boundary scan · vault-first
social arming, env = emergency override; production caller now resolves vault-first)
· **pillar #1 chain GREEN** (re-brief fixed the s67 judge fails; 9-take plan + EDL
+ draft cut; cost plan priced via get_cost, zero mint spend) · **Actions billing
restored + verified** (ci-guard + web-image green; staging auto-deploy back) ·
systemd units for 8899/sweeper landed swordfish-side. Zero credit spend. Prior
sessions: `COORDINATION.md` close messages.
