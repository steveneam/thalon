# From Swordfish (infra/ops) — 2026-07-13

_Left by the swordfish agent at the founder's request. Not written by your own
agent — read, adopt, then file/delete as you see fit (this file arrives
untracked; committing it is your call)._

## You now own "Website Design General"

Founder call 2026-07-13: the drive folder `Website Design General` (previously
unclaimed) **belongs to Thalon**. It is a small standalone web-design project
with its own `.claude/` config.

**Where it is:** `~/migration/thalon-migration/website-design-general/` —
**placed and verified** (15 files, ~14 MB, matches the census exactly;
transferred + placed 2026-07-13 ~16:45 +10:00).

**What's in it** (from the drive census — 15 real files, ~14 MB):

- `index.html` — the site itself
- `screenshot.png` … `screenshot5.png` (5 files, ~13.7 MB)
- `.claude/` — 8 files: `CLAUDE.md`, `CLAUDE (Rules Based).md`,
  `rules/design-rules.md`, `rules/technical-defaults.md`,
  `agents/tell-me-the-time.md` — the design rules may be worth folding into
  your own docs rather than keeping as a parallel config
- `.DS_Store` (ignore)

**node_modules was deliberately NOT transferred.** On the drive it was 4,370
of the folder's 4,385 files (42.8 MB) and it is **orphaned** — there is no
`package.json` anywhere in the folder outside `node_modules` itself, so
nothing references it and there is nothing to reinstall from. If you ever
need deps for this project, you'd be starting a fresh `package.json` anyway.
This was the founder's dedupe call, executed at the transfer source
(rsync `--exclude node_modules`).

**Your move when you wake:** verify the staged folder matches the list above,
pick its final home (in or beside your repo — swordfish deliberately did not
touch your repo), and tell the founder where it ended up.

## Mode B is now crash-proof on this box (added 16:31 +10:00)

You ran parallel lanes two ways (your `COORDINATION.md`): in-session worktree
subagents, and **Mode B — founder-opened terminals** (your Sprint 0
`claude --worktree b05-aws` second terminal; your Sprint 2 notes call all-4-
concurrent "Mode B if pulled"). On syd4, Mode B's old fragility is gone:

- Every code-server terminal now lands in a **tmux session named after its
  folder** with claude auto-started (`agent-term`, the box's default terminal
  profile). A window/browser crash no longer kills a lane — reopening the
  folder's terminal reattaches to the live session.
- So all-N-concurrent is now as durable as in-session subagents: one
  code-server window per worktree folder, each lane its own named session.
- Same-folder second tab mirrors the first (tmux semantics, not a bug); a
  plain shell is the "bash" profile in the terminal dropdown.
- `work` over ssh joins the same folder-named session — no duplicate agents.

Founder asked that this reach you explicitly (2026-07-13); he considered your
lane technique the portfolio's heaviest use of it.

— swordfish (senior ops), syd4
