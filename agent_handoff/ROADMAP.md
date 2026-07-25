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

### Phase 0 — ✅ EXECUTED s69 (2 of 3 LIVE; the X tail is platform-side)
**THE ENGINE'S FIRST LIVE SOCIAL POSTS (2026-07-25): LinkedIn
`urn:li:share:7486713895370256384` (image + @Anthropic org mention, posted as
the founder) · Facebook `197903966922661_122232823196050754` (image attached).
X refused PLATFORM-SIDE: HTTP 402 "credits depleted" on the dev app — a founder
console action (add/renew the X API credit allocation); the draft `a40e9c48`
stays approved + armed + image-attached, ONE publish call posts it when credits
exist. Then do the display-name check (first tweet's `source` field must read
neutral).** Lap details: tuning close (s69 commit `a5fdca3`) — g3-016 red-pin
LIFTED (3/3 + 4-sweeps green; s68 noise, final v2 unchanged) · two REAL screen
finds fixed in v4 (mechanism-vs-paraphrase collision g3-008 · topics-as-support
g3-006) · majority-retry runner (2-of-3, logged) → **32/32** · `491089d0`
unblocked by GROUNDING DEDUP not prompt churn (root cause of the s68 12-lap
record: the re-brief APPENDED a near-duplicate brief source; two ~same
instruction docs destabilize the final tier — ratchet candidate below) ·
LinkedIn pin was DEAD on first real use (202512 nonexistent; active set swept
live, pinned 202607, `isReshareDisabledByViewer` removed; commit `2b258f3`) ·
main-RED #4 fixed (`1420bc8`, oauth1 typecheck).

### Phase 1 — ✅ B-int.2 SHIPPED s70 (the Integrations surface, direct-to-main)
**Settings → Integrations is LIVE** — a card per destination grouped by what it
powers (Social · Your website · Outreach & newsletter · Intel), every card in a
frozen honest state; mode-2 guided connect flows (generic step lists + schema-derived
paste fields + validate-on-connect); on-demand Validate / Disconnect; **the s69
versioned-probe spec line landed in the engine seam** (LinkedIn validate now ALSO
fires the 426-vs-400 malformed-body pin proof — a dead LinkedIn-Version reads loud
in the probe detail, card untouched); **the PUBLISHED VIEW closes FEATURE-MAP's
`/blog` partial** (social ledger ⋈ web posts bundle, newest-first, way-back links
on every row — verified live showing all three s69 posts + the s67 article);
**env-override honesty badge** (X's env 1.0a posture reads "env override" instead
of lying "not connected" plain); probe-discovered identity now lands on the card
(validate stamps connectedAs). New doors: GET/POST `/api/integrations[...]`,
engine `cards.ts` + `published.ts`, repo `listRecent`. B-int.3 moves arming onto
tenant data next.

### Phase 1-next — B-int.3: driver rewire **[lane; founder lane-approval at the opener]**
Publisher/intel/outreach seams resolve credentials vault-first by tenant (the
production caller already does for social); per-platform arming becomes tenant DATA
(connected + tenant-armed) instead of env; refusal ladder keeps its shape. Meanwhile
the standing [lead-serial] alternative: **B-pub.4 blog images** (backlog below).

### Phase 2 — ✅ PILLAR #1 MINTED + RENDERED s70b (founder GO: kling3_0_turbo 1080p)
**`one-prompt-v1.mp4` is REAL: 42.3s @1080p, engine-rendered end-to-end**
(8 mints at exact-cue durations = the 94cr plan + two 10cr retakes = 114cr,
inside the 110–150 band; balance 584.12). The render went through the real
doors — with one gap found + ratcheted: one-prompt projects had NO sanctioned
media-root setter (`videoProjects.setMediaRoot` shipped, `53456b8`). Craft
lessons banked (prov.json + memory): kling reliably fabricates gibberish on
UI-semantic surfaces (buttons/checkboxes) — such beats are better FULLY
code-drawn (beat-06 was, $0); cornered pseudo-text on static regions takes a
deterministic patch (beat-07). **Founder verdict on the cut = the open tail**
(approve door ready; fix rounds ~10cr/beat).

### Phase 2b — WORKSPACE UI/UX OVERHAUL **[founder-directed s70b — phase 0 lane RUNNING]**
The founder's verdict: current look/flow "not working" — benchmark =
Supabase/Vercel-class; evaluate **Meta Astryx** (150+ components, theming,
CLI + MCP server, StyleX under) as the shadcn replacement. Phase 0 (lane
`ui-p0`, report-only) delivers `docs/research/ui-overhaul-plan.md`: Astryx
license/stack-fit verdict + benchmark teardown + surface-by-surface audit +
wave map. **The founder re-charters on that plan before any rebuild wave.**

### Phase 3 — ✅ EXECUTED s69/s69b (all three live; kept for the record)
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

