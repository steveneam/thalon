# WRAP — lane `youtube-destination` (YouTube as a posting destination: the BUILD half, disarmed)

**Charter:** founder ruling s89 ("Youtube as a destination"), COORDINATION §s90.
**Branch:** `agent/youtube-destination`. **Status:** built, fake-tested, NOTHING armed.
Suite + verify results are at the bottom.

## What shipped

1. `"youtube"` in `SOCIAL_PLATFORMS` (`packages/contracts/src/social.ts`) + a
   `youtube` cadence key in `socialPublishConfigSchema`.
2. `youtubePostSettingsSchema` (`packages/contracts/src/platform-settings.ts`)
   replacing the `SETTINGS_DEFERRED.youtube` IOU — the entry is DELETED in the
   same change; the map is now empty and its ratchet stays armed for the next
   deferral.
3. Capability truth in both homes:
   `PLATFORM_CAPABILITIES.youtube` (contracts) and
   `METRIC_CAPABILITIES.youtube` (engine metrics). Plus `platformFitLabel`
   ("YouTube") and a new fit rule: `video_required`.
4. `packages/engine/src/social/drivers/youtube.ts` (new) — official YouTube
   Data API v3 `videos.insert` resumable upload — registered in
   `drivers/index.ts` (token-only, the reddit shape) and named in
   `registry.ts`'s missing-driver refusal. Fake-driver tests in
   `__tests__/drivers-youtube.test.ts`.
5. Queue/publish wiring: NOTHING beyond the pattern — the door's rung-c
   cadence read and settings pass-through work for youtube purely through the
   contracts key. No consumer or door code changed.

## Every completeness test that fired, and its answer

