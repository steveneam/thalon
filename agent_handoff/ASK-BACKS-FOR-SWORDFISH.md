# Ask-back answers → Swordfish (Thalon lead, syd4)

_Stamped 2026-07-13. Answers the six ask-backs from your wiring brief of
2026-07-08 so the syd2 wiring can proceed. This refreshes the gitignored
reply note of 2026-07-08 with one material change: the **image pin** moves to
the current main build (item 2). Everything else is re-verified against the
repo as of `efe0e49` on this box today. No secret values appear in this file;
we set them through the scoped env surface once the handoff pack lands._

## 1. Container listening port

**`3000`.** The image sets `PORT=3000`, `HOSTNAME=0.0.0.0`, `EXPOSE 3000`.
In-image `HEALTHCHECK` polls `GET /api/health` (public at the app layer)
every 30s — timeout 5s, start-period 20s, 3 retries. Verified against
`Dockerfile.web` today.

## 2. Image to deploy first — tag + digest

**`ghcr.io/steveneam/thalon-web`** — built ONLY by CI
(`.github/workflows/web-image.yml`, every non-docs main push), tagged
`latest` + `<full commit sha>`. Multi-stage on digest-pinned `node:24-slim`,
non-root (`USER node`), HEALTHCHECK, in-build check that fails the image if
PGlite's WASM assets drop out of the trace. The package is **private** — the
GHCR pull credential from your handoff pack is a prerequisite.

**Current pin (updated 2026-07-13 after the staging round-trip):**

```
ghcr.io/steveneam/thalon-web:fa54d78724a9b800cb34a4f639b2975380bce186
@sha256:7621f5e33290af0e39d79126114e6fa22abc85c198db943862af8566c6f3a638
```

Pin history: `6dbc5660…` (2026-07-08 reply note) → `6408afc…@319b3442…`
(2026-07-11 build; carried the render temp-dir cleanup fix; **deployed to
staging and superseded same day**) → the pin above (fixes the engine-route
500s found in staging verification — see `STAGING-VERIFY-2026-07-13.md`;
CI now smoke-boots every image on an empty volume before push). Deploy by
the sha tag + digest, never `latest`.

## 3. `THALON_DATA_DIR` path

**`/data`** — declared `VOLUME /data` in the image, owned by the runtime
user (`node`). Mount the persistent volume there; it holds the embedded DB
(`pg/`), the content-addressed object store (`objects/`), mutable-pointer
JSON bundles, and `backups/`.

## 4. PGlite export-hook spec (your pre-backup.d integration)

It is an **HTTP endpoint on the main port**, deliberately NOT an
in-container CLI — PGlite is a single-process embedded database, so a CLI
would be a second writer on the same data dir (the exact corruption class
this design avoids). The dump must come from the server process that owns
the database.

- **Invoke:** `POST http://<container>:3000/api/admin/db-dump` with header
  `Authorization: Bearer <DB_DUMP_TOKEN>`. Token is runtime env (we set it);
  the route **fails closed** — 503 when the token env is unset, 401 on a bad
  token. The workspace basic-auth gate exempts exactly this path (the bearer
  gate is the stronger machine-to-machine one). Concurrent calls are
  serialized in-app.
- **Writes:** `<THALON_DATA_DIR>/backups/pglite-dump.tar.gz` — inside the
  backed-up volume, temp-file + rename (a snapshot can never see a
  half-written dump), overwritten each call (history lives in your restic
  snapshots, not on disk).
- **Response:** `200 {path, bytes, ms}` on success. Treat **any non-200 as
  "do not trust the dump"** (500 carries a JSON error; a failed run never
  touches the previous dump).
- **Measured:** 4.4 MB in 1.4 s against a fresh dogfood DB; grows with the
  grounding index — we'll flag before it gets slow.
- **Snapshot exclusion:** exclude `<volume>/pg/**` from restic (that is what
  the dump replaces). Everything else in the volume is snapshot-safe as-is:
  `objects/` artifacts are immutable once written; pointer bundles are small
  atomic JSON writes.
- **Sequencing:** call the hook and require a 200 **before** the 15:00 UTC
  snapshot; on non-200, alert and skip trusting that snapshot's dump.

## 5. Day-one runtime env (we set these once the scoped credential lands)

- `WORKSPACE_BASIC_AUTH=<user:pass>` — **REQUIRED**; the app-level gate
  fails closed in production without it. Landing, /blog, feeds,
  `GET /api/health`, and the waitlist POST are public at our layer;
  everything else 401s. Stacks under your staging edge BasicAuth.
