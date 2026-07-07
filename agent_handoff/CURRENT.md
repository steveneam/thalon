# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-08 (session 21) · **SERVER-SIDE BRIEFING LANDED — deploy re-charters onto the portfolio's self-managed VPS (Thalon = first dogfood tenant); the founder's tenant note is delivered to the infra side; plus a founder-directed detour that built the first landing-page TEMPLATE instance (client pitch artifact, gitignored).** Next act = **B6.7 prep, VPS-shaped: ADR → Dockerfile → CI image → auth gate**.

## Resume prompt (paste verbatim to resume next session)

> Stamped 2026-07-08 (UTC+10:00). Safe to `/clear` after reading — see the clear-safe line at the end.

**Resume · Thalon** — Sprint 6, **B6.7 deploy prep + exit gate**, now VPS-shaped (session-21 re-charter). E:\thalon, main @ the session-21 wrap commit.

▎ ▸ Read `CLAUDE.md` → `agent_handoff/CURRENT.md` → `COORDINATION.md` session-21 message → memory notes `vps-deploy-swordfish` + `pujusfresh-client-template` (the specifics + gitignored `.context/` pointers live there) → the tenant note at `.context/notes/swordfish-tenant-note-2026-07-08.md`.

▎ ▸ **Recorded, do not re-litigate (founder, 2026-07-08):** web deploy = the portfolio's self-managed VPS (its infra engine runs in its own repo/sessions; coordination via founder). Thalon = **first dogfood tenant** — web container first, render worker second (the Linux box is the render fast path; it supersedes the Lambda render-farm story). Vercel = documented swap path · AWS parks at ~$0 (keep OIDC) · DNS co-location accepted · the infra repo's guard token for this project is unlocked founder-side.

▎ ▸ **First acts, lead terminal (none block on the box):** (1) **ADR-0007** — deploy re-charter (VPS-first; auth-gate invariant; web/render image split). (2) **Dockerfile**: `output:"standalone"` (not yet set), `proprietary/prompts` traced into the image, PGlite WASM assets verified present, `NEXT_PUBLIC_SITE_URL` supplied at build time. (3) **CI image build → GHCR** (multi-stage, non-root, HEALTHCHECK, digest-pinned; never built locally — no-Docker rule). (4) `next build` CI job (two-waves-old carry). (5) **Workspace auth gate before anything public** — the dev auth stub must never face the internet (edge basic-auth = cheapest honest gate; landing + /blog stay public). (6) Design the **app-level DB dump hook** (embedded Postgres has no server socket; the box's dump-before-snapshot backup invariant needs it — flagged to the infra side in the tenant note). Carried: revalidate-on-publish · GSC verification at domain-live (arms B6.8) · hyperframes temp-jobDir cleanup · eval-row refinement (incl. screen-tier rhetoric finding + dismiss→eval-row door) · exit reviews across families, green suite = sprint exit.

▎ ▸ **NEW feature direction (founder, session 21): landing-page TEMPLATES** for the webpage family. Instance #1 built + founder-tuned through ten feedback rounds as a client sales artifact (scroll-driven physics produce landing; Matter.js document-space world, floor-opens-per-section, material-true masses, photo/vector hybrid, dew-fresh hero arrangement) — lives gitignored under `.context/clients/` with its `assemble.ps1` + `assets/` (client brands never enter tracked files). **Charter candidate at the next checkpoint:** generalize the proven TEMPLATE-config seam into the engine. Founder-supplied hero photos carry a ⚠ swap-before-commercial-use caveat (noted in the assemble script).

▎ ▸ **[you] — founder queue:** (1) the infra-side box purchase (its Bucket-5 opener step-card, its repo). (2) Review the 3 seed blog articles at `/blog`. (3) The blocked engine draft in `/approve` — your click publishes Thalon's first engine-authored post. (4) Production transcript key · LinkedIn Page paperwork · X dev app · optional Trends alpha · carried: `0b11d48` scrub decision. (5) Client pitch file is at `Downloads\PujusFresh.html` (also `.context/clients/…/index.html`) — placeholders (numbers, prices, hours) are SWAP-marked in the HTML.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: working tree clean, local = remote on main, guard passing, no open PRs, zero worktrees, no dev server, no mid-edit state. Tracked-file delta this session = the COORDINATION session-21 message + this handoff only (everything else lives in gitignored `.context/`, Downloads, and session memory).

---

## Pointer

Read in order: `CLAUDE.md` → this file → `COORDINATION.md` session-21 message → `CHARTER.md` B6.7/B6.8 rows → memory (`vps-deploy-swordfish`, `pujusfresh-client-template`) → `.context/notes/swordfish-tenant-note-2026-07-08.md`. Founder runbook: `.context/runbooks/keys.md`.

## Delta (session 21)

- **Server-side briefing heard first (as armed):** founder re-charters deploy from Vercel-first/AWS to the portfolio's self-managed VPS. Assessment recorded on the board: the fit is architectural, not just cost — persistent FS + one long-lived process suit PGlite/local-store/mutable-pointer bundles as shipped, and the Linux box is the render fast path.
- **Tenant note delivered** (via founder) with handoff-pack asks, sizing notes, and the PGlite dump-hook joint design item.
- **Founder decisions:** infra-side guard token for this project unlocked · DNS co-location accepted · first tenant = web app, render offload second.
- **Landing-template detour (founder-directed):** instance #1 built, browser-verified, iterated live through ten founder feedback rounds (physics realism: mass-true pushing, near-zero bounce, grounded leaves/blossoms; art: photo cutout pipeline via Openverse/Commons + PIL flood-fill + rembg, drawn cut-both-ends cassava, dew-drop hero arrangement). Reuse = config + sprite maps + copy swap.
- **B6.7 execution did NOT start** — consumed by the above; ADR + Dockerfile + CI + auth gate are the next session's first acts.

## Next action

Founder: paste the resume prompt. Lead next session: ADR-0007, then Dockerfile/CI/auth-gate prep — none of it blocks on the box purchase.
