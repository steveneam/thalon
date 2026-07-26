# KICKOFF — s79 lane 3: `dashboard · transcription · sites` (verify, then fix)

> **PREPPED at s78 close; LAUNCH GATED on the founder's fresh approval at the
> s79 boot** (standing rule: every launch needs fresh approval, per named run).
> You are lane 3 of 4; lane 4 (`approve · create · intel · videos`) runs
> beside you on disjoint files.

You are a **verify-and-fix** lane, not a build lane. Read `CLAUDE.md` first,
then IN ORDER:

- `docs/research/workspace-audit-findings-s77.md` — the work list and the
  plan. **Its keyed-by-entity annotation names 7 findings ALREADY CLOSED —
  two of them were yours; do not re-verify or re-do them.**
- `.claude/skills/thalon-check/SKILL.md` — the lens set. READ IT BEFORE FIXING.
- `docs/research/mock-sheets/README.md` — the sheet contract and the founder
  amendments where the app deliberately diverges.
- `agent_handoff/lanes/WRAP-s78-lane1.md` §"Round 1" — what the s78 verify
  gate killed and why, so you know what a refutation looks like.

## THE GATE: verify before you fix

These findings are **RAW — plausible, not refuted**. The s78 gate killed 3 of
23 and rewrote the fix on eight more, including one whose sketch would have
made the surface worse. Round 1: adversarial refutation of your 11 below
(independent refuters per finding, distinct lenses, default `real:false`,
majority survives). Round 2: fix only survivors. A refuted finding gets one
line in your wrap saying why. Do NOT touch mediums/lows — they are s80's.

## Your findings — blocker + high only (11)

**Dashboard** (`components/dashboard/**`)

| sev | finding | where |
|---|---|---|
| `blocker` | The needs-you card's global Enter binding steals Enter from every control on the surface | `needs-you-card.tsx:50` |
| `high` | j/k moves the selection out of the scroll box and the box never follows | `needs-you-card.tsx:39` |
| `high` | The card head says 25 while the card lists 21 — two reads, two windows, no statement of the gap | `dashboard.tsx:98` |
| `high` | The day view puts week-old waiting drafts on today's clock at their historical time | `week-card.tsx:144` |
| `high` | "your review" marks paint accent blue instead of warn amber — overridden by `.screen a` | `week-card.tsx:318` |

**Transcription** (`components/transcription/**`)

| sev | finding | where |
|---|---|---|
| `high` | Every disabled control on this surface looks and feels exactly like a live one | `transcription.css` |
| `high` | "or drop a file" is advertised in the ingest box and there is no drop handler anywhere | `transcription.tsx` |
| `high` | An unbounded shelf with no search, no filter and no sort — and the tags that would filter it are inert | `transcription.tsx` |

**Sites** (`components/sites/**`, `lib/sites/**`, `app/app/sites/**`)

| sev | finding | where |
|---|---|---|
| `blocker` | Dead door: the dossier's "Wave" fact link is silently dropped for wave 2.5 | `app/app/sites/page.tsx:17` |
| `high` | A filter can be left applied with its chip hidden and no clear control on screen | `sites.tsx:112` |
| `high` | The resting filter row is five alphabetical one-result verticals; every useful facet is hidden | `sites-model.ts:101` |

The fix sketches in the findings doc are **suggestions, not instructions** —
s78's verifiers reversed one entirely.

### ALREADY FIXED — do not re-do, do not re-verify

- **Dashboard: the needs-you selection index** (`needs-you-card.tsx:36`, low)
  and **Transcription: selection is an array INDEX** (high) — both closed by
  the s78 keyed-by-entity sweep (`8d35a9e`), pinned in
  `components/__tests__/keyed-by-entity.test.tsx`. If you touch selection on
  either surface, keep it keyed by id; never reintroduce an index.

### Founder rulings that bind YOUR surfaces

- **Dashboard publish door = ARM** (s77 ruling, recorded in the findings doc
  §s78 plan item 5). Building/wiring the door is inside the GO; **exercising
  any publish path is NOT** — that needs his fresh per-platform GO after the
  fix pass lands. If arming it would let one click post, wire it disarmed and
  say so in the wrap.
- **The founder's own asks for these surfaces:** Transcription's missing
  search/filter/sort is his named "re-introduce filters, sort by" — do it in
  Approve's `.sel-ctl`/`.seg` grammar (lane 1 already used it on leads/board/
  runs; match them, don't invent a fourth vocabulary).

## DRIVE THE SURFACE — the s78 lesson, not optional

The founder found a whole missing capability (calendar planning) in ten
minutes of clicking, after 59 agents and a 189-finding audit missed it —
because every agent READ the code. So, per surface you touch, before you call
it fixed: **do the surface's actual job end-to-end in a real browser** via
puppeteer against your OWN code (`npx tsc` + tests + drive the flows in
jsdom-free reality where you can — you cannot run `next dev` in the lane, so
for anything needing the live app, write the exact drive script into your wrap
for the lead's gate to run on merged main). State in the wrap which jobs you
drove and which you could not.

## Constraints — not negotiable

1. **Lead-owned files — do not touch:** `app/app/workspace.css`,
   `packages/contracts/**`, `packages/db/**`, ratchet pin tests.
2. **The contract window is FROZEN.** No new tables, contracts, migrations.
3. ⛔ **THE SEQUENCE GATE:** *"we're not posting anything yet until all the
   walks are verified and fixed."* Build, wire — never exercise a publish
   path, never call a live platform API.
4. **You CANNOT screenshot-gate your own work** — `shoot-surface.mjs` refuses
   from a worktree (enforced). List expected visual deltas per surface in your
   wrap; the lead runs the gate on merged main.
5. **`npm run verify` before wrap** — never through `tail`; write to a file.
   **vitest does NOT typecheck** (three catches on record).
6. **Every fix gets a test in the same change, revert-checked.**

## Wrap

Commit on your branch. **Do NOT merge** — the lead merge-gates on rebase +
verify on merged main + a MEASURED render + driving the surfaces. Write
`agent_handoff/lanes/WRAP-s79-lane3.md`: killed findings with reasons,
survivors shipped, jobs driven vs deferred-to-lead, expected visual deltas,
anything deliberately left. Signal the lead when done.
