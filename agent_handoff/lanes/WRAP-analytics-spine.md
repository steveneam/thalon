# WRAP — lane `analytics-spine` (D2: own-post analytics, the spine)

**Branch `agent/analytics-spine`. `npm run verify` GREEN on exit code in the
worktree: 2959 passed / 9 skipped / 0 failed, 0 lint errors.** Contracts
consumed exactly as frozen — not one edit. Zero live calls: every platform
response in every test is an injected fake. The tick is on no systemd unit.
**The lead merges.**

---

## 1. The seam decision — REPORTED BEFORE BUILDING

**`fetchPostMetrics` does NOT ride the publisher. It is a parallel READER
seam: `SocialMetricsReader`, resolved by its own credential-only ratchet.**

The kickoff named the alternative (an optional verb on `SocialPublisher`,
the `needsPublicMediaUrl` opt-in pattern). It loses on three counts, and the
first is the one that decided it.

**(a) The tick must be structurally unable to post.** An optional
`fetchPostMetrics?` on `SocialPublisher` hands the metrics tick a live
`publish()` for every platform it holds — a loop bug becomes a post nobody
approved. `SocialMetricsReader` has no publish method, so the tick cannot
reach the publish path at all. That is the queue consumer's own posture in
its own words — *"structurally, not just by flag"* — applied to the read
side, and it is why this is not a matter of taste.

