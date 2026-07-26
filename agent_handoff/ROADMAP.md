# ROADMAP — Thalon forward plan (the "gogogo" work list)

> **This is the plan of record.** `gogogo` (a fresh session with no other prompt)
> boots via `agent_handoff/CURRENT.md`, which points here. **Work down the
> Recommended sequence below, top to bottom.** Items marked **[lead-serial]** need
> no founder input — start them immediately. Items marked **[founder GO]** need his
> word: present them at the opener and proceed on his reply, but **never block** —
> always have a [lead-serial] item in flight.
>
> **One home.** This file owns "what to do next + the full open backlog." `CURRENT.md`
> owns the boot pointer + last session's delta. `NEEDS-STEVEN.md` owns open founder
> actions. `COORDINATION.md` owns live lane state + the append-only history. Update
> this file at every wrap: move shipped items to "Recently shipped", re-rank the rest.

---

## Recommended sequence — next session

Ordered by what I'd actually do. Phase 1 is buildable with zero founder input, so
`gogogo` always has productive work; Phases 2–3 are his GOs, surfaced at the opener.

### Phase 0 — ✅ EXECUTED s69 (2 of 3 LIVE; the X tail is platform-side)
**THE ENGINE'S FIRST LIVE SOCIAL POSTS (2026-07-25): LinkedIn
`urn:li:share:7486713895370256384` (image + @Anthropic org mention, posted as
the founder) · Facebook `197903966922661_122232823196050754` (image attached).
X refused PLATFORM-SIDE: HTTP 402 "credits depleted" on the dev app — a founder
console action (add/renew the X API credit allocation); the draft `a40e9c48`
stays approved + armed + image-attached, ONE publish call posts it when credits
exist. Then do the display-name check (first tweet's `source` field must read
neutral).** Lap details: tuning close (s69 commit `a5fdca3`) — g3-016 red-pin
LIFTED (3/3 + 4-sweeps green; s68 noise, final v2 unchanged) · two REAL screen
finds fixed in v4 (mechanism-vs-paraphrase collision g3-008 · topics-as-support
g3-006) · majority-retry runner (2-of-3, logged) → **32/32** · `491089d0`
unblocked by GROUNDING DEDUP not prompt churn (root cause of the s68 12-lap
record: the re-brief APPENDED a near-duplicate brief source; two ~same
instruction docs destabilize the final tier — ratchet candidate below) ·
LinkedIn pin was DEAD on first real use (202512 nonexistent; active set swept
live, pinned 202607, `isReshareDisabledByViewer` removed; commit `2b258f3`) ·
main-RED #4 fixed (`1420bc8`, oauth1 typecheck).

### Phase 1 — ✅ B-int.2 SHIPPED s70 (the Integrations surface, direct-to-main)
**Settings → Integrations is LIVE** — a card per destination grouped by what it
powers (Social · Your website · Outreach & newsletter · Intel), every card in a
frozen honest state; mode-2 guided connect flows (generic step lists + schema-derived
paste fields + validate-on-connect); on-demand Validate / Disconnect; **the s69
versioned-probe spec line landed in the engine seam** (LinkedIn validate now ALSO
fires the 426-vs-400 malformed-body pin proof — a dead LinkedIn-Version reads loud
in the probe detail, card untouched); **the PUBLISHED VIEW closes FEATURE-MAP's
`/blog` partial** (social ledger ⋈ web posts bundle, newest-first, way-back links
on every row — verified live showing all three s69 posts + the s67 article);
**env-override honesty badge** (X's env 1.0a posture reads "env override" instead
of lying "not connected" plain); probe-discovered identity now lands on the card
(validate stamps connectedAs). New doors: GET/POST `/api/integrations[...]`,
engine `cards.ts` + `published.ts`, repo `listRecent`. B-int.3 moves arming onto
tenant data next.

### Phase 1-next — B-int.3: driver rewire **[lane; founder lane-approval at the opener]**
Publisher/intel/outreach seams resolve credentials vault-first by tenant (the
production caller already does for social); per-platform arming becomes tenant DATA
(connected + tenant-armed) instead of env; refusal ladder keeps its shape. Meanwhile
the standing [lead-serial] alternative: **B-pub.4 blog images** (backlog below).

### Phase 2 — PILLAR #1: minted s70b, **VERDICTED s70c — kept as a MID-QUALITY EXEMPLAR, not the pillar**
The founder's verdict on `one-prompt-v1.mp4` (42.3s, 114cr): "really bad and
doesnt show the true capability of thalon" — **KEEP the video as an example
of the bad/mid quality class** (learning material for the quality ladder,
never approved, never published). **PILLAR #1 IS RE-SCOPED: a SCREEN
RECORDING of the live workspace actually working — sequenced AFTER the UI
overhaul ships** (Phase 2b below gates it). The engine mechanics all proved
out (mint doors, code-drawn text, setMediaRoot ratchet `53456b8`, real render
door); what failed was the abstract-motion-graphic CONCEPT as flagship
material. Craft lessons stay banked (prov.json + memory).