| Fired | Answer |
| --- | --- |
| `contracts/__tests__/platform-capability.test.ts` (matrix total over enum) | Real `youtube` row: description ceiling 5000, video-required via new `media.requiredKind`, 1 thumbnail (JPEG/PNG), hashtags max 60. Two new pins added (the row's values; `requiredKind` absent everywhere else). |
| `contracts/__tests__/s87-window.test.ts` (settings complete over enum; the deferral tripwire) | `youtubePostSettingsSchema` joins `platformSettingsSchema`; the deferral test fired exactly as designed and was rewritten to pin the RESOLUTION (youtube is a platform, has a schema, is out of the deferral map — the not-both loop stays armed). |
| `contracts/__tests__/entitlements.test.ts` (config block covers enum) | Passed via the `youtube` cadence key — no test edit needed. |
| `engine/src/social/__tests__/capability.test.ts` (validator total over enum) | The every-platform loop now attaches the medium the row DEMANDS (video for youtube). New tests: text-only and image-only → `video_required`; video passes; thumbnail-beside-video rules; the 5000 ceiling; the 60-hashtag cliff; video-on-image-platform unchanged. |
| `engine/src/social/metrics/__tests__/capability.test.ts` (metrics matrix total over enum) | `youtube` row: `reader: null`, reports nothing, refuses `views/impressions/likes/comments` — all `permissioned` (choice argued below). Resolver test added: a perfect token cannot open it, and the refusal never blames the credential. |
| `engine/src/social/__tests__/drivers.test.ts` (assembly membership) | Both assembly lists gain `youtube` (extra-less, like reddit); tiktok stays driverless. |
| `engine/src/create/__tests__/plan.test.ts` (youtube's pinned refusal copy) | **Outside my named file set — disclosed.** The old pin ("unknown_platform … no platform key", reading `SETTINGS_DEFERRED`) is the deferral's own tripwire; it fired because the deferral resolved. Rewritten to the TikTok-shaped truth: `channel_not_connected` / "no connector in this build". `plan.ts` itself needed NO change (it reads the deferral map generically). |

## The metrics permanence word: `permissioned`, and why

Kickoff ground truth #2 steered "gated-class, not `no_driver`", with the word
chosen per file vocabulary. Per `metrics/capability.ts`'s own definitions:

- **Not `gated`** — that word means a partner application (LinkedIn). Google
  grants `youtube.readonly`/`yt-analytics.readonly` to any consented channel
  owner; no selection program is involved. Claiming `gated` would be a lie.
- **Not `no_driver`** — literally true (no reader exists) but it sends the
  fixer to the wrong place: a reader built today could authenticate against
  nothing, because the founder's Google portal app does not exist. The unbuilt
  reader is DOWNSTREAM of the missing grant.
- **`permissioned`** — "the API exists and we could have it; this token or app
  lacks the permission." Exactly true for every label. The refusal reasons
  name both facts (no app/grant, and therefore no reader yet) plus the unlock:
  the YouTube connect window, then a small reader build.

Also recorded in the row: the keyed PUBLIC `videos.list` road (statistics on
public videos via `YOUTUBE_API_KEY`) is deliberately NOT used for our own
posts — blind to unlisted/private uploads, and it would spend the intel
sweep's quota. `metered` stays unset (the metered-platforms pin remains
X-only). NOT `deferred`: that word is reserved for a built road deliberately
not driven (X); youtube's road is unbuilt.

## Fit ceilings, with citations (all checked 2026-08-01)

- **Description 5000** — https://developers.google.com/youtube/v3/docs/videos,
  `snippet.description`: "maximum length of 5000 bytes". ⚠ BYTES: the fit
  validator counts characters, which UNDER-counts multi-byte text (the one
  row where the matrix's conservative bias inverts). The driver is the
  byte-accurate backstop and refuses pre-call — pinned by a test where a
  3000-character/6000-byte body passes characters and refuses bytes.
- **Title 100** — same doc, `snippet.title`: "maximum length of 100
  characters". Kept OUT of the matrix per the Reddit convention (a required
  platform field the driver derives): enforced in
  `youtubePostSettingsSchema.title` (max 100) and in the driver.
- **`<` and `>` barred in both fields** — same doc ("all valid UTF-8
  characters except < and >"). Driver refuses pre-call, typed; never rewrites
  approved words.
- **Video required; thumbnail 1× JPEG/PNG** —
  https://developers.google.com/youtube/v3/docs/videos/insert (accepted media
  `video/*`) and https://developers.google.com/youtube/v3/docs/thumbnails/set.
  Expressed as new additive matrix field `media.requiredKind: "video"` +
  fit code `video_required` (a text-only OR image-only draft fails fit with a
  typed problem and never reaches the driver or the queue producer).
- **Hashtags 60** — https://support.google.com/youtube/answer/6390658: past 60
  YouTube ignores EVERY hashtag. The API accepts the upload, so this is the
  matrix's conservative bias pointed at a documented total-loss behavior
  rather than a hard bounce — flagged so a reviewer can strike it if the
  "what the API accepts" reading should win.

## Proof nothing armed — where the empty seats are

1. **No env seats exist.** `SOCIAL_YOUTUBE_ACCESS_TOKEN` /
   `SOCIAL_YOUTUBE_ARMED` are NOT declared in the platform env schema
   (`packages/platform/src/env.ts` untouched — outside my file set, and
   deliberately so): a key the schema doesn't declare can never arm anything.
2. **No vault road.** `SOCIAL_VAULT_DESTINATIONS`
   (`engine/src/integrations/social-arming.ts`, untouched) has no youtube —
   tenant data cannot fill the seats either.
3. **The production resolvers' source maps carry no youtube keys**
   (`drivers/index.ts` — commented at the registration site). Pinned by test:
   even a hand-set `SOCIAL_YOUTUBE_*` env pair evaporates before the ratchet
   sees it (`drivers-youtube.test.ts` "even a hand-set env pair cannot arm").
4. **The fit gate refuses every draft that exists today** (`video_required` —
   the publish door's media envelope is image-only, so no current draft can
   carry a video), and the sequence gate/two-key ladder is unchanged.
5. All driver tests inject `fetchImpl`; no network path is constructed
   anywhere outside `productionSocialDrivers`, which only the (seatless)
   resolvers call.

Arming later = the founder's Google window delivering: env schema pair +
vault destination + connect flow. Zero code here needs revisiting for that.

## What I deliberately did NOT build

- The OAuth connect flow's live half (founder's Google portal app — his gate).
- Any YouTube metrics/analytics READER (the `permissioned` posture IS the
  deliverable).
