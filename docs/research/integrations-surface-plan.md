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

## One capability, two scopes (founder s64)

Social integration + posting is a SINGLE capability serving two tenancy scopes — not
two features. **Thalon is tenant zero: its own first customer.** Thalon's launch
presence (arming-plan §end-state — Thalon posts AS Thalon) and every paid client's
posting run the SAME account-agnostic drivers + per-tenant credential vault + the
entitlements seam; the only difference is which tenant's connected accounts they point
at. Build ONCE. Thalon's own presence is the dogfood that proves the path before any
client depends on it — Thalon runs its launch through the exact flow a client will.

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

## Mode-1 automation check (founder question, s70)

Founder asked whether connect can be automatic NOW ("check Nango; swordfish
followed a similar pattern for storage drives"). The honest read:

- **The blocker for mode 1 was never the OAuth plumbing** — it is each
  platform's app review for posting scopes. No OAuth toolkit bypasses that:
  you bring your own client id/secret and the platform still reviews your app.
  B-int.4's gate (the landing's Terms/Privacy + partner filings) stands.
- **But the SELF tenant's apps already hold the scopes** (the live-post tokens
  were minted from them), so an in-product OAuth callback + token exchange +
  auto-refresh can replace the manual portal token dance for the dogfood
  tenant TODAY — that pulls B-int.4's core forward without waiting on any
  approval, and kills the needs_reauth churn (LinkedIn ~60d expiry; X OAuth2's
  2h death is why X rides 1.0a).
- **Nango** (verified 2026-07): self-hostable (Docker), OAuth flows + token
  refresh + credential store + Connect UI for 900+ APIs — but licensed
  **Elastic License 2.0**, not MIT/Apache. Licensing hygiene applies: if
  adopted, isolate behind a clean interface with a recorded swap path
  (hand-rolled callback routes = the swap), and our AAD-bound vault stays the
  system of record (Nango's store would sync into it, never replace it).
- **Swordfish answered same-day (FROM-SWORDFISH 2026-07-25, full detail there)
  and de-risks the choice:** they run Nango ITSELF, self-hosted, for the P2
  storage-drive connects — live and verified end-to-end; the founder made
  swordfish the portfolio Nango owner (instances, security, backups, wiring).
  Load-bearing facts: 3-container stack, ~300–400 MB idle; the community
  image is single-account so it is ONE INSTANCE PER PROJECT, never shared;
  `NANGO_ENCRYPTION_KEY` must never rotate. License verified ELv2 including
  the client SDKs — so the clean shape is **zero SDK in our bundle: consume
  the broker over plain REST** (session → hosted connect link → token read /
  proxy), which keeps ELv2 code out of this repo entirely and leaves the
  tiny API surface hand-rollable as the swap path. They confirm the broker
  changes nothing about platform app review (your app, your creds; scope
  hygiene is the real lever). **Standing offer: swordfish mints Thalon its
  own instance (fresh never-rotate key + backup drill before the first real
  connection) at the B-int.4 kickoff — no new spend.** Decision still belongs
  to B-int.4 — the surface + guided-manual mode 2 is needed regardless
  (mode 2 is never removed).

## Not in scope for the seed

Vault implementation, OAuth partner-app registrations, the guided-flow copy,
card components. This is the pre-plan; the charter turns it into buckets.
