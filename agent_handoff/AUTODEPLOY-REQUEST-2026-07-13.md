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
