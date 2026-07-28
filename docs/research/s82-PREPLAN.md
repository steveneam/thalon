# PRE-PLAN — s82 parallel lanes: editor verbs · polish tail · the scheduling spine

> Planned at the s81 close on the founder's direction: *"plan the next set of
> phases and tasks … look at Postiz … see if there are anything we can
> incorporate … address some of the medium/low issues … maybe parallel
> workstreams next session."* The PREPLAN artifact class (⑯, s62): decide before
> code, in writing, so the build has something to be held to. Every repo fact
> below was verified in code/DB at plan time, not remembered.

## 1. The Postiz study

**What it is:** Postiz (gitroomhq/postiz-app · postiz.com) — an open-source
scheduler-first social tool. Compose once → per-channel variants with previews →
calendar/queue → timed publish → per-post analytics. NestJS + Next.js + Prisma +
Temporal. 30+ providers behind one provider abstraction.

**⚖ LICENSE: AGPL-3.0.** Repo rule (AGENTS.md, Licensing hygiene): **no AGPL
code embedded — reference-only patterns, re-implemented.** Everything below is a
pattern-level take; nobody opens their source while implementing. Naming the
upstream in this tracked file is fine (guard retired 2026-07-26).

### What Thalon already has — and where it is AHEAD (nothing to take)

| Postiz | Thalon | verdict |
|---|---|---|
| AI compose (ungated — agent drafts, user posts) | fan-out → **judge gate** (denylist + grounding) → Approve consent | **ahead** — the gate IS the product; theirs has none |
| 30+ providers | 4 drivers (LinkedIn·FB·X live-proven, IG typed-refusal) behind a registry + vault + per-platform founder GO | pattern already mirrored; breadth = per-GO discipline, not a build |
| Multi-brand "customer groups" | multi-tenant from table one + brand profiles + switcher | **ahead** |
| Team roles/approval | single-operator Approve consent (by design at this stage) | no-op now |
| Temporal queue engine | sweep-scheduler pattern (systemd unit, proven since s65) — $0, self-hosted | keep ours (MIT/$0 rule) |
| Channels page w/ health | Settings → Integrations honest card states (s70) | **ahead** (validate-on-connect, env-override badges) |

### Worth taking (re-implemented, in priority order)

1. **The approve→slot→queue→timed-publish spine — our half-built loop, finished.**
   Ground truth verified at plan time: `planned_slots` is LIVE (repo
   `plan/unplan/getForDraft/listRange`, calendar + board + dashboard read it) but
   it is *intent only*; **`publish_queue` exists as a table (statuses
   pending/processing/published/failed/cancelled, idempotency key, per-platform
   scheduled index) with NO repo, NO producer, NO consumer** — a queue both of
   whose ends are missing. The publish door + refusal ladder (a→f) is live and
   stays THE only path to a platform. Postiz's core flow is exactly the missing
   piece, and it lands on our own parts: Approve gains a *Schedule* verb
   (approved draft + platform + slot → queue row), a queue consumer tick mirrors
   the sweep scheduler and walks due rows through the existing publish door.
   **Ships DISARMED** — rows sit `pending` until the platform is armed AND the
   founder's per-platform GO stands; the sequence gate is untouched.
2. **A declarative platform capability matrix + deterministic pre-publish
   validator.** Postiz encodes per-provider rules (char limits, media rules,
   link/hashtag norms) in each provider. Verified: our drivers carry **zero**
   such constraints today — a 400-char X body reaches the platform call before
   anything refuses. Re-implement as *data* in contracts + one pure engine
   validator beside the judge (the Phase-2c sibling: the judge gates content,
   this gates FIT). Consumed three ways: at generation (beside `targetTerms`),
   at Approve (visible fit line), at the queue producer (refuse to enqueue what
   the platform will bounce).
3. **Platform-true preview at Approve.** Postiz previews each channel variant
   before scheduling. Our drafts are already per-platform (fan-out), and Approve
   is already ruled media-first "scan-and-decide" — but it renders body text,
   not what X/LinkedIn will *show* (truncation point, link handling, hashtag
   rendering). A preview card state powered by the capability matrix. **Design
   consequence → founder call #3 below** (sheet amendment vs keeper-state).