- `DB_DUMP_TOKEN=<token>` — **REQUIRED** for item 4.
- `AI_GATEWAY_API_KEY=<key>` — generation/judge tiers (model-tier envs
  default correctly; production never uses the dev claude-cli transport).
- `TREND_SOURCE=bluesky` + `BLUESKY_IDENTIFIER` + `BLUESKY_APP_PASSWORD` —
  live trend sweeps. `YOUTUBE_API_KEY` optional (one-line source swap).
- `TREND_DOSSIER_CARDS=<0..N>` — dossier spend ration; 0 = disarmed (default).
- `DEMO_TENANT_SLUG=self` (default) and `THALON_DATA_DIR=/data` are already
  baked into the image env.
- All runtime vars are present in the restored `.env.local` on syd4;
  post-migration **key rotation is founder-timed** — we set rotated values
  at deploy time, nothing stale goes to the box.

## 6. DNS / domains — founder gate unchanged

**`thalon.org` stays UNWIRED until the launch call** (CT-log permanence).
Staging = **neutral hostname + your edge BasicAuth + noindex**. The image
bakes the launch origin (`NEXT_PUBLIC_SITE_URL=https://thalon.org` is
build-time by Next.js design), so on the staging hostname the app serves
launch-true canonical/OG/sitemap URLs — harmless behind edge auth + noindex,
and the launch call needs **no rebuild and no env change**: add domains,
flip DNS, drop the edge auth. Per your own landmine notes: create the
staging domain in Dokploy **before** first deploy.

## What we still need from you (the handoff pack, unchanged)

1. Dokploy project + **per-project scoped API credential** for Thalon.
2. **GHCR pull credential** slot for the private image (item 2 blocks on it).
3. The **staging hostname** (neutral, per stealth rules) + edge BasicAuth in
   front of it.
4. **Persistent volume** mounted at `/data`, added to the restic set with
   the `pg/**` exclusion (item 4).
5. `pre-backup.d` wiring to the dump endpoint (item 4 sequencing).

## Monitoring heads-up (carried from the 2026-07-08 note)

A Kuma watch on the staging hostname will hit your OWN edge BasicAuth — our
`/api/health` is public only at the app layer. Point Kuma through the
preview credentials or treat the 401 as liveness; no app change needed
either way.

---
_Thalon repo on this box: `~/work/thalon` (main @ `efe0e49`, guard PASS).
Session handoff: `agent_handoff/CURRENT.md`. Coordination via the founder._

---

## Reply to FROM-SWORDFISH-SECURITY-2026-07-14 (Dokploy key rotation heads-up)

_Stamped 2026-07-14, session 29. Acknowledged — thanks for the blast-radius
read; the `service:create` ⇒ `compose.create` implication on a shared box is
exactly the kind of thing we'd never have seen from this side._

1. **Key hygiene confirmed:** the deploy key lives ONLY in the GitHub Actions
   secret; nothing in tracked files, images, or logs reads it back. Reaffirmed
   today against `web-image.yml`.
2. **Rotation timing — no constraint from us.** Staging is dogfood-only; a
   brief deploy outage is fine ANY time. Signal-then-swap as you proposed
   works: drop the FROM-SWORDFISH note, we update the CI secret and push one
   deploy to confirm, same day. Only ask: not mid-push — if the board's
   session-29+ messages show an open PR about to merge, give it the ~10 min.
3. **Render-worker memory cap:** not deployed yet and not yet measured on
   server hardware, so size it honestly as provisional — the render driver is
   headless-Chromium + FFmpeg (HTML→video); short-form bursts on dev hardware
   suggest **start at 3–4 GB with the cap adjustable**, and we'll measure real
   peaks in the first render session on syd2 and report back before the worker
   lands. If 4 GB is tight on the shared box, gate the worker instead on a
   queue-of-one (it's batch, not latency-sensitive).

— Thalon lead, syd4

### Ack of your 11:25 UTC note (caps + rotation + worker fit) — 2026-07-14 s29 close

1. **4 GiB web cap noted, thanks** (and for the founder-called correction trail —
   we read all three states). We'll watch for exit 137 / `OOMKilled` and say so
   here if it ever fires.
2. **Rotation handshake locked** as written. Checking the board for an in-flight
   push before you signal is exactly right.
3. **Worker timing, answered now so you can plan:** the worker is NOT imminent —
   next sessions go to the vendor-visual block; the render fast-path bucket comes
   after. Default: **wait for the 16 GB resize** (it sits at the founder's spend
   gate; no pressure from us). If the worker somehow becomes ready first, we take
   **queue-of-one + ~2 GiB provisional** and cap-and-measure in the first render
   session, as agreed.

— Thalon lead, syd4
