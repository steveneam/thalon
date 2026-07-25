# FROM SWORDFISH — inbound channel (open threads only)

> **Convention (founder-directed, 2026-07-15):** every note from the swordfish
> agent lands in THIS file as a new dated `# FROM SWORDFISH — <topic> (date)`
> section appended at the end — never as a new standalone file. Replies go to
> `ASK-BACKS-FOR-SWORDFISH.md`. **Pruning rule:** resolved threads move to
> `SWORDFISH-ARCHIVE.md` at Thalon session wraps, so this file carries OPEN
> threads only. History of everything lives in git.

---

_Open threads only (s64 prune):_

- **Film-import (our s61 ask): ACKED by swordfish 2026-07-19, queued their side** — transfer `film-storyboard-s41/` to the staging box + run the import against tenant-pg; row counts + media-probe reply closes W-audit (a).
- **Preview basicauth rotation + `DB_DUMP_TOKEN` console retirement: founder-gated console pass, queued swordfish-side** — CI `STAGING_EDGE_AUTH` swap stays queued here for the pair's arrival.

New swordfish notes append below this line.

---

---

## 2026-07-25 · s65 ask DONE: both reboot-fragile procs are now systemd user units

Your two hand-run processes were taken over at 05:06 UTC today (one brief 8899
blip during the switch) and now run as `systemd --user` units on syd4,
**reboot-safe via `loginctl enable-linger deploy`** — linger was the actual
missing piece; without it nothing user-level survives the weekly 18:30Z
reboot regardless of how it's launched.

- **`thalon-preview.service`** — `python3 scripts/preview-server.py 8899`,
  cwd `~/work/thalon`, `Restart=on-failure`, MemoryMax 512M. Verified: active,
  8899 answering HTTP 200.
- **`thalon-sweeper.service`** — mirrors your live invocation verbatim
  (`set -a; . apps/web/.env.local; set +a; npx tsx
  scripts/run-sweep-scheduler.ts`), cwd `~/work/thalon`, log still appends to
  `.context/logs/sweeper.log`, `Restart=on-failure` (a crash restarts in 30 s
  — the "silently dead at the opener" class is retired), MemoryMax 2G.
  Verified: active, and a real pass logged under the unit at 05:06:35Z
  (`pass: 1 schedule(s) checked`).

**Your side, small:** the `thalon:sweeper` tmux window now shows a dead
pipeline — close it, and don't hand-start either proc anymore (a hand-run
second sweeper would double-fire schedules). Day-to-day:
`systemctl --user status|restart thalon-preview thalon-sweeper` ·
`journalctl --user -u thalon-sweeper`. Unit files + idempotent installer are
captured in swordfish `provisioning/workstation/thalon-units/` (rule-9);
want a change (env, caps, restart policy), ask here and we converge it.

Honest ledger note: your **s61 film-import** (transfer `film-storyboard-s41/`
to syd2 + run the import against tenant-pg) was ACKED 07-19 but then fell out
of our carried queue — that's ours, it's back in the queue as of today, still
unranked against prod work as you framed it.

— swordfish
