# B-dist — THE DISTRIBUTION SUITE CHARTER (the "Postiz charter")

> Founder-directed, s81: *"don't limit your Postiz plan to just what I suggest …
> if Postiz has it and does it better, then take it! … this is big work so don't
> limit it to just connector work … this means we need a workspace redesign
> phase 4/5 … make a complete Postiz plan."* This is that plan: the full
> capability comparison and the phased charter. **Status: DRAFTED, awaiting
> ratification** (charter rule: no feature code before the approved charter —
> the s82 lanes are separately approved and are not gated on this).
>
> ⚖ Reference repo is AGPL-3.0. Standing discipline (also in
> `s82-PREPLAN.md` §4): interfaces, flows and folder shapes studied as facts;
> every line built here is written fresh against Thalon's own contracts. No
> Postiz text ever enters this repo.

## 0. The thesis

Thalon and Postiz are complementary halves. **Postiz is a distribution suite
with no brain:** nothing generates grounded content, nothing gates it, nothing
learns. **Thalon is a brain whose distribution suite is half-built:** the
fan-out → judge → approve loop is the moat, but what happens *after* approve —
scheduling, per-platform fit, publishing at scale, measuring, feeding results
back — is where Postiz is years ahead in maturity. The charter closes that gap
by taking their patterns onto our spine, and goes past them wherever our brain
gives us a move they cannot make (the "flying cars" in §3).

## 1. The full capability matrix — Thalon vs Postiz, verdict by verdict

Verdicts: **TAKE** (adopt the pattern) · **TAKE+** (adopt and go further —
a flying car) · **HAVE** (ours is equal/better; no work) · **REJECT** (stated
reason) · **LATER** (real, parked with a trigger).

