# KICKOFF — s78 lane 1: `leads · board · runs` (verify, then fix)

> **APPROVAL ON RECORD (founder, s78 boot):** *"gogogo, and you have my
> approval"* — given against the s78 resume prompt, which names exactly two
> lane launches. You are lane 1 of 2. Lane 2 (`calendar · settings ·
> profiles`) runs beside you on disjoint files.

You are a **verify-and-fix** lane, not a build lane. Read `CLAUDE.md` first,
then IN ORDER:

- `docs/research/workspace-audit-findings-s77.md` — the work list and the
  plan you are executing. **Read `## s78 plan` and everything below it.**
- `.claude/skills/thalon-check/SKILL.md` — **the lens set. READ IT BEFORE
  FIXING.** Its two named process rules are there because they cost the
  founder three rounds of micromanagement in s77.
- `docs/research/mock-sheets/README.md` — the sheet contract, including the
  founder amendments where the app deliberately diverges from a sheet.

## THE GATE: verify before you fix

The 189 findings in that document are **RAW — plausible, not yet refuted.**
The adversarial Verify pass was deliberately not run. It exists because a
confident reviewer invents work, and historically it kills a real fraction.

**Round 1 — verify your blocker+high ONLY (the 12 below).** Use the
`fe-check` skill's adversarial shape: each finding gets independent
verifiers prompted to REFUTE it, defaulting `real:false`, and it survives
only on a majority. This fan-out is pre-approved — it is the round-1 spend
the founder signed off on. Do NOT verify your mediums and lows: they are
s80's, deliberately, because fixing blockers changes the code they were
found against.

**Round 2 — fix only what survived.** A refuted finding gets one line in
your wrap saying why it was refuted. That is a result, not a gap.

## Your findings — blocker + high only

**Leads** (`components/leads/**`)

| sev | finding | where |
|---|---|---|
| `blocker` | Dismiss and Mark hot have no pointer control anywhere — the verbs exist only as hidden keystrokes | `leads-surface.tsx:340` |
| `high` | A judge-BLOCKED draft is handed over with the same one-click send affordances as a passed one, and no judge verdict has a door to its trail | `leads-surface.tsx:780` |
| `high` | A failed run-feed read renders as "No draft yet" — broken presented as empty | `leads-surface.tsx:118` |
| `high` | An older draft falls out of the 50-run feed window and becomes invisible, while the compose toast insists it is being shown | `leads-surface.tsx:147` |
| `high` | The Dismissed view is a filter with no cue on screen and no visible way to clear it | `leads-surface.tsx:134` |

**Board** (`components/board/**`)

| sev | finding | where |
|---|---|---|
| `high` | Waiting column drops 9 of 21 cards behind a note that claims the opposite | `board-surface.tsx:183` |
| `high` | 620px column bound clips a card at the sheet's own density while ~180px of page height sits unused | `board.css:135` |
| `high` | Topbar says "Needs you · 25", the column says "Waiting on you 21" — same fact, same screen | `board-model.ts:46` |
| `high` | Approved / Composing / At-the-judge cards carry no platform — two identical cards render today | `board-model.ts:138` |

**Runs** (`components/runs/**`)

| sev | finding | where |
|---|---|---|
| `high` | Global Enter binding hijacks the surface's own buttons — the All/Failed/Published filter cannot be operated by keyboard | `runs.tsx:149` |
| `high` | A failed run with zero drafts opens into Approve and silently selects a DIFFERENT run's draft | `runs-model.ts:133` |
| `high` | Every row's lead is derived from platforms only — 19 of 27 live rows read the identical string "Fan-out · Video" | `runs-model.ts:134` |

The full fix sketches for each are in the findings document — they are
**suggestions from the walker, not instructions.** If verification says the
sketch is wrong, say so and do the right thing.

### ALREADY FIXED — do not re-do, do not re-verify

- **Leads: `outreachError` is not keyed to its lead** (`leads-surface.tsx:101`)
  — closed by the lead-direct keyed-by-entity sweep this session (`8d35a9e`).
  It is already on the main you branched from.
- **Runs' index-shaped selection** was swept in the same commit. If you touch
  selection in `runs.tsx`, keep it keyed by run id; do not reintroduce an
  index.

### One finding needs a two-sided fix and lane 2 does NOT own the other side

`runs-model.ts:133` (*a failed run with zero drafts opens into Approve and
selects a different run's draft*) has its second half in
`approve-surface.tsx` — making an unmatched `?run=` honest rather than
silently falling back. **Approve is lane 4's surface (session B), not
yours.** Do the Runs side; for the Approve side, either make the minimal
honest-fallback change and flag it loudly in your wrap as a cross-lane
touch, or leave it and write the precise instruction into your wrap for
s79. Your call — but say which you chose and why.

## The founder's re-introductions, for YOUR surfaces

His directive: *"re-introduce the good things (like filters, sort by, a
workable calendar) from the old design."* The fan-out reached the same
conclusion independently on all three of your surfaces:

- **Leads** — "a queue built to swallow whole CRM exports offers no search,
  no filter and no sort" (`leads-surface.tsx:134`).
- **Board** — "no filter and no sort on a surface whose densest column is 21
  items" (`board-surface.tsx:91`); he named platform filter + sort.
- **Runs** — "27 rows with no search, no platform filter and no sort"
  (`runs.tsx:181`).

These are logged as medium/low, but the founder asked for them **by name**,
so they are in scope for you rather than deferred to s80. Do them once, in
one grammar, using Approve's existing `.sel-ctl` / `.seg` markup so three
surfaces do not grow three vocabularies.

## Constraints — these are not negotiable

1. **Lead-owned shared files. Do not touch:** `app/app/workspace.css`,
   `packages/contracts/**`, `packages/db/**`, and the ratchet pin tests.
   If you believe you need one, STOP and write it in your wrap instead.
2. **The contract window is FROZEN** (s77). No new tables, no new contract
   schemas, no migrations. If a fix seems to need one, it does not belong in
   this session — report it.
3. ⛔ **THE SEQUENCE GATE, the founder's words:** *"we're not posting
   anything yet until all the walks are verified and fixed."* You may build
   and wire; you may NOT exercise any publish path, and you may not arm one.
4. **Screenshot-gate every surface you change** — `scripts/shoot-surface.mjs`
   against dev 3111, diffed against the surface's sheet. The script refuses
   not-ready shots; that refusal is information, not an obstacle. Use
   `localhost`, never `127.0.0.1` (Next blocks `/_next` cross-origin — a
   healthy app reads as dead).
5. **`npm run verify` before you wrap** — and **NEVER pipe the suite through
   `tail`**; write it to a file and read the file. **vitest does NOT
   typecheck** — three catches on record, one of them this session.
6. **Every fix gets a test in the same change.** Executable ratchets beat
   documented ones. A test that passes without your fix is not a ratchet —
   check by reverting.

## Wrap

Commit on your branch `s78-lane1-leadsboardruns`. **Do NOT merge** — the
lead merge-gates every lane on rebase + verify on merged main.

Write `agent_handoff/WRAP-s78-lane1.md` covering: what verification KILLED
(with the refutation reason), what survived and shipped, the screenshot
results, any cross-lane touch, and anything you deliberately left. State
your final verify numbers.

Signal the lead when you are done.