4. **Parked with triggers (Phase 2+, not this window):**
   - *Per-publication metrics ingestion* (their analytics) — joins B-learn L2's
     standing intel-all-platforms directive; needs a `publication_metrics`
     window. Trigger: first sustained live posting cadence.
   - *Evergreen re-queue* (repeat a keeper post) — trigger: queue consumer live.
   - *RSS auto-post, public API/webhooks/MCP surface* — trigger: external users.

### 1b. The deep dig (founder-directed, s81 second half): every folder, and how an integration actually works

**The founder's question was "is the secret its Auth folder?" — no.** `apps/
backend/src/services/auth` is user LOGIN (GitHub/Google sign-in + a CASL
permissions layer). The platform secret lives in
`libraries/nestjs-libraries/src/integrations/` and it is three small generic
pieces plus one file per platform:

- **`social/social.integrations.interface.ts` (~190 lines)** — ONE
  `SocialProvider` contract: auth verbs (`generateAuthUrl` · `authenticate` ·
  `refreshToken`) + `post()` + capability metadata (`identifier`, `scopes`,
  `maxLength()`, `checkValidity()`, `editor`, a per-platform settings DTO,
  mention lookup, optional analytics).
- **`social.abstract.ts` (~290 lines)** — ONE hardened base: a `fetch()` that
  classifies every failure (429/rate-limit → timed retry ×3 · 401 → a typed
  `RefreshToken` failure · anything else → typed `BadBody` carrying the
  platform's actual response body), SSRF-safe dispatcher, scope verification,
  per-provider concurrency (`maxConcurrentJob`).
- **`integration.manager.ts`** — a plain registry array; the manager derives
  the whole channels catalog (name/identifier/editor/custom fields) from it.
- **Per platform: ONE provider file** (`reddit.provider.ts` = 514 lines
  total, of which the entire OAuth dance is ~90) plus one settings DTO in
  `dtos/posts/providers-settings/` (28 of them — subreddit/flair for Reddit,
  privacy levels for TikTok, and so on; these power both the composer's
  per-platform settings tab AND server-side validation).

**The OAuth dance is fully generic — two endpoints and one dynamic page serve
all ~36 platforms:**
1. `GET /integrations/social/:name` → the provider builds the platform's
   consent URL; the server stashes `state → {codeVerifier, org, redirect}` in
   Redis with a 1-hour TTL; the browser goes to the platform.
2. The platform redirects back to ONE dynamic frontend route
   (`integrations/social/[provider]/page.tsx`) — no per-platform callback
   pages exist.
3. That page posts `{code, state}` to `POST /social-connect/:name`, which
   validates + consumes the state, calls the provider's `authenticate()` (code
   exchange + the platform's "me" endpoint), and persists an org-scoped
   Integration row (token/refresh/expiry/username/avatar).
4. Refresh is automatic: any 401 inside the hardened fetch throws the typed
   `RefreshToken` failure, and a Temporal refresh workflow re-runs the
   provider's `refreshToken()` and retries the job.

**The honest decomposition of "seamless" — three parts, only two of them code:**
(a) the provider-file pattern makes each platform ~300–600 lines; (b) the
generic dance means connecting is a click-through, not token-pasting; (c) their
HOSTED product ships Postiz's own pre-approved platform apps. **Self-hosted
Postiz still requires creating your own developer app per platform** —
`.env.example` is a wall of `REDDIT_CLIENT_ID/SECRET`, `LINKEDIN_CLIENT_ID/…`
pairs. So the app-review wall (Meta/LinkedIn/TikTok posting scopes) is exactly
the one we already named in the s70 Nango verdict, and no code removes it.
What code DOES remove: everything else.

**Folder-by-folder, the rest of the repo (nothing else hides integration magic):**
- `apps/orchestrator` — the Temporal worker: **versioned** post workflows
  (v1.0.1→v1.0.5 side by side, an in-flight-compatibility discipline), an
  `autopost` workflow (RSS), a `refresh.token` workflow, and a
  **`missing.post` recovery workflow** (find scheduled posts the worker
  dropped — a pattern our queue consumer should carry from day one).
- `apps/frontend` — the `new-launch` composer (144 files: per-platform
  settings tabs + per-channel previews), the launches calendar, analytics.
- `apps/commands` — a small CLI (refresh tokens, config check, agent run).
- `apps/extension` — a Chrome extension that posts **via the user's own browser
  cookies** for API-less platforms (Skool). Clever; **REJECTED for Thalon** —
  ToS exposure, and everything it enables sits outside official APIs (our
  standing burner/official-APIs-only rule).
- `apps/sdk` + `public-api/` — a public REST surface + typed SDK (Phase 3).
- `libraries/nestjs-libraries/chat` — a Mastra-based agent + **an MCP server**
  whose tools are the product's own doors (schedule post, list channels,
  generate media). Their agentic layer is a THIN wrapper over the same
  services the UI calls — an architecture note worth keeping, not a build.
- `videos/` (veo3, image-slides) · `3rdparties/` (heygen, reelfarm) ·
  `short-linking/` (dub/kutt/short.io behind an interface with an `empty`
  default) · `upload/` (local/R2/Cloudflare factory) — the SAME provider
  pattern stamped four more times. The lesson is the pattern's leverage, not
  any one folder.
- `database/prisma` — repo-per-model (integrations, posts, autopost, sets,
  webhooks, signatures, errors); nothing novel vs our drizzle repos + RLS.

## 2. The s82 lane plan

Three lanes, disjoint file sets, Mode B via `scripts/launch-lane.sh`, strongest-
tier pin, **launch gated on the founder's named GO** (standing rule: every lane
launch needs fresh approval). Lead = merge gates: verify-on-merged-main by exit
code · drive the jobs · measure the render · read the screenshots. **A lane
cannot drive or screenshot its own work.**

### Pre-flight (lead-direct, BEFORE lanes — window discipline: freeze first)

- **W1 — contract window (small, additive):**
  `publishQueue` repo (enqueue w/ idempotency · listDue · claim · complete ·
  fail · cancel) over the existing table · `videoCuts.remove` (refusals in §3
  call #2) · `platformCapabilitySchema` + per-platform matrix in
  `packages/contracts` (char limits · media constraints · link/hashtag norms).
  Freeze on green, then lanes launch. Nothing else touches packages/db or
  packages/contracts mid-lane.
- **W2 — the audition seam:** one shared `TakeAudition` component (click a tile
  → inline `<video>`/`<audio>` audition via the media door) with its own
  namespaced stylesheet (the SourceThumb precedent, surface-css-scope test
  category). Lane A wires it into the takes strip (editor.tsx), lane B into the
  bed picker (editor-inspector.tsx) — neither edits the other's files.

### Lane A — `editor-verbs` (version management: 4 of the 5 open no-affordance rows)

**Files:** `components/videos/editor.tsx` + its tests · `lib/videos/*` ·
`app/api/videos/**` routes. Owns NO css — uses the sheet's existing classes
(the proposal `.diff-panel`/`.diff-op` grammar is exactly a compare view's).

| # | task | notes |
|---|---|---|
| A1 | **Compare two versions** | pure `compareEdls(a,b)` in lib/videos (beats added/removed/reordered/trimmed · caption text/timing · music source/knobs) + a compare state behind the Cut-history door, drawn in the existing diff-panel grammar. Deterministic — no LLM, no spend. |
| A2 | **Save as a NAMED variant** | the save door already derives version per name (`planCutSave`) — this is UI only: a name field on save; same-name = next version (unchanged default). |
| A3 | **Delete a version / abandoned derived cut** | DELETE route over W1's `videoCuts.remove`. Refusals per founder call #2. Jobs table drives the refusals as well as the verb. |
| A4 | **A render survives leaving the page** | registry gains `listRunning(projectId)` (in-process, no schema) + a GET param; the editor resumes the poll on load and the player states "a render is in flight for vN". |
| A5 | **Audition a candidate take** (the 5th row, takes-strip half) | consume W2 in the takes strip. |
| A6 | editor.tsx-owned s78 tail | player failure state + way out (`onError` → honest notice) · shared `busy` → action-identity (`running: null\|"save"\|"render"\|…`) · every duration through `timecode()`. |

### Lane B — `editor-polish` (the s78 medium/low tail that lives in the inspector/timeline/css)

**Files:** `components/videos/editor-inspector.tsx` · `editor-timeline.tsx` ·
`editor.css` · `dossier.css` (B8 only) · NEW `editor-polish-s82.test.tsx` (the
s80 safety-test precedent; editor.test.tsx stays lane A's).

| # | task | audit finding |
|---|---|---|
| B1 | Remove-easing restores the held values | `medium` R-lens |
| B2 | proposal marks on caption/music lanes get the word + accessible state | `medium` |
| B3 | judge-refusal marks on the timeline plates (`refusedCaptions` set beside `propCaptions`) | `medium` |
| B4 | numfield width scoped to numeric — free-text reason fields get their flex back | `medium` |
| B5 | pan-axis flatten retains endpoints for the return trip | `low` R-lens |
| B6 | copy-mode music block: selectable-not-draggable cursor + "no knobs" tag | `low` ×2 |
| B7 | endcard overlay's freeze fact visible, not a dead tooltip | `low` |
| B8 | player plate ink fixed-register in light mode — **both videos surfaces in one change** (editor.css + dossier.css, the audit's own condition) | `low` |
| B9 | Audition in the BED PICKER (consume W2) | s81 gap |
| B10 | beat-block label mid-token clip + `.prop-tag` clipped to 0px | `high` remnant |

### Lane C — `sched-spine` (the Postiz take, items 1–3)

**Files:** `packages/engine/src/social/**` (validator + queue producer/consumer
core) · `app/api/social/**` routes · `components/approve/**` (Schedule verb +
fit line + preview card) · `components/calendar/**` (scheduled-vs-planned
distinction, C4 only). Contracts/db FROZEN by W1 — a mid-lane schema need =
re-plan, not an edit.

| # | task | notes |
|---|---|---|
| C1 | **capability matrix + `validateForPlatform`** | pure, tested per platform; wired at generation beside `targetTerms` and exported for C2/C4. Deterministic refusals with the reason (the honest-doors grammar). |
| C2 | **queue producer** — Approve's *Schedule* verb | approved post-family draft + platform + slot → `publish_queue` row (W1 repo, idempotency = draft+platform+scheduledAt). Next-free-slot suggestion derived from `planned_slots` grammar. Refuses on C1 validation. Planned-slot (intent) and queue row (commitment) stay distinct facts; the calendar says which is which. |
| C3 | **queue consumer** — publisher-scheduler tick | mirrors the proven sweep-scheduler unit; claims due rows → the EXISTING publish door (refusal ladder untouched — an unarmed platform's rows simply fail closed and say so). **Ships disarmed** (`SOCIAL_QUEUE_ARMED` absent = the tick reports and touches nothing). Zero live calls in the lane, ever. |
| C4 | **Approve platform-true preview card** + calendar scheduled-state | gated on founder call #3 — if the sheet amendment is declined, ships as a keeper-STATE behind existing chrome (the s74 keeper rule) and the sheet stays law. |

**Merge order:** A → B → C by default (A and B re-gate the same surface; C's
gates are Approve/Calendar jobs + be-check on the engine seam). Lead extends the
jobs tables at each merge — new jobs: compare · named save · delete + its
refusals · resume-poll · audition ×2 · schedule verb · fit line.

## 3. Founder calls — ALL FOUR DECIDED s81 ("I'll go with your recommendations on the four calls"), recommendations kept below as the record of what was decided

**Standing result: the three lanes are APPROVED for the s82 launch (call #1 =
the named-lane approval the standing rule requires — no re-ask at boot), the
delete default is ratified, the preview ships as a keeper-state, and the
disarmed posture is confirmed.**

1. **Lane GO** — the three named lanes + W1/W2 pre-flight, per the standing
   fresh-approval rule. **Recommend: launch all three.** The file sets are
   disjoint by construction, the box handles three lanes since the resize, and
   each is independently mergeable. If trimming to two, **defer editor-polish**
   (lowest-risk to postpone — all cosmetic/medium; the other two carry the
   product-moving work).
2. **Delete rule default (A3)** — hard-delete the cut ROW and its rendered
   file; **refuse** deleting (a) an approved cut, (b) a lineage parent of a
   living derived cut, (c) the project's last cut. Rejected-proposal eval rows
   are separate rows and survive. **Recommend: keep this default.** An approved
   cut is a judge receipt — deleting one deletes evidence; a lineage parent
   anchors another cut's provenance; the alternative (an `archived` status) is
   a contracts change for marginal benefit. Softening is one line later if
   dogfood wants it.
3. **Approve preview card (C4)** — sheet amendment or keeper-state?
   **Recommend: keeper-state now, sheet amendment only after dogfood proves the
   card earns permanent chrome.** That is the two-step doctrine's own shape
   (state behind resting chrome first) and it keeps the lane unblocked on a
   canvas round-trip.
4. **Sequence-gate posture for C** — **recommend: confirm as stated.** Consumer
   ships disarmed, queue rows sit pending, arming + per-platform GO + per-post
   GO all stay the founder's. It is the only posture consistent with the
   standing gate; the lane never fires a platform call.

**And the fifth thing he asked about (the integration time-sink): recommend §4
as the s83 headline** — the connector seam + generic connect flow, proven on
Reddit + Bluesky (no review wall on either). s82's queue work neither waits on
it nor conflicts with it.

## 4. THE CONNECTOR SEAM — the recommended s83 headline (B-int.4 pulled forward, Postiz-shaped)

The founder's real complaint — *"it is taking us a lot of manual time to get
each platform wired"* — decomposes into the two code problems §1b names, and
both are ours to fix:

1. **Per-platform code cost.** Our four drivers were each hand-built end to
   end. Re-shape them behind ONE `SocialConnector` contract in
   `packages/contracts` (zod): identifier · scopes · capabilities (merges with
   W1's matrix) · per-platform settings schema · verbs `generateAuthUrl` /
   `exchangeCode` / `refreshToken` / `whoAmI` / `post`. One hardened fetch in
   the engine with typed refusal classification (429-retry · 401→refresh ·
   verbatim platform body on failure — our `errors.ts` already half-does
   this). After the seam, a new platform ≈ one connector file + one settings
   schema + a registry line + an env/vault pair.
2. **The connect flow.** Replace mode-2 token pasting with the generic dance:
   one connect door + ONE dynamic callback route under Settings →
   Integrations, single-use state rows in Postgres with a TTL (we run no
   Redis; a table is the honest equivalent), tokens landing in the EXISTING
   vault — which is already stronger than Postiz's storage. A refresh tick
   rides the proven sweep-scheduler pattern (LinkedIn's 60-day tokens stop
   being a hand-chore).

**Proof platforms: Reddit + Bluesky, deliberately.** Both have instant
developer-app creation and **no posting-scope review wall** (Bluesky is an app
password — no OAuth at all), so the seam can be proven end to end with two NEW
platforms in one session, through the existing publish door and the s82 queue,
without waiting on any partner filing. The Meta/LinkedIn/TikTok review wall
(s70 Nango verdict) is untouched by any of this and stays on the B-int.4 /
THE-LANDING track.

**Sequencing recommendation: s83, not s82.** The seam re-shapes the driver
layer that sched-spine's consumer calls through; doing both in one session
puts two lanes in the same engine files. s82 proves the queue on today's
drivers; s83 re-shapes the drivers behind the seam and adds Reddit + Bluesky
as its proof. If the founder wants it sooner, it REPLACES sched-spine's C4
rather than joining it.

**⚖ The discipline, stated once:** Postiz's interfaces, flows and folder
shapes were studied as facts — protocol sequences and API shapes, which is
what "reference-only patterns" contemplates. Every line we build is written
fresh against Thalon's own contracts (zod, drizzle, the vault, the judge);
no Postiz text enters this repo, which keeps AGPL obligations out and — since
our tenancy/vault/judge differ structurally — is also just the correct
engineering.

## 5. Out of scope, stated so it is a decision

- `publication_metrics` window + analytics view (Phase 2; trigger: live cadence).
- Evergreen re-queue · RSS ingest · public API/webhooks/MCP (Phase 2+/3).
- Any provider beyond the four drivers; any platform app-review chase (B-int).
- Any publish exercised anywhere (⛔ sequence gate verbatim).
- The editor's remaining `undriven` job (needs a pending proposal = metered).
- X spend (gated on learning readiness, founder rule s71).
