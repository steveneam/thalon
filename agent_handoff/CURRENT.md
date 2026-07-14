# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-14 (session 29, syd4) · **Meta-prompt DELIVERED + vendor-visual plan FILED (`925e5dc`), then the →EMAIL DRAFT-ONLY SLICE SHIPPED (PR #44, `82f142e`)** — B-crm.4's front half live end-to-end: lead →Email exit → pruned-chips brief → full judge gate (denylist · cadence on `email` · G3×2 grounding) → approve queue with approved-gated copy-out; **no send path exists anywhere**. s28 dogfood riders (contact prominence + import-extras section) rode the same PR. Suite of record **1121/3/0**; guard clean; CI 9/9; auto-deploy fired. Founder called the vendor order: email slice first (done) → **Higgsfield subscription** → vendor block starts clean.

## Resume prompt (session 30, syd4 — paste verbatim; "gogogo" boots this too)

> Stamped 2026-07-14, session-29 wrap.

**Resume · Thalon** — session 30, syd4 — **vendor block opens when the founder confirms the Higgsfield tier (rec: Plus 1mo — plan at proposal §Session-29 addendum); zero-spend P0.1–P0.5 can start immediately; →Post generation wiring + the deferred spend check carries.**

▎ ▸ **Read first:** `CLAUDE.md` → this file → `COORDINATION.md` Sprint-7 board + session-29 messages → visual-uplift proposal §Session-29 addendum → `agent_handoff/FROM-SWORDFISH-SECURITY-2026-07-14.md`.

▎ ▸ **State:** main = origin @ `82f142e` (email slice merged; board/handoff docs follow at wrap) · suite **1121/3/0** · staging auto-deploys every main push · **→Email is live on staging but no LIVE compose has run yet** — the first judged generation (→Email compose or →Post wiring, whichever fires first) carries the deferred judge-gate spend check (gateway credit $14.65) · leads queue still awaits founder triage (120 ranked; triage rows = B-crm.5 corpus seed) · vendor-visual rows now `blocked:tier` only.

▎ ▸ **Session-30 plan:** (1) **vendor block on tier confirm** — founder subscribes (Plus 1mo rec), MCP reconnect on the paid workspace, then P0.1–P0.5 from the §Session-29 addendum (factory meta-prompt v1 → pass checklist → B7.2 shot-list → AssetSource window 2 → driver skeleton) before any minting; **B7.2 mint week order: images → pages → workspace → video-if-credits**; (2) **impeccable first run (founder-directed s29 close: installed, deliberately NOT run yet)** — skill live at `~/.claude/skills/impeccable` (v3.2.1, Apache-2.0); open with `/impeccable init` (writes PRODUCT.md + DESIGN.md at repo root — guard-safe wording, no company names) → `document` → `critique`/`audit` on the workspace (`/app` product register) → targeted `layout`/`polish`; **re-arm the detector hook per-project** (global manifest parked at `~/.claude/impeccable-hook.PARKED-2026-07-14.json` — its `${CLAUDE_PROJECT_DIR}` path needs the project-local form; hook = the executable ratchet, `npx impeccable detect` = a $0 deterministic CI-gate candidate); **don't invoke the `frontend-design` plugin in the same work** (vocabulary collision, upstream warning — founder may want it disabled while impeccable drives); its `layout`/`critique` flows spawn sub-agents → fresh founder go per standing rule (the skill itself says stop-and-ask); (3) **→Post generation wiring** (Create → fan-out → cadence → judge → queue; the s28 dogfood elevation) + run the spend check at the first live judged generation; (4) founder queue-triage feedback folds into the proposal; (5) if room: B7.c persona-brief editor. **Swordfish rotation**: when the `FROM-SWORDFISH` rotation note lands, swap the Dokploy CI secret + one confirm deploy (reply conventions already in ASK-BACKS; handshake ACKED by swordfish 11:25 UTC). **Box facts (11:25 note):** thalon-web memory cap now **4 GiB** (watch exit 137); box is 8 GB — render worker at 3–4 GB doesn't fit worst-case until the queued 16 GB resize (founder spend gate); sooner-worker fallback = queue-of-one + ~2 GiB (lead answer already in ASK-BACKS).

▎ ▸ **Next checkpoint (B-crm.3–6) additions unchanged:** Postgres migration = "B0.5 finally lands" (stronger every session — migrate BEFORE triage/eval rows accumulate; then RLS ratchet) · B-crm.5 shortlist + `matchTerm` word-boundary question · B-crm.3 enrichment provider · B-crm.4 Resend domain-vs-stealth timing.

▎ ▸ **[founder] queue:** **Higgsfield tier decision** (plan read → subscribe → say go) · **triage the staged leads queue** (`preview.swordfish.cfd/app` → Leads) · **dogfood the →Email exit on a real-ish lead** (compose → approve → copy-out; its verdict + your edits become eval rows) · at the checkpoint: B-crm.3 provider + Resend timing · swordfish asks: deploy-outage window pref recorded as "any time, not mid-merge" — veto in ASK-BACKS if wrong.

▎ ▸ **Standing:** stealth holds · founder `.env.local` edits arrive BOM+CRLF — normalize · `[Steven via hermes-relay]` = founder; relay turns end founder-readable · any lane/subagent launch needs fresh founder go · `.env.tenant-pg` = syd2-only Postgres credential (verified 0600 + gitignored) — never tracked, never ask for a public port · Dokploy deploy key stays CI-secret-only (rotation heads-up: security note above).

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: PR #44 merged; branch GC'd; wrap docs + swordfish note + ASK-BACKS reply committed on main; no open PRs; no worktrees; no mid-edit state. Verbatim vendor meta-prompt archived gitignored at `.context/design/build-method-meta-prompt-2026-07-14.md`.

## Pointer

Read in order: `CLAUDE.md` → this file → `COORDINATION.md` (Sprint-7 board + session-29 messages) → visual-uplift proposal §Session-29 addendum → leads proposal §Session-28 addendum → `agent_handoff/FROM-SWORDFISH-SECURITY-2026-07-14.md`.

## Delta (session 29)

- **Meta-prompt review + vendor plan (`925e5dc`)**: verbatim archive gitignored in `.context/design/`; §Session-29 addendum = five adoptable additions (design-axis draw · two-lane iteration pass · license-clean reference→regenerate · stakes framing · /guide route), explicit non-adoptions, zero-spend P0.1–P0.5, tier rec Plus 1mo. Board rows → `blocked:tier`.
- **→Email slice (PR #44, +27 tests)**: `outreach_email` format (window amendment 1c) · engine `outreach/` module (brief = generation input AND grounding; platform `email` arms B7.a cadence; new metered op `outreach.compose_email`, ratchets updated deliberately) · Create 4th family composing from surviving chips only · approve queue To/subject/body + approved-gated copy-out (clipboard/mailto) · riders: contact mailto prominence, import-extras section.
- **Swordfish security note received + answered**: Dokploy key's `canCreateServices` = larger-than-labeled blast radius on shared syd2; no leak evidence, no action today; coordinated signal-then-swap rotation coming; lead reply in ASK-BACKS (timing free, render-worker RAM provisional 3–4GB).

## Next action

Session 30: founder confirms Higgsfield tier → vendor block opens (P0.1–P0.5 zero-spend first, then B7.2 mint week) ‖ →Post generation wiring + first-generation spend check → B7.c if room. Founder at their pace: queue triage · →Email dogfood · tier call.