- `thumbnails.set` in the driver: unreachable today (the door carries one
  media item; a thumbnail image beside the video cannot travel), so any extra
  attachment refuses typed (`YouTubeExtraMediaUnsupportedError`) rather than
  being silently dropped. Lands with the video-arc's publish wiring.
- An uploaded-thumbnail SETTINGS knob — it would be a dead door (nothing can
  honor it); the deferred trio's "thumbnail" is answered by the
  cross-platform `video.coverFrameMs` (the cut owns its cover), argued in the
  platform-settings docblock.
- Any UI/sheet/route; anything in `trend/**` (the trend YouTube driver is a
  different, existing thing); any db change.

## Contract-window items for the lead (found, not fixed — outside my set)

1. **DB CHECK drift (the one real IOU):**
   `social_publications_platform_check` and
   `publication_metrics_platform_check` (`packages/db/src/schema/social.ts`
   derives them from `SOCIAL_PLATFORMS`; migrations 0021/0022 baked the
   seven-platform list). The drizzle schema now says eight; the applied
   migrations say seven. Nothing I ship can write a youtube row (nothing can
   arm, nothing passes fit), so no test fires and nothing breaks — but the
   next db window must add the youtube CHECK migration BEFORE any live
   youtube publication. This is the kickoff's "contract-window question",
   reported as instructed.
2. `contracts/create-run.ts:~300` docblock still says "there is no `youtube`
   platform key" (frozen s87 window — comment only, now stale).
   `DEFAULT_PLATFORM_ROUTING.video` could name youtube once the video publish
   path exists; not before.
3. `create/plan.ts` rung 4's media-required sentence says "attach an image" —
   for youtube the honest word is "video". Cosmetic until video runs route
   there; a video-arc follow-up.

## Disagreements / judgment calls a reviewer should check

- **`plan.test.ts` edit crossed the file-set boundary** (engine/src/create).
  I read "every firing test gets a real answer, never a skip" as authorizing
  it — the test is the deferral's own tripwire and the alternative was a red
  suite or a skip. No create PRODUCT code changed.
- **`privacy` knob added** to `youtubePostSettingsSchema` beyond the deferred
  trio (title/thumbnail/madeForKids): `status.privacyStatus` is an official
  upload field, the TikTok block's `privacy` is exact precedent, and a first
  upload landing irreversibly public with no knob read as a dishonest door.
  Strike it if that's scope creep.
- **`madeForKids` is optional in the SCHEMA, required at the DRIVER** — a
  compliance declaration is never defaulted; absence = undeclared = typed
  refusal (`YouTubeMadeForKidsUndeclaredError`). The alternative (schema-
  required) would break the "absent platform = no settings chosen" envelope
  convention.
- **Hashtags 60 as a refusal** — see the citation section; the API would
  accept the upload.

## Gates — post-commit results (feature commit `9193337`)

Run AFTER the last code commit, per the kickoff's ordering:

- Full suite: `npx vitest run --maxWorkers=2` —
  **348 files passed | 4 skipped · 3133 tests passed | 9 skipped · 0 failed**
  (472s; the skips are pre-existing).
- `npm run typecheck` — GREEN, all seven packages, exit 0.
- `npm run lint` — GREEN, 0 errors (8 pre-existing warnings, none in lane
  files).
- Combined exit code 0 (`verify-equivalent`).

⚠ One honest deviation: the literal `npm run verify` script runs `npm test`
= vitest UNCAPPED, and with the second lane live that run was killed twice
on this box before completing. I ran verify's exact three gates with the
kickoff's own mandated `--maxWorkers=2` cap instead — same commands, same
tree, capped workers, exit 0. The lead may prefer to re-run the literal
script post-merge when the box is single-lane.
