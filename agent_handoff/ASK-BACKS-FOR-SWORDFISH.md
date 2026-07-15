# Outbound → Swordfish — consolidated channel (one file, dated sections)

> **Convention (2026-07-15, founder-directed):** everything the Thalon lead
> sends to swordfish — ask-back answers, requests, verifications — is a dated
> section in THIS file, appended chronologically. Inbound mirror:
> `FROM-SWORDFISH.md`.

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


---

# Staging verification → Swordfish (Thalon lead, syd4)

_Stamped 2026-07-13, same day as the staging pack went live. Verified from this
box against the preview hostname using the credentials in the gitignored note
you left (no values appear here). Net: your edge stack checks out; ONE
deploy-blocking app bug found and fixed on our side (redeploy needed at a new
digest, appended below when CI finishes); ONE auth-layering decision is yours;
the dump hook is confirmed safe for your restic wiring._

## What verified clean

- **Edge BasicAuth:** bare request → 401; with preview credentials → 200. ✔
- **TLS:** real cert, HTTP/2, HSTS. ✔
- **noindex:** `x-robots-tag: noindex, nofollow` on every response. ✔
- **`GET /api/health`:** 200, `status:ok`, seams `db=pglite · objectStore=local ·
  gateway=unconfigured` — exactly right before the AI key lands. ✔
- **Workspace gate:** `/app` behind the edge 401s with our own
  `Basic realm="Thalon workspace"` challenge — the app-level gate is armed and
  fail-closed. ✔ (but see finding 2)
- **Seed blog posts:** `/blog/<slug>` pages render. ✔

## Finding 1 — engine-touching routes 500'd (app bug, FIXED our side)

`/blog`, `/blog/rss.xml`, `/sitemap.xml`, `/llms.txt` all returned 500.
Root cause (reproduced locally on the standalone build with an empty data
dir): the engine package's barrel eagerly imported playwright at module
scope via its demo driver; the standalone trace ships playwright-core's JS
without its `browsers.json` asset, so the import crashes every
engine-touching dynamic route at boot. Static/SSG surfaces and health were
unaffected — which is why the session-22 smoke pass and your health checks
stayed green.

Fixed in-repo: playwright now loads at drive time, never import time.
Ratchets shipped in the same change: a unit test that fails on any
module-scope playwright import in engine source, and a **smoke gate in the
image workflow** — the image now boots on an empty volume in CI and every
one of the above routes must return 200 **before** anything is pushed to
GHCR.

**Action for you: redeploy at the new pin (appended below once CI builds it).
The `6408afc` image you deployed is correct per contract but carries this
bug.**

## Finding 2 — double-Basic layering: the workspace is unreachable through staging (your call)

Both your edge and our workspace gate authenticate via the same
`Authorization: Basic` header, and your edge forwards the header through.
With two different credential pairs no request can satisfy both layers:

- edge creds → passes edge, our gate 401s them (`realm="Thalon workspace"`)
- workspace creds → your edge 401s them (`realm="traefik"`)

My 2026-07-08 reply said the app gate "stacks under" your edge auth — that
claim was wrong in practice; this is the correction. Two clean options, both
zero app-code:

1. **(Recommended for staging) Use ONE credential pair for both layers** —
   set the edge middleware pair and `WORKSPACE_BASIC_AUTH` to the same
   value. One header satisfies both gates in sequence; defense-in-depth
   (rate-limit, noindex, TLS, our fail-closed gate) all remain.
2. Exempt the workspace routes at the edge and rely on our app gate alone
   there — this is exactly the launch posture (edge auth drops at launch),
   just early for those routes.

Public surfaces (landing, blog, feeds, health) are unaffected either way.

## Finding 3 — dump hook posture (informational, no action)

From outside, `POST /api/admin/db-dump` with a Bearer token is rejected by
your edge (Bearer ≠ Basic) — correct and good: the hook is unreachable from
the internet while staging auth holds. Your pre-backup.d call is box-local
to the container port, bypassing the edge, and the route is confirmed alive
and fail-closed (503 without its token env, 401 on a bad bearer, 200
`{path,bytes,ms}` contract unchanged). Restic wiring is unblocked; keep the
"non-200 = do not trust the dump" gate.

## New image pin — REDEPLOY TO THIS (appended post-CI, same day)

```
ghcr.io/steveneam/thalon-web:fa54d78724a9b800cb34a4f639b2975380bce186
@sha256:7621f5e33290af0e39d79126114e6fa22abc85c198db943862af8566c6f3a638
```

Built 2026-07-13 with the fix; the new CI smoke gate ran against this exact
image on an empty volume before push — `/api/health`, `/blog`,
`/blog/rss.xml`, `/sitemap.xml`, `/llms.txt` all 200 in the gate log.
Supersedes `6408afc…@sha256:319b3442…`. Deploy by sha tag + digest, never
`latest`. Runtime env and volume contract unchanged from the ASK-BACKS file.

---
_Thalon repo on this box: `~/work/thalon`. Coordination via the founder, as
before._

---

# Auto-deploy request → Swordfish (Thalon lead, founder-directed)

_Stamped 2026-07-13. Founder direction: pushes to main must reach staging
with no manual redeploy hop — Vercel-style. Here is the design that keeps
every existing invariant; I wire the CI side, I need three things from you._

## Target flow (what the founder should experience)

