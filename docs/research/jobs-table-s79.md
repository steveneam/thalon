# The JOBS TABLE — use-truth per surface (s79)

> **What this is.** For each surface, the jobs an operator would actually try,
> driven in a real browser and scored three ways: **works** · **dead door** (the
> control is there and eats the intent) · **no affordance** (nothing offers the
> job at all).
>
> Produced by `node scripts/drive-surface.mjs --jobs all`. Re-run it; do not
> trust this file as current.

## Why a third verdict exists

The s78 lesson, in the founder's words: *"was the calendar really fixed, how did
shit like this get through the agents?"* The s77 fan-out was a **reading** walk —
189 findings, 59 agents on the editor alone — and it missed that the calendar
could not PLAN anything. A reviewer saw `Reschedule` gated on `kind === "plan"`
and marked it consistent. Nobody noticed there were **zero plans and nothing in
the product could create one**. He found it in ten minutes of clicking.

A pass/fail gate cannot express that defect, because nothing was *wrong* — a
capability was *absent*. That is the whole reason the third column exists, and
why the video-editor walk's jobs table (of 27 jobs: 8 work, 4 dead doors, 15 no
affordance) was the most useful artifact s78 produced.

## The harness is not above suspicion

The first full run of this table had **four wrong selectors**, and two of them
produced **passes on surfaces that genuinely carry the defect** — Create's
staged-flow door "worked" because the job only checked for an `href`, and Intel's
flagship exit "worked" because the job followed the *rail's* Create link instead
of the dossier's own button. A third invented a finding: Sites' cards **are** the
anchors (`a.site-card`), so a `.card a` selector reported "no affordance" on a
portfolio full of working cards.

So: selectors come from `--inventory <route>`, never from reading the component,
and a job the harness cannot evaluate exits **non-zero as a harness error** — never
as a pass. A gate that invents findings is worse than no gate; a gate that hides
them is worse still.

## Baseline — main @ `2db2406`, before the s79 lane fixes landed

Dark mode, 1440×940 (from `mock-sheets/theme.css`). 25 jobs across 7 surfaces:
**14 work · 9 dead doors · 2 no affordance.**

| surface | job | verdict | measured |
|---|---|---|---|
| dashboard | see what needs me, and open one of those items | ✓ | lands on `/app/approve?run=…&draft=…` |
| dashboard | trust the stated needs-you count against the rows offered | ✗ dead door | surface states **25**, card offers **21** rows, nothing explains the gap |
| dashboard | walk needs-you by j/k and keep the selection in view | ✗ dead door | j walked the selection out of `.card-rows` and the box never followed |
| dashboard | read 'your review' as a status needing action | ✗ dead door | `.mark-you` paints `lab(57 -4.3 -46.1)` — opposite channel to `--warn lab(76.2 15.1 58.8)` |
| dashboard | read today's plan on the week view, reach the calendar | ✓ | week view present, links through |
| transcription | ingest a source by URL | ✓ | ingest input present |
| transcription | drop a file into the ingest box | ✓ | not advertised on this build — nothing to honour |
| transcription | find one source in the shelf (search/filter/sort) | — no affordance | unbounded shelf, no search, no filter, no sort |
| transcription | tell a disabled control from a live one | ✗ dead door | `Ingest` is disabled at full opacity with a normal cursor |
| sites | open a site dossier from the portfolio | ✓ | lands on `/app/sites/fern-and-crumb` |
| sites | follow the dossier's Wave fact back to the portfolio | ✗ dead door | the Wave fact is not a door |
| sites | apply a filter, then clear it from what is on screen | ✗ dead door | filter applied with no visible clear/all to undo it |
| approve | read a waiting draft and see why the judge passed it | ✓ | reasons panel opens |
| approve | tell the two grounding tiers apart | ✓ | **"Grounding — screen" / "Grounding — final"** — already distinct |
| approve | trust the waiting count against the bulk action's count | ✗ dead door | "13 waiting" beside "Approve all waiting (**2**)" |
| approve | arrive from an unmatched deep link and be told so | ✓ | *"That run has no drafts in this queue…"* |
| create | write a brief and generate from it | ✓ | Generate reachable (**not pressed** — spend gate) |
| create | follow Intel's PRIMARY exit into Create and generate | ✗ dead door | lands `/app/create?ctx=intel-capture-3` with Generate **refused** |
| create | write a brief, then take it into the advanced/staged flow | ✗ dead door | "Advanced · staged flow →" lands on **`/app/approve`**; the brief is discarded |
| create | get back to the source behind the grounding row | ✗ dead door | the capture's URL is never a link |
| intel | walk the rising list by keyboard, open one into the dossier | ✓ | j/↵ opens it |
| intel | ride a trend without an angle | ✓ | angle control present (toggle-off truth is the seam's) |
| intel | promote the dossier into Create | ✓ | exit present: "Create post · suggested" |
| videos | open a video project from the list | ✓ | lands on `/app/videos/<id>` |
| videos | trust the card's aspect-cut count against the project page | ✓ | card says 1 aspect cut, page agrees |

### What the baseline says about the lanes' own work list

**11 of the 22 blocker+high findings the two s79 lanes are verifying were
independently reproduced here by USE**, including both remaining blockers (Sites'
Wave door, Intel→Create's dead end — the latter caught with its exact
`?ctx=intel-capture-3` handover). Those 11 must flip to ✓ at the merge gate; that
is what this baseline is for.

**One looks refuted on today's main:** Approve's *"reasons panel labels both
grounding tiers 'Grounding'"* — the rows read "Grounding — screen" and
"Grounding — final", which are distinguishable. Lane 4 reaches its own verdict
adversarially; this is a second, independent signal pointing the same way, not a
substitute for it.

### Jobs deliberately not driven

- **Anything that spends.** Generate is checked for *reachability* and never
  pressed: generation is a metered gateway call, and the sequence gate stands —
  *"we're not posting anything yet until all the walks are verified and fixed."*
- **Any publish path.** Not exercised, on the same gate.
- **The video EDITOR** (`/app/videos/[projectId]/edit`) — 36 findings and 15
  jobs with no affordance at all, awaiting the founder's scope call. It is the
  surface this harness would pay off on most, and it is not s79's.
