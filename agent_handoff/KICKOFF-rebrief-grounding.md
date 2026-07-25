# KICKOFF — lane `rebrief-grounding` (the 491089d0 ratchet: re-brief REPLACES grounding)

Read `CLAUDE.md` first. Branch `agent/rebrief-grounding`. Contracts + db
FROZEN — engine + tests only. Founder-approved s71 close as part of the s72
parallel wave. Small lane: one root cause, one fix, one pin.

## The incident you are ratcheting (s69 root cause, on record)

Draft `491089d0`'s judge failures traced to DUPLICATE near-identical grounding
briefs: a re-brief pass ADDED its new grounding source ids alongside the old
ones instead of REPLACING them, so the judged context carried two almost-
identical briefs — grounding checks then behave badly (near-duplicate
sources dilute/confuse verbatim-support checks). The s69 wrap named the rule:
**re-brief must REPLACE `groundingSourceIds`, never append.** It was recorded
as a ratchet candidate and never executed. You make it executable.

## Steps

1. **Locate the re-brief path.** Start points: the video/pillar brief chain
   (the s68 "re-brief beat two judge refusals" flow) and
   `packages/engine/src/origination/origination.ts` (canonical
   `groundingSourceIds` handling: dedupe+sort at line ~74). Find every
   call site where a SECOND brief for the same draft/beat can contribute
   grounding ids; map who owns the merge.
2. **Reproduce first.** A failing test that drives a brief → re-brief cycle
   through the real code path and asserts the duplicated-grounding state the
   incident had. No live model calls — scripted fakes like the neighboring
   tests.
3. **Fix: REPLACE semantics.** The re-brief's grounding set becomes THE set
   (dedupe within itself as today). If the current shape makes silent append
   possible from more than one seam, prefer the structural fix (one owner of
   the merge) over patching each caller.
4. **Pin it.** The regression test asserts: after re-brief, grounding ids =
   exactly the re-brief's set; no near-duplicate brief text reaches the
   judge context; idempotent replay unaffected (generation keys: check
   whether grounding ids fold into a key anywhere — if replacing changes a
   key, that is CORRECT behavior, pin it as such).
5. Full `npm run verify` (unfiltered) + guard.

## Out of scope

Judge internals (frozen tuning, s69 arc closed) · prompt files · anything in
`proprietary/judge` beyond reading · contracts.

## Wrap

`agent_handoff/WRAP-rebrief-grounding.md`: the located seam(s), the shape of
the fix (owner-of-merge vs per-caller), test names, any behavior deltas
(e.g. key changes on re-brief runs). The LEAD merges on green post-merge
verify.
