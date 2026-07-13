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
