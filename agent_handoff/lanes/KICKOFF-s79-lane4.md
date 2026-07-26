# KICKOFF — s79 lane 4: `approve · create · intel · videos` (verify, then fix)

> **PREPPED at s78 close; LAUNCH GATED on the founder's fresh approval at the
> s79 boot** (standing rule: every launch needs fresh approval, per named run).
> You are lane 4 of 4; lane 3 (`dashboard · transcription · sites`) runs
> beside you on disjoint files.

You are a **verify-and-fix** lane, not a build lane. Read `CLAUDE.md` first,
then IN ORDER:

- `docs/research/workspace-audit-findings-s77.md` — the work list and the
  plan. **Its keyed-by-entity annotation names 7 findings ALREADY CLOSED —
  your Approve blocker is one of them; do not re-verify or re-do them.**
- `.claude/skills/thalon-check/SKILL.md` — the lens set. READ IT BEFORE FIXING.
- `docs/research/mock-sheets/README.md` — the sheet contract and the founder
  amendments. **One binds you hard: Approve sort = NEWEST FIRST is a founder
  amendment — the SHEET's "Oldest first" chip is the wrong one. Do NOT "fix"
  the app to match the sheet.**
- `agent_handoff/lanes/WRAP-s78-lane1.md` — its §"cross-lane" note is YOUR
  work item (below).

## THE GATE: verify before you fix

These findings are **RAW — plausible, not refuted**. The s78 gate killed 3 of
23 and rewrote the fix on eight more. Round 1: adversarial refutation of your
11 below (independent refuters per finding, distinct lenses, default
`real:false`, majority survives). Round 2: fix only survivors. Do NOT touch
mediums/lows — they are s80's.

## Your findings — blocker + high only (11)

**Intel** (`components/intel/**`, `lib/intel/**`)

| sev | finding | where |
|---|---|---|
| `blocker` | The dossier's primary exit lands on a Create where Generate is refused — and on today's data it is the PRE-PICKED one | `dossier-card.tsx:296` |
| `high` | "Click again to ride without an angle" is false — the seam re-attaches the first angle anyway | `lib/intel/store.ts:106` |
| `high` | "Target this" on every horizon card defaults to a family Create cannot generate | `search-tab.tsx:334` |

**Approve** (`components/approve/**`)

| sev | finding | where |
|---|---|---|
| `high` | "13 waiting" beside "Approve all waiting (2)" — staged rows counted, silently excluded, indistinguishable | `approve-surface.tsx:341` |
| `high` | Selecting a staged row kills j/k/a/r/e while the footer still advertises them, and the pane points back at the card it removed | `approve-surface.tsx:328` |
| `high` | The reasons panel labels both grounding tiers "Grounding" — the two rows that can disagree are indistinguishable | `draft-card.tsx:295` |

**Create** (`components/create/**`)

| sev | finding | where |
|---|---|---|
| `high` | "Advanced · staged flow →" is a dead path — no staged authoring door exists, and the brief is discarded | `create-surface.tsx:185` |
| `high` | Intel's primary suggested exit lands on a disabled Generate — the flagship path terminates in Create | `create-surface.tsx:178` |
| `high` | A failed profile read is rendered as "no active profile" — broken and empty collapsed into one fact | `create-surface.tsx:101` |
| `high` | Grounding row lost the sheet's "view sources" door — the capture's source URL is never a link anywhere | `create-surface.tsx:441` |

**Videos** (`components/videos/videos*.ts*`, `dossier.tsx` — **NOT the editor**)

| sev | finding | where |
|---|---|---|
| `high` | Card says "4 aspect cuts"; the dossier it opens says "none yet" — the family line mixes three scopes | `videos-model.ts:86` |

The fix sketches are **suggestions, not instructions**.

### ALREADY FIXED — do not re-do, do not re-verify

- **Approve's blocker** (*the editor outlives the draft*) and its actionError
  medium — closed by the s78 keyed-by-entity sweep (`8d35a9e`), pinned in
  `components/__tests__/keyed-by-entity.test.tsx`. `DraftCard` is keyed per
  draft; existing tests re-query the "Draft detail" region BY DESIGN.
- **Create's loader** is keyed by capture (same sweep). Keep both keyed.

### Carried work that is YOURS

1. **Approve's unmatched-`?run=` honesty** — lane 1 fixed the Runs side and
   left you the precise instruction in `agent_handoff/lanes/WRAP-s78-lane1.md`
   (an unmatched deep link must say so, never silently select a different
   run's draft). It already shipped a `role="alert"` band; verify it against
   the instruction and finish anything it deferred.
2. **The Intel↔Create dead-end is ONE finding wearing three rows** (Intel's
   blocker + Create's two exit highs). Fix it as one decision — the founder's
   s77 ruling is **Create post/page generation = GO TO ARMING**, so the honest
   fix may be arming the door rather than annotating the refusal. ⛔ But the
   SEQUENCE GATE stands: *"we're not posting anything yet until all the walks
   are verified and fixed."* Build the arming DISARMED; generation-on-click
   spends tokens, so leave the spend path behind his GO and say in the wrap
   exactly what state you left it in.

### Explicitly NOT yours

**The video EDITOR** (`editor.tsx`, `editor-timeline.tsx`,
`editor-inspector.tsx`, the `/edit` route). Its 36-finding audit
(`docs/research/video-editor-audit-s78.md`) is a build list awaiting the
founder's scope call — its own session. Unless the founder's s79 boot approval
explicitly adds the editor's one blocker (keyboard-dead timeline blocks), do
not touch those files.

## DRIVE THE SURFACE — the s78 lesson, not optional

The founder found a whole missing capability (calendar planning) in ten
minutes of clicking, after the audit missed it — every agent READ the code.
Per surface you touch: **do its actual job end-to-end** — promote a capture
into Create, ride the angle off, approve a staged row, walk j/k through it.
You cannot run `next dev` in the lane; for flows needing the live app, write
the exact drive script into your wrap for the lead's merged-main gate. State
which jobs you drove and which you deferred.

## Constraints — not negotiable

1. **Lead-owned files — do not touch:** `app/app/workspace.css`,
   `packages/contracts/**`, `packages/db/**`, ratchet pin tests.
2. **The contract window is FROZEN.** No new tables, contracts, migrations.
3. ⛔ **THE SEQUENCE GATE** (verbatim above): never exercise a publish path,
   never call a live platform API, and no token-spending generation without
   his GO.
4. **You CANNOT screenshot-gate your own work** — `shoot-surface.mjs` refuses
   from a worktree (enforced). List expected visual deltas in your wrap.
5. **`npm run verify` before wrap** — never through `tail`. **vitest does NOT
   typecheck.**
6. **Every fix gets a test in the same change, revert-checked.**

## Wrap

Commit on your branch. **Do NOT merge** — the lead merge-gates. Write
`agent_handoff/lanes/WRAP-s79-lane4.md`: killed findings with reasons,
survivors shipped, the Intel↔Create decision and what state the arming is in,
jobs driven vs deferred, expected visual deltas. Signal the lead when done.
