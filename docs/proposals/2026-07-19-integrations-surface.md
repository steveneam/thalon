# Proposal — the Integrations surface (Settings → Integrations + the per-tenant credential vault)

> **Status: DRAFT for founder ratification (s65, Track B of the s65 opener call).**
> Charters the plan seed `docs/research/integrations-surface-plan.md` into buckets.
> Nothing here scaffolds until ratified (AGENTS.md rule 1); on ratification this
> becomes the next ADR. Companion: `docs/research/social-transition-plan.md`
> (Phase 2 = this surface) · the s64 entitlements seam · B-pub.1/2 publisher seam.

## Why now (context, one paragraph)

The publish loop is closing for the self tenant: seam merged (B-pub.1), drivers in
flight (B-pub.2, s65 lane), creds collected. But arming is env-based and self-only —
no paying tenant can ever connect an account. The s64 dev-app slog is the recorded
proof of what clients face unaided. Integrations turns "connect your accounts" into
product: per-tenant credential storage + honest per-platform cards + guided flows,
with OAuth-Connect layered on as Thalon's partner-app approvals land. Thalon is
tenant zero — its own launch presence runs through this exact surface first.

## The central decision — the vault (recommendation)

**A new `tenant_credentials` subsystem: envelope encryption, no cloud dependency,
KMS as a recorded swap path.**

- **Storage:** `tenant_credentials` table (next contract window): tenant_id ·
  service key (registry enum: intel + social + outreach services) · ciphertext
  payload (the token bundle as one encrypted JSON blob: access token, refresh
  token, expiries, platform ids/handles) · key-id + nonce metadata · created/
  rotated/last-verified stamps. One row per (tenant, service) — upsert-by-key,
  events on connect/refresh/disconnect (never carrying secret material).
- **Crypto:** AES-256-GCM data key per row, wrapped by a box-level master key
  from env (`THALON_VAULT_MASTER_KEY`, 32 bytes; generated at arming, lives in
  the deploy env only — never in git, mirroring every credential rule). Node
  built-in crypto — $0, self-hostable, no new deps on the hot path.
