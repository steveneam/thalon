# KICKOFF — lane `leadboard-wire` (Leads board STEP 2: wire it, then delete the legacy board)

> **APPROVAL ON RECORD (founder, s75 close):** *"crete the lead[s board]
> based on the mock, and plan to have it wired/working next session"* — the
> lead shipped **step 1** in s75 (`5408090`, structure only, zero wiring);
> **you are step 2.** Parallel lanes are open per the s73/s74/s75 rulings.

Read `CLAUDE.md` first, then IN ORDER:

- `docs/research/mock-sheets/README.md` — the contract; **rule 6 (scoped
  stylesheets) is the one that bites here**, because the leads board and
  the content board deliberately share class names (`.cols`, `.col`,
  `.col-hd`, `.col-bd`) with **different values**: the content pipeline
  draws six columns, the lead lifecycle three.
- `apps/web/src/components/leads/leads-board.tsx` — **step 1, and your
  brief.** Its header comment states what step 2 owes. Read it first.
- `apps/web/src/components/leads/leads-model.ts` — `LEAD_BOARD_COLUMNS` is
  **contract-derived** (`LEAD_STATUSES` filtered by whether the status has
  exits in `LEAD_TRANSITIONS`). Keep it that way. Terminal statuses are
  never columns, because a terminal state is not a drop target.
- `apps/web/src/components/leads/leads-surface.tsx` — the surface that owns
  the List/Board segmented control and already holds the real leads.
- `apps/web/src/components/board/board-surface.tsx` — the CONTENT pipeline
  board, shipped s75. **Read it for its column grammar; it is not yours to
  change.** (Note it uses `board-model.ts`; the legacy `board/model.ts` is
  a different, older file — see below.)
- `docs/research/old-design-keepers.md` — the re-entry rule.

## What step 2 owes

1. **Real leads in the columns.** The surface already loads them; group by
   `status` into `LEAD_BOARD_COLUMNS`, ordered by the same
   `compareLeadCards` the list ranks by, so the two views agree. Counts
   replace the `–` placeholders — and an empty column reads honestly, not
   as a suspicious zero.
2. **The card is a LEAD card**: identity badge (`leadInitials`), name ·
   company (`leadTitle`), and the score bar painted by the same thermal
   band the list uses (`heatColor`). Reuse the model helpers; do not
   restate them.
3. **The layout call the lead flagged.** Step 1 renders inside the
   surface's list/detail split, and a kanban in that ~480px left pane is
   cramped. Decide deliberately: either the board takes the full content
   width when the Board tab is active (likely right), or it keeps the split
   and the columns scroll. Say which you chose and why in the wrap.
4. **The keyboard grammar.** The legacy board had a 2D extension of the ONE
   list grammar (`lib/workspace/keyboard.ts`): j/k within a column, h/l
   across columns. Re-enter it only if it lands clean behind byte-true
   resting chrome — the re-entry rule says a keeper returns as a state
   behind the sheet's chrome, never as extra chrome. If it does not fit,
   say so and leave it out; do not bolt on a second control band.
5. **THEN delete the legacy set, in the SAME commit that replaces it**
   (DOCTRINE 0 — the old implementation dies with the change that replaces
   it, never before): `apps/web/src/components/board/leads-board.tsx`,
   `apps/web/src/components/board/model.ts`, and their tests
   (`__tests__/leads-board.test.tsx`, `__tests__/model.test.ts`). These are
   ORPHANED today — nothing imports them; the s75 merge gate found this and
   the founder ruled the capability comes back here. **Check the import
   graph yourself before deleting; do not take this file's word for it.**
   Their rows in the ratchet pins come out with them.

## HONEST LIMIT you must preserve, not quietly fix

**No drag-between-columns.** Today's lead lifecycle is engine-owned —
scoring and the send door set it — so a drop target would fake an agency
the operator does not have. Step 1 says this in the footer, in plain words.
Keep saying it. It arrives with the operator-owned stage field, which is a
contract-window change and is not yours.

## Your file set

- `apps/web/src/components/leads/**`
- `apps/web/src/components/board/**` — **deletions only**, per item 5.
  `board-surface.tsx` / `board-model.ts` / `board.css` are the shipped
  content board: DO NOT TOUCH.
- the ratchet pins, resolved by the lead at the gate:
  `apps/web/src/lib/__tests__/bridge-burndown.test.ts`,
  `mono-ratchet.test.ts`, `selected-row.test.ts`

**The other lane this session is `videos-rebuild`, which owns
`components/videos/**` and `app/app/videos/**`. Do not touch either.**

## Rules that have each cost this repo a real incident

- **Scope your stylesheets** — step 1's rules are already under
  `.leads-surface` in `leads.css`; keep every new rule there.
  `src/lib/__tests__/surface-css-scope.test.ts` enforces it.
- **Never fabricate a value.** An empty column says it is empty.
- **Thumbnails stay placeholders** (founder s75: *"also have placeholder
  until bmedia ready"*) — not that lead cards carry media today.
- **Never pipe a gate through `tail`** — it put main red twice.
- **Sequence your verify against the other lane** (check `uptime`); this
  lane is the smaller one, so you will likely reach the full suite first.
- **Run the grep guard before every commit**: `pwsh scripts/ci-grep-guard.ps1`.

## Definition of done

Board wired, legacy set deleted, `npm run verify` GREEN at the repo root,
worktree clean, branch pushed, and `agent_handoff/lanes/WRAP-leadboard-wire.md`
written: what you wired, the layout call and why, the keyboard-grammar
verdict, proof the deleted files were genuinely orphaned, pin deltas, and
anything above this lane's pay grade. The lead merge-gates on a live
screenshot plus a verify on merged main.
