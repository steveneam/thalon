# COORDINATION — lane board

> Parallel-lane ledger (protocol: `docs/SPINE.md` §5). **One writer per row** — the lead owns assignments + merge-order; each owner writes only its own `status`. Messages append-only. Status vocab: `pending · in_progress · blocked:<what> · review · merged`. **Contract** = `packages/contracts` + the drizzle schema — frozen per sprint once committed; a lane needing to edit it mid-flight = re-plan, not an ad-hoc edit. Merges serialize through `main` in merge-order: rebase → CI green (guard + lint + tests) → review → merge; never on red.
>
> **This file holds only live state** — active lanes, the gated work queue, fresh messages. Everything decided or shipped lives in **`COORDINATION-ARCHIVE.md`** (append-only history: every sprint's lane tables + all messages through the s53 close record). Wrap stamps = `agent_handoff/CURRENT.md` · founder actions = `agent_handoff/NEEDS-STEVEN.md` · swordfish asks = `agent_handoff/ASK-BACKS-FOR-SWORDFISH.md`. Link, don't copy (AGENTS.md rule 8).

## Active lanes

None. The s52 parallel grant covered exactly the s53 slate and is spent — **every lane/subagent launch needs fresh founder approval** (standing rule). No worktrees open as of the s53 wrap.

## Work queue (open items + their gates)

| # | item | gate / door | detail lives in |
|---|------|-------------|-----------------|
| 1 | **⑧ Crateline** (logistics / brutalist primary), then ⑨ ⑩ | **GATE OPEN** — Orchard House founder-APPROVED live 2026-07-17 evening, no fix round; Crateline = s54 lead work | the proven loop: `proprietary/templates/meta-prompt.md` + reference builds in `proprietary/templates/sites/` |
| 2 | **Staging smoke compose** (seat `openai/gpt-5-mini`) → B-crm.5 staging first-run | **GATE OPEN** — env edit landed + verified (swordfish mail 2026-07-17 ~17:00Z); founder-directed: run at the **s54 opener** | seat dev-verified s52; first real staging generation carries the deferred judge-gate spend check |
| 3 | **B-crm.5 weights UI surface** (learned-weight provenance in the leads queue) | none — lead work, next session | `docs/research/lead-scoring-algorithms.md` + PR #54 |
| 4 | **Staging cutover** PGlite volume → tenant PG (lead runs steps 1–4/6–7) | swordfish step-0 confirmations + a window — choreography ACK'd 2026-07-17, top of swordfish's Next list; sequenced behind the smoke compose | `scripts/migrate-pglite-to-tenant-pg.ts` · full lane record `.context/notes/lane-wrap-b-rls-s53.md` |
| 5 | **Transcript bulk-delete pass** | founder GO stands; re-scope first (s53's deferral reason was lost to the crash) | the library bulk-delete door |
| 6 | **B-crm.4 back-half build** (Resend send door + cadence) | founder verdict on the proposal (§Session-53 addendum) | AU Spam Act invariants ride as code, per the proposal |
| 7 | **Checkpoint decisions** — cache exemption · B-rls.2 charter candidate · standing scratch-admin role · ms-fidelity caveat | founder, next checkpoint | archive s53 record + `.context/notes/lane-wrap-b-rls-s53.md` |

Parked (charter-level, not this window): s40 re-critique run · B6.7 domains launch · post-wave-2 landing+workspace design phase · B-visual style-lock candidate · month-end credit call. The founder-action queue has ONE home: `agent_handoff/NEEDS-STEVEN.md`.

## Messages (append-only — prior messages through s53 are in COORDINATION-ARCHIVE.md)

- 2026-07-17 lead: **BOARD PRUNED (founder ask, post-s53-wrap).** All history — nine sprint/window lane tables and every session message through the s53 close record — moved verbatim to `COORDINATION-ARCHIVE.md`; this file now carries live state only. The s53 close record (lanes A/B, the lane-B opens, the tmux-crash record) is the archive's final entry.
- 2026-07-17 lead: **FOUNDER APPROVED ORCHARD HOUSE (live, post-wrap) — the wave-2 insert lands clean, no fix round; ⑧ Crateline ungated for s54.** Same live round: staging seats confirmed landed (queue #2 gate opened same evening) · the 8899 static server was found DEAD (it died with the tmux unit in the OOM) and was restored — localhost-bound, detached from the session, orchard-house verified 200 · both closed lines removed from NEEDS-STEVEN.
