# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-05 (session 6) · **Wave 2 merged — B2.5 (PR #15) + B2.6 (PR #16) on main; SPRINT 2 CODE-COMPLETE (B2.1–B2.6); next: Sprint-2 exit review (dogfood B2.3 + B2.5), then Sprint-3 re-charter**

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` (Sprint-2 table + Sprint-3 pulled list) → `COORDINATION.md` (Sprint-2 lane board + the 2026-07-05 wave-2 merge-train message — review findings, lint rounds, follow-ups).

## Delta (this session)

- **B2.5 merged (PR #15)**: `packages/engine/src/demo/` — crawl (robots.txt merged-across-groups + rate limit on EVERY request, incl. robots fetch, as tested core invariants) → flow map → storyboard shell behind a Zod+structural validation boundary → one `demo_plan` draft per run with waterfall's idempotency/backfill → post-approval Playwright drive (`DemoDriver` seam; browser-gated integration test) → content-addressed capture bundle; `drafts.updateMeta` with optimistic concurrency (`ConcurrentUpdateError`). Pinned `demo_plan` meta contract for the UI: `packages/engine/src/demo/schemas.ts`.
- **B2.6 merged (PR #16)**: approve-queue renders clip plans (canonical shape), exemplar provenance + `blocked_overlap` badge, demo plans (pinned contract, `captureStatus` chip); three Sprint-1 follow-ups closed — panel refresh race (ref-guarded), aborted-run rows (feed rewired onto new additive `fanoutRuns.list()`), operator re-judge. **Structural change: apps/web now depends on `@thalon/judge` and runs the judge pipeline in-request** on both save-edit and re-judge (wired like `eval/src/dogfood.ts`; metering stays inside the pipeline's `withGatewayGuard`) — a judged outcome (`queued`/`blocked`) comes back in the response; failures surface loudly with the draft honestly at `judging`; re-judge doubles as the retry path.
- Root suite 300 passed / 2 skipped (browser-gated); lint 0 errors; both lane worktrees + branches GC'd.
- **Founder process directive (in agent memory, `lead-drives-lanes`): an approval covers exactly the named agent runs — reviewer agents and lane fix-round resumes each count as launches; any agent run beyond the approved count = pause, founder approves or defers.** This session used 6 runs against a 2-lane approval before the directive landed.
- Founder decision: B2.5 dogfood target = a known brand's **public docs-search flow** (Anthropic docs first) as runtime input, never committed; auth-walled chat products are out (A5 no-ToS-evasion).

## Next action

**Sprint-2 exit review** (lead terminal, no agents needed): dogfood the two new slices end-to-end on real inputs — B2.3 clip plans from the founder's pillar caption/SRT, B2.5 demo plan against the pinned docs-search flow (crawl → storyboard → judge → approve in the queue UI → Playwright drive → capture; needs `npx playwright install chromium` locally + `AI_GATEWAY_API_KEY` already in `apps/web/.env.local`) — capture any overrides as eval rows, then present Sprint-3 re-charter options (B3.x are pulled, not pushed). Small follow-ups queued on the board: `fanout.ts` double read, `_dataDir` lint warning, failed-drive partial-trace persistence.

## [you] — founder-supplied, needed as work starts (not before)

- B2.3 dogfood (blocking that half of the exit review): your first pillar video's caption/SRT file.
- B2.5 dogfood: confirm the exact docs-search flow to storyboard when we run it (target stays runtime input).
- Gateway credit top-up (optional until Sprint 3): restores the ratified sonnet final judge tier.
