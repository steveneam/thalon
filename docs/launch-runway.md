# The launch runway — everything between here and launch, in order

> **Status: PLAN OF RECORD (opinion-tagged — re-charterable at any checkpoint).**
> Commissioned by the founder s89 (2026-08-01): *"give me a synthesis of what all
> the next steps would be from now until launch … include everything from
> workspace redesign, wiring, testing, refining, landing page redesign, video of
> features, video of thalon etc."* This file is the MAP; the lane board
> (`COORDINATION.md`) stays the per-session plan; each spec keeps its own depth.
> Sequencing here is a recommendation — every wave verdict, lane GO, arming step
> and stealth lift remains the founder's call at its own gate.

## 0. Where we are (honest, as of s89 close)

- **Engine: pass-2 complete and green** (suite 3104/9, verify exit 0). Create
  engine + both LLM shells + the candidate judge (R8 closed) · judge harness
  with one shared gate ladder · fanout → judge → approve wired · publish spine
  built, **disarmed everywhere except Bluesky-for-testing** · analytics D2 spine
  live with absence-honesty (X deferral now structural) · leads/outreach with
  the two-key send door · ingest/library · video engine (EDL/render/direction)
  ALL built · sites/webpage engine · schedule spine · profiles with routing ·
  four social channels connected.
- **Surfaces: the split is closing.** Researched + sheet-done: the D4 four
  (Analytics · Schedule · Composer · Channels, s85–86) + **the W1 four (Approve
  · Dashboard+Board-toggle · Runs — APPROVED s89)**. Coverage: 13 of 20
  research-touched. Remaining unresearched: Create-draw (research ✅, sheets
  owed) · Sites · Library · Source Media · Intel · Leads · Profiles ·
  Settings/Integrations · video sheets (references banked).
- **Deploy:** staging live on the VPS (neutral hostname + edge auth); CI →
  GHCR → Dokploy auto-deploy proven.
- **Stealth:** intact — thalon.org unwired, nothing posted, pillar tenant
  gitignored.

## 1. The surface programme to completion (lead-direct, one wave ≈ one session)

| step | content | gate |
|---|---|---|
| **W1 builds** (unblocked NOW) | Rebuild `/app/approve`, `/app` (+ setup band + Board toggle), `/app/runs` to the amended sheets, exact-mock; **delete `/app/board`** as its replacement lands | W1 verdict ✅ (s89) |
| **W2 draw** | Create home sheet update + wizard sheet (B-create.3, research banked) · Composer Postiz-launcher flow facts · Sites pass · **Library/Source-Media IA resolution** (ONE Library, transcription = ingest kind) | founder verdict on W2 sheets |
| **W3 draw** | Channels/Integrations/Settings split applied (§5.4) · Settings sheet (new) · Schedule build-prep · Profiles pass | founder verdict; unblocks D4 Channels build |
| **W4 draw** | Intel · Leads · video sheets pass 1 (Overview/Dossier/Editor — references banked s87, version rail collapses 4 of 5 no-affordance jobs) | founder verdict |
| **Pass 2 — flow** | Walk the eight §4 journeys end-to-end across the settled sheets; fix the joins, not the screens | after pass 1 settles |
| **Pass 3 — state & button** | Every control's empty/loading/partial/refused states; the Composer POPOUT drawn open; state matrix | after pass 2 |
| **Impeccable re-arm** | `/impeccable audit` over the sheets, reconcile ramp into design.json, remove the ignore entry | the programme's own expiry trigger |

## 2. Builds behind their verdicts (interleave with §1)

- **B-create.4 — the Composer route** (`/app/create/run/`): now buildable
  against the spec's REAL semantics (the R8 deviation closed s89). Lead-gated,
  exact-mock to `Composer.dc.html`. This is the biggest single unblock — it
  completes the MAKE act and journey 3's spine.
- **D4 builds:** Channels (after W3's split verdict) · Analytics (after the
  Facebook-fixture reconciliation — `capability.ts` is the truth, the sheet's
  Meta numbers are stale) · **Calendar→Schedule rename (STILL THE FOUNDER'S
  OPEN CALL — route, component, copy)**.
- **Library collapse** (W2 verdict) · **Settings split** (W3 verdict).
- **Onboarding setup band + per-surface empty states** — drawn in W1, builds
  with the Dashboard rebuild; no route, ever.

## 3. Engine pass 3 — the live drivers (laneable, engine-side)

- **Trend live pollers** — YouTube Data API first, behind the existing
  `TrendSource` seam (automated acquisition IS the feature — never manual
  curation). Also lights Intel's dark Velocity/Engagement signals (programme
  file, open decision 4).
- **Transcript live driver** — box needs python3 + faster-whisper (`npm run
  doctor` names the exact commands); the seam is built, tests stay fake.
- **AI gateway production top-up** — `claude-cli/*` is the dev transport on the
  founder's subscription; production needs the paid gateway seat. A launch
  gate, flagged not silently blocking.
- **Own visual engine (B-visual)** — post-launch charter candidate by standing
  directive; keeper/reject mint data is already being collected for it.

## 4. Wiring, testing, refining

