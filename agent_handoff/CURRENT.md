# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-14 (session 28, syd4) · **B7.a cadence gate + B7.e routing table SHIPPED (PR #42) and the FIRST LEADS DOGFOOD IS LIVE ON STAGING** — tenant #0's ICP seeded (v3 after live term-hygiene fixes), 120 synthetic leads imported and ranked through the real deployed stack with real metered embeddings, **the ranked queue awaits the founder's review/triage**. The dogfood caught a real bug the same hour: every profile-editor save silently dropped the window-1 config blocks (icp/cadence/routing) — fixed, round-trip pinned, merged (PR #43). Swordfish provisioned a dedicated tenant Postgres on syd2 (drilled restore); migration assessed as "B0.5 finally lands", next-checkpoint rec. Suite of record **1094/3/0**; guard clean; CI green on both PRs.

## Resume prompt (session 29, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-14, session-28 wrap.

**Resume · Thalon** — session 29, syd4 — **meta-prompt review/plan first (founder recovered it; plan BEFORE tier purchase), then the approved →Email draft-only exit; next checkpoint carries B-crm.3–6 + Postgres migration.**

▎ ▸ **Read first:** `CLAUDE.md` → this file → `COORDINATION.md` Sprint-7 board + session-28 messages → `agent_handoff/FROM-SWORDFISH-2026-07-14.md` → `.context/leads-dogfood/README.md`.

▎ ▸ **State:** main = origin @ session-28 wrap (`cbcfd35` + board/handoff docs) · suite **1094/3/0** · staging auto-deployed at every main push · **staging tenant #0: ICP v3 active, 120 leads scored and ranked** (16 genuine matches = ranks 1–16, 3 planted dealbreakers = the only hard zeros, medians 0.93/0.66) · ICP-drift re-score proven live · profile-editor round-trip fixed (PR #43) · features lane closed for B7.a/e (`agent/features/b7ae` GC'd) · vendor-visual block still gated on the founder's meta-prompt · **gateway credit $14.65** (first judged generation no longer top-up-blocked; run the deferred judge-gate spend check at that first generation).

▎ ▸ **Session-29 plan (founder-directed at s28 close):** (1) **vendor meta-prompt review + plan** — the founder RECOVERED the build-method video's on-screen meta-prompt; he pastes it at session open → **archive verbatim in `.context/`** → review it and plan the deferred visual block (B7.2/7.3/7.4) — **planning only, zero vendor spend; the tier-purchase decision comes AFTER the founder reads the plan**; (2) **→Email draft-only exit (APPROVED pull-forward, proposal §Session-28 addendum)** — compose from lead DNA + `pain_point` through the one capture door, full judge gate (denylist · grounding · cadence), parks in the approve queue, operator sends manually; NO send path wired (B-crm.4's send half attaches behind the same approve door at the checkpoint; provider decided early: **Resend**, Thalon-domain identity — founder mailbox never the from-address, details gitignored `.context/outreach/identity.md`, **the mailbox contains guard token A — never in tracked files**); (3) founder's queue-review feedback folds into the proposal as it lands (triage rows = the B-crm.5 corpus seed); (4) if room: B7.c persona-brief editor · first judged generation on the $14.65 credit (+ the deferred spend check). **Term-hygiene note for anything ICP:** scorer `matchTerm` is v1 substring containment — full words beat bare codes ("AU" matched "aeronautical"; "agency" hard-zeroed "real estate agency"); word-boundary matching = a B-crm.5-checkpoint design question beside two-axis grading.

▎ ▸ **Next checkpoint (B-crm.3–6) additions:** Postgres migration = **"B0.5 finally lands"** (swordfish db live; `openDb` seam already refuses on `DATABASE_URL` naming B0.5; node-postgres branch + staging re-seed — cheapest BEFORE triage rows accumulate — then **RLS as the executable tenancy ratchet**) · B-crm.5 algorithm shortlist (research brief §5) + the matchTerm question · B-crm.3 enrichment-provider + B-crm.4 outreach-mailbox founder decisions.

▎ ▸ **[founder] queue:** **paste the recovered meta-prompt at session-29 open** (tier subscription decision comes after the plan) · **review + triage the staged leads queue** (`preview.swordfish.cfd/app` → Leads; edge auth unchanged) · ICP v3 edits welcome any time (term-hygiene note above; the editor now carries icp through saves) · at the checkpoint: B-crm.3 enrichment provider · B-crm.4 Resend domain-vs-stealth timing (provider itself decided).

▎ ▸ **Standing:** stealth holds · founder `.env.local` edits arrive BOM+CRLF — normalize · `[Steven via hermes-relay]` = founder; relay turns end founder-readable · any lane/subagent launch needs fresh founder go · `.env.tenant-pg` (repo root, gitignored) = the syd2-only Postgres credential — never tracked, never ask for a public port.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: PRs #42/#43 merged, main pushed incl. board/handoff docs; staging deployed at `cbcfd35`; no open PRs; no worktrees; branches GC'd; no mid-edit state. The dogfood corpus + ICP seed + staging profile history live in gitignored `.context/leads-dogfood/` with provenance in its README.

## Pointer

Read in order: `CLAUDE.md` → this file → `COORDINATION.md` (Sprint-7 board + session-28 messages) → `agent_handoff/FROM-SWORDFISH-2026-07-14.md` → `.context/leads-dogfood/README.md` → leads proposal §Session-27 addendum.

## Delta (session 28)

- **B7.a + B7.e merged (PR #42, 3 commits + 31 tests)**: cadence gate beside denylist/grounding (queue-admission counting off the I4 events spine via new read-only `drafts.listQueueAdmissions`; absence disarms at every level; gate named `cadence` per the descriptive precedent) · routing table at fan-out (`bucket` on `FanoutRequest`; routing entry replaces platforms; provenance on run params; generation key stays platform-derived) · importer dialect rider (`Email 1` · `Company Notes` · `projectDescription`) from the morning's header survey (AWS Partner Central = field dictionary, not data; datablist = the usable synthetic sets).
- **Dogfood executed on staging** (the founder-approved corpus plan, refined after reading the real ICP): hand-written `icp-shaped-20.csv` + transformed `lead-scoring-100` → 120/120 scored → honest spread with verbatim reasons; ICP v2→v3 term-hygiene fixes proven by re-score. Datablist gibberish sets stayed local (mechanics already CI-proven; no corpus pollution).
- **PR #43**: profile editor was silently dropping icp/cadence/routing on every save (wire omission + form rebuild) — found the hour it could first bite, fixed with wire pass-through + form `carry`, pinned both directions.
- **Swordfish channel**: dedicated tenant Postgres live (note committed at `agent_handoff/FROM-SWORDFISH-2026-07-14.md`); assessment + migration rec recorded on the board.
- **Gateway credit corrected to $14.65** (founder, mid-session; memories updated — the stale $4.9 is gone).

## Next action

Session 29 (founder-directed): meta-prompt archive + vendor-visual review/plan (tier decision after) → →Email draft-only exit → queue-review feedback folding → B7.c/first-generation if room. Founder at open: paste the meta-prompt; at his pace: triage the staged queue · ICP edits.
