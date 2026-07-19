# Arming plan — "Sprint 8: Arm It Live" (research + bucket shapes)

> **Status: live** — the plan-of-record for the founder's s62 re-focus ask
> ("eventually we get back to working on thalon fully"). Written s62 so it
> waits ready behind wave 4; it becomes buckets at the re-charter, and
> nothing here is scaffolded until chartered (AGENTS.md rule 1). Every
> "exists" claim below was verified against the code the day this was
> written.

## The gap, in one sentence

The engine's architecture is finished and judge-gated end-to-end; what
separates the workspace from the real product is **arming** — live drivers
behind seams that already exist, keys the founder holds, and doors that were
deliberately built disarmed.

## ① Live trend intel — MOSTLY BUILT, needs keys + a scheduler

**Exists (verified):** `packages/engine/src/trend/` carries a real
**YouTube Data API v3 driver** (`youtube-source.ts` — official API, keyed,
quota-aware: search.list treated as the expensive ~100-unit call, batch
videos.list for stats, `maxSearchesPerSweep` config that fails LOUD rather
than silently truncating) and a **Bluesky/AT-Protocol driver** (app-password
auth), both behind the `TrendSource` seam with a registry +
`TREND_SOURCE` env flag (default `fake`). The sweep runner persists
wire-ready bundles; the ranker, watchlists, area expansion, outlier math and
the Intel surface all already consume them. The new `thumbnailUrl`
passthrough (s62) means live cards get visual identity the moment a driver
supplies it.

**Missing:** (a) a **sweep scheduler** — today sweeps run on the operator's
"Sweep now"; the honest stamp says "no next sweep until live pollers arm."
A cron/timer per tenant (cadence already in the stamp contract, default 4h)
is the one new piece of plumbing. (b) **Dossier generation arming** —
`TREND_DOSSIER_CARDS` defaults 0; ready titles/angles per card are gateway
LLM spend.

**Arming path:** founder supplies `YOUTUBE_API_KEY` (free tier: 10k
units/day; one sweep at default knobs ≈ 100–200 units — comfortably dozens
of sweeps/day) and/or `BLUESKY_IDENTIFIER`+`BLUESKY_APP_PASSWORD` (free);
set `TREND_SOURCE`; schedule the sweep; later `TREND_DOSSIER_CARDS=3` once
the **gateway top-up** lands. Judge/compliance unchanged — intel never
bypasses the gate because it only feeds Create.

**Bucket shape:** `B-arm.1 sweep scheduler` (small: timer + per-tenant
cadence config + events + honest failure surfacing in Runs) ·
`B-arm.2 live-driver soak` (dogfood: run the founder's real watchlist a
week, eval rows from dismiss/promote verdicts — the loop that already
exists starts learning from real data).

## ② Social publishing (B3.1) — THE REAL BUILD of the sprint

**Exists (verified):** `publish_queue` table (tenant-scoped, platform +
scheduled index) · the approve→publish door in the workspace (honest
"unarmed" states everywhere) · **own-site page publishing is fully built**
(`packages/engine/src/webpage/publish.ts` → deploy target → `/blog`, the
one armed publish path) · the **two-key arming pattern** proven by the
outreach door (`RESEND_API_KEY` + `OUTREACH_SEND_ARMED`, refusing transport
that names its missing arms — `outreach/transport.ts`).

**Missing:** the social publisher seam itself — there is no
`SocialPublisher` interface or per-platform driver yet. This is the one
genuinely new subsystem: seam + drivers (official APIs only, ADR 0002) +
queue consumer + per-platform two-key arming + a typed refusal ladder
(unapproved draft, unarmed platform, cadence violation, dead credential),
mirroring the outreach door's shape.

