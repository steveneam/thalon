# LANE KICKOFF — B-ve.7 agent reframe (s51, Mode B window)

> Lead-authored. You are the B-ve.7 lane agent in the worktree
> `.claude/worktrees/b-ve7` (branch `b-ve.7-agent-reframe`). Read
> `CLAUDE.md` (repo protocol) first, then this file end to end, then build.
> The founder approved this lane's launch at the s51 opener; scope below is
> the approved scope. The lead is running wave-2 in a parallel window — you
> never touch vendor tools, credits, or the dev database.

## 0. Gate — do not start until this is true

The lead lands a **contract half-window at the s51 opener** (additive crop
ops in `edlDiffSchema`, re-frozen at its merge). Before building:
`git fetch origin && git rebase origin/main`, and confirm
`packages/contracts/src/video-project.ts` contains the crop-op arm in the
diff schema. If it does not, STOP and tell the lead — do not add contract
schema yourself (windows are lead-owned, one owner per sprint).

## 1. What this bucket is

**Resolve Smart-Reframe, our way** (survey: `docs/research/
nle-timeline-ui-patterns.md` §5): the agent proposes per-clip **crop/pan
changes** as EDL-diff ops through the EXISTING B-ve.4 door — propose →
diff view → operator approve → replay-verified attributed save. Own-engine,
0 credits (A17: no vendor-metered call can be expressed on an edit path).

## 2. Scope (build exactly this)

1. **`applyEdlDiff` crop arm** (`packages/engine/src/edl/diff.ts`): apply
   the half-window's crop op(s) to a clip's `crop` — mirror the existing
   op arms' shape and error style (unknown index / invalid target = typed
   refusal, verbatim messages).
2. **Proposer** (`packages/engine/src/edl/propose.ts` + `shell/generator`
   + `proprietary/prompts/`): extend the EDL-diff proposer so reframe asks
   ("recenter beat 4 on the desk", "keep the flame in frame") can yield
   crop ops. The prompt context MUST carry the **measured source dims**
   (the route already probes via `probeSourceDims` — extend the door to
   pass dims into the propose call) and the CURRENT crop values. Proposal
   ops carry `why` naming what was measured — "measured, never estimated"
   applies to the AGENT too: a proposal citing no measurement is refused
   by dry-apply validation (clamp/bounds check against dims).
3. **Web**: the Assist panel's diff view renders crop ops readably (old →
   new window per clip, source-pixel values); the applied preview flows
   through the existing `applyEdlDiff` path (it already re-renders the
   FrameComposer + track view from the patched EDL — verify, don't
   rebuild).
4. **Bounds validation**: dry-apply refuses ops whose window leaves the
   measured source (extend `validateEdlDiffCandidate` — the dims travel
   with the request).
5. **Tests** (+~15–25): diff arm apply/refusals · proposer emits valid
   crop ops against a fake driver · bounds refusals · assist-panel render
   of crop diffs. Mirror the B-ve.4 test files' style.

## 3. Out of scope (recorded so it doesn't creep)

Auto-apply (does not exist, ever) · pan-expression proposals (static +
from/to only in this bucket) · vendor anything · judge-lens changes (crop
ops carry no text — G1 binds at approve exactly as today, receipt
`lines: N` unchanged) · dev-server browser verification (the LEAD does the
live pass at merge; you verify with tests + jsdom only).

## 4. Lane rules (Mode B standing)

- Worktree only; NEVER `npm install` here (preinstall guard enforces; ask
  the lead — installs run in the main checkout).
- **No dev server in this lane** (port lane 3111 belongs to the lead's
  window; your proof is the suites).
- Run before declaring done: workspace suites you touched → root
  `npm test` → `npm run typecheck` → `npm run lint` → `pwsh
  scripts/ci-grep-guard.ps1` — all green, all from THIS worktree.
- Commit style: `feat(b-ve.7): …`, no AI attribution anywhere. Push the
  branch; do NOT open the PR — end with a wrap message in chat (what
  shipped, suite numbers, anything the lead must know) and stop. The lead
  reviews, browser-verifies, and merges from the main window.
- Contract friction (schema you need but the half-window lacks) = STOP and
  report, never an ad-hoc edit (COORDINATION.md header rule).

## 5. Context worth reading before coding

`docs/adr/0010-video-editor-charter.md` (all amendments) ·
`packages/engine/src/edl/diff.ts` + `propose.ts` + their tests (the shapes
you're extending) · `apps/web/src/components/videos/assist-panel.tsx` ·
`apps/web/src/lib/videos/frame.ts` (source-pixel math + clamps you can
reuse) · survey §5 (the design intent).