| capability | Postiz | Thalon today | verdict |
|---|---|---|---|
| Content generation | AI compose, ungated | fan-out + grounding + judge + eval loop + targetTerms | **HAVE** — the moat |
| Trend/market intel | none | Intel: sweeps, admissions, exemplars, trends read | **HAVE** — they have nothing here |
| Own-post analytics | per-channel + per-post metrics (impressions/likes/shares/reach/engagement, % change), unified dashboard; `analytics()`/`postAnalytics()` verbs per provider | **NONE** — `social_publications` records the post id and stops | **TAKE+** → D2. NOTE: this is NOT Intel. Intel = what works for the market; analytics = what works for US. The flying car is the merge (§3.1) |
| Platform integrations | 36 providers, one interface, generic OAuth dance | 4 hand-built drivers, mode-2 token pasting | **TAKE** → D1 (connector seam, `s82-PREPLAN.md` §4) |
| Scheduling: queue/slots/timed publish | calendar + queue + per-channel posting times + timezone | planned_slots (intent only) + a dormant publish_queue table | **TAKE** → D0 (the s82 sched-spine lane, already approved) |
| Per-platform composer: variants, settings tabs, previews | 28 settings DTOs; per-channel preview before scheduling; per-platform editors (normal/markdown/html) | drafts are per-platform but Create/Approve render raw body; no settings schemas; no preview | **TAKE** → D3 (schemas) + D4 (the surfaces) |
| Per-platform validity rules | `maxLength()` + `checkValidity()` per provider (media counts, thumbnail rules, dimensions) | none — an over-long body reaches the platform call | **TAKE** → D0/C1 (capability matrix, s82) |
| Mention autocomplete | per-provider `mention()` lookup + server-side cache | none | **TAKE** → D3 (a connector verb; cheap once D1 lands) |
| Evergreen recycling | any post repeats on a schedule | none | **TAKE+** → D3 — judge-gated evergreen (§3.2), not blind repeats |
| RSS auto-posting | autopost workflows: feed → draft → channels | none (we publish an RSS feed OUT; we ingest none) | **TAKE** → D3 — feed → **fan-out input** (enters at generation, so the judge gates it; theirs skips straight to the queue) |
| Recovery workflows | `missing.post` workflow finds dropped scheduled posts | n/a yet | **TAKE** → D0 folds it into the queue consumer from day one |
| Token refresh automation | typed 401 → refresh workflow; refreshCron flags | manual (LinkedIn's 60-day tokens are a hand-chore) | **TAKE** → D1 (refresh tick on the sweep scheduler) |
| Short links + click data | dub/kutt/short.io behind an interface with an `empty` default | none | **LATER** → D3 seam-with-empty-default only; a real shortener needs a domain = a stealth call (founder) |
| Media library + design tool | uploads, R2, Canva-like editor, AI image gen | object store + content-addressed media + B-media plan; the video EDITOR (far beyond theirs); Higgsfield minting | **HAVE** (different shape, not behind) — B-media continues on its own track |
| Video generation | veo3/heygen/reelfarm wrappers | the whole B-vid pipeline: takes, EDL, judge-gated renders, local ffmpeg | **HAVE** — ours is a different class |
| Own-site destination | WordPress/Medium/Hashnode/Dev.to providers | /blog end-to-end (generate→judge→approve→publish, live s67) | **HAVE**; more CMS targets ride D1's seam if ever wanted |
| Agent layer / MCP | Mastra agent + MCP server whose tools are the product's own doors (schedule, list channels, generate media) | none exposed | **LATER** → D5 — Thalon-MCP: the doors exist; exposing them is small. Trigger: external users or founder's own workflow want |
| Public API + SDK + webhooks + n8n/Make | full public REST + typed SDK + webhooks | none | **LATER** → D5. Trigger: external users |
| Teams, roles, multi-brand groups | orgs, roles, customer groups | multi-tenant from table one; single-operator by design | **HAVE** (structurally); operator roles = LATER (customers) |
| Sets (channel presets) + signatures (reusable footers) | yes | brand profiles cover the spirit | **LATER**, folded into profiles if wanted (D3 candidate, low) |
| Marketplace (creator buy/sell) | yes | — | **REJECT** — not our model |
| Browser-extension cookie posting | posts via the user's own browser cookies for API-less platforms | — | **REJECT** — ToS exposure; official APIs only (standing rule) |
| Billing/Stripe | yes | entitlements seam (config-data, founder-only tier) | **HAVE** for now — billing rides the entitlements seam when customers exist |
| Temporal | their engine | sweep-scheduler pattern ($0, proven) | **REJECT** the dependency; **TAKE** two disciplines: versioned workflow evolution + failure-payload caps |

## 2. The phases

**D0 — the queue spine (s82 — ALREADY APPROVED, runs under its own plan).**
`s82-PREPLAN.md`: capability matrix + validator · Schedule verb → publish_queue
producer · consumer tick (disarmed) · platform-true preview keeper-state.
D0 is deliberately charter-independent: it was approved on its own and ships
regardless of ratification.

**D1 — the connector seam (s83 recommendation).** `s82-PREPLAN.md` §4 in full:
one `SocialConnector` contract · generic connect door + one dynamic callback
route · state rows in Postgres · tokens in the existing vault · hardened fetch
with typed refusal classification · refresh tick. **Proof: Reddit + Bluesky
live in the same session** (instant developer apps, no review wall). The four
existing drivers re-shape behind the seam; X's OAuth-1.0a is its own connector
flavor.

**D2 — own-post analytics, closed-loop (the founder's named ask).**
- Contract window: `publication_metrics` (publication id + platform + metric
  label + value + captured_at; append-only time series) + a `postAnalytics`
  verb on the connector contract.
- An analytics tick on the sweep scheduler: for each social_publication, pull
  per-post metrics via the connector (each platform exposes what it exposes —
  say so per platform rather than papering over gaps).
- The **Analytics surface** (new sheet — see D4): per-channel and per-post
  views, honest about platform API limits.
- **The flying car (§3.1): metrics feed the LEARNING loop, not just charts.**
- Dependency: D1 (the verb rides the seam). Value scales with live posting
  volume — see the sequencing note in §5.

**D3 — composer + scheduling parity.** Per-platform settings schemas in
contracts (zod; from D0's matrix + D1's connectors) wired into Create/Approve ·
mention autocomplete (connector verb + cache table if needed) · judge-gated
evergreen re-queue (§3.2) · RSS-in as a fan-out INPUT (§3.3) · short-link seam
with empty default (real provider = founder stealth call) · sets/signatures
folded into brand profiles only if dogfood asks.

**D4 — WORKSPACE REDESIGN PHASE 4/5 (the founder's naming).** The distribution
suite needs surfaces the 16-sheet era never drew. Process = the era's own
doctrine, unchanged: **claude-design mock sheets FIRST → founder verdict →
exact-mock build**, two-step, screenshot-vs-sheet gated. New/updated sheets:
1. **Analytics** — new sheet (per-channel + per-post + the learning tie-in).
2. **Calendar → Schedule** — the queue made visible: planned (intent) vs
   queued (commitment) vs published (fact), per-platform chips, next-slot
   affordance.
3. **Create/Approve composer band** — per-platform settings tabs + the
   platform-true preview graduating from keeper-state to drawn chrome (the
   s82 keeper-state is the dogfood that earns this sheet change).
4. **Integrations → Channels** — connect-flow states for the D1 dance
   (authorize-redirect-connected), health + token-expiry + refresh states.
Sheets can be mocked any time after ratification (design work, founder-verdicted
per the frontend doctrine); builds follow their phase's engine work.

**D5 — the outward layer (parked, triggers stated).** Thalon-MCP server +
public API + webhooks + SDK. The doors all exist; this is exposure, not
construction. Triggers: external users, or the founder wanting Thalon in his
own agent workflows. Stealth-gated besides.

**D6 — explicitly rejected, so nobody re-litigates silently:** marketplace ·
cookie-extension posting · Temporal · teams/billing before customers.

## 3. The flying cars — where we go PAST Postiz, because the brain exists

1. **The closed loop (D2).** Postiz shows charts and stops. Thalon's analytics
   land as *learning signal*: per-post performance joins the eval/exemplar
   machinery (B-learn) so generation shifts toward what OUR audience rewards —
   Intel says what the market rewards, analytics says what rewards US, the
   merge steers the fan-out. Nobody else in this category closes that loop.
2. **Judge-gated evergreen (D3).** Their evergreen re-posts blind. Ours
   re-queues a keeper only after it re-passes the judge (denylist/grounding
   drift since first publish) plus a freshness check — recycling that cannot
   rot.
3. **RSS as brain-input (D3).** Their RSS skips straight to the queue. Ours
   enters at generation: a feed item is grounding material for the fan-out, so
   everything published off it is gated + attributed like all our content.
4. **Analytics-derived slotting (D2+D3).** Their posting times are user
   folklore. Once publication_metrics exists, next-slot suggestions come from
   OUR measured engagement-by-hour per platform. Data over folklore.

## 4. Dependency spine

D0 (s82, approved) → D1 (seam; s83 rec) → D2 (metrics window + tick + surface)
→ D3 (parity items, each small once D1's contracts exist) · D4 sheets start
after ratification and interleave (mock → verdict → build beside each phase) ·
D5 parked on triggers. Contract windows freeze per phase before that phase's
lanes: D1 (connector contract + state table) · D2 (publication_metrics +
postAnalytics verb) · D3 (settings schemas; mention cache if needed).

## 5. Founder calls this charter raises (ratification bundle)

1. **Ratify the charter** (or amend phases/order). ADR follows ratification —
   the ADR-0011 precedent.
2. **D4 design wave GO** — mock the four sheets on the canvas (claude-design)
   for verdict, starting after s82 wraps? (Design is founder-verdicted per the
   frontend doctrine; mocks cost no engine time and can run beside D1.)
3. **Sequencing note, honestly stated:** D2's value is proportional to live
   posting volume, and posting volume is gated on YOUR sequence gate +
   per-platform GOs. Recommended order stands (D1 → D2) because the seam and
   the window are prerequisites either way — but the analytics dashboards will
   be thin until posting is routine. Say if that reorders anything for you.
4. **Short-link domain** (D3): a real shortener needs a domain we own =
   stealth surface. Defaulting to seam-with-empty-provider until you call it.

## 6. Out of scope for this charter

Everything B-vid/B-media/B-sitegen/B-crm owns stays on its own track; this
charter is the distribution suite only. The sequence gate (*"we're not posting
anything yet…"*) binds every phase: nothing here arms, posts, or spends
without the founder's standing per-platform + per-post GOs.
