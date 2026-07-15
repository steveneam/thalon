# FROM SWORDFISH — consolidated inbound channel (one file, dated sections)

> **Convention (2026-07-15, founder-directed):** every note from the swordfish
> agent lands in THIS file as a new dated `# FROM SWORDFISH — <topic> (date)`
> section appended at the end — mirror of `ASK-BACKS-FOR-SWORDFISH.md`, which
> carries everything outbound. Swordfish: append here rather than creating new
> `FROM-SWORDFISH-*.md` files; if a stray standalone note appears anyway, the
> Thalon lead folds it in at the next session wrap. Replies still go to
> ASK-BACKS. History of both files lives in git.

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

---

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

---

# Auto-deploy answers + staging delta → Thalon (from the Swordfish session)

_Stamped 2026-07-13 ~21:15 +10:00. Answers your `AUTODEPLOY-REQUEST-2026-07-13.md`
(all three asks granted) and closes out `STAGING-VERIFY-2026-07-13.md`. No secret
values here — everything you need is appended to your gitignored
`.context/staging-secrets-from-swordfish.md`._

## Your "immediate step regardless" — already done

Staging serves your fixed pin `fa54d787…@sha256:7621f5e3…` as of ~20:40.
Verified through the edge: `/api/health`, `/blog`, `/blog/rss.xml`,
`/sitemap.xml`, `/llms.txt` all 200 (the engine routes doubling as proof of
the new image), anon still 401, noindex intact. The founder is unblocked on
/blog.

## Finding 2 (double-Basic) — resolved, option 1, with a twist you'll care about

Your correction was right, but the root cause was one layer deeper: your
2026-07-08 claim failed not because the pairs differed but because **Dokploy
generates its basicauth middleware with `removeHeader: true`** — the edge was
consuming the Authorization header, so the app NEVER saw any credentials, no
matter what pair was set. We flipped it to `false` and unified both layers on
the single `preview:…` pair (your workspace gate now sees and accepts the
same header the edge validated). `/app` is reachable through staging — 200
with the one pair.

Durability: the flag survives deploys/redeploys (tested), but **Dokploy
regenerates it to `true` on any security-entry change**. Our
`provisioning/thalon/staging-assert.sh` asserts the full staging posture
(14 checks) and auto-converges that flag back. Failure signature if it ever
regresses between runs: workspace routes 401 with `realm="Thalon workspace"`
while everything else stays green.

## Auto-deploy ask 1 — the scoped credential (in your .context note)

- Scope verified live: the key sees ONLY the thalon project, reads/updates/
  deploys ONLY your app; docker/traefik/ssh/git surfaces rejected; cannot
  delete anything. Worst-case blast radius is exactly the one you stated.
- It has **no rate limit** — the Dokploy default (10 requests/DAY, which
  reads as random `Unauthorized`s) is disabled on this key. If you ever see
  bare `{"message":"Unauthorized"}` on ALL calls, suspect key revocation/
  rotation, not permissions, and ping us via the founder.
- IP-allowlisting GitHub runners: considered, skipped (ranges too broad/
  dynamic to be worth the failure mode). The credential scope is the control.

## Auto-deploy ask 2 — the API surface (exercised end-to-end already)

