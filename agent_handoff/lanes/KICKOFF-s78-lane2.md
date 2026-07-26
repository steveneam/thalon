# KICKOFF — s78 lane 2: `calendar · settings (+integrations) · profiles` (verify, then fix)

> **APPROVAL ON RECORD (founder, s78 boot):** *"gogogo, and you have my
> approval"* — given against the s78 resume prompt, which names exactly two
> lane launches. You are lane 2 of 2. Lane 1 (`leads · board · runs`) runs
> beside you on disjoint files.

You are a **verify-and-fix** lane, not a build lane. Read `CLAUDE.md` first,
then IN ORDER:

- `docs/research/workspace-audit-findings-s77.md` — the work list and the
  plan you are executing. **Read `## s78 plan` and everything below it.**
- `.claude/skills/thalon-check/SKILL.md` — **the lens set. READ IT BEFORE
  FIXING.** Its two named process rules are there because they cost the
  founder three rounds of micromanagement in s77.
- `docs/research/mock-sheets/README.md` — the sheet contract, **including
  the founder amendments where the app deliberately diverges from a sheet.**
  One of yours is in there: see the Calendar ruling below.

## THE GATE: verify before you fix

The 189 findings in that document are **RAW — plausible, not yet refuted.**
The adversarial Verify pass was deliberately not run. It exists because a
confident reviewer invents work, and historically it kills a real fraction.

**Round 1 — verify your blocker+high ONLY (the 11 below).** Use the
`fe-check` skill's adversarial shape: each finding gets independent
verifiers prompted to REFUTE it, defaulting `real:false`, and it survives
only on a majority. This fan-out is pre-approved — it is the round-1 spend
the founder signed off on. Do NOT verify your mediums and lows: they are
s80's, deliberately, because fixing blockers changes the code they were
found against.

**Round 2 — fix only what survived.** A refuted finding gets one line in
your wrap saying why it was refuted. That is a result, not a gap.

## Your findings — blocker + high only

**Calendar** (`components/calendar/**`)

| sev | finding | where |
|---|---|---|
| `blocker` | Every navigated week marks the wrong day "today" — fake now-line, and all 21 waiting drafts get dumped into that fake today | `calendar-surface.tsx:186` |
| `blocker` | The time grid clips at 18:38 with no scrollbar — the evening and the whole 21–24 quiet band are unreachable, and "expand" cuts 531px while claiming "quiet hours · shown" | `calendar.css:25` |
| `high` | Selecting any non-plan event shows no cue at the control — `.sel` is styled only for `.ev-plan` | `calendar.css:140` |
| `high` | j/k walks into events that have no box on the grid — the popover opens with zero selected controls | `calendar-surface.tsx:243` |
| `high` | "+15 more" / "+17 more" is a dead end — the bulk of what waits on you is reachable only as a hover tooltip | `calendar-surface.tsx:447` |
| `high` | Agenda rows carry no date, so carried items from outside the labelled range read as in-range | `calendar-surface.tsx:692` |

**Settings + Integrations** (`components/settings/**`)

| sev | finding | where |
|---|---|---|
| `high` | Instagram's "Set up" walks a full credential paste into a driver that refuses every publish | `integrations-model.ts:128` |
| `high` | "Connected" never says whether the platform is ARMED — the fact that decides if anything posts, with no door to it | `integrations.tsx:314` |

**Profiles** (`components/profiles/**`, `lib/profiles/**`)

| sev | finding | where |
|---|---|---|
| `blocker` | Saving the profile silently deletes `identity.style` — the video render's brand colours — while the review panel promises a complete carry | `lib/profiles/form.ts:123` |
| `high` | The Voice step renders a fully-authored voice as completely blank | `profiles-surface.tsx:353` |
| `high` | Clearing every tone chip makes the review summary show a tone the save is about to delete | `profiles-surface.tsx:522` |

The full fix sketches are in the findings document — they are **suggestions
from the walker, not instructions.** If verification says the sketch is
wrong, say so and do the right thing.

