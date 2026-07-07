# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-08 (session 22) · **B6.7 DEPLOY PREP COMPLETE — ADR-0007/A14 recorded, Dockerfile + CI image + auth gate + dump hook all landed and smoke-proven on the real standalone server, the first ENGINE-AUTHORED post is live on /blog (judge screen-prompt v2 unblocked it the chartered way), and the infra side's wiring brief is answered — wiring expected the next day.** Next act = **deploy `thalon-web` behind the staging hostname when the handoff pack lands**, then the B6.7 exit-gate tail.

## Resume prompt (paste verbatim to resume next session)

> Stamped 2026-07-08 (UTC+10:00). Safe to `/clear` after reading — see the clear-safe line at the end.

**Resume · Thalon** — Sprint 6, **B6.7 deploy + exit gate**, prep done, deploy-at-handoff-pack. E:\thalon, main @ the session-22 wrap commit.

▎ ▸ Read `CLAUDE.md` → `agent_handoff/CURRENT.md` → `COORDINATION.md` session-22 message **+ its two addenda** → `.context/notes/thalon-wiring-brief-2026-07-08.md` (their brief) + `.context/notes/thalon-wiring-replies-2026-07-08.md` (our answers, incl. the pinned first-image digest) → memory `vps-deploy-swordfish` + `net-positive-speedups` (new founder standing directive).

▎ ▸ **Landed session 22 (don't redo):** ADR-0007 + A14 · own-site publish door in the queue (route + panel + per-request feeds + slug revalidate) · judge `g3-screen.v2` + golden rows (screen/final claim-taxonomy aligned; I3 untouched) · **first engine post published + verified on every blog surface** · `Dockerfile.web` (digest-pinned **node:24-slim**, non-root, HEALTHCHECK, PGlite-asset check in-build) + `.dockerignore` · `web-build` CI job + `web-image.yml` → GHCR — **CI green end-to-end after the npm/cli#4828 lockfile fix; first image built + digest quoted in the replies note** · `src/proxy.ts` workspace gate (closed allowlist, fail-closed 503 in prod; smoke-proven) · `DbHandle.dumpTo` + `POST /api/admin/db-dump` (bearer, fail-closed; 4.4MB/1.4s measured) · **optimization-readiness pass** (founder-directed): windowed horizon scans (`windowDays` config, index-aligned reads) + the carried **dismiss→eval-row door landed** (origin `intel_dismiss`, migration 0006, audited mechanism, live-cards-only) + `docs/DATA-SPINE.md` (inflow map · flat-read rationale · pre-committed scale triggers · GSC arming checklist).

▎ ▸ **First acts next session:** (1) if the infra handoff pack has landed ([you] relays: scoped deploy credential + GHCR pull slot + staging hostname + volume) — **deploy the container behind the staging hostname** (their platform's REST at deploy.<their-domain>/api, x-api-key; create domains BEFORE first deploy per their landmine notes; set runtime env per the day-one list in our replies note: WORKSPACE_BASIC_AUTH + DB_DUMP_TOKEN required, gateway key, TREND_SOURCE=bluesky + creds) → verify health/gate/dump-hook from the box → their pre-backup.d integration. (2) B6.7 exit-gate tail: hyperframes temp-jobDir cleanup · exit reviews across the three families · full green suite = sprint exit (the eval-row-refinement carry is DONE — screen-v2 + dismiss door both landed). (3) Carried: GSC verification at domain-live (launch-gated with the domain, arms B6.8; the arming checklist is `docs/DATA-SPINE.md` §4 — OAuth surface + daily budgeting is the one new code surface).

▎ ▸ **Stealth mode (founder call, on the record):** the real domain stays UNWIRED until the launch call (CT-log permanence); staging = neutral hostname + their edge BasicAuth + noindex; our image bakes the launch origin so launch = add domains + DNS flip + drop edge auth, zero rebuild.

▎ ▸ **Addendum-2 layer (also landed, don't redo):** suite **sharded 3-way** (4m08s vs 10m30s proven; aggregate keeps the required-check name `test`) · docs-only pushes skip the image build (root `*.md` + `docs/` only — prompt `.md`s still trigger) · flow-video creative direction recorded in `docs/FRONTEND.md` §2 (ANIMATED stream: input→creation→output, whole flow incl. social fan-out depicted working — the product goal) · founder standing directive saved: **net-positive speedups get built when spotted, not parked** (memory `net-positive-speedups`).

▎ ▸ **[you] — founder queue:** (1) relay the wiring-replies note to the infra side (`.context/notes/thalon-wiring-replies-2026-07-08.md`) and the handoff pack back. (2) Production transcript key · LinkedIn Page paperwork · X dev app · optional Trends alpha · carried: `0b11d48` scrub decision. (3) At launch call: registrar DNS flip. (4) Landing-template family = charter candidate at the next checkpoint (unchanged from session 21).

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: working tree clean, local = remote on main, guard passing, full suite green, no open PRs, zero worktrees, no dev server, no mid-edit state.

---

## Pointer

Read in order: `CLAUDE.md` → this file → `COORDINATION.md` session-22 message → `docs/adr/0007-vps-deploy-recharter.md` → the two wiring notes in `.context/notes/` → memory (`vps-deploy-swordfish`). Founder runbook: `.context/runbooks/keys.md`.

## Delta (session 22)

- ADR-0007 + charter A14: VPS-first deploy re-charter recorded in tracked docs (infra specifics stay gitignored).
- Publish door productized: approve queue → own-site publish → posts bundle → /blog, with the revalidate-on-publish story resolved for a long-lived box (per-request feeds + slug revalidation at the door).
- Judge screen-tier prompt v2 (chartered eval-row refinement): claim taxonomy aligned with the final tier after the tier split reproduced live; golden rows pin it; the previously blocked draft passed both tiers, was founder-approved, and is live — **Thalon's first engine-authored post**.
- Container + CI + gate + dump hook: all six ADR first-acts landed and verified (standalone-server smoke: every gate case + a real 4.4MB dump).
- Wiring brief in from the infra side (staging opens next day); all six ask-backs answered in the replies note.

## Next action

Founder: relay the replies note; paste the resume prompt next session. Lead next session: deploy at handoff-pack, then the exit-gate tail (temp-jobDir cleanup · exit reviews · green suite).