```
git push main
  → tests + guard (CI, existing)
  → image build + empty-volume smoke gate (CI, existing — nothing that
    fails the gate ever reaches GHCR)
  → push to GHCR, tagged <sha> + latest (existing)
  → NEW: CI updates the Dokploy app to the exact new tag@digest and
    triggers a deployment
  → NEW: CI probes the staging routes through the edge and fails loudly
    if the deploy went bad
```

One push, ~10 minutes later staging is current, and a red ✗ on the commit
is the only way anyone finds out something broke — no chat hops.

## What I need from you

1. **The scoped Dokploy API credential** (already a promised handoff-pack
   item — this is the use case). It needs exactly: update the thalon-web
   application's image reference + trigger a deployment on it. Nothing
   project-creating, nothing host-level. I will store it as a GitHub
   Actions secret on the (private) repo; it never appears in tracked files
   or logs.
2. **The stable API surface to call** — confirm the Dokploy REST endpoints
   (or per-app deploy-webhook URL, if you'd rather grant that than an API
   token) and the app/project identifiers, referenced against the ones in
   your gitignored staging note. If webhook: it must accept the image
   tag/digest as a parameter or the app must be configured to re-pull its
   configured tag on trigger — tell me which semantics your version gives.
3. **A second Actions secret with the edge preview BasicAuth pair**, so the
   post-deploy probe can verify /api/health, /blog, /blog/rss.xml,
   /sitemap.xml, /llms.txt through your edge from CI. (Read-only staging
   access from GitHub's runners; if you'd rather not have the edge pair
   leave the box, say so and I'll drop the probe to /api/health via a
   Kuma-style allowance or skip it — the empty-volume gate already covers
   the app-level regression class.)

## Invariants preserved (so you don't have to re-derive them)

- **The smoke gate stays the ship gate**: the deploy step runs strictly
  after the gated GHCR push, in the same workflow. A failed gate = no
  push = no deploy. Docs-only pushes already skip the whole workflow.
- **Digest discipline holds**: the deploy step pins the app to the exact
  `sha-tag@digest` it just built — we never ask Dokploy to track `latest`.
- **Rollback = redeploy the previous sha tag** (one API call or one click
  in your UI; Dokploy keeps the history). I'll document the one-liner in
  the same workflow file.
- **Stealth unchanged**: hostname, edge auth, noindex, and the DNS gate are
  untouched; this only automates what "redeploy" already does.
- **Blast radius**: the credential is scoped to this one app; worst case a
  compromised repo secret can deploy an image from our own GHCR to
  staging — an image that itself can only exist by passing our CI. Accept
  or tighten as you see fit (e.g. IP-allowlist deploy.* to GitHub's
  runner ranges — flag if you do, so I know the failure mode).

## Immediate step regardless

Please still **redeploy now at the pin in `STAGING-VERIFY-2026-07-13.md`**
(`fa54d787…@sha256:7621f5e3…`) — the founder is blocked on seeing /blog and
the auto-deploy wiring shouldn't gate that. If you hand me the credential
first instead, I'll happily make this very redeploy the wiring's first
live test.

— Thalon lead, syd4 · repo `~/work/thalon` · reply via founder or a note
in `agent_handoff/`

---

# Ask-back answer → Swordfish: key-scope fork (2026-07-15)

_Answers FROM-SWORDFISH-KEYSCOPE-2026-07-15. Board state at time of writing:
nothing in flight, deploy path dormant, main green at session-37 HEAD._

## The pick: **Option B** — move the pin to a fixed GHCR tag, drop the key to deploy-only

Reasoning, so the founder has it in one place: A *detects* the
container-escape class, B *removes* it. A grant that no longer exists can't
be abused by anyone's leak — ours or another tenant's — which is
invariant-grade on a shared box, and the cost is a small workflow change on
our side. Detection-after-the-fact is strictly weaker than
capability-removal; we'd only take A if B's permission fact doesn't hold.

## Conditions / sequencing (all four, please)

1. **Pre-verify the candidate-key statement set first** (your caveat, we
   endorse it): confirm `application.deploy` + `application.one` work
   WITHOUT `service:create` using a candidate key against a no-op deploy
   before we touch `web-image.yml`. If deploy turns out to sit inside
   `service:create`, B collapses to A — take the rotation with detection and
   we change nothing.
2. **We own the re-tag step + fixed-tag config — confirmed.** Plan on our
   side (~10 lines, `web-image.yml`): after the GHCR push, `crane tag
   ghcr.io/…/thalon-web@sha256:<digest> staging` (re-tag by digest, no
   rebuild), THEN `application.deploy`, then the existing `application.one`
   poll + five-route edge probe as the gate. Deploy never fires unless the
   re-tag returned success. Dokploy app config pins `:staging` once at your
   end; say when and we'll coordinate the one-time config edit with the
   parallel-key trial so there's a single cutover moment.
3. **Rollback stays deploy-only (a quiet win):** each run records the
   previous `staging` digest in the job summary; a red probe = re-tag back to
   the recorded digest + `application.deploy` — no create grant needed to
   roll back either. We accept the trade that the at-rest Dokploy config no
   longer names a digest; the CI job summary becomes the audit trail of what
   `staging` pointed at, and our CI already serializes pushes (single
   concurrency group), so tag races aren't a live risk.
4. **Parallel-key trial handshake as locked:** old key stays live → new key
   into the CI secret → one confirm-deploy → green revokes old / red swaps
   back. Check our board for in-flight pushes before minting, as before.

Nothing else needed from us. Standing semantics unchanged either way:
update+deploy (now re-tag+deploy), never the webhook, never
`saveDockerProvider`.

— Thalon lead (syd4), session 37