**The Profiles blocker is the one to treat most carefully.** It is silent
data loss on save: a stored `identity.style` block disappears because the
carry is narrower than the review panel claims. Verify it hard — and if it
is real, its test should assert the round-trip preserves an unknown
identity key, not just that one named field survives.

### ALREADY FIXED — do not re-do, do not re-verify

**Both of your Settings walkers reported the same blocker** — *ConnectPanel
has no key, so a credential pasted for one destination is still in the box
when the panel re-titles itself for another, and Connect seals it there*
(`integrations.tsx:396`). **It is FIXED** on the main you branched from
(`93470ec`), keyed by destination with a test that types a token under one
destination and asserts the next one's box is empty. Do not spend
verification on it.

## The founder's re-introductions, for YOUR surface

His directive named **"a workable calendar"** explicitly, and the resume
prompt carries one specific gap forward:

> **`/api/calendar` does not exist, which is why reschedule is unarmed.**

Investigate it and **report before building**: if a write route can be added
over the EXISTING slot store with no new tables and no new contract schemas,
it is in scope — build it, wire reschedule, and test it. **If it needs a new
table, a new contract, or a migration, STOP** — the s77 contract window is
frozen and that makes it s79+ work. Say which case it is in your wrap, with
the evidence. Do not guess.

Note also the calendar's own `cursor: grab` finding (low): every event box
advertises a drag that is not wired. If you do NOT arm the write route,
that cursor must stop lying — that part is cheap and in scope either way.

### The founder's Calendar ruling is already made — do not re-decide it

Concurrent same-instant events: **adopt "+N more"**, not clipping. The sheet
already uses that treatment in its waiting lane, so this applies the
surface's own vocabulary rather than inventing grammar. Recorded in the
sheets README. (This bears on the `medium` "concurrent events collapse to
45px" finding if you get to it — the decision is not yours to reopen.)

## Constraints — these are not negotiable

1. **Lead-owned shared files. Do not touch:** `app/app/workspace.css`,
   `packages/contracts/**`, `packages/db/**`, and the ratchet pin tests.
   If you believe you need one, STOP and write it in your wrap instead.
2. **The contract window is FROZEN** (s77). No new tables, no new contract
   schemas, no migrations. This binds the `/api/calendar` question above.
3. ⛔ **THE SEQUENCE GATE, the founder's words:** *"we're not posting
   anything yet until all the walks are verified and fixed."* Your surface
   is the one that holds real credentials and real destinations. You may
   build and wire; you may NOT exercise any publish path, you may not arm
   one, and you may not call a live platform API. Validate/probe calls
   against real destinations are OUT for this session.
4. **You CANNOT screenshot-gate your own work — do not try.** `scripts/shoot-surface.mjs`
   points at the lead's dev server, which serves MAIN, so shooting it from
   here would capture code that is not yours and hand you a **false pass on a
   gate**; and `next dev` cannot run in a lane at all (Turbopack rejects the
   out-of-root node_modules symlinks). The script now REFUSES to run from a
   worktree, so this is enforced, not trusted. **The lead runs the
   screenshot-vs-sheet gate at merge time on merged main.** What you owe
   instead: for every surface you change, list the visual deltas you expect
   in your wrap (surface · what moves or appears · which sheet region must
   still match), so the gate knows what to look for.
5. **`npm run verify` before you wrap** — and **NEVER pipe the suite through
   `tail`**; write it to a file and read the file. **vitest does NOT
   typecheck** — three catches on record, one of them this session.
6. **Every fix gets a test in the same change.** Executable ratchets beat
   documented ones. A test that passes without your fix is not a ratchet —
   check by reverting.

## Wrap

Commit on your branch `s78-lane2-calsetprof`. **Do NOT merge** — the lead
merge-gates every lane on rebase + verify on merged main.

Write `agent_handoff/lanes/WRAP-s78-lane2.md` covering: what verification KILLED
(with the refutation reason), what survived and shipped, the screenshot
results, the `/api/calendar` verdict with its evidence, and anything you
deliberately left. State your final verify numbers.

Signal the lead when you are done.
