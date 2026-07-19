# Integrations surface — plan seed (workspace Settings → Integrations)

> **Status: plan seed, not chartered.** Founder-directed 2026-07-19 (s64),
> from a live dogfood insight: setting up Thalon's OWN social developer apps
> hit CAPTCHA/429 walls and multi-step per-platform portal flows — "these are
> the hurdles that all the clients in thalon will face." Build queued for a
> following session; nothing scaffolds until chartered (AGENTS.md rule 1).
> Owner: lead. Companion to `arming-plan-sprint8.md` (the publisher/intel
> drivers this surface connects) and the s64 entitlements seam.

## The problem, stated

Every tenant that wants Thalon to post for them must connect their social
accounts. The naive path — each client registers their own developer app in
each platform's portal — is exactly the friction we just lived: browser bot
walls, multi-tab portals, permission-order gotchas, token-generation flows,
review queues. No non-technical client will complete that. If connecting
accounts is hard, the product's core loop (generate → judge → **publish**)
never closes for them.

## The reframe (the valuable half)

**At product scale, THALON owns one registered developer app per platform;
tenants OAuth-"Connect" their account to it and never see a portal.** The
per-client dev-app hell only exists while bootstrapping Thalon's own first
accounts. So the surface has two connection modes per platform, and we
automate toward the first:

1. **Connect (OAuth, automated)** — Thalon is the registered partner app.
   Tenant clicks "Connect X" → platform's own auth page → authorize → we
   store their token. Zero portal steps for the client. *Dependency:* each
   platform must approve Thalon as an app allowed to post on a user's behalf
   (LinkedIn Community Management review · Meta App Review · X elevated
   access). Until that approval lands per platform, mode 1 is unavailable and
   we fall back to mode 2.
2. **Guided connect (manual, immediate)** — where mode 1 isn't approved yet,
   or the platform requires the posting entity to hold its own app, the
   surface shows the exact step list (the `.context/developer-apps.md`
   click-paths turned into an in-product guided flow with copy-paste fields)
   and validates each pasted credential with a read-only API ping before
   marking the card connected. Works day one, no review gate.

Design rule: **every platform card offers mode 1 the moment Thalon's partner
app for it is approved; mode 2 is always the honest fallback, never removed.**

## Surface shape (first pass)

- **Settings → Integrations**: a card per connectable service —
  YouTube · Bluesky · X · LinkedIn · Instagram · Threads · Facebook, plus
  Resend (email/CRM send). Group by what they power (Intel sources · Social
  publishing · Outreach).
- **Card states** (honest, like the rest of the workspace): not connected ·
  connected (as @handle / Page) · needs re-auth (token expired) · expiring
  soon · unavailable-on-your-plan (entitlements) · platform-review-pending
  (mode 1 not yet live → offers mode 2).
- **Per card**: Connect button (mode 1) OR "Set up manually" (mode 2 guided
  steps + paste + validate) · disconnect · last-verified stamp · which
  drivers it arms.
- **Arming is per-tenant here, not env.** Today the publisher seam arms from
  `SOCIAL_*_ARMED` env flags (single self/dogfood tenant). Integrations makes
  connection + arming per-tenant DATA — the card's connected state IS the arm.
  Live posting still needs the tenant's explicit per-platform GO (the stealth
  gate stays; a connected account is not an armed one).

## The hard part — a per-tenant credential vault (new subsystem)

We currently have NO per-tenant secret store; arming is env-based (self only).
Integrations needs tenant-scoped storage of OAuth tokens + refresh tokens,
**encrypted at rest, never in git, never in a tracked file**, with
server-side refresh. This is the real engineering weight of the feature and
its own design decision (envelope encryption? a KMS/secrets backend? the
object-store durability trigger may apply). Flag as the charter's central
question — the UI is easy; the vault is the feature.

## Contract / dependency ties

- **Entitlements seam (s64, migration 0016):** which integrations a tier may
  use rides `tenant_entitlements` / plan defaults — an Integrations card reads
  `isEntitled`. (Templates + CRM already gated; social publishing likely
  tiered too — founder call.)
- **The social config block:** the s64 window flagged `brand_profiles` has no
  home for `socialPublishConfigSchema` — Integrations is its natural owner
  (per-platform cadence lives beside the connection). A next contract window
  candidate already on the board.
- **Publisher seam (B-pub.1, merged):** per-platform two-key arming becomes
  "connected + tenant-armed"; the refusal ladder's "unarmed platform" rung
  reads tenant connection state instead of env.
- **Intel sources (B-arm.1):** YouTube/Bluesky connection moves from env keys
  to per-tenant Integrations cards too (same vault).

## Open questions for the charter

1. Vault design + at-rest encryption backend (the central decision).
2. Which platforms get mode-1 partner-app approval first, and who files them
   (Thalon-level app registrations, distinct from the self-tenant apps the
   founder is collecting now).
3. Does the self/dogfood tenant keep env-based arming as a shortcut, or move
   onto the vault too (dogfood the real path — likely yes).
4. Entitlement granularity: per-platform, or one "social publishing" feature?

## Not in scope for the seed

Vault implementation, OAuth partner-app registrations, the guided-flow copy,
card components. This is the pre-plan; the charter turns it into buckets.
