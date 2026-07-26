# KICKOFF — lane `exarm` (arm outlier→exemplar auto-admission, s71)

You are a Mode B build lane in a git worktree on branch `agent/exemplar-arm`.
Work ONLY here. Read `CLAUDE.md` (repo root) first — every rule binds you
(grep guard, no AI attribution). Launch approval: founder, s70c. This is the
s68 founder-directed item (a) of the learn-from-the-crowd program — it
PREDATES the B-learn charter candidate and is buildable now; the wider
B-learn (own-post metrics, attribution, contract window) stays UNCHARTERED —
do not scaffold any of it.

## Mission

The sweeps already capture engagement (likes/comments/reposts/views) and
score outliers by Δ-velocity — but NOTHING is admitted to the exemplar pool
(it held 4 entries when the founder asked why the engine writes mediocre
posts). **Arm the admission loop: scored outliers auto-ingest as exemplars,
governed by per-area knobs as CONFIG-DATA.**

- Knobs (per monitored area): engagement metric names to read, absolute
  floors, velocity multiples over baseline, max admissions/day, min body
  length. Defaults conservative.
- Admission calls `ingestExemplar` (kind "exemplar", uri = the source
  permalink, meta.origin = "auto-admission:<area>") — dedup is the door's
  own idempotency plus a content-hash check; never admit the same text twice.
- **Budget honesty:** every admission embeds through the metered ledger —
  cap admissions/day (default ≤20) so the 2M daily budget holds; refusals
  from the budget rail are logged, never fatal to the sweep.
- Coverage honesty (s68 finding): Bluesky's area feeds are news-bot-heavy —
  the knobs must make floors strict enough that headline spam never
  qualifies; YouTube titles/hooks are the richer source today.

## Read first

1. `packages/engine/src/trend/` — sweep-scheduler, longitudinal (the
   velocity math you consume), source-registry.
2. `packages/engine/src/exemplar/ingest-exemplar.ts` — the one ingest door.
3. `packages/contracts` — **FROZEN.** If the area-config knobs require
   editing a contracts schema, STOP that slice and write the window request
   in your wrap instead (the bint3 lane's precedent); ship whatever is
   achievable with open jsonb config meanwhile.
4. ROADMAP §B-learn (context only — L1 is yours, L2–L5 are NOT).

## Discipline

- Tests with code: admission thresholds (floor/velocity/cap) with scripted
  sweep fixtures; dedup; budget-refusal tolerance; zero live network.
- `npm run verify` green before your wrap (NEVER filter gate output).
- Commit on your branch; the lead reviews/merges. Do NOT push to main.

## Wrap

`agent_handoff/lanes/WRAP-exemplar-arm.md`: what shipped, the knob defaults chosen
and why, any contract-window ask, and the first real sweep's admission count.