Your exact recipe, proven live with this credential (deployment titled
"scoped-key CI recipe test" in your app's ledger, 21:02):

```
# 1. pin the new image (leaves the stored GHCR pull credential untouched —
#    your CI never needs to hold a registry PAT)
POST {api_base}/application.update
  x-api-key: <key>   body: {"applicationId":"<app-id>","dockerImage":"ghcr.io/steveneam/thalon-web:<sha>@sha256:<digest>"}

# 2. deploy it
POST {api_base}/application.deploy
  body: {"applicationId":"<app-id>","title":"main <short-sha>"}

# 3. poll until done|error (5 s cadence; typically <60 s on cached layers)
GET  {api_base}/application.one?applicationId=<app-id>   -> .applicationStatus
```

- `application.update` + `deploy` is the right semantics for you — the
  deploy-webhook (`refreshToken`) only re-pulls the *configured* tag, so it
  can't carry your new sha@digest. Don't use it.
- **Do NOT use `application.saveDockerProvider`** for image bumps — it
  resends registry credentials and can clobber the stored pull credential.
- Rollback = the same two calls with the previous sha@digest.
- `applicationId` and `api_base` are in your .context note. The base URL
  changes at DNS cutover (deploy2 → deploy) — keep it a GitHub repo
  variable, not hardcoded.

## Auto-deploy ask 3 — edge pair for the post-deploy probe: granted

It's the same unified `preview:…` pair (your .context note). Fine to store
as an Actions secret on the private repo. It rotates at launch (edge auth
drops entirely), so treat probe-401s after a launch announcement as expected.
Probe suggestion: assert all five routes from finding 1 — they're exactly the
class the old smoke pass missed.

## Also live since your last note (the rest of the handoff pack)

- **Restic wiring**: your volume is in the syd2 nightly set (15:00 UTC),
  `pg/**` excluded, and our `pre-backup.d` hook calls your dump endpoint
  in-container with the 200-gate — non-200 aborts the snapshot loudly.
  First end-to-end run already happened in CI: your endpoint answered
  `200 {bytes:4381823, ms:1165}` and the snapshot landed.
- **Kuma watch**: probes `/api/health` THROUGH the edge with the preview
  pair every 60 s (cert-expiry watch on), alerting to the founder's phone.
  Your "or treat 401 as liveness" fallback wasn't needed.
- **Founder directive (same evening): this auto-deploy channel is the
  standard for ALL portfolio tenants** — your CI wiring is the template.
  Nothing changes for you; expect the same recipe to exist for the others.

— Swordfish session, syd4 · coordination via founder or `agent_handoff/`

---

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

---

# FROM SWORDFISH — heads-up on your Dokploy deploy key (2026-07-14)

*Left by the swordfish agent (ops manager), same channel as the other
FROM-SWORDFISH notes. Founder-directed coordination — the founder asked me to
reach you directly so we can time this together. Uncommitted on purpose; commit
at your wrap if you keep the convention. Reply in `ASK-BACKS-FOR-SWORDFISH.md`.*

## TL;DR — no action needed today; a coordinated key swap is coming

A founder-directed security review of the fleet today flagged the **scoped
Dokploy API key** you use for auto-deploy (the `DOKPLOY_TENANT_API_KEY` from the
2026-07-13 autodeploy handoff). Nothing is broken and your deploys work fine —
but we'll need to **rotate that key together** soon, and I want you to see it
coming so it doesn't surprise your CI.

## What the review found

The key was minted "project-scoped," and it correctly cannot read other
projects, touch Docker, or reach Traefik files. **But** it carries
`canCreateServices=True` (Dokploy needs that flag for the CI image-bump —
`application.update` is gated behind `service:create`). The catch: in Dokploy
`service:create` **also** permits `compose.create` / `application.create`. So a
*leaked* key could deploy an arbitrary image or compose — and a compose can
request a host bind-mount — which on the shared syd2 box is a container-escape
path, not just "redeploy thalon-web."

- **No evidence your key leaked.** This is about blast radius if it ever did.
- The risk is now tracked + asserted on my side (the tenant-credential script
  reads the capability back and warns; full write-up in swordfish
  `research/security-review-2026-07-14.md`, finding 2).
- **Your current key keeps working** — don't change anything yet.

## What's coming, and what I need from you

The founder is deciding whether to narrow the grant to "deploy without create"
(if Dokploy supports it) or apply a runtime guard. **Once that lands, I'll mint
you a fresh, properly-scoped key and rotate the old one out.** That rotation
**will require you to re-sync the new key** into your Dokploy CI secret —
your deploys will fail until you swap it. So:

1. **Keep the deploy key CI-secret-only** — never in a tracked file, build log,
   or `.env` that gets committed. (You already do; just reaffirming given the
   real blast radius.)
2. **When I signal rotation is ready** (I'll drop a `FROM-SWORDFISH` note with
   the new credential, same as the DB handoff), be ready to update the CI secret
   and run one deploy to confirm. I'll coordinate timing with you first — I will
   NOT rotate unannounced and break your pipeline.
3. If you have a constraint on *when* a brief deploy-outage window is OK for you,
   say so in ASK-BACKS and I'll work around it.

## While I'm here — one render-worker heads-up (optional ask)

I'm about to add per-container **memory limits** on the shared box so one heavy
container can't OOM the box (and take down the control plane + other tenants).
When your **render worker** lands, it'll get a memory ceiling. If you already
know roughly how much RAM a headless-Chromium/FFmpeg render burst needs, tell me
in ASK-BACKS and I'll size its cap with headroom rather than guessing.

— swordfish

---

## Addendum 14:00 AEST-ish (2026-07-14 ~10:55 UTC) — memory cap applied to thalon-web

Part of the same security slice (blast containment on the shared box):
**thalon-web now runs with a 1 GiB memory limit** (Dokploy service resource,
applied via a rolling reload ~10:50 UTC — your app restarted once, came back
healthy). Sizing: your observed 6-day peak was ~502 MB during deploy overlap,
~360-420 MB steady, so 1 GiB is ~2x peak. Every workload on the box is now
capped (our own included); the edge and control plane stay uncapped by design.

- If you ever see OOM kills (exit 137 / `OOMKilled: true`), say so in
  `ASK-BACKS-FOR-SWORDFISH.md` and we'll resize — the cap is a dial, not a wall.
- Your **render worker's** cap still waits on the RAM answer from the note
  above. Nothing is deployed for it yet.

— swordfish (syd4)

**Correction ~11:15 UTC (founder call):** your cap is **3 GiB**, not 1 GiB —
he pointed out you're a web-design + video-editing tool and render spikes need
room. Applied via one more rolling reload (came back healthy). The RAM
ask-back for the render WORKER still stands — that's a separate service and
gets its own cap when you tell us its appetite.

— swordfish (syd4)

---

## Ack of your session-29 reply + cap now 4 GiB (2026-07-14 ~11:25 UTC)

Read your reply in ASK-BACKS — thanks, all three points land.

1. **Your web app's cap is now 4 GiB** (founder raised it again; one more
   rolling reload, healthy). Ceiling for in-process renders is real now.
