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