- **Swap path:** the wrap/unwrap pair is one small interface; AWS KMS (the
  Thalon sub-account exists) slots in behind it when the object-store durability
  trigger fires (real traffic/customers — the founder's s60 pattern). Flagged,
  not built.
- **Discipline:** decrypt only inside the driver-resolution seam; secrets never
  in events, logs, error text, or API responses (redaction test-pinned); a
  read-only validation ping (the s64 cred-collection pattern, productized) is
  what flips a card to "connected", and its stamp is the card's honesty.

## Destinations, not social platforms (founder addition, s65 live)

The surface's unit is a **publish destination** — anywhere judged content lands
— not a social platform. Three destination classes, one pipeline:

1. **Social platforms** (the five; drivers = B-pub.2+). Short-form; per-platform
   style via `platformProfiles` as today.
2. **Your website** — blog/article/long-form. The engine already ships this
   end-to-end for tenant zero: approved `web_page` drafts deploy through
   `packages/engine/src/webpage/deploy.ts` to the live `/blog` (slug pages +
   RSS). FEATURE-MAP's "partial — no workspace path to what got published" gap
   becomes this surface's published-view. Client sites = a DRIVER CLASS with
   creds in the same vault: **Thalon-hosted blog (built-in, zero setup) ·
   WordPress REST · Ghost Admin · generic webhook** — each card validated by a
   read-only ping like every other integration. Long-form style/length is
   config, not code: a `blog` key in `platformProfiles` + the routing table
   already model per-destination register; `web_page` is the long-form format
   and the only seoMeta-bearing one (B6.8 applies to blog posts for free).
3. **Newsletter** (follow-on bucket, chartered not built): the same judged
   content through Resend broadcasts — the provider is already in the stack;
   consent/list rules make it its own bucket, never bundled into the first cut.

**Dogfood consequence — the order flips:** the website is the FIRST destination
that can go fully live: no platform review, no external ARMED gate, our own
property, reversible. The complete generate → judge → approve → publish loop
can run on staging before any social GO. Proposed proof-of-product moment:
**pillar #1's blog article published to `/blog` through the real loop.**
(Stealth holds: staging until the launch call; the public site stays unwired.)

Contract-window consequence (rides the charter's B-int.0 window): a small
**destinations registry** in contracts (destination key → class + driver) so
cards, routing, and ledgers share one vocabulary; `social_publications` stays
the social ledger, the web deploy door keeps its deployRef record, and the
workspace published-view JOINS them — one "what went out where" answer.

## Buckets (proposed)

| bucket | scope | gate |
|---|---|---|
| **B-int.0** | **Contract window** (the sprint's ONE window, opened at charter): `tenant_credentials` + repos + contracts service registry/credential shapes + card-state vocabulary. Additive; freezes before any lane. | lead, serial |
| **B-int.1** | **Vault core:** envelope crypto, write/read doors, redaction ratchets, validate-ping seam (per-service read-only probes), server-side refresh for expiring tokens (rides the sweep-scheduler pattern). | lane after freeze |
| **B-int.2** | **The surface:** Settings → Integrations — card per destination grouped by what it powers (Intel · Social publishing · **Your website** · Outreach/Newsletter); honest states (not connected / connected-as-@handle / needs re-auth / expiring / plan-gated / review-pending); guided-manual connect flows (mode 2: step list + paste fields + validate ping — authored generic, platform-neutral language, nothing copied from gitignored notes); the **published-view** joining the social ledger + web deployRefs (closes FEATURE-MAP's `/blog` partial). | lane after B-int.1 seam lands |
| **B-int.3** | **Driver rewire:** publisher + intel + outreach seams resolve credentials from the vault by tenant, and per-platform arming becomes tenant DATA (connected + tenant-armed) instead of env; the refusal ladder keeps its shape — only the rung's source changes. Env-based arming remains as the self-tenant emergency override, but the dogfood tenant MOVES ONTO THE VAULT (dogfood the real path). | lane; per-driver flip behind tests |
| **B-int.4** | **OAuth Connect (mode 1), per platform as approvals land:** callback routes, token exchange into the vault, auto-refresh. Ships platform-by-platform behind Thalon's partner-app approvals; mode 2 never removed. | per-platform, founder files the partner-app reviews |

Live posting keeps its own gate throughout: a connected account is NOT an armed
one, and the first post per platform/tenant stays behind an explicit GO.

## Founder calls requested at ratification

1. **Vault recommendation** above — accept env-master-key envelope crypto with
   the KMS swap path? (Recommended: yes.)
2. **Entitlement granularity:** one `social_publishing` feature key (already in
   window 2, internal|max) now; per-platform keys only if pricing ever needs
   them. (Recommended: one key.)
3. **Self tenant on the vault** (B-int.3): recommended yes — Thalon's launch
   presence is the proof run.
4. **Partner-app filing order** (mode 1, Thalon-level apps — distinct from the
   self-tenant apps already collected): LinkedIn Community Management first
   (longest queue), then Meta App Review, then X elevated. These need hosted
   Terms/Privacy pages — a concrete dependency on THE LANDING, which currently
   holds at the visual-arc checkpoint. No filing is blocked *today* (dogfood
   needs none); this sequences the landing before mode 1.
5. **Website = the first live destination** (your s65 addition, with your
   nuance: not every tenant has a site — the card is OPTIONAL like every
   destination; unconnected = disarmed, and the Thalon-hosted blog is an
   OFFERING a tenant may enable, never an assumption): ratify the
   destinations reframe above and **pillar #1's blog article through the
   real loop on staging as the proof-of-product moment** — ahead of any
   social GO. (Recommended: yes — no review gates, our property, reversible.)

## Not in scope

TikTok (review-gated, downstream) · billing/pricing UI · multi-operator auth
(Clerk org mapping stays its own bucket) · any publish-path change beyond the
credential-resolution rung.
