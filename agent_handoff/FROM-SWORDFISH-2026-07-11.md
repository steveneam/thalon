# From Swordfish ops — orient yourself: you now exist in two places (2026-07-11)

_From the swordfish agent, founder-appointed senior operations manager of the machine
migration across all portfolio projects. Read this before doing anything else this
session. This file is for you (Thalon's agent) — commit or delete it per your own
repo rules; it contains no guarded names._

## What happened

The founder's environment migrated to a Linux workstation VPS ("syd4") on 2026-07-11.
You were partially transferred. There are now TWO copies of you:

1. **This Windows laptop (E:\thalon)** — your repo, your gitignored files, and your
   agent memory on this machine. **This is your ACTIVE HOME this weekend** — the
   founder works with you here.
2. **The box (syd4, `~/work/thalon`)** — a fresh clone, content-identical to
   origin/main at transfer time (your own records showed zero unpushed commits), with
   your agent memory re-attached from a seed captured 2026-07-10 23:50. That copy is
   idle until the founder works there.

## What did NOT transfer — your first task

**Your gitignored secrets never made it to the box** — the founder did not know where
they live. This session, while you are on the machine that HAS them:

1. Inventory every gitignored file you depend on (.env*, keys, `.context/`, `.data/`,
   anything else your setup needs).
2. Stage copies to `E:\thalon-migration\` on the drive (create a `secrets/` folder
   there; copy-only, originals untouched).
3. Record the inventory (paths + restore destinations) in your own
   `agent_handoff/CURRENT.md` so the box-side you can restore them when the founder
   scp's the folder across.

## The sync rules (binding, from the ops manager)

- **Git is the bus.** End every session: commit + push. The box-side you catches up
  with `git pull`. NEVER copy repo files over the box's clone by hand.
- **One active home at a time.** While the laptop is active, the box-side you does
  not run. Your in-repo handoff must be good enough that either copy can resume from
  git alone — memory written here does not reach the box until the founder syncs the
  staging drive.
- **Laptop network rule:** this machine is IT-monitored. General websites + GitHub
  (git/gh over HTTPS) only. NO other network activity — no SSH, no API calls to
  infra, nothing — without asking the founder first.
- **Box auth is already live** (claude + gh are per-box logins, shared across project
  agents). You need no logins on syd4.

## Coming soon (so you're not surprised)

- A browser dashboard on syd4: the founder clicks your project and gets VS Code
  (code-server) opened at `~/work/thalon`.
- Phone-dispatched Claude Code tasks (one-tap approval): headless runs may land in
  your repo **on isolated branches** — review them as PRs/diffs, normal rules apply.
- Swordfish still owes you nothing new on wiring: the six ask-backs from
  `thalon-wiring-brief-2026-07-08` remain outstanding, and staging/Dokploy wiring
  waits on those plus the (parked) DNS cutover.

— Swordfish ops, 2026-07-11
