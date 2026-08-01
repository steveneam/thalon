# KICKOFF — lane `youtube-destination` (YouTube as a posting destination: the BUILD half, disarmed)

**Charter: founder ruling s89** — *"Youtube as a destination."* — recorded in
`COORDINATION.md` §s90 rulings. This lane replaces the retired `trend-live`
candidate (the s90 boot re-ground found the trend half already built — the
correction is recorded in COORDINATION §s90). **The LIVE half is gated on the
founder's Google portal app and is NOT yours** — you build the platform key,
the contracts resolution, the capability truth, and the driver behind the
seam, all tests fake, nothing armed.

Launch is Mode B in the `thalon` tmux session. You own
`agent/youtube-destination`, worktree `.claude/worktrees/youtube-destination`.

**Why this lane exists.** Every destination the workspace can talk about lives
in `SOCIAL_PLATFORMS` (`packages/contracts/src/social.ts:17` — seven keys
today). YouTube was deliberately deferred with a dated IOU:
`SETTINGS_DEFERRED.youtube` in `packages/contracts/src/platform-settings.ts:172`
— *"no platform key, no capability row, no driver."* The deferral's own design
is that **adding the key makes the completeness tests fire until every row is
resolved honestly** — that cascade is not a nuisance, it IS the work.

---

## The ground truth that decides the design

1. **The key cascades by design.** Adding `"youtube"` to `SOCIAL_PLATFORMS`
   fires completeness tests across the suite — the confirmed set:
   `packages/contracts/src/__tests__/platform-capability.test.ts`,
   `packages/contracts/src/__tests__/s87-window.test.ts`,
   `packages/contracts/src/__tests__/entitlements.test.ts`,
   `packages/engine/src/social/__tests__/capability.test.ts` — plus whatever
   else `npx vitest run` surfaces. **Every firing test gets a real answer,
   never a skip, never a placeholder row.**
2. **Two capability homes, both truth-tables:**
   `packages/contracts/src/platform-capability.ts` (the contracts-side rows)
   and `packages/engine/src/social/metrics/capability.ts` (the metrics
   permanence vocabulary — six words; absences must use the right one).
   Neither mentions youtube today (verified at boot). YouTube Analytics API
   reads are OAuth-gated on the founder's Google app → the honest metrics
   posture at build time is `gated`-class, not `no_driver` (a reader that
   exists-but-cannot-authenticate and a reader nobody built are different
   truths — pick per file vocabulary, and say why in the wrap).
3. **The settings IOU resolves, then deletes.** Replace
   `SETTINGS_DEFERRED.youtube` with a real youtube settings schema in
   `platform-settings.ts` — the deferred note names the fields: title,
   thumbnail, made-for-kids (COPPA declaration is a REQUIRED upload field on
   the official API, not an optional nicety). Model on
   `socialRedditCadenceSchema` (`packages/contracts/src/social.ts` — the
   one-platform-specific-block precedent). Delete the `SETTINGS_DEFERRED`
   entry in the same change — a resolved IOU that outlives its resolution is
   a lie (the judge-candidate lane's deviation-block rule, same doctrine).
4. **The driver seam is uniform.** Seven drivers exist in
   `packages/engine/src/social/drivers/` (bluesky.ts · facebook.ts ·
   instagram.ts · linkedin.ts · reddit.ts · x.ts + oauth1.ts helper), wired
   through `drivers/index.ts` env-seat resolution and
   `packages/engine/src/social/registry.ts`. Yours is `drivers/youtube.ts`
   `(new)` — official **YouTube Data API v3 `videos.insert`** (resumable
   upload), OAuth bearer from the vault seat exactly like facebook's shape.
   No API surface that isn't Google-official documentation, cited in the
   driver docblock with a checked-on date (the s89 Facebook lane's pattern).

## What you build

1. `"youtube"` into `SOCIAL_PLATFORMS` (`packages/contracts/src/social.ts:17`)
   + the platform-settings schema replacing the `SETTINGS_DEFERRED.youtube`
   IOU + every contracts-side completeness row the tests demand.
2. Capability truth in both homes (ground truth #2), including
   `platformFitLabel` (`packages/engine/src/social/capability.ts:341` — the
   display-name map) and `validateForPlatform` fit rules: YouTube is
   VIDEO-REQUIRED (a text-only draft must fail fit with a typed problem, not
   reach the driver), title length 100, description 5000 — cite the live
   Google doc for each ceiling.
3. `packages/engine/src/social/drivers/youtube.ts` (new) behind the seam +
   registration in `drivers/index.ts` and `registry.ts`, fake-driver tests
   for every path (happy · refusal on missing credential · fit refusals ·
   the made-for-kids declaration passing through).
4. Queue-consumer/publish wiring ONLY as far as the existing per-platform
   pattern demands — **the arming key rests EMPTY; the sequence gate is
   unchanged; nothing you ship can post.**

## What you do NOT build

The OAuth connect flow's live half (founder's Google portal app — his
browser, his gate) · YouTube Analytics/metrics READS (the deferral posture
from ground truth #2 is the deliverable, not a reader) · any UI/sheet/route ·
transcript or trend-side anything (`packages/engine/src/trend/**` is NOT
yours — the trend YouTube driver already exists and is not this lane) · any
arming, env default, or config that could make a post reachable.

## File set — DISJOINT, hard boundary

Yours: `packages/contracts/src/social.ts` ·
`packages/contracts/src/platform-settings.ts` ·
`packages/contracts/src/platform-capability.ts` + their tests ·
`packages/engine/src/social/**` (capability.ts, metrics/capability.ts,
drivers/youtube.ts `(new)`, drivers/index.ts, registry.ts + tests).
**NOT yours:** `packages/db/**` (missing verb/table = STOP and report —
contract-window question) · `packages/engine/src/trend/**` ·
`eval/**` and `apps/web/src/lib/approve-queue/**` (the `learn-evals` lane is
live there) · sheets, routes, UI. Outside the set = STOP and report.

## Gates, and the box

- `npx vitest run --maxWorkers=2` (a second lane is live) · **never
  `pkill -f vitest`** · `npm run typecheck` (vitest does not typecheck) ·
  done = `npm run verify` green on EXIT CODE in your worktree · never
  `npm install` in a worktree.
- **Re-run the full suite after your LAST commit, not before it.**

## Wrap

`agent_handoff/lanes/WRAP-youtube-destination.md` (new — you write it): every
completeness test that fired and how each row was answered · the metrics
permanence word you chose and why · the fit ceilings with their doc citations
· proof nothing armed (where the empty seats are) · what you deliberately did
not build · anything you disagreed with. Commit on your branch, push, stop.
**The lead rebases/merges — you do not.**