**(b) The arms are different arms, and conflating them breaks measurement.**
`resolveSocialPublisher` refuses unless `SOCIAL_<P>_ARMED` carries the
founder's per-platform POSTING GO. Reading numbers off posts we already
published is not an outbound act and must not need that GO — otherwise
disarming a platform (an ordinary, correct operator move, and the emergency
override's whole purpose) silently blinds the analytics on everything that
platform ever carried. The reader ratchet asks for one thing: a connected
credential. Pinned by a test that passes `SOCIAL_BLUESKY_ARMED: "false"` and
still resolves a reader.

**(c) The refusal vocabularies are disjoint.** A publish refusal is about
arming, cadence and fit. A metrics refusal is about PERMISSION and PLATFORM
CAPABILITY — *"partner-gated"*, *"Meta retired this metric in 2025"*.
Different sentences, different fixes, different permanence.
`SocialMetricsRefusedError` is deliberately NOT a `PublishRefusedError`.

**No parallel driver folder.** Reader factories live BESIDE their publisher
in `drivers/<platform>.ts`, so one file per platform stays the single place
that platform's API is known — a parallel tree would have made
`INSTAGRAM_GRAPH_VERSION` and friends into two truths that drift.

---

## 2. The per-platform capability table AS BUILT

Verified against live platform docs on **2026-07-29** (each row cites its
doc in `metrics/capability.ts`; every row carries `verifiedOn`).
✅ = a row lands. ⛔ = **no row, ever** — absence with a stated reason.

| metric | bluesky | x | facebook | instagram | reddit | linkedin | tiktok |
|---|---|---|---|---|---|---|---|
| **audience** | ⛔ structural | ✅ `impressions` | ✅ `reach` | ✅ `reach` | ⛔ structural | ⛔ gated | ⛔ no driver |
| views | — | — | ✅ `post_media_view` | ✅ `views` | — | ⛔ | ⛔ |
| impressions | ⛔ no such number in the protocol | ✅ `public_metrics.impression_count` | ⛔ **retired 2025-11-15** | ⛔ **retired at v22** | ⛔ `view_count` is moderator-only | ⛔ partner-gated | ⛔ |
| reach | ⛔ | ⛔ X reports impressions, not unique reach | ✅ `post_total_media_view_unique` | ✅ `reach` | ⛔ | ⛔ partner-gated | ⛔ |
| likes / reactions | ✅ `likeCount` | ✅ `like_count` | ✅ `post_reactions_by_type_total` (summed) | ✅ `likes` | — | ⛔ **Restricted permission** | ⛔ |
| comments / replies | ✅ `replyCount` | ✅ `reply_count` | ⛔ not an insights metric | ✅ `comments` | ✅ `num_comments` | ⛔ Restricted | ⛔ |
| reposts / shares | ✅ `repostCount` | ✅ `retweet_count` | ⛔ not an insights metric | ✅ `shares` | — | ⛔ | ⛔ |
| quotes | ✅ `quoteCount` | ✅ `quote_count` | — | — | — | ⛔ | ⛔ |
| bookmarks / saves | ✅ `bookmarkCount` | ✅ `bookmark_count` | — | ✅ `saved` | — | ⛔ | ⛔ |
| clicks | — | ⛔ 30-day non-public metric | ✅ `post_clicks` | — | — | ⛔ | ⛔ |
| score / ratio | — | — | — | — | ✅ `score`, `upvote_ratio` | — | ⛔ |

**The four findings that change what the surface can draw:**

1. **Facebook's reach metric was RETIRED.** Meta killed
   `post_impressions_unique` on 2025-06-15 and `post_impressions*` on
   2025-11-15. **The Analytics sheet's fixture shows Facebook reporting reach
   — under a metric that stopped existing a year before this lane.** The
   column survives under Meta's new word (`post_total_media_view_unique`),
   which the matrix maps to `reach`; the drivers never ask for the dead
   names, and a test pins that they don't.
2. **LinkedIn is gated on BOTH roads, and one of them was not obvious.**
   `organizationalEntityShareStatistics` is partner-approved AND describes
   ORGANISATION shares — our driver authors `urn:li:person:<sub>`, a member
   post, which that endpoint does not cover even with approval. The road that
   *does* cover member posts, `socialActions`, needs `r_member_social_feed`,
   which LinkedIn marks **Restricted — select developers only**; our token's
   `w_member_social_feed` writes without reading. So: an application, not a
   scope. There is no reader, and a perfectly good credential does not change
   that (pinned by a test).
3. **X metrics COST MONEY.** X is metered pay-per-use with no free read
   tier — every post measured is a billed resource. It is the only platform
   with a `metered` note, and the tick prints the bill **before the pass
   runs, armed or not**.
4. **Bluesky's absence is structural, and its engagement is entirely real** —
   exactly the split the sheet drew. The AT Protocol computes no view number
   for anyone; its like/repost/reply/quote counts are genuine.

**Permanence vocabulary** (what the wrap was asked for — which absences are
permanent vs permissioned): `structural` (nobody can ever have it) ·
`retired` (the platform removed it) · `gated` (partner application) ·
`permissioned` (this token lacks a scope; a reconnect fixes it) ·
`no_driver` (ours to fix). It rides every refusal into the read-model, so the
surface's copy is data rather than a sentence someone typed under a number.

---

## 3. What the Analytics surface can now show honestly

`analyticsReadModel(deps, {windowDays, limit}, now)` returns the sheet's
shape with the honesty already applied, so the surface cannot un-apply it:

- **Tiles** — Published (from our own rows, always complete), Reach,
  Engagement, each with the previous window, delta, and `deltaPct` that is
  **null when the previous value is 0** (a move from nothing is not a
  percentage). Every tile carries `platformsReporting` **and**
  `platformsNotReporting` with each one's reason — the *"3 of 5 platforms
  report reach"* line and its footnote come from the same read.
- **Per-post rows** — audience and engagement as `MetricCell`s where
  `value: null` + `reason` + `absence` is a *different fact* from
  `value: 0`, plus `parts` naming each platform field behind the number
  (the tooltip's provenance), plus `asOf`.
- **Sparkline** — the audience series where the platform reports one, the
  engagement series where it does not, and **`trend: null` when nothing was
  measured** — never a flat line at zero, which reads as "measured, and it
  was nothing".
- **Per-channel roll-up** — per platform, over the same bounded page (never
  a wider claim than was read), with `reportsAudience` and the platform's own
  absence sentence.
- **The bound, stated** — `bound.truncated` says when the page did not reach
  the start of the comparison window, so partial deltas cannot read as
  complete.

**What stays "not measured", permanently:** LinkedIn everything ·
Bluesky/Reddit reach and impressions · Facebook impressions (retired) ·
TikTok everything. **What is only "not measured YET":** any platform with a
reader whose tick has not run — reported as `not_collected`, which is a
different sentence with a different fix.

---

## 4. What was deliberately NOT built

- **No UI.** Engine-side read-model only, per the kickoff.
- **No systemd unit.** `scripts/run-metrics-tick.ts --once` is hand-run;
  `--armed` is required to read a platform or write a row. **The arm is a CLI
  flag, not an env key, because `packages/platform`'s env schema is outside
  this lane's file set.** → **Lead item: when the tick earns a standing timer,
  `SOCIAL_METRICS_ARMED` belongs in that schema beside `SOCIAL_QUEUE_ARMED`.**
- **No X `organic_metrics`/`non_public_metrics`** (link + profile clicks).
  They exist for our own posts but only within 30 days of posting — a series
  that silently stops on day 31 leaves a hole nothing can tell apart from a
  failed tick.
- **No Facebook comment/share counts.** They are fields on the post object
  (`comments.summary`, `shares`), not Page Insights metrics — a second call.
  Recorded as a `no_driver` refusal, not a fabricated zero. Cheapest real
  follow-up on this list.
- **No learning-loop tie-in** (the sheet's "Feeds back" column / §3.1 flying
  car). That is B-learn's, and it now has its data source.
- **No new repo methods.** The frozen window's three reads were used as-is.

### Flags for the lead

1. **The sheet's Facebook fixture is now wrong** (finding 2.1). Whoever
   builds the Analytics surface should re-read the reach column against the
   capability table, not the mock's numbers.
2. **`publicationMetrics.series()` ties are nondeterministic.** It orders by
   `(captured_at, id)` and `id` is `defaultRandom()`, so two labels written
   into the SAME bucket come back in arbitrary order. Harmless for
   everything built here (the read-model groups by label first) — but a
   future consumer reading `series` across labels positionally will be flaky.
   Caught by a test that passed alone and failed in the full suite.
3. **The read-model is one query per publication** (bounded by `limit`,
   ≤100 indexed reads by default). A single-query version needs a
   "many publications at once" repo method = a future contract window.
4. **`oauth1Header` was widened** to RFC 5849 §3.4.1 query handling — the
   metrics read is a signed `GET` with a query string, and the POST-only
   signer would have produced a 401 indistinguishable from a dead credential
   on X's first live read. The POST golden signature is byte-identical
   (pinned), and the new cases assert against a base string assembled **by
   hand from the spec**, not re-derived from the code under test.
5. **X spends money.** Before any armed pass that includes X publications,
   that is a founder call.

### Files

New: `packages/engine/src/social/metrics/{capability,registry,errors,parse,tick,read-model,index}.ts`
+ 4 test files · `scripts/run-metrics-tick.ts`.
Touched: the five `drivers/<platform>.ts` (reader factories beside their
publishers) · `drivers/oauth1.ts` (query signing) · `drivers/index.ts`
(`productionSocialMetricsReaders`/`Resolver`) · `social/index.ts` (exports) ·
`integrations/social-arming.ts` + `integrations/index.ts`
(`vaultSocialMetricsResolver` — the credential half of the vault view, no
arming half). Nothing outside the kickoff's file set; the `create-engine`
lane's `packages/engine/src/create/**` untouched.