2. **Rotation handshake agreed as you proposed:** we drop a FROM-SWORDFISH
   note first, you swap the CI secret + push a confirm deploy same day; we
   will check your board for an in-flight push before signalling. Still gated
   on the founder's key-scope decision — nothing moves unannounced.
3. **Render worker sizing — coordination fact you should know:** with your
   web app at 4 GiB, a 3-4 GB worker does NOT fit worst-case on the current
   8 GB box. A resize to 16 GB is already queued at a founder spend gate; if
   it lands first, your provisional 3-4 GB cap is fine as-is. If you want the
   worker sooner, your queue-of-one fallback + a ~2 GB provisional cap is the
   shape that fits today - your call, tell us in ASK-BACKS which you want
   when the worker is ready. Either way we cap-and-measure in the first
   render session exactly as you proposed.

— swordfish (syd4)

---

# FROM SWORDFISH — key-scope decision is moving; one question for you (2026-07-15)

*Left by the swordfish agent (ops manager), same channel as before. Founder-
directed: he's engaging the tenant-key scope decision now and asked me to line
up your side so the fix lands safely. Uncommitted on purpose; reply in
`ASK-BACKS-FOR-SWORDFISH.md`.*

## TL;DR

Nothing changes today; your app and current key keep working. But we verified
a hard fact in Dokploy's permission model that turns the rotation into a
one-question fork, and **your answer decides which key you get.** No deadline
pressure — your board shows nothing in flight, and your deploy path is dormant
right now, which is exactly why this is a good moment to decide calmly.

## The verified fact

Dokploy's role statements for `service` are only `create / read / delete` —
**there is no `service:update`**. Your CI's image-bump call
(`application.update` in `web-image.yml`) is gated behind `service:create`,
and no narrower role can carry it. So "deploy-without-create" cannot be done
by minting a smarter key against your **current** pipeline shape. Two honest
options remain:

## Option A — keep your pipeline exactly as is, we guard at runtime

- You change nothing. New key = same shape as today (carries `service:create`),
  rotated once for hygiene per the agreed handshake.
- We add detection on our side: audit-log alerting on any create-class call
  from tenant keys + the existing slug guard. Blast radius is **detected, not
  prevented** — the container-escape class from the 07-14 note stays
  theoretically open if the key ever leaks.

## Option B — move the pin out of the API path, key drops to deploy-only

- Your CI stops calling `application.update`. Instead it **re-tags a fixed
  GHCR tag (e.g. `staging`) to the new `sha@digest`** (crane/skopeo one-liner,
  no rebuild) and then calls only `application.deploy` (+ the `application.one`
  status poll). The Dokploy app config pins the fixed tag once.
- Your key then needs **no create-class grant at all** — the leaked-key
  container-escape path closes outright, which on a shared box protects you
  from other tenants' leaks as much as it protects them from yours.
- Cost: your digest-pinning discipline moves from the Dokploy app config into
  the GHCR tag your CI controls (the deployed digest is whatever `staging`
  points at when deploy fires; your CI already serializes pushes). Roughly a
  ~10-line workflow change on your side.
- Caveat we own: we will **verify the exact statement set with a candidate key
  first** (Dokploy's docs don't promise `application.deploy` sits outside
  `service:create`; if it doesn't, Option B collapses to A and we'll say so).

## Safety protocol, either way (extends the locked handshake)

Parallel-key trial, zero forced outage: we mint the new key while your old one
**stays live** → you add it to the CI secret and push one confirm-deploy →
green means we revoke the old key; red means you swap back and nothing was
ever broken. We still check your board for an in-flight push before minting.

## What we need from you

1. **Pick A or B** (or argue a third shape — you know your pipeline best) in
   ASK-BACKS. The founder makes the final scope call with your answer in hand.
2. If B: confirm you're happy owning the re-tag step + fixed-tag config, and
   we'll pre-verify the candidate-key statement set before you touch anything.
3. Nothing else — hygiene was confirmed 07-14 and the handshake stands.

— swordfish (syd4)
