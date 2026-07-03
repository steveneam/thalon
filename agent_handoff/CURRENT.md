# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-03 · spine design phase (pre-B0.3)

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` (note § Amendments) → `docs/SPINE.md` (approved architecture) → `COORDINATION.md` (lane board).

## Delta (this session)

- `docs/SPINE.md` written and **founder-approved**: DCPS doctrine, draft state machine, elaborated B0.3 schema, target package layout, operating + maintenance model.
- Amendments A1–A4 ratified → `CHARTER.md § Amendments` + `docs/adr/0001-spine-adoption.md`.
- Parallel plumbing landed: `COORDINATION.md` stub · `.worktreeinclude` · `.claude/settings.json` (worktree node_modules symlink) · this handoff file · AGENTS.md rule 9 now mirrors the resume prompt here.

## Next action

**Lane A (this terminal): B0.3** — package extraction (A3) + PGlite seam swap (A1) + full schema per SPINE §2.5 + state machine §1.1 + caches + budget ledger + the three ratchet tests. Then B0.4.
**Lane B (proposed, founder opens second terminal: `claude --worktree b05-aws`): B0.5** — CDK-Python/OIDC skeleton, `infra/**` only. See `COORDINATION.md`.

## [you] — founder-supplied, outstanding

AWS sub-account (unblocks Lane B deploy role) · `AI_GATEWAY_API_KEY` · Langfuse keys.
