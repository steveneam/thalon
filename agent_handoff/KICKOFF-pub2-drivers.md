# KICKOFF — lane `pub2-drivers` (B-pub.2 publisher drivers, s65)

You are a Mode B build lane in a git worktree on branch `agent/b-pub2-drivers`.
Work ONLY here. Read `CLAUDE.md` (repo root) first — every rule in it binds you,
especially the grep-guard constraint and no-AI-attribution.

## Mission

Build the per-platform **social publisher drivers** behind the frozen B-pub.1
seam: `LinkedIn (member post) → X → Facebook Page → Instagram`, in that order.
TikTok is explicitly OUT (platform-review-gated, downstream). Everything ships
**DISARMED and zero-live**: no code path in this lane may reach a real platform
— drivers are exercised only through injected fetch fakes, and production
resolution still requires the per-platform credential + `*_ARMED="true"`
founder GO through `resolveSocialPublisher`'s ratchet, which this lane must not
weaken.

## Read first (the frozen contract you build against)

1. `packages/engine/src/social/registry.ts` — `SocialDriverFactory`,
   `SocialPublisher`, `socialArmKeys`, the arming ratchet. Your drivers plug in
   here; the ladder semantics are untouchable.
2. `packages/engine/src/social/publish.ts` + `errors.ts` — the door that hands
   your driver `{draftId, text}`. The text is the judged body VERBATIM: never
   alter, trim, or truncate it. If a platform rejects it (length, policy), the
   driver throws honestly — nothing is recorded.
3. `packages/engine/src/outreach/transport.ts` — the driver precedent (resend):
   injectable fetch, typed errors, no secret ever logged.
4. `packages/contracts/src/social.ts` — platforms + config shapes (FROZEN — as
   is ALL of `packages/contracts` and the drizzle schema; if you believe a
   contract change is needed, STOP and write it in your wrap instead).
5. `packages/platform/src/env.ts` — the ten `SOCIAL_*` arming pairs landed at
   window 2 (PR #64).

## The build

- `packages/engine/src/social/drivers/linkedin.ts` — official versioned REST
  Posts API, member post as the token's owner (derive the author member id via
  the official userinfo endpoint at publish time — stateless, no extra config).
- `drivers/x.ts` — official v2 create-post endpoint.
- `drivers/facebook.ts` — official Graph API Page feed post. Needs the page id:
  add `SOCIAL_FACEBOOK_PAGE_ID` (optional) to the platform env schema — the
  window comment already reserves driver extras as lane additions. The
  ACCESS_TOKEN slot carries the PAGE token.
- `drivers/instagram.ts` — HONESTY CASE: the official content-publish flow
  requires media; a text-only `post` draft cannot become an IG feed post. Ship
  the driver as a typed, tested refusal that names this real platform
  constraint (it arms structurally; a media path arrives with a later video/
  asset bucket). Add `SOCIAL_INSTAGRAM_USER_ID` (optional) now so the config
  seat exists.
- `drivers/index.ts` — `productionSocialDrivers(env)`: assembles the
  `Partial<Record<SocialPlatform, SocialDriverFactory>>` map the registry
  takes; a platform missing its driver extras contributes NO factory (the
  ladder then names the missing arm honestly). Export through `social/index.ts`.

Driver shape rules (all four): fetch is injectable (default = global fetch, but
tests always inject); `publish()` resolves ONLY on a platform-accepted response
whose id becomes `externalPostId` (permalink/echo into `meta`); every non-2xx →
one typed error carrying platform + status + the platform's message, and the
credential must never appear in any error, log, or test snapshot.

## Hard constraints

- **Secrets:** real credentials exist in gitignored `.context/` files. Do NOT
  read, copy, or reference them — drivers are credential-agnostic; tokens
  arrive as `EnvSource` values in tests and via env at arming time.
- **Env discipline:** read env ONLY from a passed `EnvSource`. Never read the
  global process environment, and never write that literal anywhere — the
  boundary ratchet (`tests/boundary.test.ts`) greps for it, comments included;
  main went red on exactly this once already.
- **No UI, no queue worker, no publish caller** — drivers + assembly + tests
  only.
- **Never `npm install` in the worktree** (preinstall guard enforces); no
  `next dev` in a lane.
- Additive only in `packages/platform/src/env.ts`; nothing else outside
  `packages/engine/src/social/` should need touching.

## Tests (extend the engine suite)

Per driver: accepted → receipt with the platform's id · non-2xx → typed error,
NOTHING recorded upstream (prove via the publish door + fake repos pattern in
`social/__tests__/publish.test.ts`) · request payload/headers pinned (endpoint,
auth header shape, body carries the text verbatim) · token absent from error
text. Assembly: extras present → factory registered; extras missing → platform
driverless and `resolveSocialPublisher` names the missing arm; IG refusal case
pinned.

## Gate + wrap

Before EVERY commit: `npm test -w @thalon/engine` green, root `npm run
typecheck` + `npm run lint` clean, `pwsh scripts/ci-grep-guard.ps1` PASS.
Commit locally on the branch in small steps — **do NOT push, do NOT open a
PR, do NOT merge**; the lead reviews and merges. When done (or blocked), write
`WRAP-pub2-drivers.md` in the worktree root: what shipped, per-driver endpoint
+ version pinned, any contract gaps found (report, never work around), test
counts, and anything the founder must do before a first live post. Then stop.
