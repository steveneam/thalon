# ADR 0011 — Integrations surface charter: publish destinations + the per-tenant credential vault

- **Status:** accepted (founder ratification 2026-07-19, session 65, live in chat: "i'm happy with the charter")
- **Context home:** `docs/proposals/2026-07-19-integrations-surface.md` (the ratified proposal — buckets, vault design, destination classes); plan seed `docs/research/integrations-surface-plan.md`; transition map `docs/research/social-transition-plan.md` (this is its Phase 2).
- **Relates to:** the s64 entitlements seam (window 0016) · Sprint-8 window 2 (PR #64: `social_publishing` key, social/outreach profile columns) · B-pub.1/2 publisher seam + drivers (PRs #61/#65).

## Context

The publish loop is closed for tenant zero at the engine level (seam + drivers, disarmed), but arming is env-based and self-only — no client can ever connect an account, and the s64 dev-app slog is the recorded proof of what unaided clients face. One capability, two scopes (founder s64): Thalon's launch presence and every client's posting run the same drivers and the same connect flow; Thalon dogfoods it first.

## Decisions (founder, 2026-07-19 — all five proposal calls ratified as recommended)

1. **The vault:** per-tenant `tenant_credentials` with envelope encryption — AES-256-GCM per-row data keys wrapped by a box-level `THALON_VAULT_MASTER_KEY` from env; Node built-in crypto, $0/self-hostable; cloud KMS is a recorded swap path behind the wrap/unwrap interface (trigger mirrors the object-store durability call: real traffic/customers). Secrets never in events, logs, errors, or API responses — redaction test-pinned; a read-only validate ping flips a card to connected.
2. **Entitlement granularity:** ONE `social_publishing` feature key (already shipped, internal|max); per-platform keys only if pricing ever demands them.
3. **The self/dogfood tenant moves ONTO the vault** (env arming stays as emergency override only) — Thalon runs its launch through the exact flow a client will.
4. **Partner-app filings (OAuth-Connect mode 1), Thalon-level:** LinkedIn Community Management first, then Meta App Review, then X elevated. They require hosted Terms/Privacy pages, so **THE LANDING sequences before mode 1**; guided-manual mode 2 is always the fallback and ships first, never removed.
5. **Destinations, not social platforms** (founder addition, s65 live): the surface's unit is a publish destination — social platforms · **your website** (optional per tenant; unconnected = disarmed; the Thalon-hosted blog is an offering, never an assumption; client CMSes = a driver class: WordPress REST · Ghost Admin · generic webhook) · newsletter (Resend, follow-on bucket). **The website is the first destination that can go fully live** (no review gates, own property): **pillar #1's blog article published to `/blog` on staging through the real loop = the ratified proof-of-product moment.**

## Consequences

- **Buckets as proposed:** B-int.0 (the sprint's ONE contract window: `tenant_credentials` + repos + contracts service/destination registry + card-state vocabulary — the A13 one-window lesson holds) → B-int.1 vault core → B-int.2 the surface (cards + guided flows + the published-view that closes FEATURE-MAP's `/blog` partial) → B-int.3 driver rewire (arming becomes tenant data; ladder shape unchanged) → B-int.4 OAuth-Connect per platform as approvals land.
- **Sequencing:** B-int.0 opens s66+, beside (not blocking) B-vid.8 pillar #1; the pillar's blog article is the destination-flip's proof. Every lane = Mode B, fresh founder approval per launch; merges on `npm run verify`.
- Live posting keeps its per-platform, per-tenant explicit GO throughout — a connected account is not an armed one; stealth holds (staging until the launch call).
- The landing gains a second gating consumer (mode-1 filings) beside its portfolio role — its sequencing stays a checkpoint call.
