# WRAP — lane `crm-rebuild` (exact-mock rebuild: Leads, then Profiles)

Branch `agent/crm-rebuild`, four commits, worktree clean. Both surfaces
rebuilt TWO-STEP from their sheets, one surface in flight at a time.

| | step 1 (pure port — the verdict point) | step 2 (wire + keepers, old code deleted) |
|---|---|---|
| **Leads** | `0c3c023` | `69cefbd` |
| **Profiles** | `43db792` | `f597e5c` |

Full `npm run verify` at the repo root: **GREEN** — guard PASS · **1967
passed / 9 skipped (274 files)** · typecheck clean · lint 0 errors (12
pre-existing warnings, none in this lane's files). Run at 18:59 UTC with the
box at load 4.2 (1-min) after waiting out the sibling lanes: at 18:57 load
was 11.0 with two lanes mid-suite, so the cheap gates (targeted tests,
workspace typecheck, repo lint, grep guard) ran first and the full suite took
the quiet window. Guard ran before every commit.

## Leads

**Step 1** — `components/leads/leads.css` (the sheet's helmet atomics, every
rule scoped under `.leads-surface`; `.avatar` deliberately not restated —
workspace.css already shares it) + `leads-surface.tsx` as the sheet's markup
with the sheet's placeholder content. workspace.css untouched.

**Step 2** — real reads through the existing `lib/leads` + `lib/approve-queue`
+ `lib/outreach` clients. No API, contract, db or engine change.

- rows = the real ranked queue (`compareLeadCards`, pinned first), score bars
  painted by the same thermal bands the workspace grades by;
- **Why this score** renders the scorer's OWN lines split into the sheet's
  three columns (signal + value · magnitude bar · the reason), with the
  untouched line on the row's `title` so the split loses nothing;
- **Activity** carries the two events the lead spine actually records;
- **Drafted outreach** reads the lead's own judged draft: compose stamps
  `params.leadId` on its run, so one run-feed match + ONE drafts read reaches
  it — no new route. Copy body / Copy subject / a real `mailto:` are live.

### Keepers woven back in (each behind byte-true resting chrome)

- **Lead-score provenance** (my named keeper row) — front half is the reason
  rows above; the weights ride one disclosure behind the footer's own line
  *"best fit first · reasons on every score"*: learned-vs-base, state
  id/age/evidence, per-signal multipliers, the lagging-leads amber, the
  ICP-drift line, `Learn from feedback`, `Score now`. All six behaviours of
  the deleted `weights-provenance.test.tsx` are re-pinned there.
- **Triage verbs** — `d` dismiss / `h` hot stay keystrokes (the legend lives
  in that same panel); dismissal confirms through the action toast with a way
  back to the dismissed view. Every dismiss/hot-pick is still the learn
  loop's input.
- **Intake** — CSV picker, the template link, the invalid-row report and
  `Sync waitlist` sit behind the header's own `Import contacts` button.
- **Lead → Create promote exits** (Post · Video · Page) — see the flag below.

## Profiles

**Step 1** — `components/profiles/profiles.css` (helmet atomics scoped under
`.profiles-surface`) + `profiles-surface.tsx` porting the sheet's three-column
wizard with its own Voice-step content; the route switched to it.

**Step 2** — the six steps over the live config, saving through
`formToConfig(form, active.config)`.

- **THE HAZARD IS PINNED.** `icp · cadence · routing · outreach · social` ride
  through every save verbatim, and the review step NAMES each present block
  and what it powers — the carry is visible provenance, not an invisible
  promise. Test: *"THE CARRY: saving writes the form-backed blocks and every
  carried block verbatim"*, plus *"a profile with no carried blocks invents
  none"*.
- A second silent-drop hazard found while mapping the Voice step and closed
  the same way: an **untouched free-text tone** (`voice.tone: "direct,
  technical"`) is carried unchanged — only actually picking chips replaces it,
  and the step says so on screen. Unknown `voice` keys are preserved too.
- Version history is one disclosure behind the header's version pill; the rail
  marks a step ✓ when the profile already carries its data.

## Pin deltas (my surfaces' rows only)

- `bridge-burndown.test.ts` — **removed** `leads/leads-surface.tsx` (13),
  `leads/lead-card.tsx` (13), `leads/weights-provenance.tsx` (7),
  `profiles/profile-editor.tsx` (13). Both surfaces sit at ZERO bridged tokens.
- `mono-ratchet.test.ts` — **removed** `leads/leads-surface.tsx` (2),
  `leads/lead-card.tsx` (1), `leads/weights-provenance.tsx` (1).
- `selected-row.test.ts` — **removed** `leads/lead-card.tsx`; the rebuilt rows
  wear the sheet's own `.row.sel`. `board/leads-board.tsx` stays (not mine).

## Deletions

`components/leads/lead-card.tsx` · `components/leads/weights-provenance.tsx` ·
`components/profiles/profile-editor.tsx` · and the four old-design suites
(`leads-board-tab.test.tsx`, `leads-keyboard.test.tsx`,
`weights-provenance.test.tsx`, `profile-editor.test.tsx`).

New files: `leads.css`, `leads-model.ts`, `profiles.css`, `profiles-model.ts`,
`profiles-surface.tsx`.

## Test deltas

- `leads/__tests__/leads-surface.test.tsx` — rewritten, **18 cases**: the
  sheet's bands over real data, reasons-verbatim, activity honesty, unscored
  "–", stale-ICP, j/k/d/h, the provenance keeper (state · multipliers ·
  lagging · drift · unarmed · learn), intake panel, the promote exits, the
  outreach band (judged draft · blocked pill · compose door · mailto ·
  disabled Log-a-call), read-failure alert, Board-tab gap, zero bridge classes.
- `profiles/__tests__/profiles-surface.test.tsx` — new, **13 cases**, led by
  the carry pins above.

## Flagged — the sheet's ambiguities and the backend's gaps (nothing improvised)

1. **Leads' `Board` seg has no board in the mock.** `Board.dc.html` is the
   CONTENT pipeline board, drawn under Home ("Today · Overview | Board"), not
   a leads board. So the tab renders and states that plainly. **Consequence
   for the lead: `components/board/leads-board.tsx` (the legacy lead pipeline
   board) is now unreferenced** — it is the planner lane's file set, its pins
   are untouched, and whether it re-enters (and where) is a call above this
   lane.
2. **The lead → Create promote exits have no band in the sheet.** Rather than
   strand a shipped door (`/api/leads/promote`, and Create's own
   `lead_promote` pick-chip path), Post/Video/Page ride the footer disclosure
   beside the provenance. Resting chrome stays byte-true; if the founder wants
   them elsewhere, that is a placement call, not a rebuild.
3. **`Log a call` is rendered disabled** with its reason — no engagement store
   exists. Same root as: **Activity shows intake + scoring only**; opens,
   clicks and replies need a store that isn't built.
4. **Outreach reads are bounded by the run feed.** A lead whose compose run has
   aged out of `/api/runs` shows the compose door instead of its old draft;
   composing again is idempotent (returns the existing draft, zero spend), so
   the failure mode is benign — but a `drafts?leadId=` read would make it
   exact, and that is an API change this lane was not to make.
5. **Cross-surface copy drift for the lead:** Create still says *"use the →
   Email exit on a lead card"* (`create-surface.tsx`) — that chrome is gone;
   the door is now `Draft outreach` in the lead's detail card. One-line fix,
   in another lane's file set.
6. **Profiles: five of six step titles had to be authored** — the canvas drew
   only step 2 (Voice). They follow the sheet's grammar (a question + one
   line); the founder may want his own words.
7. **Profiles: the sheet's "saved as you go" is not true** of a versioned
   save, so the line states what is (*held here until you save vN*). Shipping
   the sheet's words would have been a lie about where the operator's edits live.
8. **Profiles: "Or point at writing you admire" ships disabled** with its
   reason — nothing fetches a URL (exemplar ingestion is engine-side and
   reachable from no route). Step 4's cadence is **read-only** for the same
   honesty: the wizard carries cadence, it does not edit it.
9. **Header pills render only on a successful read**, and the hot pill hides at
   zero — a `0 hot` amber pill would break "amber = needs-you only".
10. The design hook flagged `13.5px` in both surface stylesheets as off-ramp.
    Left unchanged and unsuppressed: those are the sheets' own helmet values,
    and DOCTRINE 0 makes the sheet's bytes the spec.

## For the lead's merge gate

Screenshot-vs-sheet was not run here (`next dev` can't run in this worktree —
Turbopack rejects the symlinks), so both surfaces are written for that gate:
resting chrome is the sheet's markup and classes, every deviation above is
either a disabled control with its reason or a state behind existing chrome.
Both surface stylesheets are fully scoped (`surface-css-scope` green), and
`.split` here is the sheet's 480px — Approve's 600px is untouched.
