# KICKOFF — lane `videos-rebuild` (the LAST three sheets: Videos Overview → Video Dossier → Videos/editor)

> **APPROVAL ON RECORD (founder, s75 close):** parallel rebuild lanes are
> open (s73 close, reaffirmed s74 and again at s75: *"prepare for the
> parallel workflow next session"*). And the call that puts THIS work in a
> lane at all — the founder had previously called Videos a *re-conception*,
> which is why it was reserved lead-direct; at the s75 close he settled it:
> **"i'll defer to your recommendation on how to handle it, but still want
> it designed exactly as mocked."** So Videos is a PORT, held to the same
> byte-fidelity bar as the eight surfaces already shipped this way. You are
> a port, not a designer — the sheet's bytes win every call.

Read `CLAUDE.md` first, then IN ORDER:

- `docs/research/mock-sheets/README.md` — **THE CONTRACT.** Rule 0
  ("exact" = the sheet's own HTML/CSS ported 1:1, never re-expressed
  through a component library — that re-expression is the pinned s72
  failure), rule 2 (placeholders over drift), rule 3 (demolish, don't
  renovate), **rule 6 (SCOPE EVERY SURFACE STYLESHEET — it names the two
  video sheets explicitly as a proven collision: `.strip`, `.play-btn`,
  `.play-tri`, `.thumb-sm`)**, and the two newest sections at the end:
  *Founder amendments* and *Proposals — NOT yet verdicted (do not port)*.
- **YOUR THREE SHEETS**, beside `theme.css`:
  `docs/research/mock-sheets/Videos Overview.dc.html` ·
  `Video Dossier.dc.html` · `Videos.dc.html`.
- `docs/research/old-design-keepers.md` — **the densest keeper set in the
  repo is yours**: the multi-track EDL editor, the version rail, takes and
  their rejects-with-reasons, the storyboard cards, the assist panel, the
  music lane. Read the re-entry rule before you decide any of their fates.
- `docs/research/ui-overhaul-plan.md` §5 (DOCTRINE 0 + the s73/s74/s75
  blocks, including **VISIBLE PROVENANCE** and **"the judge gates — it
  never rewrites"**).
- **THE WORKED EXEMPLARS — fourteen surfaces have shipped this way.** Read
  at least two before you write a line: `apps/web/src/components/leads/`
  (list + detail split, keepers behind byte-true chrome) and
  `apps/web/src/components/board/` (a column grammar, scoped CSS). The
  shared shell classes live in `apps/web/src/app/app/workspace.css` —
  **READ-ONLY for you; never edit it.**

## Your file set (nothing outside it, except the pins named below)

- `apps/web/src/components/videos/**` — yours entirely, including deletions
- `apps/web/src/app/app/videos/**` — the three routes
- `apps/web/src/lib/videos/**` — only if a read model genuinely needs it
- the ratchet pins, which the lead resolves at the merge gate:
  `apps/web/src/lib/__tests__/bridge-burndown.test.ts`,
  `mono-ratchet.test.ts`, `selected-row.test.ts`

**The other lane this session is `leadboard-wire`, which owns
`components/leads/**` and `components/board/**`. Do not touch either.**

## The method — TWO STEPS PER SHEET, one sheet in flight at a time

This is the ritual every shipped surface used, and it is not optional:

1. **Step 1 — pure port.** The sheet's markup and its helmet CSS, with the
   sheet's own placeholder content and **zero wiring**. Commit it alone.
   This is the founder's structural verdict point: he can look at it and
   say "that's the mock" before any wiring effort is spent.
2. **Step 2 — wire + keepers, old code deleted in the SAME commit.** Real
   reads through the existing `lib/` clients. Do not change any API,
   contract, db or engine code; if you think you need to, stop and say so
   in your wrap instead.

**Order: Videos Overview → Video Dossier → Videos (the editor) last.** The
editor is the biggest and most keeper-dense; do it when you already have
the other two shipped and the domain in your head.

## Rules that have each cost this repo a real incident

- **Scope your stylesheets.** `components/videos/<name>.css`, every rule
  under a surface root class (`.videos-surface`, `.dossier-surface`,
  `.editor-surface`), applied beside `.content` on the root element.
  `src/lib/__tests__/surface-css-scope.test.ts` enforces it and it WILL go
  red. The two video sheets are named in rule 6 as proven collisions.
- **Never fabricate a value to fill a fixture.** If the wire has no field
  for something the sheet draws, ship the sheet's placeholder treatment and
  say what is true. Every shipped surface has honest deviations; they were
  all accepted. An invented number is the one thing that is not.
- **Thumbnails: PLACEHOLDER, deliberately** (founder s75: *"also have
  placeholder until bmedia ready"*). The striped `.thumb`/`.thumb-sm` box
  with its mono legend is the correct, founder-confirmed render until
  B-media ships the media join. `docs/research/source-media-plan.md` has
  the full picture, and `mock-sheets/Source Media.dc.html` is a PROPOSAL —
  **do not port it.** If a take genuinely has a rendered file behind it
  (`video_takes.ref` + the `/assets/<sha256>` door), that is real media and
  may be shown; a poster frame derived from video is NOT built yet.
- **Never pipe a gate through `tail`.** It swallowed a failure and put main
  red twice. Write output to a file and read it.
- **Sequence your verify against the other lane.** Two full suites on 6
  vCPU contend badly. Run cheap gates (targeted tests, typecheck, lint)
  while you work, and take the full `npm run verify` in a quiet window —
  check `uptime` first. The s75 crm lane did exactly this and was right.
- **Run the grep guard before every commit**: `pwsh scripts/ci-grep-guard.ps1`.

## Definition of done

Three sheets shipped two-step, `npm run verify` GREEN at the repo root
(guard · suite · typecheck · lint), worktree clean, branch pushed, and
`agent_handoff/lanes/WRAP-videos-rebuild.md` written: what shipped per sheet,
every keeper's fate (re-entered where / deliberately retired / flagged),
every honest deviation with its REASON, the pin-file deltas, and anything
you found that is above this lane's pay grade. The lead merge-gates on a
screenshot-vs-sheet diff plus a verify on merged main.

If three sheets prove to be more than one session holds, **ship complete
surfaces, not partial ones** — two done properly beats three half-wired,
and say plainly in the wrap which is left.