### Phase 4 — (spec, ✅ absorbed into the shipped Phase 1 above) B-int.2 detail
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
- Post loop live per platform — **✅ LIVE s69 on LinkedIn + Facebook (the meme
  post, engine-authored end-to-end); X = platform credits (NEEDS-STEVEN). Post
  #2 = the queued Thalon intro [founder GO per post, unchanged].**
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
- **B-int.2 the surface** — ✅ SHIPPED s70 (Phase 1 above).
- **B-int.3 driver rewire** — **[lane — NEXT; founder lane-approval]** — publisher/intel/
  outreach seams resolve credentials from the vault by tenant; per-platform arming becomes
  tenant DATA (connected + tenant-armed) instead of env; refusal ladder keeps its shape,
  only the rung's source changes; dogfood tenant moves onto the vault (the surface's
  env-override badge then retires for vault-armed platforms).
- **B-int.4 OAuth-Connect (mode 1), per platform** — **[founder files partner-app reviews]** —
  callback routes + token exchange into the vault + auto-refresh, platform-by-platform
  as approvals land (LinkedIn → Meta → X). **Gated by THE LANDING** (needs hosted
  Terms/Privacy pages); mode 2 never removed. **s70 input (founder question): the Nango
  evaluation + the self-tenant OAuth pull-forward** — the founder's own apps already hold
  the scopes, so callback+refresh could work for the dogfood tenant BEFORE any partner
  approval; Nango (ELv2 — isolate + swap path if adopted) would supply the per-provider
  OAuth dances + refresh; it does NOT bypass platform review. **Swordfish ANSWERED
  same-day (FROM-SWORDFISH): they run self-hosted Nango for P2's drive connects,
  proven live; founder made them portfolio Nango owner; zero-SDK plain-REST shape
  keeps ELv2 out of this repo; standing offer = a Thalon-own instance at the
  B-int.4 kickoff, no new spend.** Full read:
  `docs/research/integrations-surface-plan.md` §Mode-1 automation check.

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

### Judge quality (s69: the tuning pass LANDED — remaining items below)
- **✅ s69 CLOSED the tuning arc (`a5fdca3`): screen v4 + majority-retry golden
  runner, 32/32.** What the lap proved: the cheap tier carries a few percent
  per-call verdict noise even on a settled prompt (three sweeps each flipped one
  DIFFERENT row; isolated re-runs green) — the runner now retries a first-attempt
  mismatch to a logged 2-of-3 majority, so golden:g3 pins doctrine, not coin
  flips. Two REAL screen defects fixed in v4: the mechanism rule now owns its
  collision with the paraphrase rule (part-by-part comparison; g3-008) and
  topics/tags/labels are explicitly never support (g3-006). g3-016's s68 red
  never reproduced — final v2 unchanged, 48/48 on the day.
- **NEW RATCHET CANDIDATE (s69, load-bearing find): re-brief must REPLACE the
  grounding pointer, not append.** Root cause of the s68 twelve-lap 491089d0
  record: `meta.groundingSourceIds` carried BOTH the original brief and the s68
  re-brief (near-identical texts, delta = one attestation block). Two ~same
  instruction documents destabilize the final tier — objections drift lap to
  lap, each contradicting the prompt's own rules (one lap discounted "the
  instruction portion" of a chunk that stated the claim VERBATIM; the next
  rejected "two months" against the prompt's own worked example). Deduped to
  the superset brief → both tiers pass, first lap. Executable home: the
  re-brief/edit path replaces the source id; belt-and-braces = judge-time dedup
  of near-identical chunks. The "operator brief as grounding" doctrine question
  (s68) stays open but got evidence: the tier invents an instruction-vs-fact
  distinction under duplicate pressure.
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
- **Platform charLimit is UNENFORCED (found s68; s69 sharpened it):** x.v1.json
  declares 280 but neither generation nor any gate checks it — a 600-char X draft
  once sailed to queued, and the LIVE X draft `a40e9c48` sits at EXACTLY 280
  (zero margin; one em-dash is weight-1 under X's counting so it fits, but
  nothing in the engine knew that). Ratchet candidate: a deterministic length
  gate reading the platform profile (belongs beside the judge, not in it), using
  X's weighted counting for the x platform.
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

## Recently shipped (last session — s70)
**B-int.2 THE INTEGRATIONS SURFACE** (Phase 1 above: cards + honest states +
guided mode-2 connect + validate/disconnect doors + the published view closing
the `/blog` partial + the s69 versioned LinkedIn probe + env-override honesty +
probe-discovered connectedAs) · Nango/mode-1 question answered + homed (plan doc
§Mode-1 automation check; swordfish asked) · token budget reset 7.25M→2M ·
verified live in the workspace against the real vault + the s69 ledger.

## Previously shipped (s69)
**THE FIRST LIVE POSTS: LinkedIn + Facebook published by the engine** (meme
post, image-attached, through draft→judge→approve→publishApprovedSocial; X
waits on platform credits) · **judge tuning arc closed** (screen v4 two real
fixes · majority-retry runner · 32/32) · **the 491089d0 mystery SOLVED**
(duplicate near-identical grounding briefs destabilize the final tier —
dedup unblocked it in one lap) · LinkedIn pin 202512→202607 live-swept +
field fix (first real versioned call found it dead) · main-RED #4 fixed
(oauth1 typecheck) · token day closed ≈7.1M (s68 3.5M + s69 lap ~3.6M;
cap raises documented in .env.local; month-end reset queued).

Prior sessions: `COORDINATION.md` close messages.