### Phase 2c — SOCIAL DISCOVERABILITY (SEO/AEO/GEO) — **CORE SHIPPED s70c (`ec07443`); generation side = s71 [lead-serial]**
**The lens is LIVE:** deterministic `discoverability` advisory gate beside the
judge (primary-entity-in-PROSE · term coverage floor · per-platform subject
hashtags), opt-in by `meta.targetTerms`, and **the founder's golden pair runs
in the suite** (engine body = fail, founder edit = pass — his catch is an
executable test). Remaining s71+: generation DECLARES targetTerms (intel
keywords + brand topics + subject entities into the fan-out prompt + meta)
and the blog-mirror pairing below. Original charter follows:
The founder's catch on the live LinkedIn post: a post ABOUT AI never says
"AI" (zero occurrences — it says Claude/models/Anthropic and no answer
engine would index it for the queries that matter), and it explains the
mechanics of model-agnostic building without its PURPOSE. Root cause,
confirmed honest: **the social path has NO discoverability dimension** —
generation receives no keyword/entity targets and no gate checks coverage
(screen = denylist, final = grounding; B6.8's seo meta is web_page-only).
The fix shape: (a) generation-side TARGET TERMS on the brief (intel
keywords + brand topics + the subject's canonical entities — "AI" when the
post is about AI), (b) a DETERMINISTIC discoverability gate beside the
judge (entity/keyword coverage + AEO answerability shape; the charLimit-
gate pattern — beside the judge, never inside it), (c) ✅ the founder's
LinkedIn edit LANDED s70c: ingested as a voice_sample exemplar (`362d2fdb`)
and seeded as the golden pair `eval/golden/discoverability-seed.jsonl`
(disc-001 engine-body=fail · disc-002 founder-edit=pass; no runner consumes
it yet — this gate wires it first), (d) **the BLOG-MIRROR doctrine (founder
s70c): a social post mirrors the article you'd put on the blog, and the
blog's whole purpose is the SEO/AEO/GEO farm** — the meme post bypassed
that (social-direct, no article twin); the fan-out shape should pair
social posts with their article and share the discoverability treatment,
(e) fact found s70c: `proprietary/judge/src/seo-lens.ts` ALREADY exists
(B6.8) but is advisory-only, web_page-gated, and checks meta hygiene — the
new gate covers BODY keyword/entity coverage for social formats and can
graduate from advisory where the founder wants teeth. Structural lesson
from his edit note: leave room for cross-vendor breadth (he wanted an
OpenAI release named but "your structure made it hard to fit").
Companion to the platform-charLimit ratchet candidate below.

### Phase 2b — WORKSPACE UI/UX OVERHAUL **[founder-directed s70b — phase 0 lane RUNNING]**
The founder's verdict: current look/flow "not working" — benchmark =
Supabase/Vercel-class; evaluate **Meta Astryx** (150+ components, theming,
CLI + MCP server, StyleX under) as the shadcn replacement. Phase 0 (lane
`ui-p0`, report-only) delivers `docs/research/ui-overhaul-plan.md`: Astryx
license/stack-fit verdict + benchmark teardown + surface-by-surface audit +
wave map. **The founder re-charters on that plan before any rebuild wave.**
**s70c input:** the founder found the site ↔ workspace seam MISSING ("zero ui
interface connection between the landing page and the workspace") — a quiet
header "Workspace" link shipped same-turn as the interim fix; the overhaul's
wayfinding work owns the real answer (auth-aware entry, both directions).
**s70c CHARTER COMPLETE — all 7 §4.6 answers on record:** dark default ·
theme from scratch · keep Geist · semantic status colours (amber = needs-you
only) · beta accepted · videos inside wave 2 · small mono allowlist kept.
**Wave 0 = NEXT SESSION, and it OPENS WITH A CLAUDE-DESIGN MOCK** (founder
standing rule: every redesign wave shows him a mock for verdict BEFORE any
build; design authoring on Fable 5 per the s51 rule). Plan of record:
`docs/research/ui-overhaul-plan.md` (merged).

### Phase 3 — ✅ EXECUTED s69/s69b (all three live; kept for the record)
s68 (second half) built B-pub.3 end-to-end: **image legs on all three text drivers**
(LinkedIn Images API · X v2 media upload · FB Page /photos), X OAuth 1.0a
standing-arm mode (OAuth2 X user tokens die in ~2h), and the pre-surface connect
CLI (`scripts/connect-destination.ts`). Credential state: **linkedin + facebook
LIVE IN THE VAULT** (first real vault credentials; both validate-pings green) ·
X 1.0a seats in env (signed probe live) · master key set · tenant social blocks
already carry all three (1/day). The meme image is built
(`.context/social/horse-meme-2026-07-25.png`, 6cr) + caption draft beside it.
**Remaining = founder only:** caption/image sign-off → the GO word → lead sets the
three ARMED flags, runs the post through draft→judge→approve, engine posts to all
three at once. Before the real post: re-verify version pins + the Little-Format
escaping call (standing checklist). Post #2 = the queued Thalon intro.

### Phase 4 — (spec, ✅ absorbed into the shipped Phase 1 above) B-int.2 detail
Settings → Integrations, now that the vault core exists:
- A card per destination grouped by what it powers (Intel · Social · **Your website** ·
  Outreach/Newsletter), honest states (not-connected / connected-as-@handle /
  needs-reauth / expiring / plan-gated / review-pending — the frozen card-state vocab).
- Guided-manual (mode 2) connect flows: step list + paste fields + validate ping,
  authored generic/platform-neutral (nothing copied from gitignored notes).
- The **published-view** joining the social ledger + web deployRefs — this closes
  FEATURE-MAP's `/blog` "partial" (no workspace path to what got published).

---

## Full open backlog (everything that needs doing)

Grouped by stream. Each item: **[owner/gate]**. Nothing here is lost between sessions.

### s76 FOUNDER POLISH PASS — ✅ 1–4 SHIPPED s76 (`61e3434`, `c945faa`); 5 BLOCKED ON THE FOUNDER

**Status:** items 1–4 are on main behind a green full verify (2102 tests).
Item 5 is the only one outstanding and it is NOT a build task — **there is no
logo in this repo to put back** (no file, none ever deleted; the rail's mark
has always been a CSS gradient square). The question is in NEEDS-STEVEN.
Three things learned doing the work, kept here because each cost a render:
`flex: 1 1 0` (not `flex: 1`) is what stops a bounded row region from driving
its card's height · the calendar's `placeColumn` is WRONG in a single narrow
strip (21 collisions became 21 ten-pixel slivers) — collapse to "+N" instead
· a 24-hour axis must auto-scroll to now or a populated day reads as empty.
Still queued from the same pass: the orphaned `HeatGrade` and
`workspace/bulk-bar.tsx` deletions (three more pins to zero).

Original directives follow.

Founder, s76, live, with an explicit timing instruction: *"do it when the
rest of the lanes have completed as to not compete for CPU"*. All five are
lead work (no lane), and (1) is inside `leadboard-wire`'s file set so it
could not start earlier regardless. Verbatim source: *"the Leads metrics
could use the same treatment as the intel in terms of simplification. the
vertical length of the Needs me in the dashbard should match the week
calendar vertical length. changing from week to day in calendar dashboard
shouldnt change it's vertical length but remain, as changing from week to
day should show the current day with the time along the y-axis, and red line
across, same as the main calendar. clicking on the thalon logo should take us
to the landing page, not the dashboard. we should put the logo back in soon,
since the redesign is near completion on all fronts."*

1. **Leads metrics — simplify the way Intel was.** The precedent is s74's
   Intel rebuild, which folded its capture doors and demo/cadence honesty
   into the sheet's OWN stamp band instead of adding extra bands. Apply that
   grammar to the Leads metrics. Files: `components/leads/**` — **must wait
   for `leadboard-wire` to merge.**
2. **Dashboard: `NeedsYouCard` height must match `WeekCard` height.** Files:
   `components/dashboard/needs-you-card.tsx` + `week-card.tsx`.
3. **Dashboard week↔day toggle must not change the card's vertical length**,
   and the day view must render the current day with **time down the y-axis
   and the red now-line across**, same as the main calendar. **This is reuse,
   not a rebuild:** `calendar-surface.tsx` already has `NowLine` (its own
   component), plus `gutterHours(win)` and `yOf(hour, win)` for the axis —
   lift the shared pieces rather than drawing a second time grammar. Note the
   dashboard card's toggle is `"today" | "week"` (week-card.tsx), so "day" =
   its Today view; the main calendar's own densities are week/month/agenda
   and have no day density to copy wholesale.
4. **Thalon logo → the landing page, not the dashboard.**
   `components/workspace/workspace-rail.tsx:44` currently reads
   `<Link href="/app" aria-label="Workspace home">`. **GOTCHA, caught before
   implementing:** `next.config.ts` redirects `/` → `/app` in DEVELOPMENT
   ONLY (founder direction s50), with `/?landing` as the documented escape
   hatch — so a bare `href="/"` bounces straight back to the dashboard on the
   dev box and looks broken to the person testing it. Production is
   unaffected. Recommended: compute the target once —
   `process.env.NODE_ENV === "development" ? "/?landing" : "/"` — so it is
   correct in both. Also re-point the `aria-label`, which currently says
   "Workspace home" and would become a lie.
5. **Put the real logo back in** ("the redesign is near completion on all
   fronts"). The rail renders `<span className="rail-mark" />`, a pure CSS
   gradient square (`workspace.css:81`, `--brand-hi`/`--brand-lo`) — a
   placeholder, not the mark. Restoring the real asset must respect the
   standing token rule: `--color-brand-hi/lo` are MARK-ONLY, never status and
   never interactive.

**Also queued in the same pass (lead-found, not founder-directed):** the
`leadboard-wire` lane left `components/intel/heat-grade.tsx` (HeatGrade, not
`heatBand`) and `components/workspace/bulk-bar.tsx` imported by NOTHING after
it deleted the legacy board. It correctly declined to touch files outside its
set. Deleting both burns three more ratchet pins to zero — verify the orphan
claim independently first, the way that lane did.

### Content origination (the loops)
- Pillar #1 mint + render — **[founder GO]** — Phase 2 above.
- Post loop live per platform — **✅ LIVE s69 on LinkedIn + Facebook (the meme
  post, engine-authored end-to-end); X = platform credits (NEEDS-STEVEN). Post
  #2 = the queued Thalon intro [founder GO per post, unchanged].**
- **B-pub.4 blog images** — **[lead-serial, founder-directed s68]** — the own-site
  door learns to serve object-store images publicly (route + page references), so
  blog posts carry the same visuals as social. The founder's destination framing:
  4 post/image surfaces (LinkedIn · X · Facebook · blog), Threads additive when
  its Meta product activates. The public image URLs this produces are ALSO the
  unlock for Threads + Instagram media later (both require image_url, not bytes).
  Posts and the blog stay UNLINKED (no cross-references; stealth trace-path
  confirmed clean s68 — the only post↔post/post↔blog connection is the internal
  ledger). One check pre-first-tweet: the X app's display name (tweet `source`
  metadata) must read neutral.
- Public `/blog` unwire → wire — **[parked: the launch call]** — stays staging-side until
  the founder says go public (stealth: thalon.org unwired, CT-log risk).
- **B-media — OPERATOR MEDIA IMPORT (bring-your-own) [CHARTER CANDIDATE,
  founder-directed s72: "the option for us to bring/import our own video,
  images, music etc to be edited/used, not just created by ai thalon"]** —
  the upload door: workspace upload/URL → object store (the s72 S3 driver is
  the durability home) → a `media`-kind source row with sha256 dedupe and
  `meta.origin="operator-import"` provenance; ffprobe measurement (the
  THALON_FFPROBE seam), thumbnail derivation, and a rights note field
  (operator's assertion, honest provenance — not legal theater). Imported
  media joins the SAME pool the editor/EDL and clip derivation read from —
  an imported master is a first-class version-rail root (mocked: "Founder
  cut — conference talk" card), an imported music bed is a first-class EDL
  music cue. Publish gates apply unchanged. UI = wave-2 videos sheets
  (overview import strip · dossier "Media used" door · editor media pool);
  engine door = this bucket, built only when chartered.

- **B-media.0 — SOURCE MEDIA ON EVERY SURFACE (thumbnails) — ✅ PLANNED s75,
  ✅ VERDICTED s76: THE FOUNDER APPROVED IT, TARGET s77.** His words: *"my
  verdict on b-media is that its worth doing right? maybe next session"*.
  The proposal sheet's do-not-port bar is lifted (README section updated in
  the same change). **No re-ask was needed on the plan's one open question:**
  his s75 ruling (*"also have placeholder until bmedia ready"*) already
  settles §1-iii — Approve/Runs/Create/Dashboard keep honest striped
  placeholders until B-media proper (the operator import door, the charter
  candidate above) gives drafts real media. **THE SEQUENCING CONSTRAINT that
  survives the verdict:** plan step 1 is a CONTRACT WINDOW — `meta.posterRef`
  plus the oEmbed `thumbnail_width/height` we already parse and discard,
  derived into `orientation` — and a window must be FROZEN BEFORE any lane
  launches against it. So s77 opens the window first, then builds
  `<SourceThumb>` and migrates the FOUR surfaces that already resolve real
  media (Transcription · Intel · Videos/Dossier · Sites), which is pure
  consolidation verifiable against two surfaces that already work. Other
  queued window candidates that could ride the same freeze rather than wait
  for another: Runs' Retry replay route (rendered but unarmed, s74) and
  Library's "grounds N drafts" count (s74). The plan is
  `docs/research/source-media-plan.md`; the proposal sheet is
  `mock-sheets/Source Media.dc.html`, filed under the README's new
  "Proposals — NOT yet verdicted (do not port)" section. **The correction it
  opens with:** two surfaces already resolve real media end-to-end
  (Transcription via the keyless YouTube oEmbed captured at ingest, Intel via
  its driver), so this generalises something that works rather than building
  from nothing — and the resolved `<img>` is already copy-pasted twice, so a
  shared `<SourceThumb>` is owed regardless. **The join splits three ways:**
  solved (Transcription + Intel) · ref-exists-poster-missing (`video_takes.ref`
  + the live `/assets/<sha256>` door need one ffprobe-derived `meta.posterRef`)
  · genuinely-nothing-to-join (a draft is text; Approve/Runs/Create/Dashboard
  stay striped until B-media's import door ships, because borrowing a thumb
  from the run or the grounding source would invent a provenance on the
  publish-decision surface). **Contract-window candidates:** `meta.posterRef`,
  and capturing `thumbnail_width/height` — already in the oEmbed reply we
  parse and currently discarded — as a derived `orientation`, which is what
  the portrait-vs-crop decision needs. Open founder question in NEEDS-STEVEN.
  Original framing follows. — the s74 rebuild
  wave shipped Approve, Runs, Create and Library/Transcription rows WITHOUT
  thumbs, because nothing on the wire carries a media reference to join; three
  lanes hit it independently and it is the single place the rebuilt surfaces
  read thinner than the mock. It also sits directly against the founder's
  MEDIA-FIRST doctrine (ui-overhaul-plan §5(1)), whose own words are that
  Approve is where it matters MOST — scan-and-decide.
  **Two halves, and the plan must cover both:**
  (a) *the join* — where a thumbnail legitimately comes from per row kind:
      a draft's own generated/attached media · a run's drafts' media · an
      intel card's driver-captured `thumbnailUrl` (already captured, no new
      plumbing) · a **transcription source's YouTube/video poster frame**,
      which is the densest case because that surface is almost entirely video
      (see the rename below). Content-addressed store + the `/assets/<sha256>`
      door already exist (B-pub.4) — the gap is the read model, not storage.
  (b) *the treatment* — **research-first, per the founder's "see how others do
      it"**: how mature queue/library products handle poster frames, aspect
      ratios, missing media, hover/scrub affordances, and the honest
      placeholder. The sheets' striped `.thumb-sm`/`.thumb-md` with a mono
      legend is the current honest fallback and stays the floor; the question
      is what the RESOLVED state should be, and it deserves a plan doc + a
      claude-design mock before code (DOCTRINE 0: a new visual pattern earns
      a sheet).
  **Sequencing:** plan next session in the lead's own time beside the wave-2
  lanes; the join half is a contract-window candidate.
- **B-media.1 — RENAME `Library` → `Transcription` — ✅ SHIPPED s75** (`1ba43bd`).
  Route `/app/transcription` with `/app/library` kept permanently as a
  redirect; `components/transcription/` with its files, tests and the
  `.transcription-surface` scope class; rail label + the `RAIL_ICONS` key
  (the rail looks its icon up BY LABEL); the two hrefs that pointed at the old
  route. `git mv` throughout, so history follows. **Deliberate boundary:** the
  rename is surface-level — `lib/library/`, `/api/library` and
  `LibrarySourceRow` keep their names because they serve the generic `sources`
  shelf, not this one surface. **Recorded as a founder amendment** in the
  mock-sheets README's new "Founder amendments — the sheets are WRONG here on
  purpose" section, so a future lane cannot correct it back to what the 16
  sheets still draw. Original framing follows. [FOUNDER-DIRECTED s74: "the
  libary (we should really rename it to Transcription) also needs the media/
  thumbnail treatment, since it's mostly youtube/video based"]** — the surface
  serves `video_transcript` sources only (its own row verbs are already
  "Copy transcript" on every row, because the sheet's "Copy text"/"Open
  profile" variants have no data behind them). Scope: rail label · surface
  header · route `/app/library` → `/app/transcription` with a redirect so
  existing deep links and the command palette keep working · component dir +
  test names · the pin-file rows that carry the path.
  **Two things to flag rather than assume:** (i) this is a DELIBERATE
  DIVERGENCE FROM THE SHEET — `Library.dc.html` and every rail in all 16
  sheets say "Library", so either the canvas is re-exported or this is
  recorded as a founder amendment, and a future lane must not "correct" it
  back; (ii) the name narrows the surface to transcripts — if it ever holds
  PDFs/pages/notes as grounding sources, "Transcription" becomes the wrong
  word, so the rename is right for what it IS today and worth revisiting only
  if the source kinds widen.

### Integrations (ADR 0011 — the sprint's big build)
- **B-int.0 contract window** — ✅ FROZEN (PR #66, migration 0018).
- **B-int.1 vault core** — ✅ SHIPPED s68 (envelope crypto + doors + validate-ping
  seam + redaction ratchets + vault-first social arming; dev pg has 0018 applied).
- **B-int.2 the surface** — ✅ SHIPPED s70 (Phase 1 above).
- **B-int.3 driver rewire** — **[lane — NEXT; founder lane-approval]** — publisher/intel/
  outreach seams resolve credentials from the vault by tenant; per-platform arming becomes
  tenant DATA (connected + tenant-armed) instead of env; refusal ladder keeps its shape,
  only the rung's source changes; dogfood tenant moves onto the vault (the surface's
  env-override badge then retires for vault-armed platforms).
- **B-int.4 OAuth-Connect (mode 1), per platform** — **[founder files partner-app reviews]** —
  callback routes + token exchange into the vault + auto-refresh, platform-by-platform
  as approvals land (LinkedIn → Meta → X). **Gated by THE LANDING** (needs hosted
  Terms/Privacy pages); mode 2 never removed. **s70 input (founder question): the Nango
  evaluation + the self-tenant OAuth pull-forward** — the founder's own apps already hold
  the scopes, so callback+refresh could work for the dogfood tenant BEFORE any partner
  approval; Nango (ELv2 — isolate + swap path if adopted) would supply the per-provider
  OAuth dances + refresh; it does NOT bypass platform review. **Swordfish ANSWERED
  same-day (FROM-SWORDFISH): they run self-hosted Nango for P2's drive connects,
  proven live; founder made them portfolio Nango owner; zero-SDK plain-REST shape
  keeps ELv2 out of this repo; standing offer = a Thalon-own instance at the
  B-int.4 kickoff, no new spend.** Full read:
  `docs/research/integrations-surface-plan.md` §Mode-1 automation check.

### The landing + visual arc **[founder sequencing call]**
- Visual arc HOLDS at 20 sites ("leave the landing pages at this for now").
- Checkpoint tail awaiting his sequencing: **the A+ animation family** (bloom-transition
  video · Orchard seasons-tree scroll · Wagtail scroll-dog) · **B-sitegen** (see below) ·
  **THE LANDING itself** (built last; the skill-compound target; also gates B-int.4's
  mode-1 filings, so it sequences before OAuth-Connect).

### B-learn — THE METRIC-DRIVEN SELF-IMPROVEMENT LOOP **[CHARTERED s72 ("approve b-learn charter") + PARALLEL EXECUTION APPROVED for s73; wave 1 = lane `blearn` (KICKOFF-blearn.md): L0 knobs-as-area-data + durable cap + L2 slice 1 (honest multi-platform trends read); launch after the lead freezes the L0 window at boot]**
The founder's bar: the engine learns from 10,000+ viral posts + 100+/day
across topics, metric-driven, so founder edits stop being the teacher.
**Founder framing (s70c, ratified into the shape): THE SCHEMA IS THE
FRAMEWORK** — learning is a data pipeline (place → filter → clean → analyse
→ synthesise), so the chartered build OPENS with a B-learn CONTRACT WINDOW
(L0): exemplar-admission config (the outlier knobs as area-config data),
own-post engagement snapshot tables (the trend_snapshots pattern applied to
OUR published posts), attribution/pattern-stat tables. Half the spine
already exists and is engagement-based: sweeps capture likes/comments/
reposts/views per item, trend_snapshots holds them append-only
longitudinally, and trend/longitudinal.ts runs Δ-velocity outlier math
against baselines — admission + synthesis are the missing half. Storage
runs on OUR Postgres (dev pg on syd4 · tenant-pg on the staging VPS —
Supabase is not in Thalon's stack; capacity is a non-issue either way).
**Instagram (founder: "needed soon"):** honest read — the official Graph
API gives own-account insights + limited hashtag top-media, NO public viral
firehose; IG posting waits on B-pub.4's public image URLs; IG intel enters
at L3 (own-post outcomes) + the modest hashtag surface, never scraping.
Honest inventory says half exists (sweeps poll 100s/day · exemplar retrieval
at generation · the B-crm.5 learn-weights pattern is the in-repo precedent)
and half is missing: (L1) ✅ SHIPPED s71 (lane exarm, merged): outlier→exemplar
AUTO-ADMISSION armed — per-area knobs as config data, fail-closed floors
(views=10k default: Bluesky admits nothing until deliberately opted in via a
likes floor; YouTube qualifies at a real bar), 4× velocity multiple, 140-char
body min, 20/day/area cap, budget-honest embeds; the contract-window ask
(persist `admission` knobs on the monitored-area row) = the L0 window's first
line item; founder unlocks calibrated on real data in WRAP-exemplar-arm.md
(YouTube key in the soak env → admissions start free; or Bluesky
`floors:{likes:500}` ≈ 16/day). ✅ FOUNDER SAID "BOTH", DONE s72: soak =
`TREND_SOURCE=youtube,bluesky` (comma-list sweeps each driver in order —
full intake + admissions per source) + `TREND_ADMISSION_CONFIG`
`{defaults:{floors:{likes:500}}}` riding scheduler AND Sweep-now; youtube
watchlist row mirrored through the repo door. **L2 carries the flagged
remainder: the per-tenant trends bundle is ONE object, so the LAST listed
source owns the trends surface until the L2 multi-platform bundle merge;
per-PLATFORM floors (vs per-area) are the same window's refinement.** (L2)
acquisition breadth legally — **FOUNDER DIRECTIVE s71: intel eventually reads
EVERY platform we post to (YouTube · TikTok · IG · Facebook · LinkedIn · X ·
Bluesky …), the way competing SaaS/creators already do; wire each via its
official surface and be honest per platform**: X — **pricing model CHANGED
(verified 2026-07, web): flat Basic $200/Pro $5k tiers CLOSED to new signups
Feb 2026; new developers get PAY-PER-USE, no monthly minimum — ~$0.005/post
read (2M reads/mo cap), $0.015/post write ($0.20 with a link). A ~500-reads/
day intel sweep ≈ $75/mo; a proof run costs pocket change. FOUNDER GATE
(s71, verbatim intent): "i would only pay if our learning engine is ready,
not before" — no X spend until the admission→generation loop demonstrably
converts exemplars into better drafts; then start metered-tiny. Re-verify
pricing at purchase (X shifts terms often).** Reddit official API; YouTube
LIVE already;
TikTok = official research/display APIs (limited, app-review-gated); IG =
own-insights + hashtag top-media only; Facebook = page insights; LinkedIn has
NO trending API — barred from scraping, learned obliquely, (L3) OWN-POST
engagement pull-back on a schedule (official APIs; the ledger's
external_post_id is the join key), (L4) attribution → retrieval weighting +
bandit hook-pattern selection (Vowpal Wabbit BSD if we want real contextual
bandits), (L5) founder edits remain the TASTE ANCHOR + golden rows while
metrics accumulate. Capacity check done: 10k posts ≈ 15MB vectors, <$1
embeds — acquisition is the constraint, never storage. This loop is the
moat (AGENTS.md rule 5). **CHARTERED s72; the X-API spend gate stands unchanged ("only pay if our learning engine is ready") — do not re-ask until the admission→generation loop demonstrably improves drafts.**

### Exemplar acquisition — LEARN FROM THE CROWD (founder intent, s68 close)
- **The founder's stated goal (verbatim intent): the engine exists because "there
  might be people out there that would write a more clever/viral/hook/trending
  post than me" — exemplars should come from THE BEST EXTERNAL POSTERS, not from
  the founder's voice** (his voice_sample was the s68 quick unlock, seasoning not
  base). Work items, lead-serial: (a) ARM automatic outlier→exemplar admission
  (area config needs outlier knobs — engagement metric names, floors, velocity
  multiples; today's sweep: 221 polled, 0 ingested, tenant had zero exemplars
  ever); (b) COVERAGE honesty: Bluesky's area feed = news-bot headlines, not
  viral posts — the hook-pattern pool needs YouTube titles/hooks (already
  polled), possibly X search (PAID API gate — month-end credit call), and (c) a
  zero-cost operator drop door: the founder pastes posts he admires → ingestExemplar
  (the s68 CLI pattern; his curation, the crowd's craft). Retrieval side is done
  (CREATE_EXEMPLAR_K).

### Judge quality (s69: the tuning pass LANDED — remaining items below)
- **✅ s69 CLOSED the tuning arc (`a5fdca3`): screen v4 + majority-retry golden
  runner, 32/32.** What the lap proved: the cheap tier carries a few percent
  per-call verdict noise even on a settled prompt (three sweeps each flipped one
  DIFFERENT row; isolated re-runs green) — the runner now retries a first-attempt
  mismatch to a logged 2-of-3 majority, so golden:g3 pins doctrine, not coin
  flips. Two REAL screen defects fixed in v4: the mechanism rule now owns its
  collision with the paraphrase rule (part-by-part comparison; g3-008) and
  topics/tags/labels are explicitly never support (g3-006). g3-016's s68 red
  never reproduced — final v2 unchanged, 48/48 on the day.
- **NEW RATCHET CANDIDATE (s69, load-bearing find): re-brief must REPLACE the
  grounding pointer, not append.** Root cause of the s68 twelve-lap 491089d0
  record: `meta.groundingSourceIds` carried BOTH the original brief and the s68
  re-brief (near-identical texts, delta = one attestation block). Two ~same
  instruction documents destabilize the final tier — objections drift lap to
  lap, each contradicting the prompt's own rules (one lap discounted "the
  instruction portion" of a chunk that stated the claim VERBATIM; the next
  rejected "two months" against the prompt's own worked example). Deduped to
  the superset brief → both tiers pass, first lap. Executable home: the
  re-brief/edit path replaces the source id; belt-and-braces = judge-time dedup
  of near-identical chunks. The "operator brief as grounding" doctrine question
  (s68) stays open but got evidence: the tier invents an instruction-vs-fact
  distinction under duplicate pressure.
- Judge-prompt tuning candidate: the FINAL tier is over-strict on truism claims
  (golden g3-004/005 fail though expected pass) AND lenient on the invented-mechanism/
  topics class (g3-006/008 pass though expected fail) — a real tension worth a
  golden-guided prompt pass. **[lead-serial — PROMOTED s68: no longer low priority;
  the meme-post dogfood added ~6 live data points in one day, including an apparent
  final-tier MISREAD (draft `74d77abb` round-4: "inverts the horse labeling" against
  a draft whose order matched the source verbatim)]** · `golden:g3` stays non-CI.
  **s68 TERMINAL EVIDENCE (draft `491089d0`, 12 laps): the final tier's objection
  set is UNSTABLE — "The architecture stays put" passed unflagged in one lap and
  failed a later lap on verbatim-absence; and the tier REJECTED an operator-attested
  lived-experience claim WHILE CITING the attestation chunk that grounds it. No
  fixed point is reachable by minimal edits. The tuning pass is now LOAD-BEARING:
  it blocks the founder-directed punchy LinkedIn post. Golden-row set for the pass:
  55108b92 · 3ebd7de1 · 14e05fa3 · 74d77abb · 491089d0 (each lap = one row).
  Also decided s68: exemplar+voice fixed generation punch in ONE lap (the
  voice_sample of the founder's own rework was the unlock) — the drafting side
  needs no tuning.**
- **Platform charLimit is UNENFORCED (found s68; s69 sharpened it):** x.v1.json
  declares 280 but neither generation nor any gate checks it — a 600-char X draft
  once sailed to queued, and the LIVE X draft `a40e9c48` sits at EXACTLY 280
  (zero margin; one em-dash is weight-1 under X's counting so it fits, but
  nothing in the engine knew that). Ratchet candidate: a deterministic length
  gate reading the platform profile (belongs beside the judge, not in it), using
  X's weighted counting for the x platform.
- **s68 evidence — the tiers SPLIT on operator-brief-sourced quantity claims:** the
  claim "one prompt becomes a week of platform-ready content" (verbatim in the
  operator's PROMPT source chunk) passed g3_screen citing that chunk in all three
  runs, but g3_final failed it twice consecutively (drafts `55108b92`, `3ebd7de1`;
  the one 05:12 pass was the outlier). Two open questions for the tuning pass:
  (a) final-tier consistency, (b) DOCTRINE: does the operator's own brief text
  count as grounding for product claims, or only identity/profile sources? The s68
  call: treat the final tier as right — quantity/time promises need real grounding,
  so the brief dropped "a week". Candidate golden rows both ways. Run 4 (draft
  `14e05fa3`) adds a LIVE truism case: g3_final killed the rhetorical address "You
  know your business" as ungrounded (the g3-004/005 over-strict class) — plus a
  correct catch of the draft re-introducing "three formats every week", enforced via
  the operator constraint text itself (constraints-in-the-prompt ARE enforceable
  grounding — worth keeping as doctrine). Runs 6-7 (the meme-post fan-out) add the
  clearest characterization yet — the ENTAILMENT class: g3_final refused "launched
  in May" against a grounded "2026-05-28" (month paraphrase) and "three releases
  in eight weeks" against three grounded dates (derived arithmetic). The final
  tier demands near-verbatim grounding; correct entailments fail. Fix-side
  doctrine: enrich the fact base with the entailed forms. Tuning-side: the golden
  pass should decide whether simple entailment (calendar containment, date
  arithmetic) is admissible grounding.

### Checkpoint decisions (COORDINATION row 4) **[founder, next checkpoint]**
- **B-sitegen charter candidate** — the meta-prompt behind Create's page family; input
  scope expanded s61 (prompt | URL-DNA extraction | template pick + purpose block +
  intel/lead autopopulate). Detail `docs/research/sites-surface-plan.md` §6.
- **Entitlements / tier-gating** — per-tier availability must be EASY TO FLIP (flags as
  config-data, per-tenant overridable; templates + CRM default to highest-tier). A
  contract-window schema candidate, not a build stopper.
- **Object-store durability** — DECIDED: VPS-local for now; AWS/S3 migration parked with
  an explicit trigger (real traffic/customers); the platform seam stays fail-loud.
- Also open: cache exemption · B-rls.2 charter candidate · standing scratch-admin role ·
  ms-fidelity caveat.

### CRM / outreach
- **B-crm.4 live send GO** — **[founder GO + the s28 stealth question]** — door built + merged,
  disarmed (`RESEND_API_KEY` + `OUTREACH_SEND_ARMED` both unset); needs Resend domain
  setup + the brand-domain-reveal decision (accept / neutral domain / wait).

### Ops / infra tails **[swordfish + founder]**
- Preview basicauth rotation + `DB_DUMP_TOKEN` retirement — founder-gated console pass,
  queued swordfish-side; lead swaps CI `STAGING_EDGE_AUTH` when the pair lands.
- db-dump route code removal — checkpoint cleanup candidate.
- GitHub Actions billing — ✅ RESTORED (founder, 2026-07-25): ci-guard re-ran GREEN on
  head; web-image re-run dispatched (staging auto-redeploy resumes with it). Local
  verify stays the merge gate; CI is the second net again.
- Concept film staging import — swordfish-side; fell out of their queue after the
  07-19 ACK, re-queued 2026-07-25 (their honest-ledger note), still unranked.
- ~~syd4 systemd units for 8899 + sweeper~~ — ✅ DONE swordfish-side 2026-07-25:
  `thalon-preview.service` + `thalon-sweeper.service`, linger on, reboot-safe;
  never hand-start either again (a second sweeper double-fires schedules).
- Dokploy templates-preview service + `TEMPLATES_PREVIEW_ARMED=true` — founder console,
  gives the workspace Sites surface a live origin (dev reads local meanwhile).

### Parked (charter-level, explicit triggers)
- **HEADLESS AI / BYO-AI (founder s70c, "a discussion for another time")** — tenants
  bring their own AI subscription/keys instead of Thalon metering shared budgets;
  natural fit: AI-provider credentials as a vault destination class + model seats
  as tenant data (the B-int.3 pattern). Trigger: the next charter checkpoint.
  Related standing rule (s70c, EXECUTED): build phase runs the strongest tier on
  every model seat (`claude-cli/claude-opus-5`); cheap tiers return only on a
  proven-comparable eval at launch.
- AWS/S3 object-store migration — trigger: real traffic/customers.
- B6.7 domains launch · B-visual style-lock candidate (open-weight self-host + per-tenant
  LoRAs, cloud-GPU only) · film refine (revisit after the landing) · month-end credit call.

---

## Founder decisions outstanding
Live list in `agent_handoff/NEEDS-STEVEN.md`. At boot, none block starting Phase 1. The
GOs that unlock Phases 2–3 (mint cost-plan · per-platform live posts) arrive inline.

## Standing constraints (always in force)
Stealth (public /blog + thalon.org stay dark until the launch call) · hermes-relay =
founder · blanket workspace grant · **Mode B lanes on fresh founder approval** ·
`npm run verify` = the merge gate (10-min tool cap → split: suite backgrounded,
guard/typecheck/lint foreground) · ≥40cr mint ping · no AI attribution · wrap =
guard + commit + push + stamped resume prompt + this file re-ranked.

## Recently shipped (last session — s70)
**B-int.2 THE INTEGRATIONS SURFACE** (Phase 1 above: cards + honest states +
guided mode-2 connect + validate/disconnect doors + the published view closing
the `/blog` partial + the s69 versioned LinkedIn probe + env-override honesty +
probe-discovered connectedAs) · Nango/mode-1 question answered + homed (plan doc
§Mode-1 automation check; swordfish asked) · token budget reset 7.25M→2M ·
verified live in the workspace against the real vault + the s69 ledger.

## Previously shipped (s69)
**THE FIRST LIVE POSTS: LinkedIn + Facebook published by the engine** (meme
post, image-attached, through draft→judge→approve→publishApprovedSocial; X
waits on platform credits) · **judge tuning arc closed** (screen v4 two real
fixes · majority-retry runner · 32/32) · **the 491089d0 mystery SOLVED**
(duplicate near-identical grounding briefs destabilize the final tier —
dedup unblocked it in one lap) · LinkedIn pin 202512→202607 live-swept +
field fix (first real versioned call found it dead) · main-RED #4 fixed
(oauth1 typecheck) · token day closed ≈7.1M (s68 3.5M + s69 lap ~3.6M;
cap raises documented in .env.local; month-end reset queued).

Prior sessions: `COORDINATION.md` close messages.

- **B-sites.1 — DEEPEN THE SITES SURFACE [FOUNDER-DIRECTED s75: "can you
  also plan to have the Sites feature a bit more built as well. there
  thumbnails seem broken, and clicking on one of them seem to take me to the
  old design. there were some good features from the old design, so see if
  you can add them back in now that the design structure is in place"]** —
  prepped as the `sites-deepen` lane for s76. Both of his observations were
  CONFIRMED by the lead before the kickoff was written:
  (a) *the broken thumbnails are an ORIGIN bug, not a rendering one.*
      `lib/sites/provider.ts` hardcodes
      `DEV_PREVIEW_ORIGIN = "http://127.0.0.1:8899"`, and both the gallery
      card images and the dossier iframe resolve against it. All 20 load on
      the box; from any other machine `127.0.0.1` is the VIEWER's loopback,
      so every one breaks. `SITES_PREVIEW_ORIGIN` overrides it, but the real
      fix is same-origin serving through the app (a thin
      `/api/sites/preview/[...path]` proxy) or catalog-time poster capture —
      the latter would also feed B-media.0's poster work. One or the other,
      never both.
  (b) *the dossier really is the old design.* `components/sites/site-dossier.tsx`
      has not been touched since s61 and still carries 19 bridged legacy
      tokens (it is pinned at exactly that in `bridge-burndown.test.ts`), so
      clicking a card leaves the mock's language entirely. **It has NO
      sheet** — the precedent is Intel's Search tab (s74): DESIGN it in the
      sheets' language rather than port it, keeping every capability the old
      one has (live preview + desktop/390 toggles, the site record, manifest
      mint facts with dims and pinned-hash tails, /guide links, verdict
      status).
  (c) *the old gallery's good features* — the estate lane already carried
      the facet filtering and count honesty across, so the lane VERIFIES
      that before assuming a gap, then mines the deleted
      `sites-gallery.tsx` history for what genuinely did not come over and
      re-enters it behind byte-true resting chrome (the re-entry rule).
  Note Sites is the one surface with REAL preview media, which is why its
  origin fix is worth doing while every other surface's thumbnails stay
  placeholders until B-media (founder s75).
