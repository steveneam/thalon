# WRAP — lane `pub2-drivers` (B-pub.2 publisher drivers, s65)

Status: **DONE** — all four drivers + assembly + tests shipped on
`agent/b-pub2-drivers`, committed locally, **not pushed** (lead reviews and
merges). Everything is DISARMED and zero-live: no code path reaches a
platform; every test injects fetch; the arming ratchet is untouched.

## What shipped

| Commit | Content |
|---|---|
| `954266a` | platform env driver extras: `SOCIAL_FACEBOOK_PAGE_ID` + `SOCIAL_INSTAGRAM_USER_ID` (optional, additive — the window-2 reserved lane additions) |
| `9336ba5` | `packages/engine/src/social/drivers/` — linkedin, x, facebook, instagram, shared typed error, `productionSocialDrivers` assembly, exports through `social/index.ts`, full test extension |

Frozen surfaces untouched: `registry.ts`, `publish.ts`, `errors.ts` (one
additive subclass only, defined in `drivers/instagram.ts`), all of
`packages/contracts`, the drizzle schema.

## Per-driver endpoint + version pins

- **linkedin** (`drivers/linkedin.ts`, name `linkedin-rest-posts`) —
  official versioned REST Posts API: `POST https://api.linkedin.com/rest/posts`,
  headers `LinkedIn-Version: 202512` (exported pin `LINKEDIN_VERSION`) +
  `X-Restli-Protocol-Version: 2.0.0`. Author derived at publish time from
  `GET /v2/userinfo` (`sub` claim → `urn:li:person:{sub}`) — stateless, no
  extra config seat. Accepted id = the post URN from the `x-restli-id`
  response header; meta carries authorUrn + permalink + apiVersion.
- **x** (`drivers/x.ts`, name `x-v2-create-post`) — official v2 create-post:
  `POST https://api.x.com/2/tweets`, body exactly `{ text }` (verbatim).
  Accepted id = `data.id`; meta carries the username-less permalink.
- **facebook** (`drivers/facebook.ts`, name `facebook-page-feed`) — official
  Graph API Page feed: `POST https://graph.facebook.com/v23.0/{pageId}/feed`
  (exported pin `FACEBOOK_GRAPH_VERSION`), form-encoded `message` (verbatim).
  The ACCESS_TOKEN arming slot carries the PAGE token; it travels ONLY in the
  Authorization header, never URL/body (test-pinned). Page id closed over at
  assembly from `SOCIAL_FACEBOOK_PAGE_ID` (the frozen `SocialDriverFactory`
  passes credentials only). Accepted id = the `{page}_{post}` composite.
- **instagram** (`drivers/instagram.ts`, name `instagram-text-refusal`) —
  HONESTY CASE as briefed: the official content-publish flow requires media,
  so `publish()` always throws typed `InstagramTextOnlyUnsupportedError`
  (`refusal: "platform_requires_media"`, extends `PublishRefusedError`). It
  arms structurally when credential + GO + `SOCIAL_INSTAGRAM_USER_ID` are set;
  zero fetch exists in the driver. The media path replaces the refusal behind
  the same factory seat at a later video/asset bucket.
- **assembly** (`drivers/index.ts`) — `productionSocialDrivers(env: ThalonEnv)`:
  linkedin + x always (no extras needed); facebook/instagram only when their
  extra is set — a missing extra contributes NO factory, so the untouched
  ladder names the missing driver honestly. TikTok deliberately absent
  (platform-review-gated, out of lane scope) — its arming pair can never
  resolve.
- Shared error (`drivers/errors.ts`): one `SocialDriverApiError` carrying
  platform + HTTP status + the platform's message (≤300 chars); every non-2xx
  and every unusable-2xx (missing id) throws it. The credential appears in no
  error, log, URL, or snapshot — asserted in every error-path test.

## Tests

Engine suite: **726 passed / 7 skipped (99 files)** — was 706/7 before the
lane; **+20 new** (17 driver-unit cases in `social/__tests__/drivers.test.ts`
pinning wire shape per driver — endpoint, version header, auth shape, verbatim
body — plus token-never-leaks on every error path and 5 assembly/ratchet
cases; 3 door integrations in `publish.test.ts` proving accepted → ledger row
with the platform's real id, and non-2xx / IG refusal → NOTHING recorded).
Root `npm run typecheck` clean, `npm run lint` 0 errors (16 pre-existing
apps/web warnings, none in lane files), `pwsh scripts/ci-grep-guard.ps1` PASS
(also ran pre-commit on every commit).

## Contract gaps found (reported, not worked around)

1. **Stale missing-driver wording in the frozen registry.** When a platform is
   env-armed but its driver extra is missing (e.g. facebook without
   `SOCIAL_FACEBOOK_PAGE_ID`), the ladder's refusal still says the driver is
   missing because "B-pub.1 ships no drivers — official-API drivers land
   per-platform at B-pub.2+". Semantics are correct (no factory = named
   missing arm) but the sentence is stale post-merge and doesn't hint that the
   fix for facebook is the PAGE_ID extra. One-string cosmetic fix in
   `registry.ts:132` — lead's call at merge or next window; I did not touch
   the frozen file.
2. **LinkedIn "Little Format" vs body-verbatim.** LinkedIn treats
   `( ) { } [ ] < > @ | ~ _ *` in `commentary` as markup; the seam contract
   says send the judged body VERBATIM, so the driver deliberately does not
   escape (escaping alters the wire text). Consequence: a body containing
   e.g. `_` or `@` may RENDER differently on LinkedIn than authored. If
   verbatim-on-render is the actual intent, escaping is a deliberate contract
   decision for a window, not a driver patch.
3. **Version pins need a pre-live check.** `LINKEDIN_VERSION = "202512"`
   (monthly versions, ~1-year support → safe into late 2026) and Graph
   `v23.0` (~2-year support → mid-2027) were pinned from documented releases;
   both should be verified against live docs right before the first real
   post. Each is one exported constant with tests pinning it — a bump is a
   one-line reviewed change.

## Before a first live post (founder)

Nothing posts today even fully armed: **no production caller exists** — the
queue-worker bucket owns wiring `productionSocialDrivers` +
`resolveSocialPublisher` into the publish door, each live platform still needs
its `SOCIAL_*_ACCESS_TOKEN` + `SOCIAL_*_ARMED="true"` founder GO, and the
tenant needs the platform in its brand-profile `social` block. Per platform:

- **LinkedIn**: member OAuth token with scopes `openid profile w_member_social`.
- **X**: OAuth 2.0 user-context token with `tweet.write users.read`
  (+ `offline.access` for refresh); app needs write access in the developer
  portal — free-tier post caps apply.
- **Facebook**: PAGE access token from a user with `pages_manage_posts` on the
  target Page (app review required outside app-role users) + the Page id into
  `SOCIAL_FACEBOOK_PAGE_ID`.
- **Instagram**: nothing to do — text-only refuses by design until the media
  bucket; setting `SOCIAL_INSTAGRAM_USER_ID` now just seats the config.
- Verify the two version pins (gap 3) and the Little-Format call (gap 2).