- **Eval suite = the ship gate** (standing rule 6): every override/correction
  an eval row; green suite gates launch. The reject-reason control (drawn in
  W1's Approve) is the learn loop's front door — wire reject→`eval_cases` when
  Approve rebuilds.
- **Journey walks as the integration test**: after pass 2, each §4 journey
  gets walked on staging against the self/demo tenant — dead doors and broken
  joins filed as defects, not notes.
- **Dogfood ladder:** (1) self-tenant daily triage on staging, disarmed →
  (2) the pillar tenant's profile (guard-token A company; JSON stays in
  `.context/tenants/`, never tracked) → (3) armed posting per the GO ladder.
- **Monthly ratchet pass** stays standing: `npm run verify` + `npm run doctor`
  executed verbatim.

## 5. Distribution arming (founder-paced, never time-paced)

The sequence gate is unchanged and stays one-way until his word, per platform:
Bluesky (armed for testing on his recorded words) → Facebook/Instagram
(per-platform + per-post GO; IG media path built, disarmed) → **X pays only at
launch** (his ruling; the deferral seat's deletion diff IS the lift) → outreach
send door (two-key, separate GO). The queue consumer's key rests EMPTY until
each arming.

## 6. The launch surface (public-facing)

- **Landing page redesign** — named by the founder s89. `impeccable` is ARMED
  here (deliberately excluded from the waiver). Run its own reference pass
  first (the DOD discipline applied to the public surface; the 17-site
  portfolio + Mobbin landing patterns are the bank), then lead-direct rebuild.
  The three tracked demo mp4s are load-bearing — they get REPLACED by the new
  feature videos, never deleted first.
- **Video of features** — Hyperframes, deterministic (free at any scale,
  ADR-0004): screen-true feature walkthroughs rendered from the product's own
  build-step pipeline. The demo fixtures already narrate this story — the
  launch film about "video as a build artifact" should literally BE one.
- **Video of Thalon (pillar #1)** — the content-origination goal made real:
  Thalon generates its own launch pillar (prompt + URL → video + caption/SRT)
  through Create → judge → Approve → render. **Dogfood as proof: the launch
  video is the product demoing itself.** Higgsfield supplies photographic
  stills/b-roll where rendered UI isn't the right texture (house style: object
  protagonist, nature supporting cast).
- **SEO/AEO/GEO** (A13/B6.8) and the blog loop (s70c: social mirrors the blog)
  ride the Sites surface once W2 passes it.

## 7. Higgsfield credits — recommendation (balance checked live, s89)

**Balance: 584 credits, Plus plan.** Recommendation:
1. **Spend ~0 during W2–W4** — sheets use placeholders by design; a mint spent
   on a mock is a mint wasted.
2. **Reserve the pool for ONE planned launch-asset sprint** (landing hero set ·
   feature-video stills/b-roll · pillar-#1 supporting assets), sized by a mint
   list written BEFORE the first generation — the standing mint discipline.
   584 credits ≈ a comfortable image sprint; it is NOT a video-generation
   budget — video rides Hyperframes, which costs nothing and is the story.
3. **Keep Plus for now** (portfolio work is live); revisit the tier only if the
   sprint's mint list prices over the pool — top up against the list, not
   speculatively.
4. Every mint keeps its keeper/reject record (own-visual-engine training data).

## 8. Infra + launch gates checklist (each is its own founder gate)

- [ ] thalon.org wiring / stealth lift — **the founder's call alone** (CT-log
      exposure is permanent).
- [ ] Staging edge auth posture at launch (basicauth pair + `DB_DUMP_TOKEN`
      rotation → CI `STAGING_EDGE_AUTH` swap; db-dump route REMOVAL is a
      checkpoint candidate before public traffic).
- [ ] `thalon-deploy` + templates-preview credentials (NEEDS-STEVEN 2026-07-29e).
- [ ] Platform portal apps in HIS browser (instructions in his Gmail draft;
      one app per platform forever; logins live durably in `.context`).
- [ ] Key rotation sweep (founder-timed, post-migration list).
- [ ] Production gateway top-up (§3).
- [ ] X billing at launch (covers analytics + posting, his ruling).
- [ ] Eval suite green (§4) + final verify-on-main.

## 9. Recommended session sequencing (from s90; ~indicative, not a promise)

| session | lead track | parallel lanes (each needs his GO) |
|---|---|---|
| s90 | canvas debt (first action) → **W2 draw** | trend-live (YouTube poller) · learn-loop evals slice |
| s91 | **W1 builds** — Approve first (the priority surface), then Dashboard+toggle+band, Runs; Board route deleted | engine follow-ups from W2 findings |
| s92 | **B-create.4 Composer route** (exact-mock) | Analytics build (after fixture reconciliation) |
| s93 | **W3 draw** (split + Settings sheet + Schedule prep + Profiles) | Channels build prep behind W3's verdict |
| s94 | **W4 draw** (Intel · Leads · video sheets) | Schedule rename build (once he rules) |
| s95–96 | **Pass 2 flow walks** + fixes; journey tests on staging | transcript live driver · gateway top-up |
| s97 | **Pass 3 states** + impeccable re-arm | dogfood ladder step 1–2 |
| s98+ | **Landing redesign** → launch-asset sprint (mint list first) → pillar #1 through the product | arming ladder, founder-paced |

*Anything here can be re-ordered at a checkpoint; the only hard orderings are
verdict-before-build, research-before-landing-redesign, mint-list-before-spend,
and every arming step behind its named GO.*
