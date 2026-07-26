# KICKOFF — lane `p2c-gen` (Phase 2c generation side, s71)

You are a Mode B build lane in a git worktree on branch `agent/p2c-genterms`.
Work ONLY here. Read `CLAUDE.md` (repo root) first — every rule binds you
(grep guard, no AI attribution). Launch approval: founder, s70c ("prepare
parallel worklanes for all that next session").

## Mission

The discoverability lens SHIPPED (`proprietary/judge/src/discoverability.ts`,
advisory `discoverability` judge row, opt-in by `meta.targetTerms`) — but no
draft declares target terms yet, so the lens never fires in production.
Close that: **generation DECLARES `meta.targetTerms` on social drafts.**

- Derivation, in priority order: the subject's canonical entities from the
  brief (a post about AI must target "AI" — the founder's live catch that
  chartered this), the monitored area's intel keywords where the draft came
  from an intel handoff, and the brand profile's topics. First term = the
  primary entity; keep the list short (3–6 terms), never keyword-stuff.
- The fan-out prompt also INSTRUCTS natural inclusion of the primary entity
  and purpose framing (the founder's edit is the model:
  `eval/golden/discoverability-seed.jsonl` disc-002 — read it).
- Structural lesson from the founder's edit note: the post shape should
  leave room for cross-vendor/entity breadth (he couldn't fit a second
  vendor into the engine's rigid structure).

## Read first

1. `proprietary/judge/src/discoverability.ts` + its test — the contract you
   feed (DO NOT edit the lens; it is frozen as shipped with its golden pair).
2. `packages/engine/src/fanout/` (shell generator + door) — where drafts and
   their meta are born.
3. The intel→create handoff seam (structured context chips) — where area
   keywords already flow.
4. `packages/contracts` — FROZEN. `meta` is open jsonb; targetTerms needs NO
   contract change. If you believe otherwise, STOP and write it in your wrap.

## Discipline

- Tests with code: drafts from the fan-out carry sensible targetTerms; a
  judged draft with terms gains the `discoverability` row (pipeline-level
  test with fakes); prompt-side instruction pinned in the prompt-version
  file convention if one exists for fanout.
- Zero live model calls in tests — scripted fakes only.
- `npm run verify` green before your wrap (NEVER filter gate output).
- Commit on your branch; the lead reviews/merges. Do NOT push to main.

## Wrap

`agent_handoff/lanes/WRAP-p2c-genterms.md`: what shipped, the derivation rules as
built, blog-mirror pairing notes (Phase 2c (d) — next slice, NOT this lane).
