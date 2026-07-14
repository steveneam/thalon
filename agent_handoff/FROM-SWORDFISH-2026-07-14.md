# FROM SWORDFISH — your Postgres database is live (2026-07-14)

*Left by the swordfish agent (ops manager), same channel as the 07-11/07-13
notes. Founder-directed handoff. Uncommitted on purpose — commit it at your
wrap if you keep the convention.*

## What exists now

A dedicated PostgreSQL 17.10 database for thalon on syd2, on the shared
`tenant-pg` service swordfish operates. Provisioned and verified today:

- database `thalon`, owned by role `thalon` (LOGIN only — no superuser/
  createdb/createrole)
- isolation proven both ways: your role connects to YOUR database over TCP
  with password auth, and is **rejected** by every other database on the
  service (and other tenants are rejected by yours)
- RLS is native Postgres — your schema, your policies, your call
- backed up nightly BEFORE the snapshot (`pg_dumpall` → restic → B2) and the
  restore is **drilled, not assumed**: today's drill loaded the dump into a
  live postgres:17.10 and read a canary row back (RPO ≤24h, worst case;
  swordfish run 29320340431). Tighter RPO = ask, wal-g graduation is the
  recorded path.

## Your credential

`.env.tenant-pg` at your repo root (0600, gitignored by your `.env.*` rule).
It contains PGHOST/PGDATABASE/PGUSER/PGPASSWORD and a ready `DATABASE_URL`.
Source of truth lives in swordfish `inventory/secrets/pg-tenant-thalon.env`
(restic-backed); the copy in your tree is yours to consume.

## How to wire it (the one important constraint)

**The host `tenant-pg-o7ijjh` resolves ONLY inside syd2's docker network.**
There is deliberately no public port and never will be — so:

- set `DATABASE_URL` on your syd2 app (thalon-web) via Dokploy
  `application.saveEnvironment` with your scoped key — remember Dokploy's
  quirk: fetch the env first and send `buildArgs`/`buildSecrets`/
  `createEnvFile` back unchanged, or the call fails
- it will NOT connect from syd4 or your laptop; that is by design, not a bug.
  If you need ad-hoc SQL during development, say so in ASK-BACKS and
  swordfish will run it over the CI channel — or migrate your dev flow to
  run inside the box's network
- never write the DATABASE_URL into a tracked file; never ask for 5432 to be
  published

## Suggested (your call, your code)

thalon-web currently runs on PGlite (swordfish dumps it nightly via its own
hook). When you're ready, migrating to this Postgres gets you real
concurrency, RLS, and the drilled restore chain for free. No rush from the
infra side — both paths stay backed up. Password rotation or a second
database (e.g. staging): one ask in ASK-BACKS-FOR-SWORDFISH.md, it's a
single re-assertable command on our side.
