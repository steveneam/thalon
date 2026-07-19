# Social publishing — the transition plan (dogfood → Thalon launch → client product)

> **Purpose:** the single consolidating map of the social-integration arc, created
> s64 at founder request ("save all these as a transition plan so you don't forget").
> It links to the detailed docs; it does NOT duplicate them (AGENTS.md rule 8 —
> one home per lesson). Read this first, then the owner doc for whichever phase.

## The arc in one line

Prove the publish loop on throwaway accounts (**dogfood**) → Thalon posts as the real
company (**launch**) → every paid client connects and posts the same way (**product**).
**One capability, two tenancy scopes; Thalon is tenant zero (its own first customer);
build once.** The drivers stay account-agnostic (key off IDs + per-tenant config, never
a hard-coded handle), so each transition is a config swap, not a rebuild.

## Phase 0 — DOGFOOD (now, in progress)

Prove generate → judge → **publish** end-to-end on throwaway personal accounts.

- **DONE (s64, merged to main):** publisher seam `B-pub.1` (no drivers, structurally
  unarmed) · sweep scheduler `B-arm.1` (intel LIVE + flowing — bluesky, frontier-AI
  watchlist, 4-hourly) · one-prompt video door `B-vid.7` (zero render spend) ·
  entitlements seam (window `0016`) · **credentials collected + read-only-validated for
  X · LinkedIn · Facebook · Instagram** (`.context/social-logins.md`, env-based, self
  tenant; Threads deferred, TikTok blocked downstream).
- **NEXT:** the drivers that actually post (`B-pub.2`) + first dogfood posts, each behind
  a per-platform founder GO (one reviewed test, then delete).
- **Accounts (all throwaway scaffolding):** @mactechdish (X) · personal profile (LinkedIn,
  `w_member_social`) · MacTechDish page (FB) · @maxbrenner_123 (IG).

## Phase 1 — THALON LAUNCH (Thalon posts AS Thalon)

Real Thalon-branded presence on every platform, publishing Thalon's own generated content —
the deepest dogfood and the company's social launch in one. The self tenant BECOMES the
real Thalon.

- **Needs:** the per-platform dogfood→company delta (X rename · LinkedIn Company Page +
  Community Mgmt review · Meta App Review · Thalon IG/Threads/TikTok accounts + TikTok
  audit) + the shared gates (**hosted Terms + Privacy pages** · the **stealth go-public
  decision** — branded pages are public, so this IS the launch moment) + the landing +
  B6.7 domains.
- **Owner doc:** `arming-plan-sprint8.md` §"The end-state / launch goal" + its dependency
  table.

## Phase 2 — CLIENT PRODUCT (the Integrations surface)

Every paid client connects their accounts (one-click Connect, or guided-manual fallback)
and Thalon posts for them — the same capability, generalized to every tenant.

- **Needs:** the **per-tenant encrypted credential vault** (the central engineering
  decision — we have none today; arming is env-based self-only) · Thalon-owns-one-partner-
  app-per-platform OAuth · entitlements gating (which tier gets it).
- **Same drivers as Phase 0/1** — the only difference is per-tenant vault vs env.
- **Owner doc:** `integrations-surface-plan.md`.

## Where the detail lives (the homes — link, don't copy)

- **`docs/research/arming-plan-sprint8.md`** — the Sprint-8 buckets, the launch end-state,
  the dependency table (keys · reviews · Terms/Privacy · stealth · gateway).
- **`docs/research/integrations-surface-plan.md`** — the client surface, the two connect
  modes, the credential vault, the charter's open questions.
- **`COORDINATION.md`** — the live lane board + the next-contract-window gap list.
- **`.context/social-logins.md`** + **`.context/developer-apps.md`** — the actual collected
  credentials + the exact per-platform click-paths (gitignored; Threads/TikTok slots ready).

## What next session starts with

1. **Self-check** — `tmux attach -A -t thalon` · `pg_isready` · 8899 up (relaunch if down) ·
   `git status` + CURRENT stamp · balance API-verify (≈706.12).
2. **Peer-mail** — swordfish tails: film-import (their queue) · the founder-gated
   basicauth/DB_DUMP_TOKEN console pass.
3. **Founder calls** — ⑲ Tsukimi re-glance · which track to sequence · gateway top-up.
4. **Then the build (founder sequences), default recommendation = Track A, close the loop:**
   - **First:** the next **contract window** (frozen gaps — `brand_profiles` social block ·
     `publishable` capability · `SOCIAL_*` env keys · `sweep.schedule_failed` event ·
     `sweepSchedules.listAll` · entitlement feature keys). Lead, serial.
   - **Then `B-pub.2` publisher drivers** wired to the collected creds — LinkedIn member-post
     first, then X, then Meta — first post on each behind a per-platform GO.
   - In parallel where granted: `B-arm.2` intel soak (already flowing) · `B-vid.8` pillar #1
     (needs the gateway top-up).
   - **Track B alternative** if the founder prefers product over proof: charter the
     **Integrations surface** (Phase 2) — the vault is the central decision.
   - Every lane = **Mode B** via `scripts/launch-lane.sh`, named in the approval ask.
