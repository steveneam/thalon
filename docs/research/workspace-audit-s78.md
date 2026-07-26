# The full troubleshoot + verification pass — plan of record

> **Founder directive (s77, verbatim):** *"so has all the 17 pages or so of
> the mock claude-design been implemented in the workspace redesign? if so, i
> might be worth going through each page, section, feature, and buttons, to
> check that consistency and functionality is there (like the Ready to Create
> in the Intel section is not working properly), as well as re-introduce the
> good things (like filters, sort by, a workable calendar etc) from the old
> design, and elaborate as necessary but keeping to the structure of the new
> design. so basically a full troubleshoot and verification pass and bug
> fixes when you have time."*

## 0. His first question, answered exactly

**Yes — all of them.** 17 `.dc.html` files exist; **15 are surface sheets and
all 15 are built and routed.** The other two are not surfaces: `Source Media`
is the B-media.0 component spec (shipped s77 as `<SourceThumb>`), and
`Wave 0 - Triage spine` was superseded by the rebuild it planned.

| sheet | route | sheet | route |
|---|---|---|---|
| Dashboard | `/app` | Leads | `/app/leads` |
| Intel | `/app/intel` | Profiles | `/app/profiles` |
| Create | `/app/create` | Sites | `/app/sites` (+ `/[slug]`) |
| Approve | `/app/approve` | Integrations | `/app/settings/integrations` |
| Calendar | `/app/calendar` | Videos Overview | `/app/videos` |
| Board | `/app/board` | Video Dossier | `/app/videos/[id]` |
| Runs | `/app/runs` | Videos (editor) | `/app/videos/[id]/edit` |
| Library→Transcription | `/app/transcription` | | |

So the *structure* is complete. What he is pointing at is the next layer:
**the surfaces are drawn and the doors behind many of them are not armed.**

## 1. His named bug, diagnosed — and it is not what it looks like

*"the Ready to Create in the Intel section is not working properly"*

**The Ready-to-Create block itself works.** Driven in a real browser: picking
a non-default title and an angle, then "Create post · suggested", promotes
correctly (`POST /api/intel/trends/<id>/promote` → 200), carries the exact
pick, and lands on `/app/create?ctx=intel-capture-N` with the prompt
prefilled from the chosen angle + hook and the context chip reading *"From
intel · title + angle + hook + source + area + source text attached"*. It
navigates; it is just slow on a cold dev route compile, which reads as a
hang.

**The dead end is one step later, and it is a real one.** On Create:

```
create-surface.tsx:178
const armed = family === "video" || (family === "email" && Boolean(pick?.leadId));
```

Only **Video** is armed. **Post and Page are not**, so `Generate` renders
disabled with *"Live post generation isn't wired to this surface yet."* And
Intel's own *suggested* exit for a thread-shaped card is **post** — so the
single most natural path in the product (spot a trend → create a post)
dead-ends on a button you cannot press, every time.

**The engine is not the problem.** `runFanout` is complete and tested, and it
produced the 25 drafts sitting in Approve right now. The gap is precise:

> **`runFanout` has ZERO callers in `apps/web/src`.**

There is no web door to the primary content path. That is the single highest-
value fix in this document, and it explains the founder's instinct that
something is off in a place that otherwise looks finished.

## 2. Every unarmed door, swept (grounded, not guessed)

| # | surface | what is dead | why | size |
|---|---|---|---|---|
| 1 | **Create** | **post + page Generate** | no web caller for `runFanout` | **L — the headline** |
| 2 | Calendar | drag-to-reschedule | **no `/api/calendar` route exists at all** — the slot store has no write door | M |
| 3 | Runs | Retry | no replay route | **being armed now** — the s77 window shipped `run-replay.ts`; `media-lane-b` is live |
| 4 | Sites | build-from-prompt | B-sitegen is chartered, not built | XL — its own bucket, not this pass |
| 5 | Profiles | re-activate an older version | no write path for version rollback | S |
| 6 | Staged flow | stage editing | one-prompt chain only | M |
| 7 | Dashboard | week card publish | "plans, not uploads" — deliberate today | S (verify intent) |

Items 1, 2, 5 are the pass. Item 3 is in flight. Item 4 is a separate
charter. Item 7 may be correct as-is and needs a ruling, not a fix.

## 3. His "re-introduce the good things" list

He named three, and each needs a different answer:

- **Filters / sort-by.** The sheets draw filter chips on several surfaces but
  the rebuild ported only what each sheet drew, so sorting is thin. This is
  the clearest "elaborate as necessary, keeping the new structure" case:
  filters belong in the sheets' own chip grammar, not a new control language.
  **Approve's sort chip is a known contradiction** already on record — its
  chip says "Oldest first" while its own rows are drawn newest-first (s74
  finding, still open pending his ruling).
- **A workable calendar.** This is item 2 above plus the known clipping bug:
  concurrent same-instant events split the column to ~45px and clip mid-word
  ("Linked·", "Faceb·") — the sheet's own `overflow:hidden` meeting a density
  its fixture never had. A "+N more" treatment would be a sheet change, which
  is why the lane left it. **Both need him to accept a small sheet
  divergence**, which the README's *Founder amendments* section exists for.
- **"Elaborate as necessary."** Read as licence to design missing states in
  the sheets' language (the Intel-Search precedent), never as licence to
  import the old design's chrome. DOCTRINE 0 still holds: the sheets are the
  structure; the elaboration fills gaps they are silent on.

## 4. How the pass should run

**Not as one sweep.** The s62 workspace audit worked because it was a scored
walk with fixes in the same session; this is bigger, because it is mostly
*arming doors* rather than correcting pixels.

1. **Fix 1 first, alone, lead-direct.** The post/page Create door is the
   product's spine. It needs a real API route, the judge gate on the way out
   (nothing ungated ever reaches Approve — AGENTS.md rule 4), and honest
   run/cost surfacing. It is not a lane; it is the lead's own work and it
   deserves a full session.
2. **Then a per-surface walk**, one surface per pass, each producing: every
   button exercised in a real browser, a screenshot-vs-sheet diff, and a
   short scored note. Parallelisable as lanes once the file sets are disjoint
   — the wave-2/3 shape that has worked three times.
3. **Founder rulings to collect BEFORE the walk** (they change the work):
   Approve's sort chip · the calendar "+N more" divergence · whether the
   Dashboard publish door should arm at all.

**Spend note, stated plainly:** arming post generation means real gateway
token spend on every Generate click. That is the first thing in this document
that costs money per use, so it wants his explicit GO on the arming, not just
on the building.
