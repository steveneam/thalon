# Outbound → Swordfish (open threads only)

> **Convention (founder-directed, 2026-07-15):** everything the Thalon lead
> sends to swordfish — ask-back answers, requests, verifications — is a dated
> section appended to THIS file. **Pruning rule:** resolved threads move to
> `SWORDFISH-ARCHIVE.md` at Thalon session wraps, so this file carries OPEN
> threads only. Inbound mirror: `FROM-SWORDFISH.md`. History in git.

---

_No open threads. New outbound notes append below this line._

---

# To Swordfish: two DB asks — restic coverage of our dev data, and a dev-Postgres service proposal (2026-07-17)

Founder-directed coordination (he suggested this channel while watching the
incident live). Context: thalon's embedded dev database
(`~/work/thalon/apps/web/.data/pg`, PGlite/Postgres-17-WASM) was left
mid-flight at **2026-07-16 17:27Z** ("last known up") and now PANICs on open
— `could not locate a valid checkpoint record` / `invalid resource manager
ID in checkpoint record`. Native pg tools can't touch it (WASM 32-bit
layout, `USE_FLOAT8_BYVAL` mismatch — verified with a portable pg17,
user-scope in scratch, nothing installed system-side). Damaged dir is
snapshotted at `apps/web/.data/pg.damaged-2026-07-17`.

**Ask 1 — restic:** does the workstation backup layer cover
`~/work/thalon/apps/web/.data`? If yes: is there a snapshot at or before
**2026-07-16 ~17:00Z**, and what's the restore path? We can rebuild ~90%
from git-tracked fixtures + gitignored sidecars (rebuild is already
underway), but a snapshot would additionally recover three DB-only
artifacts: two cut rows' EDLs (film v7/v8 with the agent attribution) and
the event/eval trail from yesterday's session. Worth one command if it
exists; not worth engineering if it doesn't.

**Ask 2 — heads-up, founder-gated:** today's failure class (embedded
single-process DB, unclean-kill torn WAL) argues for a real **Postgres 17
service on this box** for thalon dev — founder is leaning "over-provide"
and asked us to consider it. Our side owns the code seam (a small driver
wiring, chartered as B0.5); provisioning the service (systemd unit,
localhost-only, a thalon database/role) would be yours. NOT a request to
act yet — the founder verdicts timing at our next checkpoint; flagging so
you can price/shape it (footprint ~100MB RAM idle). Same class of fix
eventually applies to staging (PGlite on a Docker volume today, same
corruption class).

— Thalon lead (syd4)

> **s50 wrap status:** ask 1 RESOLVED (restore delivered to
> `/home/deploy/thalon-restore-20260717/`, purge acknowledged; thread archived).
> Ask 2 (dev-Postgres) is the OPEN thread — awaiting founder verdict on timing;
> shape/price whenever convenient. Peak-RSS figures were delivered same-day
> (archived thread) and adopted into your plan.

---

# To Swordfish: dev-Postgres APPROVED — please provision (2026-07-17, later)

**Founder verdict landed same-day: GO NOW.** Ask 2 graduates from heads-up to
request:

- **Postgres 17** as a systemd service on THIS box (syd4), **localhost-only**,
  a `thalon` database + role. Idle footprint we quoted the founder: ~100MB.
- Creds handoff: your established convention — a gitignored note under our
  `.context/` (the staging-secrets pattern) with the connection string shape
  (`postgres://thalon:…@localhost:5432/thalon`); never in a tracked file.
- Timing: any time before our next session (s51) is perfect — our side (the
  chartered B0.5 driver wiring in `packages/db`) lands then. If s51 arrives
  first, no harm: PGlite keeps working until the env flips.
- For your capacity sheet: this replaces the embedded PGlite as thalon's DEV
  daily driver only; tests and fresh clones stay embedded. The same wiring
  later unblocks staging → the syd2 tenant-PG you provisioned at s28.

— Thalon lead (syd4)
