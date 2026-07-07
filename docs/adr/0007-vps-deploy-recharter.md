# ADR 0007 — Deploy re-charter: self-managed VPS first, Vercel as swap path (B6.7)

- **Status:** accepted (founder direction 2026-07-08, server-side briefing; lead assessment recorded same session)
- **Context home:** `CHARTER.md` (B6.7 + amendment A14); board record `COORDINATION.md` session-21 message. Infra-side specifics (project name, hostnames, box sizing, tenant handoff pack) live gitignored under `.context/notes/` per repo protocol — this ADR stays generic.
- **Supersedes:** B6.7's Vercel-first deploy shape (ADR 0005 / A12) and the Lambda render-farm story as the production render path (ADR 0004 §7's *container* mechanism survives; the serverless farm framing retires).

## Context

A12 chartered B6.7 as a Vercel deploy. Since then the founder's portfolio stood up an **agent-operated infra engine on a self-managed VPS** (its own repo and sessions; coordination flows through the founder). At the session-21 briefing the founder re-chartered Thalon's web deploy onto that box, with Thalon as its **first dogfood tenant** — web container first, render worker second.

The fit is architectural, not just cost. Thalon as shipped needs a **persistent filesystem and one long-lived process**: PGlite is an embedded, file-backed Postgres (single process, no server socket); the object store is a local content-addressed directory; intel sweeps and blog posts ride mutable-pointer JSON bundles in that store. Serverless would have forced a storage re-architecture before first deploy; the VPS runs what exists today unchanged. The box is Linux, which is also the render fast path (BeginFrame determinism is Linux-only — the dev box renders via the slow screenshot fallback and carries a hard no-Docker rule).

## Decision

1. **Web deploy = one container image on the portfolio VPS.** Image `ghcr.io/steveneam/thalon-web`: multi-stage, non-root runtime user, `HEALTHCHECK` against `/api/health`, base images **digest-pinned**. Built **only in CI** and pushed to GHCR — never on the dev machine (no-Docker rule, invariant). The box's platform pulls by digest and manages runtime env, domains, TLS, and rate limiting at its edge.
2. **`output: "standalone"`** in `next.config.ts` with `outputFileTracingRoot` at the workspace root. Runtime data directories that code resolves by cwd-upward walk are traced/copied into the image at the standalone root: `proprietary/prompts` + `proprietary/profiles` (engine prompt files — SPINE §3.2 data, never inline) and `packages/db/drizzle` (migrations). **PGlite's WASM assets are verified present by an executable check inside the image build** — a missing asset fails the build, not the first request.
3. **State lives on one persistent volume** mounted at `THALON_DATA_DIR` (embedded DB + object store + pointer bundles), included in the box's backup set. `NEXT_PUBLIC_SITE_URL` is **build-time** (Next inlines `NEXT_PUBLIC_*`), so it is an image build arg; everything secret or per-deploy stays runtime env.
4. **Auth-gate invariant (safety one-way, never loosened):** the workspace and its API surface never face the internet ungated. The dev auth stub is a stub — before anything public, the app itself gates `/app`, `/approve`, and non-public `/api/*` routes behind basic auth (`proxy.ts`), **fail-closed in production when no credential is configured**. Public by design: landing `/`, `/blog/**` + RSS, `robots.txt`, `sitemap.xml`, `llms.txt`, the waitlist POST, and `/api/health` (the container healthcheck). Gating at the app (not only the box's edge) keeps the invariant true on any host, including the Vercel swap path.
5. **Backup consistency = an app-level dump hook.** PGlite has no server socket, so `pg_dump` cannot attach from outside; a filesystem snapshot of a live data dir can be torn mid-write. The app exposes a dump hook (token-gated, never public) that writes a consistent export into the data volume; the box's pre-backup step calls it before each snapshot. Joint design item with the infra side — flagged in the delivered tenant note.
6. **Render worker = second workload, second image.** The web/render image split is deliberate: the web container stays small (one Node process, modest RAM); the render image carries headless Chromium + FFmpeg + local TTS and bursts CPU/RAM. The Linux box supersedes the Lambda render-farm story as the render fast path; artifacts-to-object-storage follows later once real bandwidth is measured.
7. **Vercel = documented swap path, AWS parks at ~$0.** The B3.15 `DeployTarget` seam and this ADR record the swap; the AWS sub-account keeps its bootstrap + OIDC stacks (re-entry is one workflow away) with nothing billable running. DNS co-location with the box's other services is accepted by the founder (reverse-IP / CT-log linkage understood).

## Consequences

- B6.7 reshapes into two halves: **prep that blocks on nothing** (this ADR · Dockerfile · CI image build · `next build` CI job · auth gate · dump hook) lands now; **the deploy itself** waits on the founder's box purchase and the infra side's tenant handoff pack (deploy credential, GHCR pull credential, domain wiring, volume).
- Site verification for the B6.8 GSC flywheel is unchanged — it arms at domain-live, whichever host serves it.
- The carried B6.7 items (revalidate-on-publish · temp-jobDir cleanup · eval-row refinement · exit reviews, green suite = sprint exit) are unaffected by the host change.
- [you]: box purchase (infra-side step-card) · domain DNS cutover at deploy · production gateway/transcript keys as runtime env.