**Order of platforms (founder's test accounts stand ready):** LinkedIn
(company/member posts API — most B2B-relevant, sanest API) → X (v2 create
post) → Facebook/Instagram (Graph API, most credential ceremony) → TikTok
last (content posting API is the most gated). Each platform = its own
arming pair, so one dead credential never blocks another.

**Bucket shape:** `B-pub.1 seam + queue consumer + refusal ladder (no
drivers)` · `B-pub.2 LinkedIn driver + founder-account dogfood post` ·
`B-pub.3 X driver` · `B-pub.4+ Meta/TikTok as wanted`. Every bucket ships
with eval rows; live posting stays behind per-platform founder GO — the
same stealth question as live send applies (posting reveals the brand).

## ③ One-prompt video + pillar #1 — WIRE, don't build

**Exists (verified):** the full staged flow (storyboard → direction docs →
takes → EDL → cuts, B-video-editor .1–.6), the render seam (Hyperframes
default / Remotion swap), the judge lane, and Create's one-prompt door as an
honest planned state ("one-prompt video generation wires into the engine
next (the judge lane already exists)" — `create-surface.tsx`).

**Missing:** the auto-run: one prompt → generated direction doc → staged
pipeline executes without the operator hand-driving each stage → judged →
approve queue. The film proved every stage by hand; this bucket makes the
hands part of the engine.

**Pillar #1 is the dogfood gate:** the first real output should be a
THALON video through Thalon's own pipeline (content-origination goal —
prompt + URL in, video + caption/SRT out). Ship criterion: the founder
approves a pillar the engine made end-to-end.

**Bucket shape:** `B-vid.7 one-prompt auto-run` · `B-vid.8 pillar #1
dogfood + eval rows`. Render/mint spend is the real cost driver — reuse the
film's per-beat seat logic and get_cost preflights.

## ④ Live send — ALREADY BUILT, founder calls only

Door built + merged, deliberately disarmed. Needs: the founder's GO, the
s28 stealth pick (brand domain vs neutral vs wait), and Resend domain
setup. Zero engineering.

## B-sitegen — the landing pad (link, don't copy)

The full design of record lives in `docs/research/sites-surface-plan.md` §6
(input side: prompt | URL-DNA | template pick + metadata block + capture
autopopulate) + the founder's pre-plan-as-a-product-stage directive
(s61/s62). The wave-4 PREPLAN.md artifacts are its training exemplars.
Charter candidate alongside the arming buckets — it is the "use for the web
design" the founder named, and it rides the same Create seam ①–③ feed.

## Dependencies the plan waits on

| dependency | blocks | holder |
|---|---|---|
| Gateway top-up | dossier generation · draft models at scale | founder (credit call) |
| GitHub monthly renewal | CI matrix · staging/templates image builds | calendar |
| `YOUTUBE_API_KEY` / Bluesky app password | ① live drivers | founder (free tiers) |
| Platform app credentials per network | ② drivers | founder + platform review queues (LinkedIn/Meta app review has lead time — **start applications early, before the sprint**) |
| Stealth calls (posting + sending reveal the brand) | ②'s live GO · ④ | founder |
| Resend domain | ④ | founder |
| **Hosted Terms + Privacy pages** | ALL platform audits (TikTok now · LinkedIn Community Mgmt · Meta App Review) — they verify the URLs resolve | ties to the landing/public-site work; a shared launch gate, not per-platform |

## Proposed sequencing (for the re-charter, not self-executing)

Wave 4 + the Thalon landing close the visual arc → **Sprint 8 charter**:
`B-arm.1/.2` (fastest real-data win, near-zero cost) → `B-pub.1/.2`
(the new subsystem, LinkedIn first) → `B-vid.7/.8` (pillar #1 = the
sprint's demo) → B-sitegen in parallel as its own lane if granted — with ④
armable any day the founder calls it. Platform app-review applications
should be filed during wave 4 so credentials exist when B-pub opens.

*Written s62 on the founder's re-focus directive; owner: lead; supersedes
nothing — CHARTER.md still governs; this file becomes bucket text at the
re-charter and then flips historical.*
