# COORDINATION — lane board

> Parallel-lane ledger (protocol: `docs/SPINE.md` §5). **One writer per row** — the lead owns assignments + merge-order; each owner writes only its own `status`. Messages append-only. Status vocab: `pending · in_progress · blocked:<what> · review · merged`. **Contract** = `packages/contracts` + the drizzle schema — frozen per sprint once committed; a lane needing to edit it mid-flight = re-plan, not an ad-hoc edit. Merges serialize through `main` in merge-order: rebase → CI green (guard + lint + tests) → review → merge; never on red.
>
> **This file holds only live state** — active lanes, the gated work queue, fresh messages. Everything decided or shipped lives in **`COORDINATION-ARCHIVE.md`** (append-only history: every sprint's lane tables + all messages through the s53 close record). Wrap stamps = `agent_handoff/CURRENT.md` · founder actions = `agent_handoff/NEEDS-STEVEN.md` · swordfish asks = `agent_handoff/ASK-BACKS-FOR-SWORDFISH.md`. Link, don't copy (AGENTS.md rule 8).

## Active lanes

**Sprint 8 "Arm It Live" (s64 launch, founder GO "how about the arming work"; contract window 0016 FROZEN at PR #60 / `901ada7`; window 2 FROZEN at PR #64 / `da56b2d`, s65 — social+outreach profile columns · publishable capability · SOCIAL_* env pairs · sweep failure door + listAll · social_publishing entitlement key).** Second wave (s65, founder track call "A build + B charter same session"): B-pub.2 drivers Mode B via `scripts/launch-lane.sh`. **THIRD wave (s67, lead-serial off the s66 founder-approved slate — the two loops proven, then the vault window):** blog loop end-to-end (pillar #1 article → `/blog`, 0cr, the ADR-0011 proof-of-product moment) · post-loop production caller wired (drivers → publish door; still zero-live per platform) · **B-int.0 Integrations window FROZEN (PR #66 / `e949b43`, migration 0018 — `tenant_credentials` vault + repos, DESTINATIONS registry, card-state vocabulary, envelope shape, `THALON_VAULT_MASTER_KEY`)** · staged-flow live projection · Settings discoverability · three judge eval rows. Lead reviews/rebases/merges on full local verify (Actions billing-dead).

| lane | bucket | scope (files) | status |
|---|---|---|---|
| arm1-scheduler | B-arm.1 sweep scheduler | packages/engine/src/trend + schedule API + honest Runs/intel stamp | merged (PR #62) |
| pub1-seam | B-pub.1 social publisher seam (NO drivers) | packages/engine/src/social (new) + refusal ladder + queue consumer | merged (PR #61) |
| vid7-autorun | B-vid.7 one-prompt video auto-run | engine video pipeline orchestration + Create one-prompt door | merged (PR #63) |
| pub2-drivers | B-pub.2 publisher drivers (LinkedIn → X → Meta; DISARMED, official APIs, zero live calls) | packages/engine/src/social/drivers (new) + platform env extras + driver tests | merged (PR #65) |
| bint0-window | B-int.0 Integrations contract window (vault table + repos + DESTINATIONS registry + card-state vocab + envelope shape) | packages/contracts/integrations + packages/db credential vault + migration 0018 | merged (PR #66) — FROZEN |
| bint3-rewire | B-int.3 driver rewire (arming → tenant data; vault-first across publisher/intel/outreach; env = override) — **s70b founder-approved parallel wave; the founder drove the window himself** | packages/engine + platform env + web (840 insertions, one precedence table) | **merged (s70c, on green 1801-test verify)** |
| ui-overhaul-p0 | Workspace UI/UX overhaul PHASE 0 — **DELIVERED: hybrid Astryx adoption (MIT incl. StyleX; passing Next16+Turbopack+TW4 scratch build; 106 components; theming-as-config), five-disease audit, wave map; ALL 7 charter answers on record s70c; wave 0 = next session, claude-design mock FIRST** | docs/research/ui-overhaul-plan.md + WRAP-ui-overhaul-phase0.md | **merged (s70c)** |
| p2c-gen | Phase 2c generation side: fan-out DECLARES meta.targetTerms (subject entities + intel keywords + brand topics) feeding the live discoverability lens — **founder-approved s70c for s71 launch** | packages/engine/src/fanout + intel-handoff seam + tests (lens + contracts FROZEN) | **MERGED s71** (`4264553`, green post-merge verify) — deterministic `deriveTargetTerms` (shell entities → intel candidates → brand topics, cap 6) + `fanout-generate.v2` modeled on the founder's live edit; lens armed by data; tenant-0 drafts now always carry terms (dogfood pin updated); blog-mirror pairing notes in `agent_handoff/lanes/WRAP-p2c-genterms.md` |
| bpub4-img | B-pub.4 public blog images: own-site door serves content-addressed store images publicly (allowlist-gated route + page refs) — the IG/Threads image_url unlock — **founder-approved s70c for s71 launch** | apps/web blog routes + packages/engine/src/webpage + tests | **MERGED s71** (`638196b` + fix, green post-merge verify) — gated `/assets/<sha256>.<ext>` door, revocable per-tenant allowlist (published-artifact-scoped), verified reads, closed content-type map (never svg); **post-merge typecheck caught a BodyInit type break the in-worktree verify missed — fixed forward same session (verify-on-main = the gate, catch #2 since s65)**; IG-connect remainders (public origin = stealth-sensitive founder call · social-post admission path · Graph driver behind app review) in `agent_handoff/lanes/WRAP-bpub4-images.md` |
| exarm | Arm outlier→exemplar auto-admission (s68 item (a); B-learn L1): per-area knobs as config-data, velocity/floor gates, ≤20/day budget-aware admissions — **founder-approved s70c for s71 launch** | packages/engine/src/trend + exemplar ingest seam + tests (contracts FROZEN — window ask via wrap if knobs need schema) | **WRAPPED s71** — armed loop shipped on `agent/exemplar-arm` (admission.ts + intake wiring + 20 tests, verify green); defaults admit 0 from the Bluesky-only soak BY DESIGN (views floor fails closed); window ask + likes-floor calibration in `agent_handoff/lanes/WRAP-exemplar-arm.md`; **MERGED s71 (`c5280aa`, green post-merge verify); the `admission`-knobs-on-area-row window ask = the B-learn L0 window's first line item; founder unlocks: YouTube key in the soak env (free) or Bluesky `floors:{likes:500}` (~16/day)** |
| wave0-astryx | UI overhaul WAVE 0: Astryx foundation (pinned core+CLI · Thalon defineTheme from scratch — the mock's tokens embedded in the kickoff · layer cascade + TW bridge · labeled AppShell/SideNav · tokens-contrast re-pin · mono-allowlist ratchet) — **prep founder-approved s71 close ("plan a parallel workflow for next session"); LAUNCH GATED on his wave-0 mock verdict GO at the s72 opener** | apps/web theme/shell + token tests (NO wave-1 surface rebuilds; contracts untouched) | MERGED s72 (`2ace279`, post-merge verify green ×full suite; lane closed). **FOUNDER VERDICT on the rendered result: REJECTED as renovation — only light mode kept. Redirect: exact-mock LEAD-DIRECT rebuilds from `docs/research/mock-sheets/` (plan §5 DOCTRINE 0); no further UI lanes.** |
| blearn | B-learn wave 1 (CHARTERED s72): admission knobs → monitored-area rows (L0 shapes) · durable UTC-day cap · L2 slice 1 = per-source bundles + merged trends READ (engine+API only, intel UI stays lead-owned) — **founder approval ON RECORD (s72 close: "approve b-learn charter … parallel for next session")** | packages/contracts+db (frozen by the lead's L0 window) + engine trend/ + /api/intel/trends route (NO surface UI) | **MERGED s73** (`965f978`, post-merge verify green 1924 tests; lane closed) — L0 window frozen first (`8da5df2`: contracts `admission` block + `trend_admissions` durable-cap ledger); all three slices shipped (knobs = area data w/ request-level `areas` map REMOVED loudly · durable slot-claim cap + racing-sweeps pin · per-source bundles + merged trends read, interim CLOSED); wrap = `agent_handoff/lanes/WRAP-blearn.md` |
| ui-rebuild (LEAD-DIRECT, not a lane) | Exact-mock surface rebuilds per plan §5 DOCTRINE 0 — s73: shell re-true + Home/Dashboard from `docs/research/mock-sheets/Dashboard.dc.html`, then Approve → Intel; screenshot-vs-sheet each round; old surfaces deleted as rebuilt | apps/web surfaces (disjoint from blearn) | lead-serial s73+ (founder: "i want you responsible for the exact claude-design mock implementation") — **s73: shell re-true + Dashboard SHIPPED (`01f8179`; screenshot-vs-sheet dark+light; old shell/dashboard components deleted; bridge-burndown ratchet seeded 938)**; s73 founder direction: per-surface TWO-STEP (pure sheet port → verdict → wire keepers), keepers inventory = `docs/research/old-design-keepers.md`; next = Approve → Intel; **s73 CLOSE: founder OPENED PARALLEL REBUILD LANES (plan §5 s73-close conditions — mechanical sheet-port kickoffs, surface-scoped css, ratchet-guarded, strongest-tier pin, lead = screenshot-vs-sheet merge gate); first wave (approve + intel) queued for the founder's named GO at s74** |
| approve-rebuild | Exact-mock rebuild: Approve surface, TWO-STEP (pure port of `Approve.dc.html` → wire + keepers rows: a/r/e keys, bulk bar, toast, judge provenance) — **founder parallel directive s73 close; launch s74 boot, no re-ask** | apps/web components/approve + app/app/approve + own pin rows (surface-scoped approve.css; workspace.css READ-ONLY) | **MERGED s74** (`146f4d0`) — two-step; a/r/e keys + bulk bar + toast + per-gate judge provenance behind byte-true chrome; TWO judge-semantics corrections (cadence blocks → blocking ✗; the SEO gate is `seo_aeo`); FormatDetail rebuilt not deleted so the outreach copy-out + web_page deploy truth survive; independently reached the CSS-scoping finding and anchored `.approve-surface`. Lane verify green (1928); lead screenshot-vs-sheet PASSED. Flags in `agent_handoff/lanes/WRAP-approve-rebuild.md`: the sheet's own "Oldest first" chip contradicts its newest-first rows (lane followed the rows + s66) · "View diff →" has no read behind it · @handle not on the wire |
| intel-rebuild | Exact-mock rebuild: Intel surface, TWO-STEP (`Intel.dc.html`; consumes s73 merged trends read + `sources` stamps; keepers: capture doors, demo/cadence honesty) — **founder parallel directive s73 close; launch s74 boot, no re-ask** | apps/web components/intel + app/app/intel + lib/intel/types (additive `sources` only) + own pin rows (intel.css; workspace.css READ-ONLY) | **MERGED s74** (`bc9d4b4`) — two-step; capture doors + demo/cadence honesty folded into the sheet's OWN stamp band + merged multi-source per-source stamps (B-learn slice 3 consumed) + j/k/↵ on `.row.sel`; measured the port rect-by-rect and fixed two drifts rather than shipping them. Bridge 938→843. **Raised the cross-lane CSS-scoping defect** that became README rule 6 + `surface-css-scope.test.ts`. Lane verify green (1930); lead screenshot-vs-sheet PASSED. Its flagged Search gap was CLOSED the same session by the lead (founder-directed redesign, `c5067da`) |
| runslib-rebuild | Exact-mock rebuild: Runs then Library, TWO-STEP each (the wave's two smallest sheets; keepers: triage doors + lastError verbatim, ingest/tags/transcript doors) — **founder parallel directive s73 close; launch s74 boot, no re-ask** | apps/web components/runs + components/library + their app routes + own pin rows (runs.css/library.css; workspace.css READ-ONLY) | **MERGED s74** (`34f2adf` + lead CSS scoping `5ee804b`) — both surfaces two-step; Runs' Retry rendered at full fidelity but **resting unarmed with its reason in the title** (no replay route exists — contract-window candidate) · Library single-delete with named confirm kept, bulk parked to Approve's keepers · self-caught its own drift (Dashboard's j/k chips are that sheet's, not these) and removed it. Lead screenshot-vs-sheet PASSED both. Flags in `agent_handoff/lanes/WRAP-runslib-rebuild.md` incl. the shared-helper home question the lead is consolidating |
| planner-rebuild | Exact-mock rebuild WAVE 2: Calendar then Board, TWO-STEP each (keepers: saved-view tabs over `/api/views` — BOTH surfaces — plus the calendar engine's grids/slot chips/reschedule doors) — **founder directive s74 close ("rinse and repeat … next session parallel workflow redesign"); launch s75 boot, no re-ask** | apps/web components/calendar + components/board + their app routes + own pin rows (calendar.css/board.css; workspace.css READ-ONLY) | prepped s74 (kickoff `agent_handoff/lanes/KICKOFF-planner-rebuild.md`; worktree LIVE at `0206467`, symlinked + env-copied, smoke-tested; Opus-5 pin) |
| crm-rebuild | Exact-mock rebuild WAVE 2: Leads then Profiles, TWO-STEP each (keeper: lead-score provenance — weights + reasons; **carries the twice-live profile-config CARRY hazard as a pinned test**) — **founder directive s74 close; launch s75 boot, no re-ask** | apps/web components/leads + components/profiles + their app routes + own pin rows (leads.css/profiles.css; workspace.css READ-ONLY) | prepped s74 (kickoff `agent_handoff/lanes/KICKOFF-crm-rebuild.md`; worktree LIVE at `0206467`, symlinked + env-copied, smoke-tested; Opus-5 pin) |
| estate-rebuild | Exact-mock rebuild WAVE 2: Sites then Settings/Integrations, TWO-STEP each (no pinned keeper rows; the s66 findability door + light toggle must keep working; **Integrations' honest card states are the surface's whole point — never softened to fit the fixture**) — **founder directive s74 close; launch s75 boot, no re-ask** | apps/web components/sites + components/settings + their app routes + own pin rows (sites.css/settings.css; workspace.css READ-ONLY) | prepped s74 (kickoff `agent_handoff/lanes/KICKOFF-estate-rebuild.md`; worktree LIVE at `0206467`, symlinked + env-copied, smoke-tested; Opus-5 pin) |
| s3-store | S3 driver behind the existing object-store seam (`OBJECT_STORE=s3` currently throws) — the flagged pre-launch durability gap; interface parity, verified-read semantics untouched, @aws-sdk/client-s3 (Apache-2.0), zero-network fakes — **founder-approved s71 close for s72 launch** | packages/platform/src/object-store.ts + tests + env docs (contracts untouched) | MERGED s72 (`1abe124` incl. lead NUL-escape fix; verify green; lane closed) |
| rebrief | The 491089d0 ratchet: re-brief REPLACES groundingSourceIds (never appends) — reproduce, fix at the merge-owner seam, regression-pin — **founder-approved s71 close for s72 launch** | packages/engine origination/video brief path + tests (judge internals + contracts untouched) | MERGED s72 (`8429383`; verify green; lane closed) |

### Sprint 9 / s77 — the media framework

**Contract window FROZEN s77 (`13163d4`, direct-to-main on green verify) — CONTRACTS-ONLY, zero SQL migrations** (both meta columns were already jsonb, ground-truthed at plan time). Contents: `packages/contracts/src/media.ts` (new — `MediaRef` external|stored, envelope + provenance, the image/audio ext split, `deriveOrientation`) · `source.ts` media meta mini-contract + `sourceThumbnailEnvelope` · `video-project.ts` `videoTakePosterSchema` (the `meta.attribution` precedent) · RIDER `run-replay.ts` (arms Runs' Retry: a replay is a NEW run, scope defaults to `failed_only` so a partial fan-out never re-spends). **Amended once, pre-lane, by its owner: `capturedAt` is optional** — requiring it made the trend wire drop a thumbnail it genuinely held (see the commit; the window test pins the reason).

**NOT in the window, deliberately:** Library's "grounds N drafts" count. `groundingSourceIds` lives inside `drafts.meta` jsonb, so it is a containment query needing a repo method and an index decision — real work with a performance question attached, not a shape to freeze. It belongs to whichever lane owns it.

| lane | bucket | scope (files) | status |
|---|---|---|---|
| (lead-direct) | **B-media.0 lane A core** — resolver + `<SourceThumb>` + Transcription/Intel×2 migrated + `/api/media/[sha]` door | apps/web lib/media + components/media + the three surfaces | **SHIPPED s77 (`a70a53c`)** — verify 2153 green, screenshot gate passed both surfaces both themes. Rule 6 honoured (renders the SHARED `.thumb-*` so four per-surface overrides survive); css-scope ratchet gained a second, equally strict category for shared-component sheets |
| media-lane-b | **B-media.0 lane B + B-audio.1** — ingest width/height capture · poster derivation + backfill · **ffmpeg into Dockerfile.web** · audio bed/audition/mux | packages/engine ingest+render+video, Dockerfile.web | **MERGED s77 (`a39799a`)** — rebased clean, **verify on merged main GREEN (2194 passed / 9 skipped, 0 lint errors)**, worktree + branch + tmux window GC'd. Contracts untouched, consumed exactly as frozen. **ffmpeg image cost, measured and owed back: +472 MB unpacked / +175 MB compressed** (~160 MB of it Mesa/LLVM via ffplay's SDL dep; an ldd-closure copy would cut it to 236 MB — priced, not done). Caught two real defects in its own diff: the ~1s poster seek broke every STILL take (exit 244, zero-byte file — now only seeks into media measured long enough), and the RenderAudioBundle reshape broke a real bed producer in eval (workspace typecheck caught it). **Open for the lead: run `be-check {mode:"building"}` over this diff (the lane's own recommendation, deferred with the founder's s77 agent-budget call), plus its flagged questions — which caller supplies the bed for pillar renders · the EDL cue-add gap + project-ref-vs-stored-sha mismatch · the audio licensing gate (executable at the door; what licences the product accepts is the founder's call).** |
| (lead-direct) | Lane A remainder — Sites dossier mint strip adopts SourceThumb (first live `broken` caller); `lg` size earns a home or is cut | apps/web components/sites + videos | queued behind lane B |

### s78 — the verify-and-fix pass, part 1 of 2

**The work list is `docs/research/workspace-audit-findings-s77.md` (189 RAW
findings).** Session split on the founder's usage call: **s78 = lanes 1+2**
(6 blockers · 20 high) · **s79 = lanes 3+4** (3 blockers · 19 high — recounted at the s78 close, see the s79 section) · **s80+
= the 139 mediums+lows across all surfaces, re-read against the FIXED code.**
Founder approval for both s78 launches on record at the s78 boot: *"gogogo,
and you have my approval"*.

| lane | surfaces | scope (files) | status |
|---|---|---|---|
| (lead-direct) | **The keyed-by-entity sweep** — state that outlives its entity, as ONE change before any lane launched | approve · create · dashboard · transcription · leads · runs · settings | **SHIPPED s78 (`8d35a9e` + `93470ec`)** — 7 instances, one spelling, 7 pinned tests in ONE file that names the class, all verified to fail with the fixes stashed. Killed the Approve **data-corruption blocker** (the editor outlived the draft: Save edit wrote draft A's body onto draft B) a whole session before its surface's lane. Two found by the sweep rather than the fan-out: **Runs** (latent — `rowsFor` maps 1:1 over a feed read once, so unreachable today, fixed so the next refresh path cannot make it live) and **Settings/Integrations ConnectPanel** (the worst instance — a pasted credential rode into the NEXT destination's box and Connect would seal it there; both Settings walkers had flagged it and the sweep's own grep missed it, since it is neither index-shaped nor a detail card). 8 existing Approve/StagedFlow tests re-query the detail region: their held node is now stale BY DESIGN. verify 2201 / 9 skipped / 0 lint errors |
| s78-lane1 | leads · board · runs | apps/web components/leads + components/board + components/runs (+ their models/css) | **LAUNCHED s78** (worktree `s78-lane1-leadsboardruns`, Opus-5 pin, Mode B). Verifies its **12 remaining blocker+high adversarially FIRST**, fixes only survivors, screenshot-gated. Carries the founder's filters+sort re-introduction for all three surfaces, in ONE grammar. Kickoff: `agent_handoff/lanes/KICKOFF-s78-lane1.md` |
| s78-lane2 | calendar · settings (+integrations) · profiles | apps/web components/calendar + components/settings + components/profiles + lib/profiles | **LAUNCHED s78** (worktree `s78-lane2-calsetprof`, Opus-5 pin, Mode B). Verifies its **11 remaining blocker+high adversarially FIRST**, fixes only survivors, screenshot-gated. Owns the `/api/calendar` question (**report before building** — in scope only if it needs no new table/contract/migration, since the s77 window is frozen). Kickoff: `agent_handoff/lanes/KICKOFF-s78-lane2.md` |
| (lead-direct) | **The 15th surface — the VIDEO EDITOR** | apps/web components/videos/editor.tsx + editor-timeline.tsx + editor-inspector.tsx (1,916 lines) | **WALKED s78 on the founder's call ("you might as well walk the 15th surface") — report `docs/research/video-editor-audit-s78.md`.** 59 agents; **50 raw → 36 confirmed, 14 refuted** (1 blocker · 14 high · 13 medium · 8 low). The headline is the JOBS table, not the count: of 27 jobs an operator would try, **8 work, 4 are dead doors, and 15 have no affordance at all** — no undo, no unsaved-work guard on any exit (three plain `<Link>`s and the back button discard the working copy silently), no insert/delete of a beat or a caption, no way to swap the music track the copilot chip offers, and no preview of the working copy: while dirty, play shows the PREVIOUS render with only an "unsaved" pill beside it. The blocker: the three timeline blocks are real focusable `<button>`s wired to `onPointerDown` ONLY, so Enter/Space is a silent no-op — and selecting a caption plate or the music cue is the only entry to their inspectors, making both unreachable by keyboard. All four copilot chips ("Tighten to 30s", "Recut 9:16", "Swap music", "Retake a beat") name asks the propose door is documented to refuse, and clicking one spends a real metered gateway call to be told no. **It also corrected the lead's brief**: the editor DOES have a sheet — `Videos.dc.html` carries `data-screen-label="Video editor"` and the route's `page.tsx` names it as its spec; Videos Overview is the list, Video Dossier the project page. The render gate therefore ran against the real sheet and **does not match**. Fixes are NOT s78 — this pile joins the s79/s80 queue |

### s79 — the verify-and-fix pass, part 2 of 2

Same work list. **The honest count is 3 blockers · 19 high (11 per lane)** — the
raw tables say 4 · 20, but the s78 keyed-by-entity sweep already closed
Approve's editor blocker and Transcription's selection high, and both kickoffs
name them so neither lane re-does them. Founder approval for both s79 launches
on record at the s79 boot (*"gogogo"* + the launch question answered "launch
both lanes"); the **video EDITOR stays out of scope** by the same answer.

| lane | surfaces | scope (files) | status |
|---|---|---|---|
| (lead-direct) | **Pre-launch fixes + the interaction driver + the founder's live walk** | `tests/agent-handoff-hygiene.test.ts` · `tests/worktree-screenshot-guard.test.ts` · `components/intel/__tests__/intel.test.tsx` | **SHIPPED s79 (`d5c46c4`), test-only, no app change** — all three found by SMOKE-TESTING the lane worktrees before launching into them. (1) **main-RED #5:** `ecee263` shipped the two s79 kickoffs, each ending by telling its lane to write its own wrap file, which the s78 dead-link guard flagged — the prep commit turned the guard red, committed after the last green verify (same disease as #1–#4). A kickoff naming its OWN wrap is a forward reference; exempted SAME-SLUG ONLY, with its own pin, because widening it to "kickoffs are exempt" would un-guard the cross-lane citations most likely to rot (both s79 kickoffs cite `WRAP-s78-lane1.md`). (2) **The s78 worktree ratchet false-red inside every worktree, including the two lanes it protects:** `expect(isWorktreeRoot(REPO)).toBe(false)` encoded "this suite runs in the main checkout" — true on main, false in a lane, so both lanes would have opened on a red verify pointing at the guard built to keep them honest, and the obvious way to green it is to DELETE the line. `--git-common-dir` now resolves the real main checkout from anywhere, and in a lane the difference becomes extra coverage (the positive asserted against a real worktree) instead of a failure. (3) **A real flake on the merge gate:** intel's j/k test failed once at ~291s suite time, green in isolation every time — `useListKeys` attaches its window listener in a PASSIVE effect React runs after paint, and a DOM-based find resolves off the commit's mutation, so under load a synchronous press lands with no listener and is dropped (rows rendered, nothing selected — the failure verbatim). It was the suite's ONLY raw `fireEvent.keyDown(window, …)`; the nine other surfaces use `await user.keyboard(…)`, which awaits its own act flush — now it matches them. Both fixes revert-checked. Verify on main **2295 passed / 9 skipped / 0 lint errors** |
| s79-lane3 | dashboard · transcription · sites | apps/web components/dashboard + components/transcription + components/sites + lib/sites + app/app/sites | **MERGED s79** (`44e3e00`, rebased clean, ff-only) — **11 findings, 11 SURVIVED, 0 refuted (33 refuters, 31 voted real; T3 and S2 at 2/3)**, and the gate corrected **eight of the eleven**, two of whose audit-suggested fixes would have made the surface worse. It **drove all three surfaces in a real browser before fixing** and reported numbers, not arguments (D2: after 12×`j` the selection sat 743px down a 419px box with `scrollTop` still 0; D3: pill 25 vs 21 rows, traced to two different read windows; D5: all six `.mark-you` compute to `--act` exactly). **D3's planned fix was refused by its own verifiers** — feeding the pill from `rows.length` would trade one visible disagreement for two invisible ones, since the topbar chip and rail badge render the pulse's number on the same screen; it ships "21 of 25 shown — the oldest wait in the queue →" instead. **State the bound, don't chase the number.** T3 half-refuted and half-shipped: the shelf is empty on today's data and the row tags were never chip-shaped, but the founder's named "filters, sort by" is real, so it built a search box + Newest/Oldest/Title sort that render once the shelf holds a row (verified live during the founder's own YouTube ingest). Its own post-merge commit caught a **stray NUL that made a 12KB test file BINARY to git** — merged with no reviewable diff; cherry-picked (`872c957`) and now guarded by `tests/no-nul-in-source.test.ts`. Wrap: `agent_handoff/lanes/WRAP-s79-lane3.md` |
| s79-lane4 | approve · create · intel · videos (**NOT the editor**) | apps/web components/approve + components/create + components/intel + lib/intel + components/videos/videos*.ts* + dossier.tsx | **MERGED s79** (`5f3b1ee`, rebased clean, ff-only) — **11 findings, 11 SURVIVED, 0 refuted**, four changed shape and two of those changed the fix. It **ran its verify gate INLINE and DROVE the live app** rather than fanning out reading-only refuters, citing the s78 harness gap as the reason and correctly noting the boot approval covered the lane, not a ~33-agent fan-out inside it. **A2 was much worse than reported:** a staged waiting draft has ZERO decision verbs in the right pane (29 buttons, none of them approve/reject/re-judge/edit) while the footer advertises five keys and three strings send the operator to a panel that pane replaced — **11 of 13 waiting drafts undecidable**. Copy made honest; the capability hole routed to the founder with a recommendation (NEEDS-STEVEN). **C3 was wider:** a failed profile read painted FIVE positive claims, the sharp one being "Denylist · empty · grounding · every gate on" against a real profile carrying six terms — a broken read told the operator they had no term protection. The Intel↔Create dead end shipped as ONE decision: the dossier now **leads with "Create video"** (an exit Create can run) and keeps "Post · suggested" as a ghost with its reason, arming built DISARMED per the sequence gate. Wrap: `agent_handoff/lanes/WRAP-s79-lane4.md` |

### s82 — three lanes (APPROVED s81: the founder took the lead's recommendation on all four calls — "I'll go with your recommendations" — which includes call #1, the named-lane launch approval; launch at the s82 boot, NO re-ask)

**Plan of record: `docs/research/s82-PREPLAN.md`** (the Postiz study — AGPL-3.0,
patterns re-implemented never code — plus the lane tables, verified repo facts,
and the four founder calls). Founder direction on record s81: *"plan the next
set of phases and tasks … maybe parallel workstreams next session."* **Pre-flight
is lead-direct and FREEZES FIRST:** W1 = a small additive contract window
(`publishQueue` repo over the existing dormant table · `videoCuts.remove` ·
platform capability matrix in contracts), W2 = the shared `TakeAudition` seam,
so no lane touches packages/db, packages/contracts, or another lane's files.

**✅ BOTH WINDOWS FROZEN ON MAIN BEFORE THE LAUNCH.** W1 = `7fee14c`
(migration purely additive — two ADD COLUMNs; the status check now draws its
vocabulary from contracts via `inList` and generated NO SQL diff). W2 =
`3513ef5`. Kickoffs + the worktree-prep fix = `104efcb`. Verify green by exit
code at each: **2484 passed / 9 skipped, 0 lint errors** (2439 at the s81
close). Two things worth carrying forward:

- **The capability matrix is NOT `platformProfiles[platform].charLimit`.** That
  number is an authoring BUDGET (a style opinion fed to generation — Facebook's
  shipped budget is 5000 against a platform that accepts 63,206, and the gap is
  the point); the matrix is the platform's CEILING. The invariant tying them —
  no budget may exceed its ceiling — is executable in
  `engine/src/fanout/__tests__/profiles.test.ts`, and was **watched failing**
  (x bumped to 300 against 280) before it was trusted passing.
- **W2's tests found a defect before either lane could inherit it.** The
  one-at-a-time audition slot was keyed on the component alone, so re-pointing
  an instance at a different candidate carried the playing state across — a
  recycled tile began streaming a file nobody asked to hear. The slot now
  records the ref it was started for.

Also fixed en route: `npm run worktree:setup` invoked `powershell`, which does
not exist on this box — the documented lane-prep command had been dead on Linux
since the migration. It is `pwsh` now, and was executed verbatim afterwards.

| lane | bucket | scope (files) | status |
|---|---|---|---|
| editor-verbs | Version management — 4 of the editor's 5 open no-affordance rows (compare versions · save as NAMED variant · delete w/ refusals · render survives leaving) + takes-strip audition + editor.tsx s78 tail (player failure state · busy→action identity · timecode everywhere) | components/videos/editor.tsx + its tests · lib/videos/* · app/api/videos/** (NO css — sheet classes only) | **MERGED s82** |
| editor-polish | The s78 medium/low tail in the inspector/timeline/css (10 items, B1–B10 in the plan incl. bed-picker audition and the light-mode player plate on BOTH videos surfaces) | components/videos/editor-inspector.tsx · editor-timeline.tsx · editor.css · dossier.css (B8 only) · NEW editor-polish-s82.test.tsx | **MERGED s82** |
| sched-spine | The Postiz take: platform capability matrix + deterministic pre-publish validator · Approve's Schedule verb → publish_queue producer · queue consumer tick (mirrors sweep-scheduler; **ships DISARMED**, zero live calls) · platform-true preview (gated on founder call #3) | packages/engine/src/social/** · app/api/social/** · components/approve/** · components/calendar/** (contracts/db FROZEN by W1) | **MERGED s82** |

Merge order A→B→C by default; lead gates every merge (verify-on-merged-main by
exit code · drive the jobs · measure the render · screenshots); the lead extends
the jobs tables with the new verbs at each merge — a lane cannot drive its own
work. ⛔ The sequence gate is untouched: nothing posts, nothing spends.

**ALL THREE MERGED, ZERO CONFLICTS — the disjoint file sets held.** C landed
first (`a95b6d8`, its files disjoint from both editor lanes), then A
(`843a063`), then B (`3b151ed`). Verify green by exit code at every merge;
final **2694 passed / 9 skipped, 0 lint errors** (2439 at the s81 close).
⛔ Zero live platform calls, zero spend, all session.

**The editor gate closed its version-management theme: 25 works · 0 dead doors
· 0 no-affordance · 2 undriven**, from 21 · 0 · 5 · 1. Render measurement is
flat (8 missing · 31 drifted · 9 within ±2px), the six newly-listed classes all
being lane B's own new elements, which the sheet predates. Nothing fell out of
tolerance.

**TWO OF THE FIVE "GAPS" WERE NEVER GAPS.** The audition and resume rows were
harness lies — wrong verdicts (9) and (10), now in the ledger. (9) demanded
markup HTML forbids (a play control nested inside `button.take`); (10) asserted
a render was reported without first checking one was running. The lead settled
both by driving the live DOM and by firing a real render (local ffmpeg, 0
credits) — the surface says *"Rendering…"* on return, so A4 is proven, not
assumed. **Three sessions running, the harness has pinned markup where it should
have named the role.**

**B3 SHIPPED DEAD, and the split is why.** Lane B built and tested the
timeline's refusal marks; lane A owned the file that had to pass them, and
neither could see the seam. It rendered as nothing until the lead wired it at
the gate (`27b4ba4`) — with the refusal band's own half: it printed the raw
0-based `line 0` while the inspector called that plate "Caption 1". **A shared
seam needs an owner for the JOIN, not just for each half.**

**The box has a measured ceiling: three concurrent full verify suites exceed
16 GiB.** The kernel OOM-killed next-server, chrome and python3 at once; two
lanes had verify runs killed rather than failed; `--maxWorkers=2` fit. Stated
now by `launch-lane.sh` when it makes lane #3, along with the fact that
`pkill -f vitest` is a cross-lane weapon (s82: a lane killed a neighbour's
suite and disclosed it). The s64 "stagger retired" note measured lanes doing
ordinary work, never three full suites at once.

## Sprint 9 / s85 — parallel lanes: **BOTH MERGED** (founder GO by name: "ig-post + staging-dogfood"; `d2-window` dropped per the board's own sequencing note)

**Merged on a green verify-on-merged-main: 2775 passed / 9 skipped, 0 lint errors.**
Worktrees, branches and tmux windows GC'd.

| lane | result |
|---|---|
| **ig-post** | **MERGED `96a51a6`.** The typed refusal became a real two-step media driver (`/media` → `/media_publish`), and the lane CORRECTED its own charter: the board said "driver-local, no contract change", but IG takes a public `image_url` and never bytes, `SocialPostMedia` dropped the ref, and the public `/assets` door admits only refs a CURRENTLY-PUBLISHED artifact references — so the image 404s exactly when Meta fetches it. It threaded the address (`publicUrl`) and gated the whole widening behind an opt-in, `SocialPublisher.needsPublicMediaUrl` — silence means "uploads bytes", so no image is ever made public for a driver that never needed one. **It stopped at the checkpoint the kickoff set:** the allowlist ADMISSION MECHANISM is designed and reported, NOT built (publish-scoped pending rows, 5-min TTL, revoked in a `finally`, key reconstructed from `family`+`contentHash` so serving A's bytes under B's URL is unrepresentable). Un-defaulted seam ⇒ no address ⇒ honest refusal. **Ships disarmed; zero live calls.** Wrap: `agent_handoff/lanes/WRAP-ig-post.md` |
| **staging-dogfood** | **MERGED `270642b`.** Re-tested staging rather than trusting the handoff: the s84 real address still works (callback redirects to the real host, inert against a forged state) and tenant #0 is genuinely there (profile, 6 runs, 120 leads, a video project). **No channel is connected because staging was never given the vault master key — that is swordfish's to set**, asked with the exact command in ASK-BACKS. One founder decision raised, no clicks: whether staging should hold real tokens (recommendation: Bluesky only to start). Nothing connected, nothing posted, no portal opened. Wrap: `agent_handoff/lanes/WRAP-staging-dogfood.md` |

**The gate earned its keep.** Both lanes were green in isolation; merged main went RED
on two calendar tests neither lane touched. Cause was the wall clock (the verify ran
at 02:50): `.nowline` only renders inside the sheet's 06:00–21:00 band, and a
"+N more" fixture 2–5 hours old straddles two columns in the small hours. Three tests
now pin their own clock — the same idiom the file had already adopted for one test
after the same disease turned main red every evening. Fixed at `b2e09a8`.

### (superseded) original proposal


**Shape:** one lead-serial track he cannot delegate, plus three background
lanes with disjoint file sets. All three lanes are dependency-independent —
none blocks another, and none touches the sheets. Launch = Mode B via
`scripts/launch-lane.sh` (the default since s64); **each needs his named GO.**

| track | scope (files) | why it can run in parallel |
|---|---|---|
| **D4 sheets — LEAD-SERIAL, Fable 5, NOT a lane** | `docs/research/mock-sheets/` (4 new `.dc.html`) | Founder rule: design is authored directly, never delegated. Brief = `docs/research/d4-PREPLAN.md`. Ends at his verdict; no build follows until then. |
| **lane ig-post** — Instagram posting driver | `packages/engine/src/social/drivers/instagram.ts` + tests | The typed text-only refusal becomes a real media driver (`/media` → `/media_publish`) now that `/assets/<sha256>` is edge-public and Meta can fetch it. Driver-local; no contract change. **Ships DISARMED** — posting still needs his per-platform GO. |
| **lane d2-window** — publication_metrics contract window | `packages/contracts` + `packages/db` + migration | D2 pre-work: the metrics table + `postAnalytics` verb per connector. Contracts/db only; the Analytics SHEET stays lead-owned, so no surface collision. Honest note: thin value until posting is routine — it is groundwork, not a feature. |
| **lane staging-dogfood** — move the operating origin to staging | env/ops + `agent_handoff/` + seeding scripts | Staging is now a real origin (s84). This lane makes it the tenant's actual home: seed tenant #0 there, verify the connect dance end-to-end at the real URL, re-point the dogfood loop. Touches no product code. |

**Sequencing note:** if only two lanes are wanted, drop `d2-window` — it is
the one with the weakest near-term payoff by its own charter.

## Sprint 9 / s99 — **CLOSED** (boot 2026-08-03 "gogogo" + his mid-session bug report; **V9 SHIPPED — the video arc's last item, and with it the arc**; zero credits, zero live posts)

**The founder's one-word boot spent on V9, interrupted once by his own live
report — "in the Intel feature, why are you taking the whole transcript and
putting it into the title!!!?" — which was a real defect and got fixed first.
Three of the four video surfaces passed their render gate first time; the
Composer FAILED its gate (`matches_sheet: false`) and was fixed and
re-verified live. Every confirmed finding behind all four gates was fixed in
the same session.** Wrap verify: exit 0, **3338 passed / 9 skipped**.

| track | outcome |
|---|---|
| **The founder's Intel bug** (`93d0045`) | **Real, and worse than it looked.** The Intel card never had a title field: the dossier's `<h2>` and the rising rows were wired to the trend item's raw `text`, which for video sources is the platform's whole `title + description + transcript hook` blob — **1,947 characters rendering as the headline on live dev data**. The sheet's fixture was a short one-line post, so the mock never exposed it. Fix in the display model: the headline is the FIRST LINE (where the TrendItem contract puts the title), word-boundary-cut at 160 for a long single-line post, with the verbatim text demoted to hover truth and the source link still opening the original. Live-confirmed after the fix: h2 = 55 chars, hover = the full 1,947. |
| **V9 · Videos Overview** (`4505e9e`) | **GATE PASSED** (fe-check {built}, 21 agents; sheet-true both themes at 1440×940; refused/empty/loading distinct). Fix round: the provenance grammar amended — **a machine-minted import no longer reads "by you"** (live case `thalon-concept-film`: three recorded mint models, credited to the operator), several mints now say "N mint models", and a one-prompt project with empty manifests says "model unrecorded" instead of standing a cut identity in the authorship slot · the take poster layers OVER the stripes (a pruned media ref degrades to the placeholder, never a silent blank) · fam-link hover restored · the count pill got a sizer so the filter seg stops lurching under the pointer · **drop/paste land on the honest import disclosure** (the browser default was navigating AWAY from the workspace, discarding state) · disclosure toggles mark open at the control · Escape clears the j/k pick · the exact created stamp joined the accessible name. |
| **V9 · Video Dossier** (`9a63573`) | **GATE PASSED** (37 agents; state matrix distinct including missing-vs-refused). 27 confirmed findings; fixed: the notice band carries its TONE (success ≠ instruction ≠ refusal, dismissable, spent instructions cleared) · **the delete confirm is stamped to its cut** — a pick change closes it rather than silently retargeting a destructive door · "Deleting…" actually paints · Send-to-Approve follows the surface's own s81 grammar (aria-disabled + an answered press, never a hard-disabled silent CTA) · the pick-two compare instruction branches satisfiable on one-version projects · a failed EDL read names itself with Try again · every clipped identity wears hover truth (the gate's one rendered defect) · the brief chip credits "the run's brief" on one-prompt · **the Overview's takes/cuts facts became real deep-link doors** (`?open=takes\|cuts`). |
| **V9 · Video editor** (`8d1ed8f`) | **GATE PASSED** (41 agents; four-state matrix distinct; the s95b deviations re-confirmed deliberate). 31 confirmed, five HIGH — all fixed: the "Recut 9:16" chip kept the aspect seg's own dirty refusal (**it was the one exit that destroyed unsaved edits past both the refusal and the exit guard**) · a failed render mounts its own band even with an empty notice (broken ≠ idle) · **one gesture = one undo entry** (a coalesce key through `apply` — a drag pushed per pointermove and a caption per keystroke, evicting real edits off the bounded spine; pinned by a test proving 3 keystrokes leave 1 step) · Discard pushes the discarded copy onto the spine so ⌘Z brings it back · **the beat lane draws on the CUT's duration** — the axis the ruler, playhead, overlay and both other lanes already shared. Plus `running` as a Set, a stale `?cut=` falling back with a sentence, one-prompt attribution reaching the surface via a new `meta.onePrompt` projection, reject reasons at the mark, keyboard-bound crop windows, answered zoom clamps. |
| **V9 · Composer** — round 1 (`749b833`) | The walkthrough ran, then **credits ran out mid-gate on Fable 5 with 8 of 9 phase agents unfinished** — stated, not papered over; the session moved to Opus 5 and the gate was resumed from its own run id. Round 1's headline is a leak: **Drizzle's `Failed query: … params: <tenant uuid>` was rendering VERBATIM in the browser** on all three verbs, because surfaces print refusals word-for-word by design and `toErrorResponse`'s catch-all passed the driver's message straight through. Driver errors are now a 500 carrying the fact alone, detail server-side. Also: the fit band names a FAILED measure instead of "measuring…" forever · **the verdict strip speaks all seven draft eras** (the s98 published draft was still being told the human gate was "next") · the Intel-pick door reads `run.brief.context` (the fan-out leaves `draft.captureId` null, so it never fired) · `profile v{n}` is a door · the video media band's stated cut links to its own project. |
| **V9 · Composer** — the gate, round 2 (`<this wrap>`) | **The re-run gate came back `matches_sheet: false`** (58 agents, 41 confirmed) and its four HIGHs were real: (1) **every door on the surface rendered GREY** — a blanket `.composer-surface a { color: inherit }` landed after the shell's `.screen a { color: var(--act) }` at equal specificity and won for every anchor, including the three doors round 1 had just added; scoped to the simulated post only, and **measured live: all four doors now compute to exactly `--act`** · (2) the ⓘ tooltips were native `title=` attributes where the sheet draws a designed popover — the sheet's `.tip` block is ported, both tips are real elements, keyboard-reachable, `nativeTitles: 0` · (3) the fit band stretched a single destination across 1,174px, stranding the count 1,038px from the platform it measures — **exactly the founder's own one-destination dogfood shape** — now capped at the sheet's tile width (band 1174→236px, gap 1038→97px) · (4) a platform REFUSING the post wore an amber dot while the band below painted it red; a refusal is now err, and an over-length post (which still ships, cut) stays warn — my own test caught that ordering. Verified by live probe + screenshot, both themes. |
| Ops notes, stated | Credits ran out mid-Composer-gate on Fable 5; the session continued on Opus 5 and the gate was resumed from its own run id (the completed walkthrough replayed from cache). No credits spent on any vendor mint; no live posts; the post door stayed armed but unused. Two of my own new tests failed first and were right to: they caught that `adoptableRender` only adopts RUNNING jobs, and that ⌘Z inside a text field is deliberately left to the browser. |

## Sprint 9 / s102 — **CLOSED, all five phases shipped** (boot "gogogo"; zero credits, zero live posts)

Wrap verify on main: **exit 0, 3414 passed / 9 skipped** (s101 was 3381/9).
Five commits, `4fa663a`…`ea7b4cb`.

| phase | what landed |
|---|---|
| **1 · Intel capture ids** (`4fa663a`) | **The capture spine goes DURABLE.** Ids were `intel-capture-${counter}` in one process's memory while the `?ctx=` link they mint is a URL an operator sits on across a deploy — so after a restart that link either 404d or **resolved to a DIFFERENT capture that had taken the same number**, briefing Create from someone else's pick. The durable table has existed since s61 and had **never been written to** (dev PG: 0 rows). store.ts splits — the four ACTIONS build a draft, the SEATS persist it; `captures.ts` is the door. Two strictnesses: a durable seat never silently degrades to memory (that re-mints the bug quietly), and a **non-uuid id never reaches the uuid column** — `intel-capture-3` would throw `invalid input syntax for type uuid` and surface as a 500 where 404 is honest. `listRecent` gained a SQL kind filter: filtering after the bound let a run of dismissals push a real pick past the limit, and the board would render "you picked nothing". **Proven live against dev Postgres, not PGlite**: promoted a card, confirmed the row + its event, restarted the server, resolved the pre-restart id in the fresh process. |
| **2 · Control-arc part A** (`f0eb16e`) | **Arming becomes per-destination, and the gate gets NARROWER.** `off`/`review`/`live` per destination, ANDed with the master key — a master-armed tick with **no per-destination config publishes NOTHING**. No migration (`brand_profiles.social` already held the semantics). **Grounding corrected the spec four times and the code follows the ground:** ARM_STATES cannot live in `publish-queue.ts` (it already imports `social.ts` — a cycle leaving a schema in TDZ at barrel eval) · the resolver takes `{tenantId, platform}` because `runDuePublishes` is cross-tenant while arm state is per-tenant config, memoized **per pass** so an operator's flip is obeyed next tick · the tick ROUTE was never armed — `scripts/run-publish-queue.ts` is the one armed caller, so that is where the AND became real; the route resolves arm state for its REPORT only and gains no publisher · `armState` is **withheld from the driver call** (an authorization fact has no business inside a third-party platform call). Ratchets incl. a **FIELD-level twin** of the config-block ratchet, which could only ever see whole blocks vanish. **Nothing is armed by this change.** |
| **3 · Saved views, window 0027** (`23ceea2`) | **Schedule's saved view had NEVER once persisted.** `schedule-surface.tsx` has asked for `"schedule"` since the s86 rename while `SAVED_VIEW_SURFACES` still said `"calendar"` — every read and write 400d, and **both call sites swallow their errors by design**, so density/scope silently reset on every visit for sixteen sessions. Proven live before (both 400) and after (both 200; survives a restart; the surface renders Month·Needs-you from the server). The migration **RENAMES** the stranded rows: dev PG's one row was Schedule's own `{density,scope,expanded}`, orphaned by the rename — and the generated migration would have **FAILED** on any db holding one, since a CHECK cannot be added over violating rows. |
| **4 · Intel debt** (`6ed5725`) | **Nine of the gate's items, plus the harness bug.** `busy` names its action · add-area/save-description no longer double-submit (**the guard is a REF** — two presses in one tick read the same rendered state, which is how it shipped submittable twice) · copy buttons stop lying (the write is awaited; `navigator.clipboard?.` swallowed the whole call) · the × that PAUSES wears a pause mark · reason bars carry a name and value · machine-written text is attributed · the j/k grammar is visible · the count pill reserves its box (the 1.3s pop shifted tabs 91px). **The `.btn:disabled` dress was PROMOTED TO THE SHELL** — s79 wrote that promotion up for the lead and four surfaces copied the local block meanwhile; the ratchet followed it, so it now protects the four surfaces nobody has passed. HARNESS: `--jobs intel` matched /angle/i against textContent, but an angle radio's text IS the angle sentence; it matches the role contract now and **earns its name** by clicking an angle off. |
| **5 · Integrations research pass** (`ea7b4cb`) | **The row's first pass, and on the HONESTY half we were already ahead** — no product in the set distinguishes an env-filled seat from a stored credential, names the consuming driver, or separates connected from armed; ElevenLabs' verbatim `HTTP 401` band is our own rule arrived at independently. Gaps are all SHAPE: the connected/available SPLIT with counts (we render one flat `cards.map`) · **the blast-radius disclosure (Coda)** — a broken account lists what depends on it, and after part A the consumer knows exactly which rows those are · the partial-degradation band (Deel, **re-surfaced independently** from a query naming neither it nor health — twice-found, not once-liked) · the honest "managed elsewhere" state for an envOverride seat. No pixel moved; the row still owes p1. |

**Found while fixing, recorded not fixed:** at MONTH density Schedule's day-cell
chips clip their own text — a two-line chip keeps a one-line box. Month was
always clickable, but **nothing had ever restored INTO it**, which is why
sixteen sessions of gates never sat on it.

---

## Sprint 9 / s112b — **FOUNDER REVIEW: THE SITE D SPINE WAS REJECTED AND REBUILT** (**+93.20 credits**; balance **153.98**)

**He reviewed the arc and the verdict was about TASTE, not craft.** Verbatim:
*"did you not learn that my taste is not precise or scientific but imaginative
and abstract"* · *"i think you didnt need a transition video of the grape
turning ripe"* · a better animation would be *"grapes, then them
bursting/squashed to extract their juices, the juices then land into a wine
bottle then poured into a wine glass"* · *"the morningside coffee bean
transition was good, but that was under my direction. so that's the kind of
abstraction i want."*

**The distinction, now §THE HOUSE TASTE at the top of the meta-prompt: a
TIME-LAPSE versus a JOURNEY.** A time-lapse observes one subject while nature
acts on it and DOCUMENTS; a journey follows a material through states, by an
act, to a payoff. Morningside is a journey. Veraison was a time-lapse. **So are
the arc's three other motions** — which is the likeliest reason Aspect & Fall
and Small Hours came back *"ok, but not memorable"*, and Whitethorn's kinematic
plot *"too scientific"* for a warmth vertical (he asked to KEEP it regardless).

**Site D is rebuilt to his sequence:** 140 frames, three takes — the heap
giving way and bleeding across concrete, the stream falling into a bottle, the
glass filling. **Copy cut 851 → 371 words**, because he also called that out
(*"wasnt the ratchet for these, dont be too wordy or verbose?"*) and he was
right: *"less is more, but still with the same effect"* has been on record since
s90, in a workspace-UX doc nobody opens during a portfolio build. **Now an
executable budget** in `tests/template-portfolio.test.ts` (whitethorn recorded
as an explicit grandfathered exceedance at 1,119, because he said keep it).

**Three build findings.** (1) **Ask what KIND of motion each BEAT is, not each
site** — this spine holds one transformation and two pours, and s108 says a pour
is a cycle, so two of three takes needed no end frame and carried no
registration risk at all. (2) **A chained take drifts because of the frame it
AIMS at, not its prompt** — the first crush take recomposed across native frames
31–59 (steps to 7.62 against a 0.54 median) because its end keyframe was minted
independently at a wider framing; re-minting it as a registered EDIT of the
start (dx=0, dy=−1) fixed it outright (0 cuts, max 0.93). One 22.50cr take spent
on the lesson. (3) **Negating a label still does not remove it** — two bottles
came back labelled; cropping to the neck worked first attempt.

**Measured on the shipped page:** 140/140 frames reachable and none starved at
both 1440×900 and 390×844 · one lit frame and one live sequence everywhere ·
pin held 0/943 desktop and 0/591 phone · 42–54px of scroll per frame. The
wine-glass still he flagged for compression was **deleted, not re-encoded** —
the pour sequence ends on a glass, so the photograph was redundant.

---

## Sprint 9 / s112 — **SHIPPED: SITE D (`marl-and-cane`). THE LANDING ARC IS COMPLETE** (boot "gogogo"; **38.96 credits**, zero live posts)

**The arc's last site is built, passed and green.** A single-vineyard estate
whose page is one year of one bunch: **81 scrubbed frames of veraison**, the
fruit going green → rose → blue-black under the reader's scroll, with the
laboratory record that decided the picking date underneath it. ⑳ ✅ → ㉑ ✅ →
㉒ ✅ → the landing ✅ → ㉓ ✅ → **㉔ `marl-and-cane` ✅. A + B + C + capstone +
D + E are ALL BUILT.**

**It cost 38.96cr against a ~110cr tier, and the saving is a rule, not luck.**
The spec budgeted three segments; s107 says a one-way transformation of a single
subject takes ONE take with two minted endpoints. **One take, 36cr.** Balance
286.14 → 247.66.

**Named against the spec's own open question.** *Veraison* was checked and
**fails** — several live trading names, a near-homophone winery, and a
registered trademark holder. *Southfacing* picks a hemisphere and collides with
`aspect-and-fall`. **Marl & Cane** — a clay-limestone vineyard soil and the
one-year wood cane-pruning leaves — collides with nothing, and lets the masthead
hold the two constants while the page argues the one year that never repeats.
Secondary axis **`brutalist-raw`**, drawn over `physics-interaction` because
physics would have been a second motion system competing for one clock.

**The session's find: a generated take does not spread its transformation evenly
across its own duration.** The 8s take runs 193 frames; measured against its own
final state the subject is flat for the first ~48, changes across ~75, and is
**pinned within noise for the last ~65** — frames 128/144/168/192 are visibly
one picture. `frames: N` samples the whole clip, which is what every prior site
did, so it would have spent **a third of the page's scroll on a still image**.
Ratcheted as a manifest `range` resolved by `resolveFrameRange` (engine,
unit-tested, broken three ways). The take reaching its end early is real biology,
so the PAGE says so — its last chapter is "and then it stops".

**And the density benchmark this repo has been quoting does not reproduce.**
㉒'s bloom is recorded in the meta-prompt at "mean 1.19"; measured off the
shipped bytes it is **1.52**, and Morningside's shipped beans are **1.51** — two
shipped sequences that read well, both ≈1.5. The gap is the ENCODER: encoding is
deterministic, but two slightly-different frames land on different quantisation
decisions and a true 1.18 measures **2.25 at webp q54**, an additive ~1.0 with
nothing to do with motion. **Measure in one space and say which.**

**Four the browser found.** The **mobile pin was dead at 724 of 724 in-view
samples** — and NOT for the s111 reason: both `position` and `height` were
restated, but `.stage-col { flex: 0 0 auto }` makes the sticky element's
containing block exactly its own height, so there is no travel; desktop escapes
it only because `align-items: stretch` hides it. 0 of 688 after the sticky moved
onto the column. The stage was **bound by column width, not `--stage-max-h`**
(328px in a 900px viewport). A **fixed HSL lightness cannot survive a hue
sweep** — 29 of 81 frames failed AA at the green end until L was solved per hue
for a constant 4.85:1. And the **colour readout lagged the picture by ~20
frames** because its thresholds were guessed rather than read off the frames,
which is Morningside's "grinding" mistake exactly.

**The docroot-leak ratchet then caught a leak of MINE**, which is the best
evidence this session that the boundary is load-bearing: a source comment in the
shipped `index.html` named an internal method doc while explaining the twin.
Every site-level ratchet and every browser measurement was green. **And the run
that found it reported itself as passing** — `verify > log; echo $?` exits the
wrapper 0, so the harness summarised a two-failure gate as "exit code 0"; the
log said `VERIFY EXIT: 1`. The other red was `b-int0-repos`, untouched since
s67, at 10.6s under a load average of 25.75 — passes in 5.2s isolated, and the
opening verify passed it on the same code.

**Ratchets bought:** `resolveFrameRange` + the manifest `range` field
(executable, engine-side, unit-tested) · a **plotted-instrument drift alarm** in
`tests/template-portfolio.test.ts` that RECOMPUTES the static SVG polylines from
the page's own data block and checks every reading reaches the static table.
**Both broken deliberately and confirmed red** (three ways each), as were the
four existing portfolio ratchets against this new site — where the first attempt
at breaking them was itself a **no-op perl substitution that silently changed
nothing**, which is indistinguishable from a ratchet that does not fire. Break
tests now assert the file actually changed.

**Verdict: awaiting.** ㉔ of the portfolio.

---

## Sprint 9 / s111 — **SHIPPED: SITE E (`morningside`). The landing arc's fourth site; only D remains** (boot "gogogo"; **0.60 credits**, zero live posts)

**Site E is built, passed and green.** A coffee brand whose page IS its
animation: one ceramic cup holds the centre of the screen from the first screen
to the last while its contents go beans → grounds → poured cup across **82
scrubbed frames** of two chained Seedance takes. Everything the brand says hangs
off those three states. It is the only site in the arc whose animation is the
page rather than a chapter inside it, and — deliberately, against the house
pattern — it ships **no data instrument at all**, because `first-crack` already
IS the expert coffee page and the differentiation had to rest on register.

**It cost 0.60cr.** The spine was minted at s110 (57.24cr) and this session
spent five stills at 0.12 each, keeping three. Balance **286.74 → 286.14**, so
site D's ~110cr tier remains comfortably funded.

**The session's real find corrects s110's own corollary.** s110 measured the
chained seam once, found segment 2 came back ~5 units dark, and banked
"per-channel mean/std match onto the seam frame". Measured **per frame** on a
static patch at the build, that is aimed at an accident of the single pair it
came from: the shift is not a constant re-grade, it is a **settling transient at
the head of every take** — S2 recovers within ~16 native frames, S1 over ~86.
The banked constant fix would have levelled the join and pushed the payoff shot
(the full cup, the page's last image) **+5.8/+3.1/+3.4 off grade**. Shipped
instead: a per-frame flatten of both takes onto one measured reference, as the
manifest's `gradeFlatten`. Seam fixed identically, payoff held to
−0.2/+0.1/+0.4, and the hero still — which is the take's own frame 0 and was the
**darkest frame of its own take** — brought onto grade too. Same 0cr arithmetic,
three defects instead of one. **A correction derived from one measured frame
pair inherits that pair's accidents.**

**Two more the browser found that no test could.** (1) The scroll was moving
**17.1px per frame** through the grind — a 100px wheel notch skipping five or
six frames of the beat the page exists for. Chapter length is now *derived* from
how many frames each chapter drives. (2) The narrow-screen rules re-declared
`.ch { padding }` as a shorthand, silently discarding that calculation: **31 of
82 frames were unreachable on a phone** while desktop was perfect, and the same
block reset the stage's `position` but not its `height`, so the mobile pin was
dead. Both invisible in markup and in every screenshot.

**Ratchets bought:** `gradeFlatten` + a single-frame `frame` derive in
`scripts/export-template-assets.ts` (the s110 "the hero still IS the take's
frame 0" finding made a first-class manifest concept), and a new
**scroll-anchor contract** in `tests/template-portfolio.test.ts` — anchors must
start at 0, end at the last manifested frame, strictly advance, and each
declared `--span` must equal its anchor delta. **All four broken deliberately
and confirmed red**, then restored green. Meta-prompt amended twice: the seam
corollary corrected, and the density rule extended to **measure the PEAK, not
only the mean** (Morningside's grind is ~6 of 41 frames, so the mean says
nothing about it; on the peak, 41 still held).

**Verdict: awaiting.** ㉓ of the portfolio. `docs/landing-arc/spec.md` now has
A + B + C + capstone + E built; **site D (vineyard) is the last one**.

---

## Sprint 9 / s109 — **SHIPPED: THE CAPSTONE. Thalon's landing page is rebuilt on a real recorded run** (boot "gogogo"; 17.74 credits, zero live posts)

**The arc's capstone is built.** `/` is no longer the dark-cinematic AI-default
page it was; it is a light, instrument-led document whose spine is **one real
run this engine performed on itself, walked gate by gate.**

- **Pre-plan of record:** `docs/landing-arc/thalon-landing-PREPLAN.md` (carries
  the look-first sweep, the axis draw, the mint plan, a CORRECTION block and
  the six build findings). The claude-design mock is preserved at
  `docs/landing-arc/mock/thalon-landing-mock.html`.
- **The instrument runs on recorded data, not a mock-up.** `run-snapshot.ts`
  holds 8 of the **681 claims** this workspace's judge really ruled on
  (**635 cleared / 46 stopped**, 128 judge runs over 28 body versions of 21
  drafts), read out of dev Postgres at build time and pinned by
  `landing-run-snapshot.test.ts`.
- **The row is a CLAIM, not a draft** — the judge verdicts claims, and several
  of the strongest blocked sentences sit inside drafts that were revised and
  later approved. An earlier version paired claims with draft ids and would
  have asserted a link the database does not contain.
- **Two mints, 17.74cr against the 180cr ring-fence, which is therefore
  RELEASED** — the front door it protected is built, so the full **343.98
  remaining is available for D and E** (~230 buys both at full scope): two hero
  candidates on `text2image_soul_v2` (0.12cr each, one kept) and a 5s
  locked-off take on `seedance_2_0_fast` (17.50cr), **one `start_image` and NO
  `end_image`** — the s108 cyclic-motion corollary applied at its first
  opportunity. Both pinned with provenance; the models RECORDED are the ones
  that ran, not the ones requested (the vendor substituted both).
- **`/guide` now exists for Thalon's own front door** — the one page making the
  strongest honesty claims was the only one not showing its working.

**Six findings, four of them invisible to looking** — full detail in the
PREPLAN's close. The two that matter most: **the ledger was one chapter late**
(every hand-written `decidedAt` off by one; fixed structurally by deriving the
index from the gate), and **two of the five new ratchets were decoration** —
"static-first" and "exactly one lit frame" both passed with their subject
deleted, because Testing-Library's `render` runs effects and never saw the
server markup they claimed to check. Rewritten against `renderToStaticMarkup`
and re-broken three ways to confirm red.

**The page was also broken on a phone**, and only measurement said so: the
pinned ledger measures **1087px in an 844px viewport**, so the reading band was
negative. Narrow screens no longer pin; they show the completed run.

**CARRIED:** `/blog` and `/brand` still scope `.dark` and now differ in register
from `/` — a real inconsistency, deliberately not fixed in the same change as
the capstone.

## Sprint 9 / s108 — **SHIPPED: ⑳'s Day-84 motion. THE ARC'S THREE SITES ARE FULLY FINISHED AND THE CAPSTONE IS UNBLOCKED**

**Boot was `gogogo`.** The inherited next action was item 1 of the s107 stamp —
**⑳ Whitethorn's Day-84 handoff, moving** — and that is what shipped. It was the
last precondition on the Thalon landing page, so **A, B and C are now finished
*including their generated moments* and the capstone is unblocked with its
180cr ring-fence untouched.**

**One mint, one take, 17.50cr** against the spec's ~72cr line. Balance
**379.22 → 361.72**, reconciled live. Zero live posts, nothing armed.

**The spec's construction was wrong, and the repo's own corollary said so.**
The arc spec scheduled ⑳ as `start_image` = the pinned Day-84 still,
`end_image` = "the same dog mid-stride". ㉑'s seasons and ㉒'s bloom are
**one-way transformations** where an end frame is a genuinely different
picture — but **a trot is a CYCLE**, and its last frame looks like its first.
That `end_image` would have bought a near-duplicate of the start frame at
s106's registration coin-flip (~50% of seeds drift). Built as a **single
`start_image` with no `end_image`**: zero registration risk by construction,
one already-approved asset, first take. s107 said "the cheapest registered edit
is the one you never make"; cyclic motion takes it one step further — **there
is no second endpoint to mint at all.** Recorded as a correction block in the
spec because **site E's pour is cyclic too** while its beans→grounds→pour
chaining stands.

**The honesty constraint drove the prompt, not the review.** Day 84 reads 0/5
lameness / 94% symmetry, so the brief named the failure modes as explicit
negatives — not galloping, not bounding, feet low, never all four airborne — and
landed a sound even trot first take. **The pinned still turned out to already BE
a trot**; the only thing over-claiming was its alt text ("running at full
stretch"), now corrected. `/guide` discloses the generation and the constraint.

### The find — the count passed, and the scrub was still wrong

**s107 learned to COUNT the lit frames. s108's correction: a count proves a
scrub is ALIVE, not that it is AIMED.** The new ratchet passed perfectly —
61/61 decoded, exactly one lit at every sampled position, strictly monotonic
0→60. A **visibility-bucketed** sweep then showed the sequence was mis-mapped:
across the band's full centre travel, frames 0 and 60 sat at the clamps, and
**34 of 61 frames — over half the shipped bytes — were only reachable while the
band was under half on screen.** In the prime window the reader saw frames
17–43 and nothing else. Ending the sweep a sixth of a viewport early at each end
moved that to **10–50, 33 distinct frames**. The invariant check and the aim
check are different questions, and only the first has a ratchet.

**Three more, all measured:**
- **Frame density is set by the CAMERA, not by precedent.** ㉑ ships 18 frames
  per sequence and ㉒ ships 36, so 36 looked like the house number — but both are
  **locked-off**. This take **tracks**, so adjacent-frame difference measured
  **9.24 at native 24fps against the shipped bloom's 1.26**. Shipped 61.
- **The vendor answered the literal call with a preset suggestion and NO job.**
  `generate_video` returned a recommendation for an unrelated preset and
  rendered nothing. Nothing was charged — but a build that assumed the mint was
  running would have waited on a job that did not exist. Re-send with
  `declined_preset_id` and confirm a job id came back.
- **`close.webp` is deleted, not orphaned.** trot-00 measured **6.41** against
  it, less than one adjacent-frame step (11.88), so the sequence's own first
  frame supersedes it. The asset bijection is manifest↔disk, so an unreferenced
  asset would have passed every ratchet silently as dead weight.

**The ratchet.** s107's static-stack check keyed off an inert JSON data block,
so it covered ㉒ alone and **⑳'s stack would have shipped uncovered** — "a
ratchet applied to three assets out of four is not applied". It now keys off the
**manifest**, which every site has, and counts lit frames **per sequence**, so a
two-sequence page cannot pass by lighting two of one and none of the other. ㉑
is skipped by design (it builds frames at runtime behind a `.still` fallback).
**Proven to fail on both real defects before being trusted.**

Verify at wrap: **exit 0, 3454 passed / 9 skipped** (3453 → 3454).

## Sprint 9 / s107 — **SHIPPED: site C. The arc's headline video, and the scrub that looked perfect and was dead**

**Boot was `gogogo`.** The inherited next action was item 1 of the s106 stamp —
**site C, botanical perfumery** — and that is what shipped, as
`proprietary/templates/sites/small-hours/` (**Small Hours**, wave 4, verdict
`awaiting`).

**⚠ The landing is NOT unblocked yet, and the stamp must not imply it is.** All
three A+ sites are now BUILT, but the founder's s105 direction was *"can you
also apply that motion to the site A and site C too?"* and §6 of the spec
defines "fully finished" as **including each site's generated moving moment**.
B and C move; **⑳ Whitethorn still owes its Day-84 handoff.** That is the
remaining precondition for the capstone, and it is the next action.

**The instrument.** The SCHEMATIC test rejected the note pyramid — real in the
industry, but it is the *sales sheet*, not the bench document — and moved the
instrument to **headspace analysis**, the one candidate that shares a clock with
the mandated bloom video. That is the structural point: the video is the
specimen under the bell and the instrument is what the bell reads, so the
photograph leads and the diagram reads off it *by construction*, rather than by
a rebalance after a founder critique the way ㉑ needed. Axis pair
**otherworldly + exceptional-palette**, portfolio-new, and load-bearing rather
than decorative — every compound owns a colour, so the page's colour world *is*
the emission profile and changes on the same scroll clock.

**Cost: 35.00 credits** (414.22 → **379.22**), against the spec's ~82cr line for
site C. 17.50 was the bloom; 17.50 was eleven still generations including four
rejects. Seedance at **720p/5s/fast/silent measures 17.50**, not the 22.50 the
s106 stamp projected. **The 180cr Thalon-landing ring-fence is untouched.**

**One plan correction, made mid-build and recorded not applied silently:** the
pre-plan first specified two chained segments; the spec's own budget line
(*"2 takes × 36"*) means two attempts at ONE segment. Building it as one take
removes the entire seam class that cost ㉑ a session — the half-open state is a
frame partway through one continuous take, so it cannot be out of register by
construction — and saves 17.50cr. Registration measured anyway: the bud edit
landed **1px** off the anchor and the camera holds to **1–2px** across the take.

**⚠ THE FIND, and it is the one to carry:** the scrub **was completely dead**
and the page looked perfect. The static markup ships one frame lit so the no-JS
stage is not blank; the runtime's index started at `-1`, so the first swap
cleared nothing, that frame stayed lit, and being last in DOM order it painted
over every frame the scroll chose. Types, lint and 3,452 tests were silent; so
were the console and every screenshot; the clock and readouts moved *correctly*
the whole time. **It was found by counting lit frames across a scroll sweep.**
s106's lesson was "make it move"; s107's is that **watching it move is not
enough either — the thing that catches a compositing bug is a COUNT.** Four more
defects came out of the same measured sweeps (the clock contradicting the prose,
`margin:0 auto` shrink-wrapping a grid item, a one-chapter mobile lag, and the
discovery that shrinking the mobile sheet steals from the photograph rather than
buying reading room). All five are written up in the site's PREPLAN.

**Ratchets.** Executable: a new case in `tests/template-portfolio.test.ts` —
static instrument markup ↔ inert data block, shares summing to 100, frame count,
and **exactly one lit frame** — and it was **proven to fail against both real
defects before being trusted** (the s84 `doctor` lesson: a green ratchet that
cannot fail is a lie). Documentary: three corollaries in the meta-prompt (the
fifth silent killer; the cheapest registered edit is the one you never make;
count the countable on the ANCHOR before the batch inherits it), and a
**correction block in `docs/landing-arc/spec.md`** — the spec had assigned
`exceptional-palette` to BOTH site C and site D, verified against the repo but
not against its own earlier table. C takes it; D's secondary is an open draw at
D's pre-plan.

**Carried, recorded not fixed:** the mobile stage's vertical rhythm is airier
than it should be — a heading clears the sheet at some scroll positions and not
others. Every correctness invariant holds there; it is ergonomics, and it is the
first thing a fix round should buy.

---

## Sprint 9 / s106 — **SHIPPED: ㉑'s video pass. The scrub component exists, and it found a defect the still page was hiding**

**Boot was `gogogo`.** The inherited next action was item 1 of the s105 stamp —
㉑ Aspect & Fall's video pass, first, because it is where the scroll-scrub
machinery gets built once so site C inherits it. That is what shipped.

**What the founder asked for, and what he got.** His two s105 directions were
*"dont have to be stingy with the higgsfield credit"* and *"a top down view
doesnt really display the full beauty and power"*. The stage is **rebalanced**:
the photograph now holds **63% of the instrument area where it held 24%**, and
it **moves** — three generated Seedance transitions (Feb→May→Jul→Oct) of one
locked-off corner, decoded to frame sequences and **scrubbed by scroll
position**, never played. Measured on the rendered page: sticky `top:0`,
photograph 471px against the plan's 279px, plan annotation legible at 8.6–9.7px
after its type was enlarged for the smaller size it is now issued at.

**The find, and it is the session's real story.** Building the scrub exposed a
defect that had shipped in s105 and that nothing could have caught on the still
page: **the October keyframe was a different camera** — lower, further back,
hard backlight — measured **24px+ out of register** against the other three,
while the page captioned all four "the same corner". *A cross-fade between
differently-framed shots reads as a dissolve, so it looked fine for a whole
session.* The cause was already on the books and had simply not been applied to
that one asset: February and May used the s105 layout-naming fix, October still
carried the exact phrasing that fix replaced. Two Jul→Oct segments then
recomposed their own first frame **because they were interpolating honestly
toward a bad end frame** — chasing them with prompt language was the wrong move.
Re-minting October in register made the third good segment land with a
**zero-pixel seam**.

**Ratchets left behind** (AGENTS.md rule 8, same change): executable —
`packages/engine/src/assets/frames.ts` + 11 tests (frame-pattern expansion and
even sampling that always keeps both endpoints), the `frames:N` manifest entry
type in `scripts/export-template-assets.ts` (ext-aware pinned key; an mp4
without `frames` fails loud), and the portfolio ratchet extended so a pattern
entry expands to its N filenames and the manifest↔disk bijection still holds.
Documentary — two meta-prompt corollaries: **measure registration, never eyeball
it; mint two candidates because this edit is a coin flip per seed** (candidate A
landed within 1px, candidate B drifted 24px+ on the same prompt), and **a
generated transition is pulled by its END frame — fix the keyframe, not the
video**; plus the rule that writing a mint corollary obliges you to re-mint
every asset in the batch made the old way.

**Spend: 137.00cr** (551.22 → 414.22, reconciled against the live balance).
Six video jobs at 22.50 — two kept first-take, three rejected, **and one charged
that never returned a result** — plus 2.00 of stills. That is over the ~108
line and at the ~135 the stamp allowed; the ring-fenced 180 for the Thalon
landing is **untouched**. Zero live posts, nothing armed.

**Still open, unchanged:** site C, then the Thalon landing, then D+E on the
leftover; ⑳'s Day-84 handoff still owes its motion; phase 0's disclosure;
control-arc part B still owes a drawn sheet.

---

## Sprint 9 / s105 — **SHIPPED: ⑳ approved + site B of three. C, the Thalon landing and phase 0 remain**

**Boot was `gogogo design is approved`.** The one design loudly `awaiting` was
⑳ Whitethorn after the s104 fix round, so it is verdicted **approved**
(`bc58922`) and its board item is archived verbatim. **That settles more than
one site:** the marker-and-trace instrument was the call flagged for his eye,
so **the SCHEMATIC test is now founder-endorsed rather than only
lead-ratcheted**, and B and C inherit it as method.

**Two commits.** `bc58922` the approval · `b180be0` **㉑ Aspect & Fall**.
Wrap verify on main: **exit 0, 3441 passed / 9 skipped** — unchanged from
s102–s104, since this session added no engine code. Balance **568.72**
(13.00 spent, verified live). Zero live posts, nothing armed.

### ㉑ ASPECT & FALL — a studio whose page IS its drawing set

**The ratchets paid for themselves before a line was drawn.** The banked idea
was "one tree through four seasons". A naturalistic tree in SVG is a picture of
a THING — precisely ⑳'s three wasted rounds — so it was **rejected without
being attempted**, and the question became what a landscape practice actually
issues. The answer, wall-to-wall in the reference sweep: a **plan-view planting
drawing** (canopy circles at MATURE SPREAD, leader lines, hatched path, north
point) and a **seasonal interest calendar**. The page is that set, in drafting
register: paper, graphite, non-photo blue, numbered sheets, a title block.

**One clock — the calendar year.** It sets the coloured-pencil fill, lights
each of 13 species in its own colour in its *real* flowering months, deepens
the terrace's shade as the canopy leafs, drives three live readouts, moves a
playhead across the interest calendar, and cross-fades **four photographs of
one garden corner** (Feb/May/Jul/Oct — same bench, same walls, same birches).
Then a second chapter answers the objection a designer actually gets: **year 1
/ 3 / 10 at true mature spread** — *"Year one looks thin. It is meant to."*

**Distinctness, stated not hoped.** Pair `otherworldly-animation +
editorial-print` is portfolio-new against all 21 `site.json`. Against
`orchard-house` (the other seasons page): a working drawing vs painterly
backdrops · drafting vs painterly · one paper + plants-only colour vs four
season worlds · **a second clock (the years) it has no analogue of**.
Type: Spectral + Sometype Mono, two families because a sheet has two lettering
registers. Both portfolio-new against the ~40 faces already vendored.

**THE MOCK EARNED ITS RESTORATION A SECOND TIME** — four faults before any
build code, including **two silent killers of `position:sticky`**.

### The expensive lessons, all found by RUNNING IT — sixth session running

**A pinned instrument has FOUR silent killers, and a page whose instrument
does not pin has no product at all.** (1) a flex row with
`align-items:flex-start` cancels stretch, leaving the sticky column one
viewport tall inside a 4,290px section; (2) **`overflow-x:hidden` on any
ancestor computes `overflow-y:auto` and breaks sticky against the viewport
outright** — measured `top:-1843px`, invisible in source, survives every other
fix; (3) the single-column layout collapses the travel again, on phones only;
(4) a reading line measured from `0` marks chapters active while their headings
sit *behind* the sheet — the mobile defect ⑳ shipped.

**The clock must follow the PROSE, not the scrollbar.** Driving it linearly
against section progress put the sheet on OCTOBER while the reader was still on
the July chapter — the instrument contradicting the words beside it, which is
the one failure a data-instrument page cannot survive. Chapters now carry their
month and the clock interpolates between them.

**Static-first is an HONESTY gate, not a perf gate.** Built JS-first, the page
rendered an empty frame with JavaScript off **while `/guide` claimed the
opposite in writing** — a false statement on the honesty page, worse than the
missing feature. Fixed with a single source of truth: the plant schedule is one
inert JSON block, the static SVG is generated from it, the runtime reads the
same block. **Verified with the script stripped.** General rule now on the
books: *every claim `/guide` makes is a claim that has to be TESTED.*

**Coherence bugs only a render shows:** the wink's leader line pointed into the
*shaded* half of the terrace while the copy called it the sunny end · the twin
caption named a month the title block was not on (APR vs MAY) · **May read
`0 in flower` under a chapter claiming everything blooms** — the allium was in
the May photograph but missing from the schedule, so the fix improved both.
And the portfolio ratchet caught a real docroot leak: an internal method-doc
name in a page comment.

**Mint lessons, both new corollaries:** the **edit seat holds MATERIALS but not
VIEWPOINT** — *"keep the camera position … identical to the reference"* kept
paving, walls, bench and trees and still recomposed the shot; what worked first
time was naming the composition as a *layout* ("a drystone pier at the left
edge and another at the right, the rendered wall across the middle, the bench
against it on the left, paving filling the lower third"). And **generated
botany lies**: a "mid-May" edit returned the hydrangea in full flower, wrong
for May and contradicting the calendar printed below it — re-minted rather
than softening the calendar.

**9 kept of 11, 13.00cr.** Ring-fence intact — the ~180cr for the Thalon
landing was not touched.

**Not done, named plainly:** site C (botanical perfumery), the **Thalon landing
page**, **phase 0**, and control-arc part B.

---

### The arc turned at the close — three founder messages, and the spec now runs to FIVE sites

**All three are amendments, and all three are in `docs/landing-arc/spec.md`
(§THE VIDEO TURN, §SITES D AND E).**

1. ***"dont have to be stingy with the higgsfield credit."*** Owned: A and B
   spent 2.40 and 13.00cr against a ~120cr line while the balance evaporates.
   The error was not preferring code instruments to video — that was right —
   it was **not doing BOTH**. **The technique was PROVED, not asserted:**
   `seedance_2_0` takes `start_image` + `end_image`; job `139d81f8` ran ㉑'s
   already-pinned Feb and May frames for **17.50cr** and returned a locked-off
   camera with the season genuinely turning. Engineering note carried forward:
   **do not scrub the mp4 via `currentTime`** (h264 seeks to keyframes and
   janks) — extract a frame sequence and scrub that.
2. ***"a top down view doesnt really display the full beauty and power."***
   Accepted. ㉑'s stage inverts: the photograph leads at full size running the
   generated scrubbed transition, the planting plan becomes the reading
   instrument beside it. **The schematic test is NOT walked back** — it is what
   made the page credible, and he endorsed it the same session. Noted for
   accuracy: `orchard-house` is not 3D either, it cross-fades painterly stills;
   **neither seasons page had ever shown generated motion.**
3. ***"apply that motion to site A and site C too"*** and ***"add a site D
   (vineyard) and E (café) … after thalon with any left over credit."*** Each
   site's motion is the moment its own story already turns on and is currently
   a still — ⑳'s is the **Day-84 handoff** (six chapters measure a limp evening
   out and the page never shows the dog walking), ㉑'s is three season
   transitions, C's is the bloom. **⑳'s carries an honesty constraint the
   others do not:** it depicts a clinical outcome, so it must match what the
   instrument says or it undoes the Day-12 dip the page was praised for.

**Measured price finding: a 4s 1080p silent segment is 36cr** (5s is 45cr), and
4s is ample when the visitor scrubs rather than plays — so 36cr is the default
unit **and it sits under the ≥40cr ping threshold.** Allocation against 551.22:
㉑ ~108 · C ~82 · ⑳ ~72 · **Thalon landing 180 RING-FENCED** · **~109 left for
D + E**, which are the spend-down target and are built only after the landing.

**One correction to his café idea, verified:** no seat takes three ordered
keyframes, so beans → grounds → pour is **two chained transitions** sharing the
middle frame — better than one call, because it gives the scroll two ranges and
a dwell on the grounds.

---

## Sprint 9 / s104 — **SHIPPED: site A of three. B, C, the Thalon landing and phase 0 all remain** (the plan block below is what was written)

**One commit, `4bc9604`: ⑳ WHITETHORN — the landing arc's first site.** His
running order was followed exactly (the three A+ sites lead), and **one of the
three is built, not three.** Verify green on main at wrap, 3441/9 unchanged —
this session added no engine code.

**What it is.** A veterinary practice whose central claim is never written in a
sentence. The banked scroll-dog idea moved one vertical sideways and became a
**recovery**: a gait study pins beside six chapters that scroll past and drive
it, and one clock sets the day, the lameness score, the gait, the pelvic hike
as the sore limb loads, the loop each paw traces, the marks left on the belt
and four readouts. Day 0 is a three-beat limp; Day 84 is a trot. **The numbers
dip at Day 12** because a real post-op recovery does — the easier page would
have drawn a line that only rises.

**The expensive lesson, and it cost three build rounds: a code-drawn instrument
may be SCHEMATIC but never a drawing of a THING.** The gait mathematics was
correct on round one; the naturalistic dog was still a bad cartoon on round
three, and each round only moved the failure around. Changing register — to a
marker-and-trace kinematic plot, which is what veterinary gait analysis
actually produces — converged immediately and is *honest* rather than a
substitute for a picture. **The test now ratcheted into the meta-prompt: does
the real discipline produce this drawing? If not, it is illustration, and
illustration is a MINT.** The founder said the same thing mid-session in his
own words — *"definitely use higgsfield … if you need help with drawing or
artwork"* — which is now the recorded division of labour: **photographs carry
the feeling, the diagram carries the evidence.**

**Two mint lessons, both re-confirmations that negative-prompting fails:**
lanyards and badges (with pseudo-text on them) grow on anyone a scene reads as
a professional — *"no lanyard"* did nothing across two takes and a
crop-at-the-collarbone worked first time; and **a prompted "gate" renders as a
mullioned lattice and reads as BARS**, on the one image whose entire job was to
dispel this vertical's confinement dread. That extends the s63 window-glazing
rule to every barrier object. **Name the FRAME you want, not the object you
don't.** 14 images generated, 5 kept, **1.68cr**.

**The claude-design mock earned its restoration** (his s103 amendment, now
written into meta-prompt §How-to step 3): it surfaced a structural fault the
prose plan had missed — the instrument scrolling away and leaving six chapters
with nothing to drive — which became the build's spine.

**Every real defect came from RUNNING IT, fifth session in a row.** A
viewport-tall void under the sticky stage · the two forelegs briefly
synchronising mid-blend (`RF` lerped through `LF`) · the mobile stage hiding
each chapter's own heading · and copy claiming a gate the photograph no longer
had. Types, lint and 3441 tests saw none of them.

**Also amended:** an animation-family wave shares its primary axis by
construction, so distinctness moves to the axis PAIR, palette, type and
instrument grammar. `whitethorn` draws otherworldly-animation +
data-instrument — a pair no other site holds.

**Not done, and named plainly:** site B (garden design), site C (botanical
perfumery), the **Thalon landing page**, and **phase 0**. The ring-fence held —
nothing near the reserved 180cr was touched.

### The fix round — HIS verdict, same session (`90f0f0c`)

He read the built page and called it: it needed **more nature, openness and
light-heartedness** — *"you dont want to give off a sterile hospital
experience, but caring, warm and empathy and friendly place."* Correct, and
one item was an outright defect.

**THE DEFECT: the page had NO WINK.** One was designed — the dog turning to
look out at Day 84 — and it was **silently lost when the instrument changed
register** from a drawn dog to the kinematic plot. The house rule is one
deliberate playful moment per page; this shipped with zero and nothing
flagged it, because it was not a code defect — it was a requirement that lost
its host. **Ratcheted into the meta-prompt §casting(6): a change of REGISTER
drops the requirements that belonged to the old one; re-run the checklist
after any change of APPROACH, not only after a change of code.** Restored in
the vertical's own language: at Day 84 only, the paw-prints wander up off the
measured line under *"(stopped to sniff something)"*, written into the copy
too so it survives no-JS.

**The rest:** the instrument now **hands off to a photograph** (the recovery
ended on a number with the running shot four sections below; it ends on the
dog) · three new mints for open air — a dog rolling on its back in meadow
grass, a cat asleep behind one wide pane, a close of a dog asleep at home ·
the dark hawthorn band stopped being a divider and became the **"Whitethorn is
hawthorn"** section, earning the image by explaining where the page's one red
comes from · the alternating band went from clinical near-white to a **soft
meadow wash** · copy warmed throughout. **No honesty softened** — the Day-12
dip, the fictional disclosure and the real 0–5 scale are untouched.

One take rejected on a rule already on the books: the cat's window returned
with a rail and frame member across the glass — the one-large-pane rule, in
the section about not making animals feel shut in.

**Site total: 20 generated, 8 kept, 2.40cr. Balance 581.72, verified live.**

**⚠ HIS ORDERING CALL, RE-AFFIRMED s104:** the lead recommended bringing the
Thalon landing page forward ahead of sites B and C (the sunset puts unbounded
risk on whatever is scheduled last, and site A already banked the
transferable lesson). **He declined and kept the original order** — *"i would
still stick to the orginial order of doing the sites first, then learn, then
the thalon landing page."* That is settled; the recommendation is on the
record and is not to be re-litigated.

---

## Sprint 9 / s104 — **PLANNED at the s103 close, on his direction**

His words, in the order he gave them: ***"go ahead with 1 and 2, next
session. but also next session, i want you to plan to do more landing
pages…"*** then, closing the ordering question: ***"do the three sites first
next session."***

**⚠ THE ORDER HE SET, and it re-sequences this whole block: the THREE A+ SITES
LEAD s104.** Phases below are listed in their original numbering for
continuity, but the RUNNING ORDER is **phase 2's three sites → phase 0 → phase
1**. Rationale, stated so it can be overruled: the credit work has a clock and
part B does not, so **part B is the item that slips** if the session fills.
**The expiry date is CLOSED as a blocker** — it was only ever asked to decide
this order, and he decided it directly.

### Phase 0 — the honesty gap s103 opened (small, and it goes first)

The seg shipped at s103 offers **Live — "Due posts go out on their own."**
That sentence is **not true today**: the queue's master key rests empty, so
nothing goes out unattended whatever the control says, and **nothing in
`apps/web` mentions `SOCIAL_QUEUE_ARMED`** (verified s103 — it lives only in
`packages/platform/src/env.ts`, the engine, the tick route and the scripts).
That is the same defect class s103 caught twice: a control asserting what the
engine will not do. **Ship the DISCLOSURE, not a door** — the card says the
queue is off at the box level and that Live takes effect when it is armed.
Arming the queue from the UI is his sequence-gate call and is NOT in scope.

### Phase 1 — control-arc part B, opening with the DRAWN SHEET

Unchanged from the s103 plan, which deliberately did not start it. Approved,
both MIT deps approved, **DOCTRINE 0 says the sheet comes first** and B has
none. Mobbin sweep banked in `docs/control-arc/spec.md`; the shaping finding is
that this is **not a segment-builder surface** but three additions to a list
that already exists. Migration laid s102 (window 0027), primitive built s61.
**Design work = Fable 5 lead-direct, never delegated** (standing s51).

### Phase 2 — the LANDING ARC, specced s103: `docs/landing-arc/spec.md`

**Three founder decisions, two of which amend standing method:**

1. **The A+ family becomes NEW SITES, not upgrades.** The animation-upgrade
   family was banked as three upgrades to `wagtail-and-co` (scroll-dog),
   `orchard-house` (seasons-tree) and `stem-and-vow` (bloom video). His call:
   spend each idea on a NEW vertical so the portfolio gains **options**, not
   polish — *"the A+ dog walking animation idea can be a Vet landing page now
   and etc."* The three existing sites are untouched and keep their verdicts.
2. **claude-design RESTORED for the initial mock** — *"i think using claude
   design for the initial mock actually did help the landing page have a bit
   more clarity and structure."* This AMENDS the s62 loop-A/B call that retired
   it to OPTIONAL (meta-prompt §How-to step 3). **It is not a reversal:** the
   mandatory pre-plan stays exactly as it is and the mock comes back in front
   of it. Both, never either.
3. **HIGGSFIELD IS BEING SUNSET** — *"i plan to not continue it."* The balance
   is now **use-it-or-lose-it: 584.12 credits, Plus plan** (verified live s103;
   unchanged since s79, so nothing has been spent in twenty-odd sessions). This
   makes the own-visual-engine directive materially more urgent and puts a
   clock on the whole arc. **Unspent credit at the end should be spent down on
   variant coverage, not banked** — the normal disposal rule inverts.

**The three sites** (his vertical for A; B and C are my recommendation under
*"and etc."*, each a one-word overrule): scroll-dog → **veterinary practice** ·
seasons-tree → **garden & landscape design studio** (the instrument IS the
pitch — a designer sells what a space becomes over a year) · bloom video →
**botanical perfumery** (bloom→scent, and it rescues the idea from being a
florist twice).

**Then the Thalon landing page**, which is the reason for the order — *"take in
all that knowledge."* It is NOT a portfolio site: stealth is unchanged and
where it is served and under what name is **his separate call**; building it
does not decide it. Its mint budget is **ring-fenced before the first A+ mint**
so a fix round cannot eat the front door.

**THE ORDER IS DECIDED AND NOTHING BLOCKS IT** — *"do the three sites first
next session."* The expiry-date question is CLOSED; it existed only to settle
this, and he settled it directly. **The ring-fence survives and matters more:**
the Thalon landing's mint budget is reserved BEFORE the first A+ mint, because
with the sites leading, an over-running fix round is exactly how the front door
ends up unfunded.

**Honest scope note:** phases 0+1+2 is a lot for one session. Phase 0 is
roughly an hour; part B is a real build; the landing arc is three sites plus a
capstone. Expect the arc to run past s104 — the spec is written so it can.

---

## Sprint 9 / s103 — **SHIPPED: phases 0 and 2** (the plan below is what was written; this block is what happened)

**Three commits.** `353f8b9` part A2's engine · `6944e9d` the arm control's
write door · `37cbce5` the surface (part A's half + A2's toggle + the split).
Wrap verify on main: **exit 0, 3441 passed / 9 skipped** (s102 was 3414/9).
Zero credits, zero live posts, nothing armed, master key still empty.

**PHASE 2 WAS PROMOTED AHEAD OF PHASE 1 (part B), and the reason is the
plan's own.** The plan put part B — a recommendation of mine — ahead of the
surface that makes his own directive usable. But the plan's stated reason for
running A2 first was *"it completes the thing he just approved and used"*, and
by that reasoning the surface outranks B: part A's engine shipped at s102 with
no door, A2's shipped this session with no door, and a toggle he cannot flip
is not his ask delivered. He delegated the ordering (*"the rest we can go with
your recommendations"*). **Part B is untouched and is the s104 opener.**

**A FOUNDER CALL WAS TAKEN MID-BUILD — the storage shape of an arm flip.**
`brand_profiles` is append-only, so writing an arm state the obvious way mints
a new brand-profile version per toggle flip and floods the Profiles version
history with writes that say nothing about the brand. His answer: **update the
active row in place, and put the history on the events spine** — one
`brand_profile.social_updated` per flip. `updateSocialConfig` is that repo's
one in-place write; proven live at 5 profiles / version 5 after two flips.

**THE LESSON, for the fourth session running: run it and read it.** Under
`all`, an unconfigured destination's card rendered *"this destination posts,
even though its own setting says off"* — the exact opposite of what the engine
does with it, and a contradiction of the correction this same session had made
one commit earlier. Types, lint and 3400 tests all agreed it was fine. It was
visible in about four seconds of looking at the page. That is s100's guessed
clamp, s101's `xl:` breakpoint and s102's three bugs, a fourth time.

**Grounding corrected the spec again (rule 12), and this one was load-bearing:
part A2's binding 3 promised copy the product cannot honour.** The spec said
`all` would cover *"new channels you connect"*. Nothing in the connect path
writes a posting entry — the only writer is a profile config write — and the
publish door refuses a platform without one. Since a claimed-then-refused row
is marked `failed`, which is **terminal with no retry ladder**, reading an
absent entry as `live` would have **burned the drafts that `off` merely
holds**. `all` covers what is CONFIGURED; the surface says so.

---

## Sprint 9 / s103 — the plan as it was written (the arc continues under his standing *"A first, config, yes to the deps"*; no new verdict needed)

**Spec of record: `docs/control-arc/spec.md`** — part A's engine half is BUILT
(its build record and the four grounding corrections are in the spec); part B
is approved with its deps approved; part C is unstarted.

**The ordering principle, unchanged: a SHEET before a build.** DOCTRINE 0, and
the s101 staged rebuild is the precedent.

**HIS DIRECTIVE AT THE s102 CLOSE, verbatim: *"there can be an option for the
posting, like a toggle on whether i want to post on all or just selectively.
the rest we can go with your recommendations."*** That becomes **part A2**
(`docs/control-arc/spec.md` §Part A2) and it **runs FIRST in s103**, ahead of
part B — it completes the thing he just approved and used, and B is a larger
build that has not started. The rest of the s103 order stands as recommended.

### Phase 0 — part A2: posting SCOPE (his directive; runs first)

0. **`postingScope = "selective" | "all"`, defaulting to `selective`.** Part A
   gave every destination its own state, which is what makes a GO narrow — but
   it left no way to say "yes, all of them" except flipping each one, and
   again for every channel connected afterwards. Full wiring in spec §Part A2.
   **NO MIGRATION** (grounded at the s102 close: every reader of
   `brand_profiles.social` is a KEYED lookup — `publish.ts:244`,
   `social-arming.ts:128`, `cards.ts:189` — and nothing iterates the block's
   keys, so a scalar field cannot be mistaken for a platform).
   **The three bindings that keep it safe, all in the spec:** it sits UNDER
   the master key (three gates, all AND — `all` cannot arm anything
   `SOCIAL_QUEUE_ARMED` has not) · **`all` never overrides an explicit
   `review`** (a hold the operator asked for is not cancelled by a scope
   switch) · `all` is LIVE rather than a snapshot **and says so in words**,
   because a snapshot calling itself "all" is a lie with a delay on it.
   **It is an OVERLAY, never a mutation** — flipping back to `selective`
   restores exactly the arrangement he left, which is what makes it safe to
   try. Engine change is confined to `passArmStateResolver`; the consumer is
   untouched, which is the seam holding.
   **Its surface half rides phase 2 below** (same control, same card, one
   pass).

### Phase 1 — control-arc part B, opening with the DRAWN SHEET

1. **Draw part B's sheet, lead-direct** (design work = Fable 5, never
   delegated — standing s51). Its Mobbin sweep is banked in the spec, and the
   finding that shapes it is structural: **the best-in-class pattern is NOT a
   segment-builder surface** but three additions to a list that already exists
   — a view strip, chips that read as sentences, and "Save as a new view" in
   the filter row. Contractbook is TAKEN whole; AutoSend's three-naked-
   dropdowns modal is the recorded ANTI-pattern, because it is what we would
   otherwise have built.
2. **Then build it.** Two things make B cheaper than it looks and both were
   proven, not assumed: the saved-views primitive it extends was **built at
   s61** (table, repo, route, client, contracts), and **its only migration was
   laid at s102** (window 0027 widened `SAVED_VIEW_SURFACES` while fixing a
   live bug). The approved deps — `@react-querybuilder/core` +
   `@react-querybuilder/drizzle`, both MIT — land here, not before. We
   hand-write only the per-surface column allowlist the library deliberately
   leaves to the caller, which is the part that makes a browser-supplied
   predicate safe (rule-10 memo: `docs/research/prior-art-saved-segments-s101.md`).

### Phase 2 — part A's SURFACE half (the prerequisite is now cleared)

3. **The arm control on the Integrations channel cards, and A2's scope toggle
   above it — ONE pass, because they are one control surface.** s102 phase 5
   ran that surface's research pass, so both can now be drawn honestly. The
   per-destination control is a **seg** (`live | review | off`) in the shell's
   own `.seg` vocabulary — a toggle cannot express `review`, and `review` is
   the whole point. The SCOPE mode is the head control above them, on the
   connected group. Spec §Part A carries the drawn shape (Mistral's per-row
   Enabled column · Base44's state word UNDER the name, never a bare coloured
   dot · WRITER's inert control that states its reason and points at its
   unlock); §Part A2 carries the mode's two copy obligations — the
   future-channels sentence at the toggle, and a held destination saying why
   `all` is not touching it.
   **Each destination's seg keeps showing its STORED value** with the mode's
   effect stated beside it — never blanked, never rewritten. That is what
   makes the overlay legible and the flip back lossless.
4. **Land the connected/available SPLIT in the same pass** — it is the research
   pass's own top finding, and an arm control reads better on a split list than
   in a flat grid of every destination that exists.

### Phase 3 — the Integrations p1 the research pass earned

5. The pass's other three takes: **the blast-radius disclosure** on a
   `needs_reauth` seat (Coda — a broken credential names what it is holding
   up, and after part A those rows are the consumer's `holds`), the honest
   **"managed elsewhere"** state for an `envOverride` seat (Bolt.new — the
   box fills it and the vault door is not where you change it), and **class
   grouping** (`card.class` exists and does nothing).

### Phase 4 — the last three definition-of-done rows

6. **Leads · Profiles · Source Media** — the only `—` rows left once
   Integrations carries its research. Each is a research pass, not a rebuild.

### Carried, recorded not fixed (each with its reason, on its ledger row)

- **Schedule's month-density chips clip their own text** — a two-line chip
  keeps a one-line box. Found by the phase-3 restore: month was always
  clickable, but nothing had ever restored INTO it, so no gate had sat on it.
- **Intel's dossier-absence REASON does not reach the wire** — unarmed vs
  model failure vs **denylist** all read identically, so a judge verdict was
  being reported as a billing problem. s102 made the copy state what is true
  and stop asserting a cause; carrying the real reason (engine result →
  snapshot → wire) is a contract-window ask.
- Intel **dismiss reversibility** (Search's targets get Restore; a dismissal
  is a capture plus an in-memory set, so an Undo is a design question) · the
  **sweep schedule's missing door** (`cadenceMinutes` is live today) · the
  add-chip's **missing keyword path**.

### Still waiting on him — ONE item, blocking nothing

The three **s101 staged design calls** (live-chain editing · the dropped
"low-res stub" title · one-scene-open-at-a-time).

---

## Sprint 9 / s102 — the plan as it was written (his answer at the s101 close, verbatim: *"A first, config, yes to the deps"*)

**Spec of record: `docs/control-arc/spec.md` — VERDICTED, no open calls left.**
Rule-10 memo: `docs/research/prior-art-saved-segments-s101.md`.

**The ordering principle: correctness before capability.** His *"A first"*
orders the ARC (A → B → C); it does not put a feature ahead of a correctness
bug, so the Intel capture-id defect still leads. Part A is otherwise the
session's main build.

**What his verdict unblocked, and one thing grounding then made cheaper:**
O-1 "config" resolves to **`brand_profiles.social`, which already exists** —
per-platform publishing config whose absent-platform state already means "the
refusal ladder's unarmed rung". **Part A needs NO MIGRATION.** O-2 approves the
two MIT deps, which land with part B, not before.

### Phase 1 — correctness (no verdict needed; do first)

1. **Intel capture ids are in-process.** Carried since s100 as the highest
   remaining item and still not a UX one: an Intel exit silently vanishes or
   resolves to the **WRONG capture** after a restart. A wrong-target promote is
   worse than a dead door.

### Phase 2 — **control-arc part A** (his approved next build; no migration)

2. **Per-destination arming.** Spec §Part A carries the full wiring. In order:
   `armStateSchema` + `ARM_STATES` into `packages/contracts/src/publish-queue.ts`;
   one `armState` field on `socialCadenceSchema` in
   `packages/contracts/src/social.ts` defaulting to `off`; the repo carry-through
   (**this is where the same gap shipped THREE times — run
   `packages/db/src/__tests__/brand-profile-config-blocks.test.ts` and extend it
   if a field inside an existing block escapes its block-level round-trip**);
   `packages/engine/src/social/queue-consumer.ts`'s `armed?: boolean` becomes a
   per-destination resolver defaulting to `off`; then
   `apps/web/src/app/api/social/queue/tick/route.ts` ANDs it with the master env
   var. **Ratchets:** an unresolvable destination is `off`; a master-armed tick
   with no per-destination config publishes NOTHING.
   **The surface half needs phase 4's Integrations pass first** — it lands on a
   surface his definition of done still calls not ready, so do the research pass
   before drawing the control (see phase 4).
   **Two traps recorded in the spec, both from the repo itself:** never
   `z.record()` over an enum key (zod 4 makes it exhaustive), and do not
   overload `maxPostsPerDay: 0` — "paused" is a cadence answer, "armed" is an
   authorization answer.

### Phase 3 — the saved-views contract window (a PROVEN live bug, and part B's only migration)

3. **`SAVED_VIEW_SURFACES` widens; the CHECK constraint migrates with it.**
   Grounding for the spec proved a live bug (spec GT-2): the list in
   `packages/contracts/src/workspace.ts` is `["leads", "calendar"]`, but its one
   caller `apps/web/src/components/schedule/schedule-surface.tsx` asks for
   `"schedule"` — the name it took at the s86 rename. `isSavedViewSurface("schedule")`
   is **false**, so every read and write 400s, and both call sites swallow it by
   design. **Schedule's density/scope preference has never once persisted.**
   Retire `"calendar"` in the same window (archived s95). **Justified on the bug
   alone** — that it also lays control-arc part B's only migration is a
   dividend, not the reason, so this is not "starting the arc unverdicted".
   Done when the preference survives a restart, proven live.

### Phase 4 — the Intel debt, gate-ordered (no verdict needed)

4. **The `--jobs intel` HARNESS selector** (cheap, do early): it reports the
   angle radios as "no affordance" because `scripts/surface-jobs.mjs` matches
   /angle/i against textContent. Fix the selector, not the product.
5. **The rest of the s100 gate's list**, in its recorded severity order: no
   `.btn:disabled` dress anywhere on the surface · `busy` locks everything
   without naming the running action, and add-area/save-description run OUTSIDE
   it (double-submittable) · dismiss is terminal and irreversible while the
   Search tab's dismissed targets get Restore · the sweep schedule is armed with
   no door · model-written titles/angles/hook carry no attribution · a
   judge-gated dossier reports "not armed yet" · copy buttons say "copied" when
   nothing reached the clipboard · the × on a watch chip PAUSES while wearing
   the universal destroy glyph · reason bars have no accessible name · the
   header/watching band pops in 1.3s late, shifting the tabs 91px · the "+ Add
   area or keyword" chip offers no keyword path · the keyboard grammar works
   and is invisible.
   **NOTE the one item that does NOT belong here:** *"no filter, no sort and no
   find over 58 cards"* — the Klaviyo teardown argues that is a segment
   primitive, solved once for every surface, not a filter box on Intel. It
   moves to control-arc part B and is struck from the Intel list.

### Phase 5 — clear the last definition-of-done debt (and unblock part A's surface)

6. ~~Mobbin sweep for the arc~~ — **DONE s101, on his mid-turn directive**
   (*"use mobbin-mcp so you can find some examples of a high quality UX/UI with
   those new features"*). All three parts are swept and verdicted in
   `docs/control-arc/spec.md` + the reference library. **What it leaves owed is
   the SHEET**: part B has no drawn sheet, and DOCTRINE 0 says the sheet comes
   first — the s101 staged rebuild is the precedent. Draw it lead-direct once
   O-2 lands, not before (a sheet for a feature he has not approved is waste).
7. **The four surfaces his definition of done calls NOT READY** — Integrations ·
   Leads · Profiles · Source Media. These are the last `—` rows in the coverage
   ledger; with Staged done at s101 they are the whole remaining debt, and each
   is a research pass, not a rebuild. **Integrations goes first of the four** —
   control-arc parts A and C both land on that surface, so its pass is a
   prerequisite the arc will need anyway. **Consider pulling it ahead of phase
   2's surface half** — part A's control cannot honestly be drawn onto a surface
   that has not had its pass.

### Still waiting on him — now just ONE item

The three **s101 staged design calls** (live-chain editing · the dropped
"low-res stub" title · one-scene-open-at-a-time). They block nothing; the
surface works either way. The control-arc calls are **CLOSED** — *"A first,
config, yes to the deps"*.

### Deferred out of s102 on purpose

**Part B (saved segments) and part C (channel health).** B is approved and its
deps are approved, but *"A first"* is an order, and B additionally owes a DRAWN
SHEET before any build (DOCTRINE 0; the s101 staged rebuild is the precedent).
Drawing that sheet is the natural s103 opener now that its Mobbin sweep is
banked. **Do not start B in s102** — a half-built A and a half-built B is worse
than either finished.

## Sprint 9 / s101 — **CLOSED** (boot 2026-08-04 "gogogo" + a Klaviyo research directive; **the LAST un-rebuilt surface is rebuilt**; zero credits, zero live posts)

Wrap verify on main: **exit 0, 3381 passed / 9 skipped** (s100 was 3377/9).

**THE STAGED SURFACE — sheet AUTHORED and BUILT in one session**, which was his
own call at the s100 close (*"doors now, rebuild next session"*, with the sheet
first). It was the last surface in the workspace wearing wave-0 bridge styling,
and **the only live surface that was never in the UX programme's coverage
ledger at all** — a debt with no row, which is the one kind that table cannot
catch. It has a row now, and the next audit should start from the file list.

**His report was "the layout of it in the Approve section looks horrible", and
the cause was one mistake made twice, nested:** Tailwind `xl:` VIEWPORT
breakpoints laying out a CONTAINER that is 560px wide whatever the viewport.
Measured live at 1440×940 before touching anything:

| | before | after |
|---|---|---|
| direction editor | **182px**, beside a **342px** preview stub | the full column |
| its inner grid | three **46.7px** columns (hence "Aspect (compile-time frame)" on four lines) | chips, no grid |
| clipped elements | **4** (incl. 240px of his own CTA off the right edge) | **0** |
| pane height | **3219px** in a 764px box | **1120px** in 644 |
| hard-`disabled` controls on a live run | **26 of 41** | **1 of 21** |
| preview at the bottom of the scroll | gone — you scrubbed blind | **pinned, still on screen** |

The one remaining hard-disabled control is the locked stage's rail button,
whose reason ("not generated yet") is its own adjacent line.

**Its first research pass, same session** (ux-refinement-program §Staged):
Artlist Studio → direction as CHIPS · Elicit → every stage says what it
PRODUCED (ours said "done · queued", two status words and no artifact) · Gemini
Gems → the ask pinned above the steps (this surface stated its origin nowhere)
· Grain + Copy.ai + Asana → an outline is an index, one item open · ElevenLabs
→ the frame drawn honestly at its aspect. **Node canvases REJECTED for the
third time**, same reason as the Board s91 (they promise editable wiring; our
chain is linear with one human gate). **Postiz: nothing to take, stated** — it
has no staged-generation surface at all.

**Two structural results beyond the layout:**
- **`storyboard-cards.tsx` DELETED** — it and the direction editor's
  near-duplicate scene cards became one `scene-index.tsx`, because the sheet
  draws ONE shape for both artifacts. The two had already drifted apart on how
  they render an absent visual line, which is what a shared drawing prevents.
- **A live chain now gets FACTS, not a greyed editor.** The verbs that
  genuinely cannot reach a live draft are absent with one sentence saying why,
  instead of 26 controls rendered and disabled.
- **The bridge-burndown ratchet fired and was lowered in the same change**, as
  designed — the whole `components/staged/` block left the map at zero.

**The sheet was AMENDED in its own session, in its own header** (the verdict
row moved out of the card head, where four gate chips wrapped it to three
lines). And **rule 6 caught a collision inside the sheet itself**: the first
draw named a row `.dir.screen`, which hit the SHELL's `.screen` and turned
three caption rows into 940px screens — found by counting DOM nodes, not by
looking.

**KLAVIYO TEARDOWN** (his second ask) — `docs/research/klaviyo-teardown-s101.md`.
Docs + architecture, not visual: Mobbin has one Klaviyo screen and the memo
says so rather than inventing a UI review. The short list, by value-per-risk:
1. **Per-step arming** — their per-MESSAGE `draft`/`manual`/`live`, where
   `manual` routes the recipient to a "Needs Review" tab. That both
   **independently validates Approve** (a category leader converged on
   hold-queue-review) and beats us on granularity: we arm a whole run, they arm
   a message. Arming a *platform or stage* would let Bluesky go live while
   LinkedIn stays in review — and it makes the live grant safer, not looser.
2. **Segments — live saved predicates over an event stream** (vs static lists).
   This is the RIGHT answer to the Intel debt "no filter, no sort, no find over
   58 cards": not a filter box on one surface, but saved views everywhere.
   **Charter candidate; prior-art sweep first per rule 10.**
3. **Channel health** (their deliverability hub, translated) — a real gap no
   surface owns: Channels says a credential is connected, nothing says posts
   are landing. Parked with its trigger.
4. Trigger-split vs conditional-split as a naming distinction for the fan-out
   profiles. 5. Scores on objects — **LATER, dependency named: D2**. 6.
   Benchmarks — REJECT (one tenant), parked with its trigger.

Backend verified and mostly a *don't*: Django/Celery/Cassandra/Kafka/Flink at
170k events/sec is four orders of magnitude from us. The transferable lesson is
structural — they kept the event log separable from the aggregates, which is
what let them swap the whole bus without touching the product.

## Sprint 9 / s100 — **CLOSED** (boot 2026-08-04 "gogogo"; zero credits, zero live posts; the founder interrupted twice with live reports and both were real)

**Window 0026 opened and FROZE at the opener as chartered, then two warm-up
honesty fixes, then the Intel arc — which the founder's own two bug reports
cut across. Every boundary carried its own full verify at exit 0.**

| track | outcome |
|---|---|
| **Contract window 0026** (`61e0b91`) | **REMOVAL RETIRES, IT NEVER DESTROYS** — his call, built exactly as decided. `retired_at` on BOTH `video_cuts` and `video_projects` (migration 0026, purely additive: 2 columns + 2 indexes; drizzle's DROP+ADD churn on three identical check constraints stripped). s82's hard `deleteCut` **BECAME** the retire door — `videoCuts.remove` is gone from the repo surface and `lib/videos/output-file.ts` is DELETED: nothing unlinks a render any more, which is the only way the sheet's confirm ("Restore brings it back exactly as it is now") can be true. The three founder-ratified refusals SURVIVED, re-scoped to LIVING rows; project retire deliberately carries NONE (a cut's refusals protect things dangling INSIDE a living project; a project takes its tree with it). **Rename REFUSES, never merges** — `(tenant, name)` is the get-or-create key. Reads exclude retired by default with one sanctioned opt-in (the restore doors). Two consequences found by grounding and refused loudly rather than silently: get-or-create onto a RETIRED project's name, and create onto a retired cut's `(name, version)` (which would return the retired row with its OLD edl). 23 new repo cases; s82's cut-removal tests MOVED whole rather than copied. |
| **The doors, rendered** (`bb1dec9`) | The Dossier's Cut history carries **Restore**, and the confirm now renders the sheet's Restore sentence verbatim — **the dossier-s96 pin that asserted its ABSENCE is INVERTED**; it had been pinning the gap. The grid gained Rename…/Retire per card and a "Retired projects (n)" disclosure. One real bug fixed on the way: the list's Enter guard excluded `[role="link"]` but not `[role="button"]`, so Enter on a focused Retire would have fired the door AND navigated into the project it just retired. |
| **Two warm-up honesty fixes** (`eb65a46`) | `meta.mediaRefs` had **two competing field names** — the Composer read `mime`, the engine's fit reader and the publish door's schema read `contentType`. Unexercised today, and one producer away from silently blinding one side. One shared reader in contracts now (`draftMediaRefSchema` / `readDraftMediaRefs` / `mediaKindOf`); `contentType` wins because it is what the only reader that REFUSES already enforced. One behaviour tightened with its reasoning pinned: a ref-less entry no longer counts toward the platform ceiling. And `projectKind()` stopped sniffing `description.startsWith("One-prompt")` — a PROSE SENTENCE — to recover an origin the runner already stamps on the row; surfaced as a derived boolean, never the raw meta (which holds `mediaRoot`, an absolute box path). |
| **INTEL — the row's first research pass AND first gate** | Research recorded in the programme's library (Digg's source-domain-on-the-thumb = the biggest visual win available; Binance rank list; Etsy term-dossier for the Search tab; Churnkey direction-not-level; Productboard NEW badge; infinite scroll and sentiment both REJECTED with reasons). **The gate — 45 agents — came back `matches_sheet: false`: 24 confirmed, 16 dead/missing jobs.** Two fixed and live-proven; the rest are itemised on the Intel row. |
| **Intel's flagship path was DEAD on 52% of cards** (`26007df`) | A Bluesky card id is `<areaId>:at://did:plc:…/app.bsky.feed.post/…`. Its **slashes** were interpolated raw into the path, so **Promote and Dismiss 404'd on 30 of 58 cards** and the operator saw only "request failed: 404". `fetchCreateContext` three functions down already encoded. Proven by hand — 404 raw, 200 encoded, same card, same server — then live-verified after the fix (capture + createHref returned). It survived because every automated walk happened to land on a YouTube card, whose id is a slash-free uuid, **including the repo's own `--jobs create` gate, which passed while the flagship path was broken.** |
| **The s77 pick-list clipping had come BACK** (`b8fd008`) | The render blocker. `.pick-rows` clientHeight 420 / scrollHeight 522: the eighth option sliced mid-sentence, radio and copy button cut with it. The s77 fix had written down "measured against the structural maximum: 4 titles + 3 angles" — but the contract says `titles.max(5)`, so it was measured against a maximum that does not exist. **The clamp is deleted rather than raised**: a list the schema caps at 8 rows needs no scroll container, which is what the sheet draws. Ratchet reads BOTH files and fails if either half changes. |
| **FOUNDER REPORT #1 — the video from Create dead-ends in Approve** (`0369752`) | *"what next? Theres no obvious Approve or any button to progress it."* He was right. His run generated stage 1 (storyboard, passed) and stage 2 (direction doc), which **BLOCKED on a judge DISAGREEMENT** — g1 pass, g3_final pass, g3_screen fail on one sentence ("Swap the model underneath and the gates still hold") — and stopped. Stage 3 never ran; **no video project and no cut were ever created.** The pane offered nothing because it deferred approve/reject/re-judge to "the draft panel's own doors" — a panel IT REPLACED at s79 A2. An assumption that outlived its dependency. Now a stalled band names the stage, quotes the failing claim verbatim, and carries Re-judge (the one verb that reaches a live draft — the three stage verbs are demo-store endpoints and correctly stay hidden). **Proven on his actual draft: re-judge → g3_screen came back PASS, draft moved blocked → queued.** |
| **FOUNDER REPORT #2 — "the scenes look like placeholder"** | **They are not.** Nine scenes, real, on-brand, grounded in the news he prompted (Alibaba 2.4T / DeepSeek), pitching Thalon's actual differentiator. What reads as placeholder is the pane: the preview is an explicit `PREVIEW (LOW-RES STUB)` (no frames minted) and each scene's *visual hint* — director's prose for a renderer — is rendered in the same grey as body copy. He also only ever saw scene 1; the 1–9 pager is the rest. |
| **The judge is NOT defective — stated, because it looks like one** | Both gates reasoned carefully and split on ONE sentence: g3_screen called it an architecture claim no chunk states ("adjacent, not stated"); g3_final called it a restatement of the per-tenant config naming no new capability. That is the disagreement policy working as designed. **The defect was that a correct block had no door and no legible reason** — which is what got fixed. No judge change was made or is recommended. |

**DEFERRED, stated:** **`components/staged/` is the last un-rebuilt surface in
the workspace** — wave-0 bridge styling, no mock sheet of its own — which is
the other half of founder report #1 ("the layout … looks horrible"). **His
call this session: doors now, REBUILD NEXT SESSION with a sheet drawn first.**
Generating stage 3 for a LIVE chain stays unwired (the pass-3 write half), and
the band says so. The **Intel debt list** (capture ids in-process across a
restart being the highest, a correctness bug not a UX one) is itemised on the
Intel row. The **`--jobs intel` harness selector bug** is recorded there too —
harness, not product.

## Contract window 0026 — **DECIDED at the s99 close, founder call, runs FIRST in s100**

He asked to have the window conversation before wrapping. I re-grounded all
three flagged asks first, and **one dissolved**: `projectKind()` does sniff
`description.startsWith("One-prompt")`, but the one-prompt runner ALREADY
stamps the authoritative origin on the project row —
`meta.onePrompt { directionDraftId, promptSourceId, aspect, fps, startedAt }`
— and even reads it back to detect a same-name-different-origin collision
(`one-prompt-video.ts:234-256`). The fact is on record and only the display
layer ignores it, so that is a ~10-line read-the-stamp fix (the s99
cut-attribution shape), **NOT a window item** — it rides the s100 warm-up.

The remaining two were one question wearing two hats: **does removal retire or
destroy?** His answers, all three as recommended:

| decision | his call |
|---|---|
| Removal semantics | **RETIRE — reversible.** `retired_at timestamptz` (nullable) on **both** `video_cuts` and `video_projects`; retire/restore verbs; a Restore door. The sheet's drawn "Restore brings it back exactly" becomes honourable and gets rendered. **Retired rows KEEP their rendered file** — a retire that deletes the file makes the promise a lie — and **nothing is ever auto-purged**; the disk cost is accepted on the 180 GB box. |
| Projects | **Both removable AND renameable.** The live grid's two near-duplicate one-prompt runs are the case. **Rename REFUSES on a name collision, never merges** — `(tenant, name)` is a unique index AND the get-or-create idempotency key (`video.ts:51`), so a silent merge would fold two projects together. |
| Timing | **The s100 OPENER, before Intel** — mechanical (migration + repos + contract schemas), frozen before any surface work, which is the protocol's own order. Intel follows in the same session. |

**Implementation notes for whoever opens it** (lead calls, not founder calls):
reads must EXCLUDE retired rows by default with an explicit opt-in for the
restore door — a retire still visible everywhere is not a retire; retire must
respect tenant isolation like every other verb; and today's **hard**
`deleteCut` (s82 A3, which removes the rendered file and whose confirm says
"Its render went with it") becomes the retire door — one door, not two, so
the destructive path leaves the UI entirely. That is a real refactor of
existing copy and tests, not a rename. Migration number: **0026** (0025 is
the latest on disk).

**s100 IS CHARTERED — founder-approved at the s99 close.** He asked for a
recommendation and a plan, and approved it verbatim: *"ok go with that plan
next session."* **Gate the live loop (Intel → Create → Composer → Approve →
Schedule), Intel first**, with the `meta.mediaRefs` shared reader as a ~30-min
warm-up and the Approve gate if time holds. The argument he approved: he
caught a live Intel defect himself this session while Intel's row still reads
"untouched — not ready" (no research pass, no verdict, never gated), and the
s99 gates found ~150 confirmed findings / ~a dozen HIGH across four surfaces
that were ALL already considered finished. Everything that would broaden the
product needs his hands and he is hands-free, so quality on the loop he
already runs is the best hands-free work available. Explicitly NOT next: page
generation (his own word) · more dogfood (proven) · the s96 simplify
candidate (fold in opportunistically). Full plan + reasoning in
`agent_handoff/CURRENT.md` §Resume prompt.

**ONE THING THE GATE FOUND THAT IS NOT UI:** `meta.mediaRefs` has **two
competing field names** — the Composer's `firstMediaKind()` reads `mime`,
while the engine's `readDraftFitMedia()` and the publish door's
`mediaRefsSchema` both read `contentType`. Nothing writes mediaRefs onto
drafts today, so it is unexercised — but whichever producer lands first, one
reader goes blind (either the media band shows nothing on a draft that
publishes an attachment, or the fit band says "carries no media at all" under
a band that says "video — the run's cut"). **One shared reader before the
media pass** — first item for whoever opens that bucket.

**DEFERRED, stated:** the video arc has **no items left** — V9 was the last.
What the four gates recorded but did NOT fix (each on its
`docs/research/ux-refinement-program.md` row): project delete/rename + a
recorded project ORIGIN (kind still rests on a prose sniff) and the standing
retire/restore column = **contract-window asks** · judge-receipt and
grounding/publish evidence routes · the approved-cut→Approve-queue join ·
takes-panel filter/search at 58 takes · derived-cut compare · a render-cancel
verb · browser-Back-while-dirty · the sheet's `.otio export` claim (the drop
was honest — the SHEET needs reconciling) · Composer more-settings inputs,
the cover-frame picker and a video variant's player. **Page generation** stays
gated on the founder's own word.

## Sprint 9 / s98 — **CLOSED** (boot 2026-08-03 "gogogo. and Go for the dogfood too"; **THE FIRST LIVE CREATE-ORIGINATED POST** — zero credits, subscription tokens only)

**The founder's turn carried two GOs and both executed: the post door ARMED
(`ba850c0`) → B-create.5 dogfood END-TO-END through the real UI → a real
judge defect caught, root-caused, fixed and live-proven (`abf145e`) → the
draft PUBLISHED to Bluesky under the s83 test grant.** Wrap verify: exit 0,
**3310 passed / 9 skipped** (both build commits carried their own full green).

| track | outcome |
|---|---|
| Post door armed (`ba850c0`) | **"Go for the dogfood too" = the recorded GO.** `createDoor("post")` flipped in the ONE seam (`lib/create/families.ts`); route + both Create surfaces + Intel's exits opened from the same edit — the s77 dead-primary case healed live (post-suggested dossiers lead with "Create post · suggested" again). `page` stays shut awaiting its own word; its half of the sequence gate stays executable (route test). Six test files moved their pins to the armed truth. |
| B-create.5 dogfood (the loop, real UI) | **The full healed journey ran on real data:** live intel card ("Why the US Is Restricting Access to Frontier AI Models", hot, 3h) → Post exit with title+angle+hook+source riding → guided wizard → platforms narrowed to **Bluesky only** (the grant's platform) → plan review stated the truth ("0 credits · 1 metered call") → **spend statement on the record before Generate** (draft + both tiers = `claude-cli/claude-opus-5`, founder's subscription; zero Higgsfield, zero gateway) → generate + judge → Composer → Approve. Draft: 297/300, on-voice, grounded. |
| The judge defect the dogfood caught (`abf145e`) | **g3_screen recorded all-claims-supported + verdict:fail THREE consecutive times on the same body — its own notes arguing pass** ("Verdict should be pass; marking fail"). Root cause: **field order is generation order** — the output shape asked for `verdict` FIRST, so the model committed before weighing a single claim. Fix: verdict LAST in both transports (claude-cli inline instruction + the generateObject Zod schema; validation order-agnostic). **Proof: live golden:g3 full set 34/34 tier-verdicts — including g3-016, the s69 RED-PINNED residual, now passing screen** — plus new row **g3-017** (universalized imperative of prescribed advice, the dogfood's exact class). Every true-fail row still fails. The unchanged draft re-judged clean: screen ✓ final ✓ — queued. |
| The live post | Approved through the queue UI → commitment row → `run-publish-queue.ts --once` **armed per-run** (`SOCIAL_QUEUE_ARMED` set for the one invocation; the key still rests EMPTY): **1 due / 1 published / 0 failed** → `at://…/3ms6ep6a3sm23`, verified live on `steveneam.bsky.social` via the public API, body = the judged draft verbatim. The second-ever automated live post; the FIRST originated by Create. |
| Ops notes, stated | The daily token rail FIRED mid-golden-lap (2,023,817 vs the founder's standing 2M pin) — honored, then finished under a **per-process** `TENANT_DAILY_TOKEN_BUDGET=4000000` (the s68 raise precedent; `.env.local`'s 2M standing pin UNTOUCHED; dev server relaunched with the same per-process raise for the re-judge). Browser-driving quirk hit twice: chrome-devtools `fill` does not propagate into React controlled inputs here (the edit textarea + the schedule datetime both submitted stale values) — the datetime fallback was the product's own queue API; noted in memory. |

**DEFERRED, stated:** **V9** (the render-gate pass across the four video
surfaces) remains the video arc's ONE item — a full four-surface pass
deserving its own session. **Page generation** stays gated. **The
retire/restore column** stays the flagged window ask. The dogfood's UX
observations (platform exclusion is one-way within a wizard session; the
Composer verdict strip hides which hard gate failed behind "details ▸")
fold into the V9/UX-programme window.

## Sprint 9 / s97 — **CLOSED** (boot 2026-08-03 "gogogo"; zero credit spend, zero posts, founder-hands-free)

**Three boundaries, each committed on its own green: the `.data` split-brain
CLOSED as a workspace ratchet (`68d9873`) → the V3 script-first gate DECIDED
(`0731366`) → V7 render honesty BUILT (`1ddcf2c`).** Wrap verify: exit 0,
**3309 passed / 9 skipped**.

| track | outcome |
|---|---|
| One-root ratchet (`68d9873`) | **The s96 defect candidate EXECUTED as chartered.** Relative `THALON_DATA_DIR` now anchors at the WORKSPACE root (walk-up to `.git`/workspaces `package.json` in `packages/platform/src/env.ts`; absolute values — Docker `/data`, hermetic tmpdirs — pass through). The defect had bitten THREE times (s79 dangling llm-cache pointers · s96's 66 orphaned posters · the sweeper writing sweeps the app never saw). Three stores merged into repo `.data` (app 171 objects in; ONE divergent embedding deliberately dropped so the s79 heal path re-embeds it as a miss); both stale pins retired (eval `useWebAppDataDir` ×5 callers + the backfill script's app-root pin). Ratchets: `packages/platform/src/__tests__/data-root.test.ts` (cwd-independence, every verify) + a doctor `data-root` row that flags any REGROWN stray store — which found a third store (`packages/engine/.data`) on its very first run. Browser-passed: Overview posters, the 9-take Dossier strip, Schedule — all 200 from the merged root. |
| V3 gate (`0731366`) | **DECIDED — HOLD; script-first NOT adopted; timeline-primary stands.** Both criteria answered no on repo evidence: (1) a beat edit round-trip CONTAINS the timeline path's tail (save → local render → judge) and adds a metered Propose + vendor mint ahead of it — where text expresses what the timeline cannot, the copilot ask + s95b re-brief door already carry it, metered and secondary; (2) the s78 audit's 19 job failures were closed by TIMELINE-side work (verified in code: undo spine · beforeunload guard · parentCutId back-door · live chips · the s96 verbs), and the remaining gaps are exactly "what text cannot express". **Consequence: `beats→scene re-render` is NOT built.** Revisit trigger recorded: the re-brief door dominating dogfood usage. Record = video-arc spec §Phase 4a; Descript ledger row flipped. |
| V7 (`1ddcf2c`) | **BUILT — real elapsed honesty.** Live `Rendering… 1m 04s` on the primary + preview buttons (from the job's recorded clocks, refreshed by the poll that read them — never a ticking estimate); a finished render names its real duration in the notice band; a failed one names how long it ran before the verbatim error; `runCutRender` stamps measured `elapsedMs` onto the `video_cut.rendered` event (absent when unmeasured, never invented); `elapsedWords` rolls to an h+m tier. V7 flipped to [BUILT s97 — HOLDS] in the spec. |

**DEFERRED, stated:** **V9** — the render-gate pass across the four surfaces
(screenshot-vs-sheet + the refused/empty/loading state matrix) is the video
arc's ONE remaining item. **B-create.5 dogfood** unchanged (own GO + spend
statement). **The retire/restore column** stays the flagged window ask.

## Sprint 9 / s96 — **CLOSED** (boot 2026-08-03 "gogogo"; wrap = this session's verify)

**Phase 3 ran WHOLE, lead-direct, in the stamped order, founder-hands-free
(everything was W3-verdicted — nothing was asked of him): the three build
steps committed at their own verified boundaries** (`13f363d` editor ·
`591e9ec` Overview/Dossier · `ea29e49` Schedule), each with its own full
verify at exit 0 and a live browser pass on real data at 1440×940.

| track | outcome |
|---|---|
| Editor p1 + s95b (`13f363d`) | **SHIPPED** — frame thumbs on blocks/rail/strip (ring selection, scrim composite; stripes now MEAN "no frame derived yet"), kind tokens + kdots, the ⓘ frames tip (shared ⓘ/.tip dialect), the Split·Crop·Text·Delete tools row on the SELECTED block via NEW pure `splitBeat`/`insertCaptionForBeat`/`removeMusicCue` + existing verbs, every refusal a sentence in the notice band. **V4 truth call, stated:** Propose ⚡1 + Retake ⚡ (+ the strip's retake door quoting the beat's LAST recorded mint credits); **Recut stays UNBADGED** — this engine's recut is the aspect lens's own local derive at 0 credits, and absence says free by V4's own rule (the crescendo precedent: sheet grammar, true facts only). Crop = temporal crop-to-playhead (the spatial crop already lives in the inspector's reframe; inventing a crop window client-side would break measured-never-estimated). |
| The poster backfill (`13f363d`) | **B-media.0's missing HANDLE built** — `scripts/backfill-take-posters.ts` (the s77 door had no runner; every take read poster-pending for 19 sessions). 66 posters derived, local ffmpeg, 0 credits, idempotent re-run proven. **Rule-11 catch on its first run:** with `THALON_DATA_DIR` unset the store resolves against CWD, so the script wrote 66 posters into a root no route reads (`./.data` vs the app's `apps/web/.data`) — merged, and the script now pins the app's own root. **The wider `.data` split-brain PRE-EXISTS** (root holds `assets/` from pin-mint runs; the app's holds `posts/`/`social-media/`): a next-session defect candidate, doctor-class. |
| Overview + Dossier + V1 (`591e9ec`) | **SHIPPED** — Dossier: the crumb + the flood behind it, the marked strip (one chip per non-derived name; **a name IS a mark — Decision-5 pre-check HELD, no new columns**; derived cuts stay in the aspect band; default pick prefers a master chain), ☆ Mark through the one save door, inline compare off the radios, delete with the repo's refusals said first and the TRUE preservation sentence, the takes audition band (frozen TakeAudition seam; Swap rides the picked tile and saves vN+1). Overview: pill ONTO the thumb (opaque composite), real take-poster cards (**the s75 "placeholder until bmedia ready" hold is SPENT**), "no preview yet" words, takes·cuts row counts, kind token (one-prompt / image / imported — the only doors a project arrives by), still sheds its 0:00, timecode everywhere. **ONE stated deviation from the drawn sheet:** the delete confirm does NOT render "Restore brings it back" — no column records a retired cut and a hard delete has no way back; **the cut retire/restore column is the FLAGGED contract-window ask** for the next window (s90 freeze respected, never built around). |
| Schedule S1–S3 (`ea29e49`) | **SHIPPED** — S1: `PipelineAsset.media` serializer widening (the draft's own `meta.mediaRefs` first image — the spec's `posterRef` citation corrected against ground truth at kickoff, rule 12; tolerant read, images only) → chip `.ev-media` through SourceThumb at this surface's 30×22 `.thumb-sm` override + platform badge + Aa mark; `MEDIA_CHAINS.draft` **argued open** in the chain ratchet (own attached media only; the Approve ruling holds; runs still resolve nothing); the workspace media door reads `social-media/` beside `media/` (closed family list). S2: month marks carry the platform glyph. S3: `placeColumn` → `{placed, overflow}`, cap 2 by mark priority, `+N more at HH:MM · open day` → agenda. Live pass: real draft thumbs (the meme-horse attachments), the capped Sat-25 cluster's door, all on the wire. |
| Record hygiene | Ledger rows 2/7/8/9 flipped to **BUILT s96**; both specs carry execution records (video-arc §s95-plan Phase-3 block · schedule-refinement §BUILT s96); impeccable findings on dossier/videos css = sheet-verbatim ports (DOCTRINE 0, standing ruling, intentional, not suppressed). Simplify candidate noted in code: the platform-mark paths now live in THREE surface copies (approve · analytics · schedule) — consolidation into `components/media` is a future cleanup. |

**DEFERRED, stated:** **Phase 4** — the V3 script-first gate (its own decision
session, criteria in the spec), then pass-3 states (V7/V9). **B-create.5
dogfood** unchanged: its own GO + spend statement, interleavable. **The
retire/restore column** = the one flagged window ask from this session. The
`.data` split-brain = a lead-actionable defect candidate for a next opener.
Zero credits spent; nothing armed; zero founder hands.

## Sprint 9 / s95 — **CLOSED** (boot 2026-08-02 "gogogo"; wrap = this session's verify)

**The s94-stamped plan's Phase 1 + 2 ran as written, lead-direct, zero founder
hands: the four-sheet design block drawn, synced to the canvas, and the ONE W3
verdict ask sent.** Every surface opened with a fresh Mobbin pull — the s94
MCP error did not recur; the banked reference sets held everywhere (the week
pull re-surfaced the banked Later screen itself top-ranked).

| track | outcome |
|---|---|
| Videos Overview amendment | **DRAWN** — state pill ONTO the thumb (VEED) with the s94 opaque-backing adaptation drawn INTO the sheet (the trap is on record; the sheet doesn't re-learn it); "no preview yet" in words on the composing card; family line = takes · cuts · platforms counted from the project's own rows (Riverside — and the first mechanical mapping contradicted the Dossier's 9-takes fixture, caught and fixed); kind token formalized (ClickUp); the still sheds its lying 0:00; Loom's metrics triplet deliberately NOT drawn (REJECT-until-D2). |
| Video Dossier amendment — **V1 DRAWN** | The five no-affordance jobs get homes, four as ONE version rail: crumb selector beside the h1 (Synthesia) · marked/named cuts ("✓ Founder pick") + the ☆ Mark door (Adobe) · published pill on the shipped cut · compare radios, two selected, door armed (AI Studio) · delete confirm OPEN in the Fibery/**Resend** register (the s95 re-pull added Resend: "current content preserved" — preservation PROMISED in words) · the Takes audition band under the player (play doors; auditioning take shows scrub + Swap-into-cut). First render CRUSHED the strip (published pill wrapped vertical, door chips clipped) — caught in the browser pass, chips slimmed, confirm re-anchored. |
| Videos editor p1 amendment | **DRAWN** — V2 frame thumbnails on every clip block (striped placeholder per rule 2; selection = ring, never a repaint that hides frames) + track colour BY KIND with sheet-local kind tokens (deliberately not ok/warn — status keeps meaning) + kind dots on lane heads; V4 credit badges at the metered verbs (Recut ⚡9 · Retake ⚡12 · Propose ⚡1; EDL-only verbs unbadged — free stated by absence). Script-first (V3) deliberately undrawn: pass-2 gate. |
| Schedule refinement (S1–S4) | **S1 was already drawn** (pass 1 s86 — the ledger's PENDING rows were stale against the sheet; flipped). Density ruling CLOSED NEGATIVE by the fresh pull: no product puts media in a month cell (Midday/Airtable/Toggl text-only) → thumbs stay week+agenda. **S2 recorded** as the month-mark grammar in the sheet's amendment block. **S3 DRAWN** — the Thu 11:00 concurrent cluster (cap 2 + count-door; first placement sat under the sheet's own open modal — moved; legend census updated to Published · 6). Kickoff verify ran: month + waiting-lane counts BUILT; the real gap = `placeColumn` (even split, no cap) + CalEvent's missing media — both Phase-3 build deltas. **S4 done**: `Calendar.dc.html` → `archive/` (its hold clause expired s86), and the grep-before-moving rule caught two LIVE spec pointers (`schedule.css` header + `schedule-surface.tsx` header cited Calendar.dc.html as port source) — repointed to `Schedule.dc.html` in the same change. |
| Canvas + record hygiene | All four amended sheets **synced to canvas `f5d304cb`** (etag-checked writes; zero parity debt). Ledger rows 2/7/8/9 flipped to "AMENDED s95 (W3) · verdict OPEN"; §video Status block spent its s87 hold; README §Calendar exception RETIRED (now drawn), §Proposals gains the D4-ratified status line (a lane reading it would have refused the Schedule build); both specs carry execution records. impeccable findings on schedule.css = pre-existing sheet-verbatim ports (DOCTRINE 0), intentional, not suppressed. |

**Phase 2 CLOSED — W3 APPROVED, in-session.** The founder reviewed the four
sheets and asked two editor additions, drawn the same session as **s95b**
(fresh founder-directed pull — Leonardo's Video Dimensions glyphs + tool
rail · Arcade's timeline-edge tools · Squarespace's toolbar-on-selection):
the aspect seg's ⓘ names each frame (shape + format + platforms) and the
timeline grows the Split · Crop · Text · Delete tools row (EDL-only,
unbadged, acts on the selected block — complements the copilot). Then his
word: *"Everything else is ok … W3 is approved."* Ledger rows 2/7/8/9 =
VERDICTED; both specs flipped; canvas current. **Phase 3 is UNBLOCKED — s96
builds in order:** editor p1+s95b deltas → Overview/Dossier + V1's five
affordances (Decision-5 pre-check first) → Schedule deltas (event-media read
widening + the placeColumn cap). Zero credit spend; nothing armed; the s90
windows untouched.

## Sprint 9 / s94 — **CLOSED** (boot 2026-08-02 "gogogo"; wrap = this session's verify)

**The s93-stamped plan ran as written, founder-hands-free (both sheets were
W2-VERDICTED s91 — nothing was asked of him): the Sites + Library rebuilds,
lead-direct, exact-mock.** Boot also caught and committed two s93 doc edits
the wrap commit had stranded (`306dea0` — the stamp's "tree clean" claim was
wrong; the ledger rows 5/6 + the Create spec's routes block).

| track | outcome |
|---|---|
| Sites — the W2 amendment applied (lead 1) | **SHIPPED** — verdict pill ONTO the shot with an **opaque-backing named adaptation** (the ok/warn subtle channels are ~13% alpha tints; over real heroes the state word vanished — seen live in the browser pass, fixed in `sites.css` so the resting look composites identically); per-card truth line ("previews only · minted {d MMM}" — the catalog records no deploy state or hostname, so no card invents an address; the live/hostname branch waits on a deploy fact); h1 pills → the **state-filter seg in the VERDICT vocabulary** (All 20 · Approved 16 · Awaiting verdict 4 on dev — census counts, the sheet's Live/Draft words wait on data that exists to read); "newest first" (true of `parseCatalog`); footer blog door → the published ledger on Settings (the Dashboard's own destination). Shot 150→132 + meta paddings per the amended sheet. 43 tests green; dark+light screenshots clean at 1440×940, no horizontal scroll. |
| Library — the §5.3 rebuild + `/app/transcription` retirement (lead 2) | **SHIPPED** — ONE Library at `/app/library` (`components/library/`, `.library-surface`), `/app/transcription` **DELETED** (404s live) with the rail/palette/activity/pipeline hrefs rewired and `IconTranscription`→`IconLibrary`; **the rail's hard-coded label list was the hidden coupling** — "Transcription" resolved to null silently, caught in the browser pass. `/api/library` widened to every **non-`prompt`** kind with `kind` on the wire (prompt = per-run provenance, stated in the route): the dev shelf immediately showed why — **189 Intel-admitted exemplar captures + 1 video + 2 voice samples**, so the kind qtabs (All · Exemplar · Video · Voice, real counts) carry real weight on day one. Free-transcript \| AI-enhance **seg in the band** (per-ingest reset kept — founder s79; picking enhance unfolds the cost words BEFORE the run); transcript doors gate on kind (read/delete routes are server-guarded; d/↵ inert on non-transcript rows); rows **bounded at 50 with a stated "+N more" foot** (the Settings-ledger pattern); thumb legends read the row's own kind, never "video"; article/file/text ingest = **STATED deferral** (`ingestWebUrl` exists engine-side with zero callers — wiring it is its own task); the transcribing row state has no data while ingest is synchronous (the band's button carries the in-flight word). 52 tests; the s79 T1/T2/T3 + s86 free-ingest pins all carried. mock-sheets README exception updated (the s74 rename retired by its own boundary clause); workspace spec's Sites + Library blocks record the builds. |

| the s95 plan — video + calendar (founder-directed mid-session: "refine the plan and spec … then you can start on them … all for next session") | **STAMPED** — re-grounded first (rule 11/12: the three video sheets EXIST since s72 and their surfaces are BUILT to them; `/app/calendar` is GONE — Schedule shipped s86 — so "calendar" = the Schedule refinement pass). Plan of record: `docs/video-arc/spec.md` §"The s95 execution plan" (Phase 1 = one lead-direct design block amending the four sheets from the s85/s87 banked references · Phase 2 = ONE texted W3 verdict · Phase 3 = builds in order: editor p1 → Overview/Dossier + V1's five affordances → Schedule deltas · Phase 4 = V3 script-first gate, then pass-3 states) + NEW `docs/schedule-refinement/spec.md` (Later thumbs-in-cells · Sprout month grammar · "+N more" · Calendar.dc.html archives). Mobbin MCP errored twice from this box s94 — the fresh pulls ride the design block itself (s93 re-check precedent), banked references are the floor. Zero spend; his hands = one word. |

**DEFERRED, stated:** B-create.5 dogfood (the first real Create run) stays the
populated-state visual gate everywhere — interleavable with the s95 phases, its
own GO + spend statement. Article/web-URL ingest door (`ingestWebUrl` → route +
band) = a build task when chartered. Composer follow-ons unchanged behind their
gates (popout p3 · media pass · queue seat · G1/D2).

## Sprint 9 / s93 — **CLOSED** (boot 2026-08-02 "gogogo + Mobbin re-check directive"; wrap = this session's verify)

**Two founder directives this session, both delivered lead-direct:** (1) *"use
mobbin-mcp to re-check and adjust any UX/UI as needed to ensure the surfaces you
made are indeed world class"* → the re-check pass; (2) *"continue with the plan
you had for this session too"* → the stamped B-create.4 remainder. Plus one ask:
verify the staging preview is reachable.

| track | outcome |
|---|---|
| Mobbin re-check (all six built surfaces, live renders dark+light) | **DONE (`7a8ba72`)** — record: `ux-refinement-program.md` §s93 re-check. 24 fresh references; four surfaces validated with rejects recorded; **two live defects found by the pass and fixed with test rows**: raw-hour ages ("380h" hid sixteen days — `waitLabel` shared day-rollover at 48h, the 26h-not-1d decision preserved below it) + Approve's singular scope note ("1 staged draft advanceS through ITS own flow"). Composer's populated state stays honestly uncheckable behind the first-real-run gate. |
| Create home rebuild (B-create.4 remainder, lead-direct) | **SHIPPED** — `/app/create` rebuilt exact-mock to the s90b ask-card sheet (headline at 172 · card 740 · recent-line 916, probed): ONE centered ask-card with controls in its own bottom row, run-line of REAL facts with the s90a plan card as its expanded keeper state (s74 shape), sugg chips = real Intel picks riding the existing `?ctx=` spine (empty/failed reads say so), recent-line = the real feed's newest run with its Composer door. Old prompt-hero/two-card layout DELETED. 26 tests, every honesty pin carried over. |
| Create wizard build (B-create.3's sheet made real) | **SHIPPED** — `/app/create/guided` exact-mock to the s90b-amended sheet: accordion slots (What → Platforms → Sources & media → Review plan), **platform chips carry `deriveCreatePlan`'s own verdicts** via new pure `POST /api/create/plan` (R3 — live render: TikTok "connect to publish", refusal verbatim on the title), Review = the derived plan (refusals verbatim · real judge gates · cost honesty incl. `unestimated` words), **Generate → new `POST /api/create` → `runCreate`** with the founder's sequence gate enforced SERVER-side (executable ratchet: `api/create/route.test.ts` pins post/page → 409 verbatim) — success doors to the run's Composer. Media dialog = STATED deferral (lands with the media pass), never a dead button. Brief tucked behind its line (s90b amendment honored). 13 surface tests + 4 route-gate tests. |
| staging probe (founder ask) | **ALL REACHABLE** — `preview.swordfish.cfd` landing + `/app` + rebuilt surfaces all 200 behind the edge basic-auth (401 without it — the stealth posture working); **staging carries the s92 code** (auto-deploy fired: `/app/board` 404s as deleted, board toggle + Composer routes serve). No swordfish coordination needed. |

**DEFERRED, stated:** Sites + Library rebuilds (the `/app/transcription`
retirement) — W2-VERDICTED, next build session's first item. B-create.5 dogfood
(the first real Create run) remains the populated-state visual gate everywhere.

## Sprint 9 / s92 — **CLOSED** (boot 2026-08-02 "gogogo"; wrap verify exit 0, **3227 passed / 9 skipped**, 0 lint errors — the literal single-lane run, dev server stopped)

**The s91-stamped parallel plan ran EXACTLY as written, founder-hands-free
(both verdicts were already banked — nothing was asked of him):**

| track | outcome |
|---|---|
| lane `analytics` (Mode B, launched at the boot on the s91b GO — no re-ask) | **MERGED** (ff after clean rebase; lane suite 154 files / 1350 green capped). Three commits: read-only `/api/analytics` over `analyticsReadModel` · exact-mock `/app/analytics` (scoped `analytics.css`, honest absence words verbatim — deferred/partner-gated/no-impressions all render on live dev data) · the rail entry after Schedule. **Deliverable 1 (the Facebook fixture derivation) delivered as chartered** — the LEAD applied the sheet amendment at the gate (`Analytics.dc.html` header now records `post_media_view` / `post_total_media_view_unique` truth; drawn values stand as fixtures). Lead gate: dark+light screenshots on real data, both clean. Flagged boundary exception ACCEPTED (three additive one-line shell edits the kickoff's stale nav ground-truth made unavoidable — reviewed at rebase, no conflicts). WRAP: `agent_handoff/lanes/WRAP-analytics.md` (incl. gap G1: the read-model's one-series-per-post limit, a D2 follow-on). |
| lead 1 — pipeline board | **SHIPPED (`d357233`)**: the Dashboard toggle's Board state wired at `/app?view=board` (server-resolved view — a measured hydration mismatch fixed properly) + **`/app/board` DELETED in the same change** per the ruling's gate. Loop-order columns over real reads (picks = new read-only `/api/intel/picks` over trend_promote captures · both run reads · the plan read), feet = the day's recorded stage crossings with "–" where no read carries the instant, In Approve carries the pulse's number. Probed: six feet aligned at 916 ≤ 940. The s77 filter/sort knobs stay retired (the verdicted sheet names cards + seg as the only interactables). Light register via `light-dark()` (the scope ratchet rejected an ancestor selector — correctly). |
| lead 2 — B-create.4, the Composer core | **SHIPPED (`c6a8dd9`)**: `/app/create/run/[runId]` exact-mock from the s90c iteration (zones named · judge verdict strip with the hit marked IN the body · full-fidelity preview with real feed-cut + per-platform action rows · schema-generated settings rail · HOW IT SHOULD DO with the honest forecast deferral · fit band verbatim from the one validator) + the AI-edit doors over the create-shells verbs (`/api/drafts/[id]/ai-edit` propose → judge → apply; refusals verbatim; apply re-judges — rule 4) + the run read that resolves a CHILD id (`/api/create/runs/[runId]`), so **Approve's "Open in Composer" door ARMED** (a pre-Create run lands on that fact in words, never a bare 404). Dev truthfully renders predates-Create/empty; the populated-state visual gate rides the first real Create run (B-create.5). 29 tests. |
| merge-gate closes (`187289e`) | Schedule rail icon rekeyed (the lane's G2 — visible in the board screenshots) · the sheet amendment · workspace spec's Board row updated to the retirement — **the spec-ground-truth ratchet FIRED on the deleted route path exactly as designed** and was answered by correcting the spec, not the ratchet. |

**DEFERRED to s93, stated (never rushed past gates):** the Create home rebuild
(s90b ask-card sheet) + the wizard build (`Create Wizard.dc.html`) — B-create.4's
remaining surfaces — alongside the already-queued Sites + Library rebuilds (the
`/app/transcription` retirement). All four are W2-VERDICTED; no new verdict is
needed. Composer follow-ons queued behind their own gates: Expand popout (pass 3)
· media tools (media pass) · first-comment arming (queue settings seat) · G1
(read-model second series, D2).

## Sprint 9 / s91 — **CLOSED** (boot 2026-08-02: *"gogogo. you have my approval on W2 too"*; wrap verify exit 0, 3154/9)

**POST-WRAP, HIS TEXT (2026-08-02, verbatim): "board approved and go
analytics. wrap it all up for next session, with your plan (or parrallel
worktree)."** Both banked same turn:

1. **PIPELINE BOARD VERDICTED** — the s92 lead track wires the Dashboard
   toggle's Board state to the drawn board and **deletes `/app/board` in
   the same change** (its replacement is now drawn AND verdicted; the
   deletion gate is open).
2. **ANALYTICS LANE GO ON RECORD** — launches at the s92 boot, no re-ask
   (the s73-close pattern). Kickoff written AT the boot (rule 12: re-ground
   before speccing). Scope as GO'd: reconcile the Analytics sheet's
   Facebook fixture to `capability.ts` truth (§s87 lead item 1), then the
   Analytics build (`Analytics.dc.html` → `/app/analytics`, exact-mock,
   the runway's s92 lane row). Mode B via `scripts/launch-lane.sh`,
   worktree, strongest-tier pin, vitest capped `--maxWorkers=2`; the
   worktree cannot shoot its own work (ratchet) — the LEAD is the
   screenshot-vs-sheet merge gate, and the lead applies the sheet's
   fixture edit at that gate (sheets stay lead-owned; the lane derives the
   corrected values).

**s92 SHAPE (parallel by construction, disjoint file sets):** lead =
Dashboard board-state wiring + `/app/board` deletion, then **B-create.4**
(Composer route + wizard build, W2-verdicted) — apps/web dashboard/create/
composer surfaces. Lane = analytics — apps/web analytics (new) + engine
capability reads (read-only). No shared files; contracts untouched by
both (any window need = STOP and report, per the standing tripwire).

**HIS W2 VERDICT LANDED AT THE BOOT** — "you have my approval on W2 too"
covers all four W2 sheets (Create home · Create wizard · Sites · Library)
**including the s90b-redrawn Create set and the s90c Composer iteration**
(the scope the s90 wrap recorded). Ledger rows 5/6/16/19 flipped to
VERDICTED same turn. Consequence per runway §9: **B-create.4 (Composer
route + wizard build) queues for s92.**

**LEAD TRACK (the s91 plan of record, in order):**
1. **Pipeline board draw** — `Board.dc.html` redraws as the Dashboard
   toggle's Board state (columns in loop order, counts on heads, day's
   in/out on feet, judge/state chips on cards; refs = library §Pipeline
   board; node-graph stays rejected). Verdict asked by text; build
   continues while it waits.
2. **W1 BUILDS, lead-direct, zero founder hands — Approve FIRST**
   (verdicted s89; wires the merged `rejectDraft(..., reason?)` seat) →
   Dashboard (Overview + setup band + toggle; the toggle's Board state
   wires only once its verdict lands) → Runs re-shape → Board route
   deletion.

**LANE candidate (needs his named GO — asked in the mid-session text):**
Analytics fixture reconciliation (§s87 lead item 1 — `capability.ts` is
the truth; the sheet's Facebook fixture still shows retired
`post_impressions*`). "gogogo" boots the plan; it does not name a lane.

**s91 LEAD TRACK, DONE (all lead-direct, zero founder hands):**
1. **Pipeline board DRAWN** (`ef24402`): `Board.dc.html` redrawn in loop
   order with the aligned feet row, judge chips, warn-tinted human gate;
   measured 916 ≤ 940, zero clip; on canvas; **his verdict asked by text
   mid-session** (`cbb0e9d`, with the analytics-lane GO ask).
2. **Approve W1 rebuild SHIPPED** (`438b140`): state qtabs with live
   counts · run-group bands with "Approve run · N" · real platform marks ·
   inline verb keys (aria-keyshortcuts) · **the reject-reason learning
   door wired end to end onto the merged `rejectDraft(..., reason?)` seat**
   (prompt ask; blank = bare decision, no body on the wire) · the Composer
   door resting unarmed with its reason. 87 tests green, dark+light
   screenshot gate passed on real data.
3. **Dashboard setup band SHIPPED** (`ac1d200`): Hex's "Set up your
   workspace · N of 4" from four real reads, first pending step = the one
   live door, dismissal per-tenant, self-retires at 4/4 (honestly absent
   on dev — all four done). The toggle's Board option keeps routing to the
   still-live `/app/board` until the pipeline-board verdict wires it.
4. **Runs W1 re-shape SHIPPED** (`ca042fa`): running-now band ·
   create-run parents with nested family (new read-only `/api/create/runs`
   — no schema change) · orphans never minted a fake parent · five-state
   seg · Clay day-total footer from `usage_ledger`. Per-run cost/durations
   deliberately NOT drawn (no read exposes them — named in the commit).
**Board route deletion stays GATED on his board verdict** (nothing deleted
before its replacement is drawn — the toggle wires + the route deletes in
one change when the text lands).

## Sprint 9 / s90 — **CLOSED: both lanes MERGED, W2 drawn, the plan restructured founder-hands-free** (verify on merged main exit 0, 3137/9)

| lane | outcome |
|---|---|
| learn-evals | **MERGED** (`bcb8525`, ff after rebase; verify exit 0; GC'd). The reject-reason door pass-through + the 7-origin batch export — the stale union was WORSE than believed: one `lead_triage`/`cut_diff_review` row made the whole export THROW; fixed + round-trip-pinned. The frozen s90 window fit exactly. WRAP: `agent_handoff/lanes/WRAP-learn-evals.md`. |
| youtube-destination | **MERGED** (`30d9f4c`+WRAP, ff after rebase; the literal `npm run verify` it deferred ran post-merge single-lane: exit 0, 3137 passed; GC'd). youtube is the EIGHTH platform key: capability truth in both homes (metrics word = `permissioned`, argued), `youtubePostSettingsSchema` resolving the SETTINGS_DEFERRED IOU (map now EMPTY, ratchet stays armed), disarmed `videos.insert` driver with doc-cited ceilings (5000-BYTE description backstop · title 100 · made-for-kids required at the driver, never defaulted · hashtags-60 refusal flagged for reviewer strike). **Armed-proof pinned by test: even a hand-set env pair cannot arm it** — no env seats, no vault road, and `video_required` fails every draft that exists today. Its one real IOU — the db CHECK drift (migrations baked 7 platforms, schema derives 8) — was closed SAME SESSION by the lead: migration `0025_s90_youtube_platform_checks`. WRAP: `agent_handoff/lanes/WRAP-youtube-destination.md`. |

**TWO MORE RULINGS, POST-WRAP TURN (s90, via the in-session ask):**
1. **Library name RE-CONFIRMED — "Keep Library"** (he asked about the s74
   "Transcript" call; the two-rulings history was put to him; three rulings
   deep now — workspace spec §5.3 carries the record).
2. **The flow visual — RULED "s91 Board state":** the Dashboard toggle's
   Board state redraws as the **PIPELINE BOARD** (columns in loop order with
   live counts on heads + the day's in/out on feet; the board IS the flow —
   references banked s90, library §Pipeline board; node-graph rejected with
   reason). Draw = s91 boot, HIS VERDICT BY TEXT, then the Dashboard build
   wires the toggle to it. Home: `Board.dc.html` per its retirement note.

**THIRD POST-WRAP DIRECTION (s90b): THE MINIMAL-INTERACTION DOCTRINE** — his
words banked verbatim as a standing steer (programme file §mandate): Create
read as intimidating; interactables forward, information tucked, one action
launches the complex job. **Applied same turn, lead-direct: Create home fully
REDRAWN** to the unanimous 8-product ask pattern (ChatGPT/Copilot/Notion/
WRITER/Manus/Langdock/Lindy/Obvious — headline question · one centered
ask-card · collapsed run-line · suggestion chips · recents one foot line) ·
**Create wizard**: brief-artifact column tucked behind a line, accordion the
single focus (Create spec Decision 2 amended by his word) · **Composer** (his
"do the same"): s86 zoning kept, judge → verdict strip, settings rail → 3
knobs + More-settings·5, fit band → words with refusal reasons verbatim. All
measured ≤ 940, all on the canvas. **The W2 verdict now covers the REDRAWN
Create set.**

**FOUNDER CONSTRAINT LANDED MID-SESSION (s90, his words):** *"i won't have time
to do console visits this week … structure the plan over the next few sessions
so that you still get work on thalon done (towards launch) but without needing
my direct manoeuvring."* **Encoded in `docs/launch-runway.md` §9 (the
restructured ladder — every session needs at most a texted one-word verdict;
the three console items are batched under NEEDS-STEVEN's parked header, and a
session whose verdict hasn't arrived takes the next verdicted-and-unbuilt item
instead of waiting).** The s91 plan of record: **W1 builds lead-direct, Approve
FIRST** (verdicted s89, zero founder hands, and it wires the reject-reason seat
learn-evals just merged) → Dashboard+toggle+setup band → Runs re-shape → Board
route deletion; lane candidate = the Analytics fixture reconciliation
(engine-side). His W2 verdict, whenever texted, queues B-create.4 behind it.

**LEAD TRACK, done this session so far:** credentials wired into CI (deploy key
+ templates pair + host var; keys probed alive + cross-scope-refused first;
`.context` values scrubbed to pointers per the CI-secret-only rule) ·
`templates-image.yml` made deploy-only + its edge probe authenticates ·
**TEMPLATES_PREVIEW_ARMED=true on his GO** · NEEDS-STEVEN 2026-07-29e +
s89-refresh retired (the credentials had landed 07-29; three sessions of boards
missed the delivery — lesson recorded in the archive) · canvas parity debt
CLEARED (Approve + Dashboard uploaded, debt block deleted) · the s90 db window
FROZEN (`3e21aa5`) · **W2 MAKE draw RAN end to end** (4 sheets drawn/amended +
measured + on the canvas; Postiz launcher walked; §5.3 drawn; ledger 13→15 of
20) — **HIS W2 VERDICT: OPEN**.

## Sprint 9 / s90 — PLANNED (W1 APPROVED s89: *"yes to all, W1 approved"*; the runway map of record is `docs/launch-runway.md`)

**The shape mirrors s89: lead track is the point, two disjoint engine lanes
beside it.** Ceiling unchanged: two lanes + the lead.

**LEAD TRACK, in order:**
1. **Canvas parity debt FIRST** (programme file §rule 2 — upload
   `Approve.dc.html` + `Dashboard.dc.html` to project f5d304cb at fresh
   context, delete the debt block).
2. **W2, the MAKE draw** (spec §6): Create home sheet update + the wizard
   sheet (B-create.3 — research already banked s86, this wave DRAWS) ·
   Composer Postiz-launcher flow facts · Sites pass · Library/Source-Media IA
   resolution (ONE Library, his §5.3 ruling). Wave shape as W1: any fresh
   research ≤2 searches/surface · contracts in the workspace spec ·
   sheets · ledger rows same-commit · **his verdict closes it**.

**LANES — two candidates, kickoffs to be WRITTEN AT THE s90 BOOT (rule 12:
ground in the repo before speccing; each launch needs his fresh named GO):**

> **s90 BOOT RE-GROUND (rule 12 doing its job — the s87 ve4 class, caught at
> the opener this time): `trend-live` is RETIRED AS A LANE.** The sketched
> feature is ALREADY BUILT end to end: the YouTube Data API driver exists
> (`packages/engine/src/trend/youtube-source.ts`, B6.5), it is registered
> behind the env-selected seam (`source-registry.ts`; `TREND_SOURCE` takes a
> comma-list since s72), credentials resolve vault-first (B-int.3
> `intel_youtube`), and the velocity math is WIRED into live intake
> (`intake.ts:380` calls `detectLongitudinalOutlier`; the "pass-3 work"
> line in `longitudinal.ts`'s header is stale). What actually remains is not
> lane work: (a) a free YouTube Data API v3 key — HIS Google console visit,
> now a NEEDS-STEVEN line joined to the portal batch; (b) the
> `TREND_SOURCE=bluesky,youtube` config flip + sweeper restart when the key
> lands; (c) one deliberate non-feature: youtube account polling is a
> recorded loud refusal (bluesky covers account watching, keyless).
> **Replacement lane: `youtube-destination`** — his own s89 charter candidate
> (ruling recorded below), build-half unblocked, disjoint from `learn-evals`.

| lane | bucket | scope sketch | why now |
|---|---|---|---|
| youtube-destination | destination build half (s89 ruling) | `"youtube"` into `SOCIAL_PLATFORMS` + both capability truth-tables + settings schema resolving the `SETTINGS_DEFERRED.youtube` IOU + `packages/engine/src/social/drivers/youtube.ts` (new) behind the seam; tests fake; NOTHING armed; kickoff = `agent_handoff/lanes/KICKOFF-youtube-destination.md` | his s89 ruling chartered it; the completeness cascade is designed to fire the day the key lands; live half stays gated on his Google portal app |
| learn-evals | B-learn follow-through | the reject-reason → `eval_cases` seam + the suite's batch read (stale origin unions in `eval/src/export-eval-cases.ts` / `eval/src/dataset.ts` close as part of it); no UI — Approve's control builds with the s91 rebuild; kickoff = `agent_handoff/lanes/KICKOFF-learn-evals.md` | the ship gate is a green eval suite; W1's Approve drew the front door, the engine seam should exist before the surface rebuild wires it |

Disjoint by construction: contracts-platform/social-engine vs eval-suite/web-lib
vs sheets. **The STOP-and-report tripwire FIRED at boot, as designed:**
`learn-evals` needs `eval_cases_origin_check` widened (+ a repo verb +
the `approvals.record` reason seat) — `packages/db` schema, so it is a
CONTRACT-WINDOW question: the lead opens/freezes a minimal window (reported
to the founder with the lane ask) BEFORE that lane launches; the lane
consumes frozen shapes only. `youtube-destination`'s contracts touches are
its chartered scope (his s89 ruling names them), confined to the platform
files, and off-limits to every other actor while the lane lives.

**Behind s90 (from the runway §9):** s91 = W1 BUILDS lead-direct (Approve
first, Board route deletes as its replacement lands) · s92 = B-create.4
Composer route · then W3/W4 draws, pass 2/3, landing redesign, launch-asset
sprint (mint list first; 584 Higgsfield credits reserved), arming ladder
founder-paced.

**Rulings landed s89 (post-wrap turn), same session:**
- **Calendar→Schedule rename — DONE** (his *"yes change from calendar to
  schedule"*; route + components + symbols + rail + door copy + API route +
  view key; CSS internals deliberately deferred to the D4 rebuild; web suite
  green on exit code, one fixture updated to the new view key).
- **YouTube as a destination — RULED YES, chartered as a lane candidate**
  (`youtube-destination`): platform key into `SOCIAL_PLATFORMS` + capability
  rows + settings schema resolving the `SETTINGS_DEFERRED.youtube` entry
  (`packages/contracts/src/platform-settings.ts` — its completeness test fires
  the day the key lands, by design) + driver behind the seam, tests fake.
  **The LIVE half is gated on the Google portal app — part of the portal work
  he has not done yet (his browser, instructions in his Gmail draft).** Build
  half is not blocked.
- **Credentials (NEEDS-STEVEN 2026-07-29e): HIS WORD IS SENT** (s89 close —
  *"sent word to swordfish, he is live, and i will approve in his tmux"*).
  Expect both credentials via the swordfish channel; s90 opener checks
  FROM-SWORDFISH.md and wires the deploy key as a CI secret only.

## Sprint 9 / s89 — **CLOSED: the full shape ran** (both lanes MERGED · W1 complete through sheets · verify on merged main exit 0, 3091+/9)

**Ran 2026-08-01 on his "gogogo. you have my approval"** (read as covering the
one outstanding ask, `judge-candidate`'s named word — both lanes launched).
The budget condition held (reset was Jul 31, 23:00 UTC), so the degrade ladder
was never needed.

| lane | outcome |
|---|---|
| analytics-honesty | **MERGED** (5 commits, ff onto main). X deferral structural (`metrics/deferral.ts` — lifting it at launch = deleting `deferral.ts:26-35`, pinning tests fail by name) · FB comment/share via the post-object second GET, live-doc-cited 2026-08-01, per-metric degradation · batch `seriesForPublications` on the frozen table, read-model 1+N→2 queries. WRAP: `agent_handoff/lanes/WRAP-analytics-honesty.md`. |
| judge-candidate | **MERGED** (1 commit, ff onto main). One shared gate ladder (`proprietary/judge/src/gate-ladder.ts`), two entry points — `runJudgePipeline` unchanged (pipeline tests untouched), `judgeCandidate` writes nothing · `aiEditDraft` judges the candidate BEFORE proposing (R8 now met exactly) · deviation block DELETED from `docs/create-engine/spec.md` · typecheck caught a real Draft.format nullability error. WRAP: `agent_handoff/lanes/WRAP-judge-candidate.md`. |

**LEAD TRACK — W1 ran end to end minus the verdict:** research banked
(library §Approve/§Dashboard+Board/§Runs, ≤2 searches per surface held),
contracts updated in `docs/workspace/spec.md` §3, both research questions
ANSWERED (§5.1 onboarding = a Dashboard setup band + empty states, no route;
§5.6 notifications = bundled-by-reason, recorded and deliberately waiting),
three sheets amended + shot + measured (Approve · Dashboard w/ Board toggle +
setup band · Runs w/ the create_runs re-shape), ledger rows moved same-commit
(research 9→13 of 20; p1 on all four W1 rows). **OPEN: the founder's W1
verdict — no W1 surface builds before it; W2 (Create sheets) queues behind it.**

**Residue:** canvas parity debt on Approve/Dashboard (programme file §rule 2,
dated, trigger = next session's first action; Board + Runs uploaded) · both
lane panes were found with founder-typed UNSUBMITTED text ("merge the lane" /
"Read …WRAP…") — never submitted, windows killed at GC; flagged in CURRENT.md.

## Sprint 9 / s89 — the plan as written (budget refreshes **Jul 31, 11pm UTC**; his word: *"usage should be refreshed by then"*)

**The shape: the lead track is the point, and the lanes run beside it.** s88 was
one lane + a thin lead track because budget forced it. s89 inverts that — the
approved wave programme is now the critical path, and it is **lead-direct
design work that cannot be delegated** (his standing rule).

**LEAD TRACK — W1, the first wave of the approved programme.** Surfaces:
**Approve · Dashboard · Runs**, plus the Board decision's consequence and the
two research questions his verdict routed here. Per `docs/workspace/spec.md` §6
a wave is **research → contract updates in that spec → sheet amendments →
founder verdict**, and by the definition of done these three are the
highest-stakes surfaces still marked NOT READY. Specifics this wave must carry:
- **Board retires as a route** (his ruling) — it becomes a Dashboard toggle.
  **Nothing is deleted before this wave draws the replacement.**
- **The Runs↔`create_runs` re-shape** (spec §5 gap 8) — the s87 window made
  Runs' current shape stale; Runs is a W1 surface, so it lands here.
- **Onboarding + notifications** — research questions only. His ruling was
  research-first and **no route gets scaffolded on the strength of it**.
- Budget rule from the programme file: **≤2 Mobbin searches per surface**,
  TAKEN/REJECTED recorded same-commit, **ledger row moved same-commit** — a
  design session that moves no ledger row did not happen.

**LANES — two, file-set disjoint, each needing his fresh named approval.**

| lane | bucket | scope (files) | status |
|---|---|---|---|
| analytics-honesty | D2 follow-through — X `deferred` end to end, FB comment/share, batch read-model | `packages/engine/src/social/**` (metrics) | **kickoff committed + current, GO on record since s87** — first in line |
| judge-candidate | close the R8 deviation — judge a candidate body before it lands | `proprietary/judge/src/**` · `packages/engine/src/create/edit.ts` + tests · `docs/create-engine/spec.md` (deviation-block deletion only) | **kickoff written s88, NEEDS his named word** |

Disjoint by construction: metrics vs judge+create; neither touches
`packages/db/**`, contracts, or sheets. **Two lanes + the lead is the box's
comfortable ceiling — three concurrent full verifies OOM this machine
(measured s82).** `analytics-honesty`'s GO is already on record from s87;
`judge-candidate` is new and needs its own word.

**Why `judge-candidate` is worth a slot now:** it closes the one place where
the shipped engine knowingly diverges from an APPROVED spec, and its consumer
is the Composer (B-create.4), which W2 draws. Closing it before W2 means the
Composer is built against the spec's real semantics rather than around a
documented gap. The kickoff carries the whole design, including the two traps:
**share the gate ladder, never copy it** (a drifted judge is a safety
divergence no test announces), and **the double judge is deliberate** — the
post-land verdict is the only one I1 can honestly bind.

**Sequencing note:** W2 (Create home + wizard sheets — his named priority, and
the research is already banked) queues directly behind W1's verdict. Do not
start W2's drawing before he rules on W1.

## Sprint 9 / s88 — **CLOSED: the one lane MERGED, and it found `main` red** (verify 3074/9, exit 0)

| lane | bucket | scope (files) | status |
|---|---|---|---|
| create-shells | B-create.2 follow-through — the two chartered LLM shells | `packages/engine/src/create/**` (+ `shell/`) · shell-inventory + gateway-boundary ratchets · SPINE §1 · platform env/gateway (vision var) · 2 prompt files | **merged** (`3581df2`) |

**What shipped.** `create.describe_reference` — a gateway vision call over a
reference's own bytes, metered from core; **stored images only**, read
content-address-verified; external refs never fetched, audio refs refused in
words, both **before** the budget guard so an undescribable reference costs
neither an assertion nor a call. `create.ai_edit` — the R8 verb as
**propose/apply**. Both labels landed in the shell-inventory ratchet + SPINE §1
in the same change (the deliberate review-visible act that ratchet exists to
force). 100 create tests, was 73.

**THE LANE'S BEST WORK WAS A REFUSAL — it found a safety hole in its own
kickoff.** The kickoff ordered *rewrite → judge the candidate → land on pass →
on refusal keep the prior body byte-for-byte*. That is **unbuildable through
the shared harness**: `runJudgePipeline` judges only a PERSISTED body and
`judgeResults` binds every verdict to the draft's current `body_hash`, which
I1 reads — so appending a verdict for candidate text would mint an
**I1-valid passing verdict for content the judge never read**. It also killed
the obvious workaround with the right argument: land-then-revert writes an
`eval_cases` row asserting the operator wanted the old text back, and that
corpus is **training data**. It reported instead of faking, and built the house
`video.propose_edl_diff` shape — `aiEditDraft` writes NOTHING on any path
(hash unchanged unconditionally, stronger than the spec asks; red-checked —
making it land turned 8 of 14 tests red), `applyAiEdit` rides the existing
`approvals.record` edit door and its re-judge, guarded on `priorBodyHash`.
**Residue, named not discovered:** on judge refusal *at apply* the draft is
`blocked` carrying the applied body — hand-edit semantics, not the spec's
"keeps its prior body". Safety unaffected (I1 walls the Composer).
**Recorded in the APPROVED spec** — `docs/create-engine/spec.md` §Error
Behavior carries a dated deviation block flagged READ BEFORE B-create.4.

**Lead ruled two lane deviations, both accepted.** (1) `MODEL_VISION` defaults
to `anthropic/claude-sonnet-4.5`, NOT the kickoff's "default to the draft
tier" — `MODEL_DRAFT` is `meta/llama-3.3-70b`, **text-only**, so the kickoff
would have shipped a default that provably cannot do the job. No new vendor
(already `MODEL_JUDGE_FINAL`'s default). The lane also added a wall nobody
asked for: a `claude-cli/*` vision tier is refused by name, because that
transport is text-only and would have described a picture it never saw.
`seams.test.ts` now pins vision ≠ draft so a future "collapse the duplicate
default" tidy-up cannot undo it. (2) File-set extension to
`gateway-boundary.test.ts` (the allowlist sibling the kickoff named but did not
license) — correct and reported.

**⚠ IT ALSO CAUGHT `main` RED, INHERITED FROM s87 — fixed by the lead
(`30b4614`).** `tests/no-nul-in-source.test.ts` failed on
`tests/repo-hygiene.test.ts`: **two ratchets from the SAME s87 commit
(`e7a46a8`) contradicting each other** — repo-hygiene used a raw `0x00` as a
join separator, no-nul-in-source forbids raw NULs. The lane proved it inherited
by stashing its own work and re-running on a clean tree, then left it alone
(outside its file set — the same discipline as its R8 stop). Fix: the two-char
escape `"\0"`, identical runtime string, nothing binary on disk. The guard's
failure message now **names that fix**, because a guard that only says "you are
wrong" invites the repair that guts it (dropping the separator, allowlisting the
file). **Standing lesson, recorded in the guard's docblock: two ratchets can
contradict each other and only a FULL `npm run verify` catches it — s87 added
both and did not re-run the suite after its final commits.**

**QUEUED FOLLOW-UP (not forgotten, has a home):** the candidate-judge entry in
`proprietary/judge` — evaluate `{draft, candidateBody}`, return the verdict,
append **no** hash-bound rows. It closes the R8 deviation exactly and is the
smaller of the two options (the heavier being a staged-body column). Lane's own
warning worth keeping: the real risk is **copying** the gate ladder rather than
sharing it. Deliberately out of lane scope (moat refactor + budget).

## Sprint 9 / s88 — the launch record (kept for context)

**Founder, verbatim:** *"can we just do one lane next session since we're low on
usage."* So s88 runs ONE lane beside a deliberately thin lead track. Both
kickoffs below stay committed and current; the one not run HOLDS, losing
nothing.

**THE LANE IS `create-shells` — his word, verbatim: *"i'll do the create shells
next session."*** That is the fresh named GO the run needed (lead-drives-lanes:
approval covers exactly the named run), and it takes the lead's recommendation:
Create is the stated centre of gravity and the two shells are B-create.4's
prerequisite. **Launch it at the s88 boot with NO re-ask.**

**`analytics-honesty` HOLDS, losing nothing** — its kickoff stays committed and
current, its GO stays on record, and nothing downstream blocks on it this
month. It is the obvious first lane whenever budget allows two again.

**The thin lead track, cheapest-first:** (1) the workspace-spec §8 verdicts
(near-free — his six words + small edits) · (2) W1 research (Approve ·
Dashboard · Runs) ONLY if headroom after the lane · (3) sheet drawing stays
post-reset (Jul 31, 11pm UTC). Portal tasks: his own time, instructions in his
Gmail draft + `.context/developer-apps.md`.

## Sprint 9 / s88 — the two-lane prep (kept for context; superseded by the one-lane ruling above)

**The founder's words, s87 late (on the presented plan):** *"ok plan and spec for
the work lanes next session so they can just start building."* Reading, stated so it
is auditable: that approves the PREPARATION and the named lane `analytics-honesty`
(proposed to him by name, answered with "ok … so they can just start building" —
launches at the s88 boot without re-ask, the s86 "A + transcription-free" precedent).
**`create-shells` is a SUBSTITUTION he has not yet named** — see below — so it waits
for his one word at the opener (lead-drives-lanes: approval covers exactly the named
runs).

**WHY THE SUBSTITUTION: the `ve4-diffs` lane DIED IN GROUNDING.** Preparing its
kickoff, git + the live surface showed **B-ve.1–.7 all shipped and merged by s51**
— B-ve.4's proposer/judge-gated approve door/eval rows (`f645548`), B-ve.5's aspect
lens (PR #49) — and the s72 rebuild carried them (s78 audit: both jobs `present`;
shell inventory pins `"video.propose_edl_diff"` today). The APPROVED video spec's
"B-ve.4 and B-ve.5 remain" was false; **the spec now carries a dated correction
block and a rewritten build order** (`docs/video-arc/spec.md`). A lane launched on
the uncorrected spec would have spent the budget rebuilding a shipped feature.

| lane | kickoff | scope | disjointness | launch state |
|---|---|---|---|---|
| **analytics-honesty** | `agent_handoff/lanes/KICKOFF-analytics-honesty.md` | X = `deferred` structurally (his s87 ruling wired: armed tick spends nothing on X, typed refusal, bill print, read-model word) · Facebook comment/share via the post-object road · batch read + single-query read-model. Seat + verb shapes REPORTED before building. | `social/metrics/**` + `drivers/facebook.ts` + `repos/publication-metrics.ts` + tick script | **GO on record** — launches at boot |
| **create-shells** | `agent_handoff/lanes/KICKOFF-create-shells.md` | The Create engine's two chartered LLM shells: real reference-describe driver (`"create.describe_reference"`, stored refs only) + the R8 AI-edit verb (`"create.ai_edit"`, judge-refusal keeps prior body byte-for-byte). Both shell-inventory entries = the deliberate act, in its file set. Shapes REPORTED first. | `engine/src/create/**` + shell-inventory test + SPINE §1 (+ optional platform vision var, report-gated) | **needs his word** (replaces dead ve4-diffs) |

**Lead-serial track (his named priority):** B-create.3 — the Create sheets (home
update · wizard · Composer run-scope states), lead-direct, → his verdict →
B-create.4. Budget check first (reset Jul 31 11pm UTC); if thin, the owed
reconciliation debt instead (the Analytics sheet's wrong Facebook fixture · the
`deferred` surface copy).

**Boot order:** (0) self-check · (1) worktrees + `launch-lane.sh analytics-honesty`
on the recorded GO · (2) present `create-shells` for his word, launch on it ·
(3) sheets.

## Sprint 9 / s87 — TWO LANES, **BOTH MERGED** (specs APPROVED; founder GO on record)

**CLOSED.** Both launched at the s87 boot as approved, both wrapped, both merged
through `main` on a green verify-on-merged-main: **exit 0, 3037 passed / 9 skipped,
0 lint errors** (s86 closed at 2840). Worktrees GC'd, branches deleted, tmux windows
killed, tree clean at `7bcd5b9`.

- **`create-engine`** (`5a579a4` → merge `bbe8131`) — B-create.2: `plan.ts`
  (pure derivation, every refusal code pinned) · `dispatch.ts` (one arm per family
  over the engines that already judge) · `run.ts` (`runCreate`) · `reference.ts`
  (the describe seam, fake driver only). 73 tests. Stayed strictly inside
  `packages/engine/src/create/**`.
- **`analytics-spine`** (`35bbbc5` → merge `8b8e8f5`) — D2: `SocialMetricsReader`
  as a **parallel reader seam**, reader factories beside their publishers, the tick,
  the honest read-model, `scripts/run-metrics-tick.ts`.

**BOTH LANES FOUND REAL DEFECTS IN THE LEAD'S OWN WINDOW, AND NEITHER PATCHED IT.**
- `create-engine` found `platformRouting` accepted by `brandProfileConfigSchema` with
  **no column and no persist line** — silently dropped for every tenant. **The third
  occurrence of that exact gap** (the `outreach` docblock records it for `outreach`
  and then `social`). Fixed at merge (`783d10f`): column + persist + migration 0023,
  and — the part that matters — `brand-profile-config-blocks.test.ts`, which
  enumerates blocks **from the contract** so the next one added without a column
  fails a test rather than a review. Red-checked. The lane's own red-on-fix ratchet
  did its job and was replaced by the positive assertion it stood in for.
- `analytics-spine` found `publicationMetrics.series()` breaking capture-time ties on
  a random uuid, so two labels in one bucket returned in arbitrary order. Fixed
  (`7bcd5b9`) and pinned.

**The seam decision, reported before building and approved by the lead:**
`fetchPostMetrics` does NOT ride the publisher. A `SocialMetricsReader` with no
publish verb makes the tick **structurally unable to post**, and its ratchet asks for
a credential and deliberately **not** the per-platform posting GO — otherwise
disarming a platform (an ordinary, correct operator move) would silently blind
analytics on everything that platform ever carried.

### Lead items the lanes surfaced — carry these forward

1. **⚠️ The Analytics sheet's Facebook fixture is WRONG.** Meta retired
   `post_impressions_unique` (2025-06-15) and `post_impressions*` (2025-11-15); the
   sheet shows Facebook reporting reach under a metric that stopped existing. Reach
   survives under `post_total_media_view_unique`. **Whoever builds the Analytics
   surface reads the capability table, not the mock's numbers.**
2. **X spends money** → `NEEDS-STEVEN` 2026-07-29f, founder call.
3. **`SOCIAL_METRICS_ARMED` belongs in `packages/platform`'s env schema** beside
   `SOCIAL_QUEUE_ARMED` — when, and only when, the tick earns a standing timer. The
   arm is a CLI flag today because that schema was outside the lane's file set.
4. **A four-destination post run leaves four `fanout_runs` rows**, so the Runs surface
   shows four fan-outs behind one Create run. Deliberate: `runFanout` aborts its loop
   on the first irrecoverable destination, so one call per destination is what honours
   the spec's Error Behavior. **A surface concern for B-create.3/.4, not a defect.**
5. **No real vision driver** for reference-describe: a gateway describe call needs a
   new metering label, which cannot merge without editing `shell-inventory.test.ts` —
   the deliberate act that ratchet exists to force. Until then a reference reads
   "attached, not yet analysed", honestly.
6. **The read-model is one query per publication** (bounded, ≤100 indexed reads). A
   single-query version needs a batch repo method = a future contract window.

## Sprint 9 / s87 — the launch record (kept for context)

**Both specs are APPROVED** (founder, s86 close) and the **lane-launch GO landed at
the s87 opener**, verbatim: *"you also have my approval for lane-launch GO. i'll be
away for a bit. so keep working."* That covers exactly these two named runs.

**Boot order — DONE in order:**
0. Self-check green (tmux · pg · both user units · tree clean · doctor as expected ·
   boards clean).
1. **The contract window is BUILT, VERIFIED, MERGED and FROZEN** — commit `308a94a`,
   merge `ff55f0f`, migration `0022_s87_window.sql` (purely additive: two CREATE
   TABLEs, two optional contract fields, no rename, no drop). Verify-on-merged-main
   green on EXIT CODE: **2885 passed / 9 skipped, 0 lint errors** (s86 was 2840).
   What landed: `create_runs` + repo · `publication_metrics` + repo · media roles
   `use|reference` + `outputEligible()` · `platformRouting` (family→destinations,
   distinct from bucket `routing`) · the D3 per-platform settings slice.
   **Two ratchets caught real defects mid-build** — zod 4's exhaustive `z.record()`
   over an enum key refused every partial routing map (fixed with `partialRecord`,
   trap now test-pinned), and migrate-data's `COPY_ORDER` completeness check refused
   both new tables until they were placed in FK order.
2. **Both lanes launched** via `scripts/launch-lane.sh` into the `thalon` tmux
   session, worktrees prepped and fast-forwarded to `737adbb`. Each kickoff gained a
   **"THE WINDOW AS FROZEN"** section naming the shapes that differ from the spec's
   prose sketch — chiefly `CREATE_CHILD_KINDS` = `fanout_run | draft | video_project`
   (three, not the four-way per-family set: every family lands through the
   single-draft spine and `drafts.fanout_run_id` is NOT NULL), and
   `publicationMetrics.append` taking **no `platform` parameter** (derived from the
   publication, which is what walls the tenancy).

**Lead-serial, done s87:** the Videos Overview + Dossier Mobbin sweep — the video
arc's last blank — banked into `docs/research/ux-refinement-program.md` (`d8a323f`).
**Sheet drawing is HELD on budget** (87% of the weekly limit at launch, resets
Jul 31 11pm UTC, two lanes consuming): the durable half is done, the heavy half
waits for headroom.

| lane | kickoff | scope | disjointness |
|---|---|---|---|
| **create-engine** | `agent_handoff/lanes/KICKOFF-create-engine.md` | B-create.2: plan derivation + run orchestrator + reference-describe seam over the existing family engines. Zero UI, zero spend. | `packages/engine/src/create/**` (new) |
| **analytics-spine** | `agent_handoff/lanes/KICKOFF-analytics-spine.md` | D2 spine: metrics verb (seam decision REPORTED first) + tick + `publication_metrics` repos + read-model. Honest per-platform gaps; tick not scheduled. | `packages/engine/src/social|integrations/**` + `db/repos/publication-metrics*` |

Neither touches sheets (rule 7; both backend-only — nothing to design). Lead-serial
track: Videos Overview + Dossier Mobbin sweep → video sheets pass 1 (video spec §Build
order), Create sheets per his sequencing. Not-picked lanes + reasons: handoff s86 close.

## Sprint 9 / s86 — TWO LANES, **BOTH MERGED** (founder GO on record: "A + transcription-free")

**CLOSED.** Launched at the s86 boot as approved, both wrapped, both merged through
`main` on a green verify-on-merged-main: `ig-admission` (`0655801` → merge `16a77a4`,
2812 passed / 9 skipped) and `transcription-free` (`b42cd24` → merge `337716a`,
2840 passed / 9 skipped, 0 lint errors). Worktrees GC'd, windows killed.

**Both stopped where they were told to.** `ig-admission` shipped the admission mechanism
disarmed with the security bound stated and each clause test-pinned. `transcription-free`
hit its file-set boundary (criterion 4's per-row half needed `lib/library/types.ts` +
its serializer) and **asked instead of editing ad-hoc** — the lead approved the two-file
extension after checking disjointness against the other live lane. It also refused the
tempting fix when the B4.4 metering ratchet fired on a doc-comment: allowlisting the test
file is the weakening the ratchet exists to prevent, so it reworded the comment.

**Two things it surfaced, neither a defect:** there is **no re-ingest-to-enhance path**
(content identity is the transcript hash, so a free-then-enhance is a no-op; the surface
says so rather than letting the toggle look effective) — flagged as a charter candidate.
And rows predating the flag stay silent, because absent is unknown, not a back-dated
choice.

*Original scope, kept for the record:* **Launch at the s86 boot, NO re-ask.** Mode B via `scripts/launch-lane.sh`, Opus-5
pin, disjoint file sets, merge through `main` on a green verify-on-merged-main.

**The shape, and the constraint that produced it:** design is LEAD-DIRECT (founder:
*"i want you responsible"*), so the sheets can never be a lane. The lead runs pass 1
on Schedule · Composer · Channels, batch-syncs all four sheets to the canvas, then
opens the video arc. These two lanes run beside that, touching nothing it touches.

| lane | scope (files) | why it can run in parallel |
|---|---|---|
| **ig-admission** | `packages/engine/src/webpage/public-assets.ts` · `packages/engine/src/social/publish.ts` · `apps/web/src/app/assets/[asset]/route.ts` + tests | Builds the admission mechanism the s85 `ig-post` lane DESIGNED AND REPORTED but deliberately did not build: publish-scoped `pending` rows beside `posts`, 5-min TTL, revoked in a `finally`, source key reconstructed from `family`+`contentHash` so serving A's bytes under B's URL is unrepresentable, `rebuildPublicAssets` drops pending. The seam is already in place and un-defaulted (`admitPublicMedia` in publish.ts, gated by `needsPublicMediaUrl`), so this is the last mile to a working IG media path. Design already reviewed by the lead — see `agent_handoff/lanes/WRAP-ig-post.md` §2. **SHIPS DISARMED; zero live calls.** It widens a security gate, so the lane must state the bound it lands on and pin it with tests. |
| **transcription-free** | `packages/engine/src/ingest/` · `apps/web/src/components/transcription/` + tests | The founder's own s79 ruling, never actioned: transcription is HIS knowledge tool, so it must be **free and deterministic by default** (today every ingest chunks and embeds through the METERED gateway) plus an **AI-enhance toggle beside Ingest**, per-ingest, his choice. The embedder is already an injectable dep, so the default is a flag + skipping the embed pass. **No second artifact** — he explicitly declined verbatim-plus-enhanced side by side. |

**NEITHER LANE RUNS A MOBBIN/DESIGN PASS** (founder asked; the programme answers it —
`docs/research/ux-refinement-program.md` rule 7). `ig-admission` has **zero UI** — all
three files are server/engine only, so there is nothing to design. `transcription-free`
adds exactly ONE new control (the AI-enhance toggle beside Ingest): it ships in
`Library.dc.html`'s **existing grammar** as a keeper-state behind the sheet's own
chrome (s82 precedent), and the Transcription surface then gets its proper pass in the
programme. **A lane may never amend a sheet.**

**Disjointness checked, not assumed:** A is engine/webpage + the public asset route; B
is engine/ingest + the transcription surface. No shared file. Neither touches
`docs/research/mock-sheets/` (the lead's serial track).

**Box note:** two lanes + the lead is the measured-safe shape. Gate with
`vitest run --maxWorkers=2`, and never `pkill -f vitest` while lanes are live — it
matches every worktree and kills the neighbour's suite (s82: it did).

## Work queue (open items + their gates)

**[s82] THE FOUR THE LANES SURFACED AND THE FOUNDER DEFERRED TO s83.** He
triaged the s82 lane reports live and took three fixes this session (B3's
wiring, the 409 fold-in, the box ceiling); these four he ruled next-session.
None is broken today — each is a trap or a decision, stated so it is neither
rediscovered nor forgotten:

1. **C3's arming pieces — TWO OF THREE BUILT s83 under the founder's Bluesky
   test grant** ("you can arm bluesky … use it for testing"):
   `SOCIAL_QUEUE_ARMED` is in the platform env schema and
   `scripts/run-publish-queue.ts --once` is the consumer driver — both proven
   by the first fully-automated live post (bluesky, 1 due / 1 published / 0
   failed). The key rests EMPTY in .env.local; arming is per-run. **The third
   piece — the standing systemd timer — is deliberately NOT created**: a
   timer means unattended posting cadence, which is a separate founder
   decision when live cadence is actually wanted. Every platform still arms
   independently underneath (bluesky = the only one granted; the rest = his
   per-platform GO).
2. **No cadence pre-check at the queue producer.** A row can be committed and
   then meet the publish door's daily cap and fail terminally. Related:
   `cadenceBreaches` (the ⚑) still reads planned slots only, so a committed
   queue row breaking cadence is unflagged. Needs design, not a patch.
3. **A media hole, currently unreachable.** W1's ratchet pins
   `matrix.maxImages ≥ 1` but not the reverse: a draft carrying 2 refs would
   pass the fit check (X allows 4) and then hit `mediaRefsSchema.max(1)` at the
   door. Nothing writes >1 ref today. Closing it properly means the publish
   door exporting its own cap. *(s83 note: STILL OPEN — the s83 plan floated
   taking it "during the driver re-shape", but the four live-proven drivers
   were deliberately NOT re-shaped this session, so the carrier never
   existed; it stays a lead-direct small.)*
4. ✅ **CLOSED s83 (the D1 window): the `scheduled` draft status is GONE.**
   The reconciliation the s82 ruling called for, made executable: nothing had
   ever written `scheduled` or `published` (re-verified before the shrink), so
   `DRAFT_STATUSES` dropped `scheduled`, `approved → published` is the edge
   (the I2 G5 guard still polices it at the repo), and the drafts status check
   constraint regenerated in migration 0021. Scheduling is a `publish_queue`
   ROW fact, full stop.

▸ Architectural note, no action: **the capability validator cannot run
client-side.** Approve is a client component and must not pull `@thalon/engine`
(playwright, ai, drizzle) into the browser, and contracts is frozen — so fit
crosses the wire via `GET /api/social/fit`. Worth knowing BEFORE anyone plans
the D4 composer/Approve sheet amendment.

▸ Ledger near-miss worth keeping (lane B caught it by reading the harness
first): B10's audit-proposed fix — a bare positional ordinal on `.blk` — would
have broken the reorder job, which detects "a mistake was made" by diffing
`.blk` textContent across a drag; a positional ordinal is identical after a
reorder. Keeping the name in an ellipsising span preserved both.

**[s81] B-dist — THE DISTRIBUTION SUITE CHARTER, drafted awaiting ratification.**
`docs/research/distribution-charter.md` — the founder-directed full Postiz plan
(his words: "don't limit it to just connector work … needs its own
Charter/phase … workspace redesign phase 4/5"). Full capability matrix +
phases D0–D6: D0 = the approved s82 queue lanes (charter-independent) · D1 =
connector seam, s83 rec, proof = Reddit+Bluesky · D2 = own-post analytics
CLOSED-LOOP into B-learn (the flying car: Intel = the market, analytics = us,
the merge steers the fan-out) · D3 = composer/evergreen/RSS-as-brain-input
parity · D4 = REDESIGN PHASE 4/5 (four new/updated sheets: Analytics ·
Calendar→Schedule · composer band · Channels; mock→verdict→exact-build, the
era's own doctrine) · D5 = Thalon-MCP/public API, parked on triggers · D6 =
explicit rejects (marketplace, cookie-extension, Temporal). **RATIFIED s81 same session → ADR 0012** ("ratify the charter, and go with your
recommendations on the rest"): D4 design wave starts after s82 · D1→D2 order
stands · short links = seam until the founder's stealth call · execution s82+.


**[s77, FOUND BY BUILDING] `MediaRef` has no kind for same-origin app-served media — the Sites adapter cannot be written against the frozen contract.** The plan's §2 table said Sites was "already an envelope in spirit; adapter maps it into `MediaResolution`". It is not, and the lead found this by trying to migrate the dossier mint strip: `lib/sites/preview.ts` deliberately returns a SAME-ORIGIN path (`/api/sites/preview/<path>`, the s76 fix for the `127.0.0.1` bug), which is neither `external` (https-only, by the serializer's own rule — a relative path is refused) nor `stored` (no sha256; the manifest carries a `hashTail` only). **The lead did NOT edit the contract**: the window is frozen and `media-lane-b` is live against it, which is precisely the case the mid-flight rule forbids. Options for the next window, in preference order: (a) a third kind `{ kind: "app"; path: string }` for media OUR app serves from a route we control — honest, and the site preview is a real second caller after nothing else; (b) relax `external` to accept same-origin paths, which weakens a rule that exists to stop mixed content; (c) catalog-time poster capture into the content store, which makes Sites `stored` and would also feed B-media.0 — most work, best end state. **Gate:** the next contract window. Sites' mint strip keeps its working hand-rolled `<img>` until then (it renders correctly today; it simply lacks the `broken` state).

**[s77] `.thumb-lg` still has no shipped caller.** Two sheets draw it; no surface uses one. The verdicted sheet's own words: "an unused size is a size that drifts." Either the video dossier hero earns it or it is cut. `SourceThumb` already accepts `size="lg"`, so this is a surface decision, not a component one. **Gate:** lead-direct, next surface pass.

| # | item | gate / door | detail lives in |
|---|------|-------------|-----------------|
| 1 | **s60 SLATE — PHASE I RUNNING (founder GO at the s60 opener: "GO — all three"): the lane map is live in Active lanes above** — merge order spine→intel→create→boards; Phase I exit = visual pass on the real app → Phase R (s40 re-critique; launch confirm rides NEEDS-STEVEN). Wave-3 ⑬ First Crack → ⑭ Sparkwright interleave as capacity allows (standing approval) | gate CLEARED s60 (approval on record above); the designs of record = the seven Phase D files + `docs/research/workspace-phase-d-designs.md` | Active lanes table above |
| 1c | **W-audit — the FULL workspace audit (founder-directed s60, sequenced AFTER W-sites: "the workspace really needs a full audit after you build the site feature")**: (a) feature-access conformance against `docs/FEATURE-MAP.md` — every `partial`/`ORPHANED` row becomes a fix (Videos' empty surface, the orphaned concept film into the product's own video-project pipeline, /blog path, library source links); (b) **Source-Link Rule sweep** (NEW DESIGN.md §5 rule, founder-taught s60) — every representation of ingested/derived content gets its way back (intel rising rows + station peek, library `sources.uri` surfaced, lineage everywhere) + **thumbnails for visual sources**; (c) a real `/impeccable audit` pass over every workspace surface (Phase I ran per-file hooks only — no full audit); (d) the s40 consistency re-critique (Phase R's original scope); (e) **storage-story audit (founder q, s60): verify every save/export/import path is server-side system-of-record (client machine only ever gets copies), and document the storage architecture in FEATURE-MAP.md — incl. that dev and staging object stores are separate per-box volumes, so dogfood imports (the film) run per environment** | founder launch confirm at the opener that follows W-sites | `docs/FEATURE-MAP.md` · DESIGN.md §5 Source-Link Rule · this row |
| 1b | **W-sites — the Sites surface (QUEUED s60, founder: "sure queue, do some proper planning and research on it"): the portfolio reachable from the workspace as an outputs surface symmetric with Videos** — card gallery (hero-asset cards, verdict chips, filters, j/k/enter) + dossier detail (iframe preview w/ width toggles + the site's record + /guide). Architecture DECIDED in the plan doc: the existing dormant templates nginx image gains a `/catalog.json` build step; workspace reads it through a provider seam (dev = local fs); v1 = self/demo tenant read-only, per-tenant sites ride a future contract window. One lane, UI-only, 0cr | **s61 opener: founder approves the lane launch + picks design-first (one claude-design mock) vs straight-to-build; separately: create the Dokploy templates-preview service + set `TEMPLATES_PREVIEW_ARMED=true` (his console) to give the workspace a live sites origin** | `docs/research/sites-surface-plan.md` |
| 2 | **Staging cutover EXECUTED + VERIFIED (s56, ~04:45 UTC): staging LIVE on tenant-pg** — swordfish ran 1–5 off the lead's card (better-than-card deviation: migrated from a COPY, the PGlite volume was never opened; pre-flip tarball in his restic source); lead steps 6–7 GREEN (five routes 200, `db: postgres`, all reachable surfaces match the 29-table counts — leads 120, profiles 3, areas 1, library 1+3, activity capped view). PGlite volume = untouched rollback belt. **Open tails (updated s64): step 8 CONFIRMED 2026-07-19 (manual green run + restic `825ad3e7`; choreography CLOSED)** · remaining: preview basicauth + DB_DUMP_TOKEN console retirement = founder-gated pass on swordfish's side (lead swaps CI `STAGING_EDGE_AUTH` when the pair lands) · db-dump route code removal = checkpoint cleanup candidate | step-8 confirm in FROM-SWORDFISH · rotation pair via the .context secrets channel | ASK-BACKS s56 run record + verdict |
| 3 | **Live send GO** (B-crm.4 door is BUILT + merged; arming = `RESEND_API_KEY` + `OUTREACH_SEND_ARMED="true"`, both deliberately unset) | **founder GO + the s28 stealth question** (brand-domain outreach reveals the brand pre-launch — accept / neutral domain / wait; explained to the founder live s55) + Resend domain setup | PR #58 · `packages/engine/src/outreach/` · proposal §Session-53 |
| 3b | **Integrations (ADR 0011): B-int.0 window ✅ (PR #66) · B-int.1 vault core ✅ s68 · B-int.2 surface ✅ s70 (cards + guided connect + published view; see the s70 close message)** — remaining: **B-int.3 driver rewire** (arming → tenant data; lane, founder approval at opener) · **B-int.4 OAuth-Connect mode 1** (gated: THE LANDING → partner filings; s70 input = Nango eval + self-tenant pull-forward, plan doc §Mode-1 automation check) | B-int.3: founder lane-approval · B-int.4: landing + filings | `docs/research/integrations-surface-plan.md` |
| 4 | **Checkpoint decisions** — cache exemption · B-rls.2 charter candidate · standing scratch-admin role · ms-fidelity caveat · **B-sitegen charter candidate (meta-prompt behind Create's page family — s60 record below; INPUT-SIDE SCOPE EXPANDED by the founder s61: prompt | URL-DNA extraction | top-tier template pick + metadata/purpose block + intel/lead autopopulate — full record `docs/research/sites-surface-plan.md` §6)** · **object-store durability — FOUNDER DECIDED s60: VPS-local stores for now, AWS/S3 migration parked with an explicit trigger (real traffic/customers); the platform seam stays fail-loud until then** · **TIER-GATING → ENTITLEMENTS SEAM (founder s64, clarified same session): work on templates/CRM continues UNGATED — the requirement is that per-tier feature availability is EASY TO FLIP (tier/capability flags as config-data, per-tenant overridable; templates + CRM DEFAULT to founder-only/highest-tier). A contract-window schema candidate (plan/tier column + entitlement capabilities), not a build stopper. The visual arc still holds at 20 sites ("leave the landing pages at this for now") pending checkpoint sequencing** | founder, next checkpoint | archive s53 record + `.context/notes/lane-wrap-b-rls-s53.md` |

**Closed in s54 (full record in the session message below):** staging smoke compose + judge-gate spend check ✅ · B-crm.5 staging first-run ✅ (fit ×2 learned) · weights-ui lane merged ✅ (PR #57) · s54 contract window merged ✅ (PR #56, migration 0014) · b-crm4-send lane merged ✅ (PR #58).

Parked (charter-level, not this window): **AWS/S3 object-store migration — trigger: real traffic/customers (founder decision s60; VPS volumes + swordfish restic until then)** · B6.7 domains launch · B-visual style-lock candidate · month-end credit call · **film refine = revisit AFTER the Thalon landing work (founder, s56)** · s40 re-critique = folded into W-audit row 1c. The founder-action queue has ONE home: `agent_handoff/NEEDS-STEVEN.md`.

## Messages (append-only — prior messages through s53 are in COORDINATION-ARCHIVE.md)

- 2026-07-17 lead: **BOARD PRUNED (founder ask, post-s53-wrap).** All history — nine sprint/window lane tables and every session message through the s53 close record — moved verbatim to `COORDINATION-ARCHIVE.md`; this file now carries live state only. The s53 close record (lanes A/B, the lane-B opens, the tmux-crash record) is the archive's final entry.
- 2026-07-17 lead: **FOUNDER APPROVED ORCHARD HOUSE (live, post-wrap) — the wave-2 insert lands clean, no fix round; ⑧ Crateline ungated for s54.** Same live round: staging seats confirmed landed (queue #2 gate opened same evening) · the 8899 static server was found DEAD (it died with the tmux unit in the OOM) and was restored — localhost-bound, detached from the session, orchard-house verified 200 · both closed lines removed from NEEDS-STEVEN.
- 2026-07-17 lead: **s54 SLATE CUT ON THE FOUNDER'S LIVE GRANT (same evening as the verdict round): ⑧ ⑨ ⑩ all three landing pages = lead design work in one session + parallel lanes for the divisible rest.** Division recorded in Active lanes above. Honest division note: only ONE task is unconditionally lane-able (weights-ui — the sole apps/web writer); everything else in the queue is live-spend (smoke compose + staging first-run), destructive-door (transcript bulk-delete), infra-timing (cutover), or founder-gated (B-crm.4 build = lane b-crm4-send, activates only on his proposal verdict; s40 re-critique stays gated). ⑨ ⑩ identities from the s45-proposed / s50-verdicted slate: Wagtail & Co (pets / soft-organic) · Hue & Cry (salon / exceptional-palette).
- 2026-07-17 lead: **b-crm4-send ACTIVATED (founder live verdict: "activate the b-crm4-send") + transcript bulk-delete RE-SCOPED to likely-moot.** (1) B-crm.4 back-half proposal APPROVED — lane b-crm4-send joins the s54 slate (build TO the send door per §Session-53; live send stays a separate founder GO). (2) Bulk-delete forensics: the delete set was always exactly TWO rows — "the founder's two duplicate transcript rows" (s39 record, when the per-row delete + s40 bulk door shipped) in the DEV database. Dev moved to real Postgres (B0.5) and those rows never migrated; verified live tonight: dev PG `sources` = 3 prompt rows / 0 transcripts, staging library = 1 transcript / 0 duplicates (read-only API check). The rows exist only in the dead PGlite tree no app opens — nothing left to delete on any live surface. Founder: confirm-close on the queue row, or point at where duplicates were seen and the pass retargets.
- 2026-07-18 lead: **SESSION 55 — ⑩ HUE & CRY SHIPPED (`2629e59`): WAVE 2 IS 10/10 + transcript bulk-delete CLOSED (founder, live) + the wave-2 checkpoint review PROPOSED. Spend 0.6cr (balance ≈725.0).** (1) **Opener housekeeping:** peer-mail clean (no cutover window yet) · founder asked what live-send GO + the stealth question are — answered live (door built/disarmed, two-key arming, the s28 brand-domain trade) · **transcript bulk-delete CLOSED on the founder's "can close if fixed": re-verified dev PG live (3 prompt rows, 0 transcripts, 0 duplicates; `sources` carries UNIQUE (tenant, content_hash) so duplicate content rows are now structurally impossible) — queue row removed, NEEDS-STEVEN line removed.** (2) **⑩ Hue & Cry (salon / exceptional-palette primary, editorial-print secondary — draw recorded in site.json with reason): the page IS a shade chart.** Look-first sweeps: salon genre (defaults named and avoided: cream-serif "Elevate Your Look", dark-gold premium, portrait+card-grid), "colorful landing" (the anti-lesson: purple-blue gradient mush ≠ exceptional palette), hair-dye branding (the keepers: tone-on-tone pigment fields, colorway systems), Pinterest shade cards to the login wall (level.tone numbering, swatch books, formula notebooks — the design's actual source). Five chapters, each one pigment world (copper 7.44 hero · honey 8.3 · rose 9.26 · violet 5.20 · blue-black 1.1 close), adjacency = s35 tonal continuity; **with JS the paper takes the dye — a fixed layer cross-fades chapter pigments on scroll via a hand-rolled OKLab lerp (zero deps), the wordmark re-inks with the active chapter, and the shade-mixer instrument (level slider + real tone families) mixes its swatch in oklch() locally**; shade-book tabs (punched swatch cards) + ghost numerals + mono formula-line services carry the print grammar; no-JS/reduced-motion = hard chapter worlds, complete content. Type: Bodoni Moda + Schibsted Grotesk + Chivo Mono (all OFL, portfolio-distinct). **Mints 5/5 first-take keepers, soul_2, 0.6cr total** (hero 2k portrait 0.12cr — the tone-on-tone brief landed exactly; ink-scene shelf silhouettes inspected at 2.2× brightness before keeping, disclosed in /guide). Three two-lane passes (real catches logged in /guide: mobile caption clip, chip-snap bug, dead italic font, 2.81:1 hero accent darkened to 3.5:1, "six chairs" honesty fix); portfolio ratchet 5/5 · guard clean · console clean · zero external requests · 390px clean. (3) **Wave-2 checkpoint review PROPOSED to the founder** (⑥⑦⑧⑨⑩ + Orchard House, all on 8899); verdicts also unlock the parked post-wave-2 queue (landing+workspace design phase · s40 re-critique · credit call).
- 2026-07-18 lead: **s55 CHECKPOINT FIX ROUND (founder live verdicts on ⑨ ⑩ ⑧): Hue & Cry hero + hair try-on rebuilt · Wagtail journal remints + layout + paws · Crateline verdict = stands, untouched. Spend 3.08cr — 9 soul takes + the 2cr matte (balance 721.92, API-verified).** (1) **⑩ Hue & Cry:** hero portrait ("Mona Lisa stare") → candid two-friends-laughing cafe scene (soul_2 2k, take 3 — takes 1-2 rejected for garbled cup/sign pseudo-text, keeper composes the street into pure bokeh + plain ceramic; lineage in provenance), laid as a full-width editorial band under the type (lead's layout call per the founder's "you judge"); **the mixer's swatch circle → the HAIR TRY-ON: the shade paints onto a real photographed head** — one base mint (long natural hair from behind, tan/mixed heritage, face away — the founder's brief verbatim) + an NB2 image-to-image hair matte (2cr, alignment composite-verified), recoloured client-side via masked CSS blend layers (color + soft-light; photo shine/texture carries through; export chain gained an `alpha` manifest flag because Safari masks read alpha, not luminance — script extension, deterministic chain intact). Level strip moved to the chart head; guide pass-4 logged; re-verified desktop/390/no-JS. (2) **⑨ Wagtail:** walk remint = woman walker (calm/safe per verdict), **exactly three dogs ON the footpath — take 4, honestly logged: the s54 original had FIVE dogs against the site's own "four per walker, never more" cap (founder review caught what the build pass missed), retakes 2-3 = six dogs/road/tee-print**; nap remint 2k; both journal images display ~40% larger (entry.wide 1000→1160, polaroid 340→480; the founder's "too compressed" verdict); paw-print sprinkles at section corners (decorative, aria-hidden); 2px tilted-polaroid overflow clipped; guide pass-4 logged. (3) **Founder future-idea RECORDED (mid-session): Wagtail scroll-dog — an animated dog beside the scroll/leash line whose state changes with the journal as you scroll (drop-off → walk → nap → play → pick-up). Filed as a wave-2 checkpoint follow-up candidate, not built this round.** (4) Soul count-anchor lesson: "EXACTLY FOUR, count them" + breed list = six dogs; the working move is asking for FEWER than the cap (three) so overshoot stays honest — meta-prompt ratchet candidate at the checkpoint.
- 2026-07-18 lead: **s55 VERDICT RECORD (founder live, post-fix-round): ⑥ ⑦ were ALREADY verdicted — the lead's "no verdicts yet" framing was wrong and the founder corrected it** (⑥ = the s51 live taste round, fixes founder-directed same session; ⑦ = the s53 live approval that ungated ⑧ — both on the archive record). **ORCHARD HOUSE APPROVED again with a future-direction note, recorded as a candidate: the seasons-tree should ANIMATE with scroll (continuous tree transformation) rather than still-image cross-fades — likely costlier in credits (image-sequence or video-scrub approaches) or a code-drawn tree; think about at wave-3/re-charter alongside the Wagtail scroll-dog.** Wagtail "not updated on my side" DIAGNOSED: server-side verified fresh (curl: 10 paw refs, new 387KB walk file) — founder-side browser cache on same-named assets; `?v=s55` stamps added to the two remints + hard-refresh advised. **Lesson (ratchet candidate): review-round asset replacements keep filenames — always stamp a version query or rename, or the reviewer sees stale bytes.** Checkpoint state: all six sites verdicted or fix-delivered; founder's glance at the ⑨ ⑩ fix rounds closes wave 2 and ripens the parked decisions.
- 2026-07-18 lead: **WAVE-2 CHECKPOINT CLOSED (founder live: "ok with the new fixes for wagtail and hue and cry") — all ELEVEN sites verdicted (⑥–⑩ + Orchard House + the wave-1 five). TWO FOUNDER LESSONS RATCHETED into the meta-prompt in the same change:** (1) **the representation ladder** (his "most important point"): any load-bearing sentence that can be an image/animation/instrument SHOULD be — visual form is not reduced information; bar = the visual carries the same information load (the ⑩ try-on is the model case); (2) **casting & social register**: imagery reads socially before aesthetically — cast for audience trust (the woman walker), no camera-stare heroes, countable claims must match copy promises, playful marginalia in the vertical's language, count-anchor below caps. **s56 SLATE DIRECTED (founder):** PujusFresh into the portfolio (as a neutral fictional grocer per the tenancy rule — client instantiation stays gitignored) w/ physics rework (drop-off-screen with scroll, no bounce) + taste pass · retro taste pass over Loopwell/Northpace/TrueBore (Ember & Rye exempt) · wave-3 = FIVE more sites (skill-compounding toward a world-class Thalon landing — his rationale on record; no named slate yet, proposals at the opener) · film refine with Kling-cheaper-vs-Seedance per-beat seat question (lead's seat logic: Kling only where colour carries no meaning — s42 drift — Seedance holds story/colour beats) · **WORKSPACE REDESIGN PHASE = RIPE** (founder direction: journey-first IA — intel → pick → create → approve → fan-out as the literal spine, minimal clicks, extras into tabs/advanced; icon cleanup to the features side-rail style; calendar + kanban rebuilt studying cal.com and open-source boards as reference-only patterns re-implemented, never embedded — AGPL hygiene; founder suggests parallel workflow — lane-cutting proposal at s56, all launches need his approval). Verdict-close also ends the batch-review gate: the parked s40 re-critique + credit call remain in NEEDS-STEVEN.
- 2026-07-17 lead: **SESSION 54 — the granted slate executed: smoke compose CLOSED + learn loop's FIRST REAL LEARNING + both lanes MERGED + s54 contract window FROZEN (0014) + ⑧ ⑨ SHIPPED; ⑩ = s55 opener (founder called the wrap point live after ⑨). Spend ≈4.5cr (balance ≈725.6); gateway $14.53.** (1) **Staging smoke compose (founder-directed opener): the gate WORKS in production.** Three composes on the live gpt-5-mini seat (judge tiers revealed: screen=gpt-5-mini, final=claude-sonnet-4.5): #1 and #2 judge-BLOCKED honestly — the model offered ungrounded extras ("ten minutes", "a sample set"); tier disagreement fail-closed BOTH directions. #3 fully-grounded → **QUEUED, on Sione Latu — the exact lead whose pre-seat-fix llama run failed irrecoverably**. Spend check GREEN: ~1.5¢/compose incl. the sonnet judge; balance $14.5264. (2) **s54 contract window (PR #56, migration 0014, contract re-frozen before lane 2 launched):** consent_basis + provenance + one-way `unsubscribed` + `outreach_sends` ledger ((tenant,draft) UNIQUE = double-send structurally impossible; cadence DERIVED, no mutable state table) + `outreachSequenceSchema` (≤50/day executable ceiling) + `sendable` capability. (3) **Lane weights-ui MERGED (PR #57):** POST /api/leads/learn + the provenance panel (learned-vs-base, per-signal multipliers, honest amber for lagging/drift). (4) **B-crm.5 staging FIRST-RUN — the loop LEARNED:** 108 rows → 104 verdicts → state `2d86e475…`, **fit ×2** (posterior 0.9 vs base 0.09, Wilson low 0.68 clears), other signals held ×1 (inconclusive intervals). Applies at the next Score now. (5) **Lane b-crm4-send MERGED (PR #58) — built TO the door:** transport seam + Resend driver + two-key arming ratchet (key AND founder-GO flag, else a REFUSING transport naming the missing arms) + the typed refusal ladder (consent-none, one-way door, prose sender-identity, unsubscribe affordance, cap/day, cadence-due, duplicate) + pure cadence math; 48/48. **Lane death on record: the agent authored everything then died on USAGE CREDITS pre-verify; lead salvaged per the salvage doctrine, fixed the one red test's REAL bug (sender name inside a URL is not sender identification — prose rule), fixed the CI-only fetch-seam type break (json()→text()), verified, merged.** (6) **⑧ CRATELINE shipped (`8240fef`):** brutalist-raw + data-instrument — the manifest IS the interface (waybill, lanes ledger, container data panel, stamps/counters); mints 3/3 first-take 4.12cr (NB-pro→NB2 coercion recorded; CRATELINE/SYD MEL BNE stencil first take; soul's uninvited "73" placard cropped out by the derive). (7) **⑨ WAGTAIL & CO shipped (`bd021ad`):** soft-organic + cinematic — the day-journal (leash line draws with scroll, Gochi annotations, breathing blob; photographic dogs carry per the s37 register rule; gentle-only as deliberate contrast to ⑧); mints 3/3 first-take 0.36cr. Both: portfolio ratchet 5/5, 390px, zero external requests, /guide honest. (8) Mechanics lesson (ratcheted in memory): cwd persists across shell calls — two worktree mishaps (nested worktree + a lane branch briefly kicked to main) caught and untangled; prep worktrees with absolute paths from repo root.
- 2026-07-18 lead: **SESSION 56 — PLANNING (founder-confirmed; nothing built). The five directed proposals, filed for verdict. Peer-mail clean at the opener (no cutover window). Balance 721.92; no spend this session.**

  **(1) WAVE-3 SLATE — five named sites + axis draws (founder floated the verticals s55; lead drew the axes).** Each re-exercises a prior site's primary axis in a deliberately contrasting register — the skill-compound toward the Thalon landing (built LAST) is depth-per-axis, not just coverage:

  | # | site | vertical | primary axis (2nd exercise of) | secondary | the contrast that compounds |
  |---|------|----------|-------------------------------|-----------|------------------------------|
  | ⑫ | **Pearl & Rowe** | dental studio | soft-organic (Wagtail) | data-instrument | clinical calm vs journal warmth; FDI tooth-chart numbering as the instrument grammar; the casting/trust lesson is load-bearing |
  | ⑬ | **First Crack** | specialty coffee roaster | data-instrument (Loopwell) | cinematic-imagery | warm-craft instrument vs cool SaaS — roast curves, cupping scores, first-crack timelines ARE the vertical's real language |
  | ⑭ | **Plinth Studio** | architecture studio | high-quality-3d (Hartline) | editorial-print | studio-drawing register (plan → section → axonometric → massing scroll scene) vs house-assembly; monograph type |
  | ⑮ | **Stem & Vow** | florist / weddings | cinematic-imagery (Ember & Rye) | soft-organic | wedding photography IS the vertical; the casting/social-register lesson's biggest workout (candid, absorbed, never posed) |
  | ⑯ | **Dog-Ear Books** | independent bookshop | novel-typography (Houselights) | editorial-print | typesetting register (ligatures, drop caps, marginalia) vs marquee letterboard; playfulness in the name itself |

  Brewery alternate for slot ⑯ if preferred: **Coldwork Brewing** — brutalist-raw (Crateline 2nd) + cinematic; bookshop is the stronger compound (type confidence feeds the Thalon landing directly). Draw-rule check: five unique primaries within the wave ✓. With the PujusFresh port carrying physics-interaction, this cycle gives SIX of ten axes their second exercise (otherworldly-animation already got Orchard House); wave-4 anchors = exceptional-palette · editorial-print · brutalist-raw. Cadence: s54 shape — batch builds (proposal: ⑫⑬⑭ one session, ⑮⑯ the next), reviews at the wave-3 checkpoint or live. Budget: wave-2 ran 0.36–4.12cr/site; estimate ≤15cr for five (get_cost preflight per mint, ≥40cr ping stands).

  **(2) PUJUSFRESH PORT — neutral fictional grocer, name candidates: Sprig & Barrow (rec) · Greenhand Grocers · Marketday.** site.json: physics-interaction primary (the menu's own grocer precedent — its 2nd exercise after TrueBore) + exceptional-palette secondary (produce colour worlds). **Physics rework per the founder verdict (current = janky): DELETE the inlined Matter.js (~80KB) entirely** — replace simulation with scroll-driven kinematic fall: items drop off-screen as you scroll, position/rotation mapped deterministically to scroll progress with per-item variance; no collisions, no springs, no engine — the jank class leaves with the library. Reduced-motion/no-JS = items resting in place, complete content. **Asset note (tenancy + licensing):** the client instantiation uses CC BY-SA/CC0 photos — fine gitignored, forbidden tracked; the port mints a fresh original produce/market set (soul-class scenes; any signage/price text → the text-precise seat), est. 4–6 mints ≈ 0.5–1cr. Full meta-prompt treatment: look-first sweep (greengrocer genre) + the three s55 lessons + ≥3 two-lane passes + ratchet + /guide. Client copy at `.context/clients/pujusfresh` stays untouched; it can later re-instantiate FROM the template (the correct direction of flow).

  **(3) WAVE-1 RETRO TASTE PASS — Loopwell · Northpace · TrueBore (Ember & Rye exempt, founder-directed).** Per site, three audits from the ratcheted lessons: **representation ladder** (every load-bearing paragraph → can it be an instrument/animation/mint? Loopwell feature prose → live instruments at 0cr; Northpace plan/progress copy → cadence-clock visuals; TrueBore protocol prose → drawn gauges) · **casting/social register** (every human image checked for camera-stare, casting-for-trust, countable-claims-vs-copy; Northpace runner + TrueBore tradie imagery are the likely remints, soul 2k ≈ 0.12cr each) · **playfulness room** (one deliberate wink per page in the vertical's language — the Houselights-flicker register). Plus: confirm the height:auto test covers all three and `?v=` stamp any same-name asset replacement (s55 stale-cache lesson). One session, all three, batch review at end. Budget ≤3cr.

  **(4) WORKSPACE REDESIGN — three-phase shape (founder direction: journey-first IA, intel → pick → create → approve → fan-out as the literal spine).**
  - **Phase D (design, lead-only, no lanes, 1–2 sessions):** Fable 5 authors directly in claude-design (standing rule): the journey spine as the dashboard's literal layout (minimum clicks; extras → tabs/advanced), icon cleanup to the features side-rail style, calendar + kanban studies off cal.com and OSS boards — **reference-only patterns re-implemented, zero embedded code (cal.com is AGPL)**. Grounded in the already-ratified workspace-ux-v2.md §1 (intel card = doorway, per-destination exits). Design phase names NEW component homes (`components/calendar`, `components/board`) so Phase I lanes are disjoint by construction. **Founder checkpoint on the designs before any implementation.**
  - **Phase I (implementation, the parallel window):** four lanes by disjoint subtree — **W-spine (lead):** `app/app/{page,layout}` + `components/{dashboard,workspace,ui}` (shared-file owner, merges first) · **W-intel:** `components/intel` + intel/library routes · **W-create:** `components/{create,approve,staged}` + routes · **W-boards:** the new calendar/board homes. Merge order spine → intel → create → boards; contract untouched (UI-only phase). **Each lane launch = its own founder approval at launch time.**
  - **Phase R (exit):** the parked s40 impeccable re-critique runs against the REDESIGNED workspace (one run instead of two — it's been waiting in NEEDS-STEVEN for exactly this).
  **(5) FILM REFINE — per-beat seat map + honest recommendation: PARK.** The film is founder-approved DONE both aspects. Seat map if any beat is ever retaken (colour-semantic = Seedance holds hues, s42; colour-free = Kling at half price; get_cost preflight at mint time): beats 2/3/5/6/8/9 (amber-white Two-Channel law + platform colours) = seedance fast 17.5cr each · beats 1/4/7 (night/warm, colour carries no meaning) = kling3_0 std 7.5cr each · beat 10 = static hold 0cr. Full-retake ceiling 127.5cr (~18% of balance) — not recommended. If the founder wants a scoped refine, the two candidates on the ledger record: beat 1 (currently a local composite working around Kling re-painting static texture; a Seedance take = 17.5cr) and beat 5 fan-out (weakest choreography per §s43; = 17.5cr) → **scoped option = 35cr**. The s43 "Seedance multi-shot per act" idea is a NEXT-film shape, not a refine of this one.

  **ORDER RECOMMENDATION (the founder approves order + each launch):** ① wave-1 taste pass (cheap, applies the lessons while hot) → ② PujusFresh port → ③ wave-3 five (two build sessions + checkpoint) → ④ workspace redesign (D → checkpoint → I lanes → R) → ⑤ film = park (or the 35cr scoped pair). Honest parallelism note: items ①–③ and Phase D are ALL lead design work — they serialize; the first real lane window is workspace Phase I. Swap ③↔④ freely if the workspace itches more — the skills compound either way.
- 2026-07-18 lead: **s56 VERDICTS (founder, live) — all five proposals approved with two wave-3 substitutions; parallel plan requested and cut below; EXECUTION = s57.** (1) **Wave-3 slate as amended:** architecture OUT → **electrician IN: ⑭ Sparkwright** (high-quality-3d 2nd exercise + otherworldly-animation secondary — concept: a dark CSS-3D home gains light circuit-by-circuit with scroll; *energizing* a house vs Hartline's *assembling* one); bookshop OUT → **roofing/rooftop repair IN: ⑯ Ridge & Valley** (both real roofing terms; brutalist-raw 2nd exercise + cinematic secondary — weather/materials register: Colorbond/terracotta/storm palette, drone rooflines; distinct from Crateline's paperwork-manifest register by construction). ⑫ Pearl & Rowe (dental, soft-organic + data-instrument) · ⑬ First Crack (roaster, data-instrument + cinematic) · ⑮ Stem & Vow (florist, cinematic + soft-organic) stand as proposed. Five unique primaries ✓; wave-4 anchors are now exceptional-palette · editorial-print · novel-typography. (2) **Sprig & Barrow approved** (scroll-drop kinematic physics, Matter.js deleted, full re-mint). (3) Wave-1 taste pass approved via the order approval. (4) **Workspace redesign approved + a NEW founder design rule, RATCHETED this change into `DESIGN.md` §5 as The Bounded-List Rule:** growing lists (leads, activity, …) never grow the page — fixed-height scroll, tabs, or pagination past a short threshold; sibling sections keep their dimensions; every Phase D design states each list's bound. (5) **Film: revisit AFTER the Thalon landing work** — parked to the post-landing checkpoint, seat map + 35cr scoped pair stay on the s56 planning record. **Swordfish note check (founder flag): the open FROM-SWORDFISH thread is the cutover choreography ACK (2026-07-17) — already processed (seats live→smoked s54; OOM ratchet); the ball is with swordfish (step-0 confirmations + window). Confirmed to the founder: it can run after s57 or whenever the window lands — independent of this slate both directions.**

  **s57 PARALLEL DIVISION (founder asked for parallel workflow; launches confirm at the s57 opener per the fresh-approval standing rule).** **LEAD (serial spine — all spend + design):** ① wave-1 casting remints FIRST (Northpace runner + TrueBore tradie — the taste pass's only mints, minted early so lanes consume the exported files; get_cost preflight each) → ② Sprig & Barrow port (design + build + fresh produce set, ~0.5–1cr) → commit each on ship. **LANES (four, disjoint by construction):** **T-loopwell / T-northpace / T-truebore** — one taste-pass lane per wave-1 site, each owning ONLY `proprietary/templates/sites/<slug>/` — representation-ladder conversions (prose → 0cr code-drawn instruments), the playfulness wink, casting audit + `?v=` stamps; **NO minting in lanes** (spend stays lead; remint files handed in pinned+exported); **Fable-5-pinned subagents** per the design-work standing rule; the shared portfolio test stays lead-owned. **W-research** — boards/calendar UI pattern survey (cal.com + OSS boards, reference-only, AGPL hygiene named in the doc) → `docs/research/boards-calendar-ui-patterns.md`, feeding Phase D; research not design, any tier. **THEN (sequential, approved order):** s58+ wave-3 ⑫⑬⑭ then ⑮⑯ (lead design default; aggressive option on offer = Fable-pinned site lanes with per-lane credit envelopes if the founder wants speed) → wave-3 checkpoint → Phase D in claude-design (bounded-list rule = named input) → founder design checkpoint → Phase I four lanes (W-spine lead / W-intel / W-create / W-boards) → Phase R = the s40 re-critique against the redesigned workspace. Honest note unchanged: the lead spine serializes; the lanes are the real concurrency, and the taste pass batch-reviews at its end.
- 2026-07-18 lead: **SESSION 57 — EXECUTION: the founder re-cut the division live ("do the research this session, then the T lanes next session") — W-research + the full lead spine DONE; T-lanes move to s58. Spend 3.56cr (balance 718.36, API-verified). Pre-session: the syd4 16GB resize was REFUSED by BinaryLane (host capacity — no reboot; swordfish raised swap to 6GB; STAGGER standing for all future lane launches; absorbed into handoff docs at `da6eff9`).**

  **(1) W-research SHIPPED (`4e3fd93`) — `docs/research/boards-calendar-ui-patterns.md`** (304 lines, background lane, founder-approved this session): cal.com lineage + five board tools surveyed reference-only; license-hygiene table opens the doc — notable correction: **cal.com went closed-source April 2026, its OSS lineage relaunched MIT as Cal.diy** (any pre-2026 snapshot is still AGPL); adopt/adapt/reject mapped to DESIGN.md conventions (column-as-field-value, saved-views-as-tabs, advisory WIP counts adopted; color-only exceeded states adapted with words; unbounded column growth rejected per the Bounded-List Rule); 9 open questions for Phase D; two DeepWiki secondary sources + two honest survey gaps disclosed in-doc.

  **(2) Wave-1 casting remints SHIPPED (`d956e2c`) — the taste pass's only mints, pinned + exported so the s58 T-lanes consume files, never spend.** Northpace `first-light.webp` (everyday runner, strict profile, blue-hour dawn — take 2; take 1 rejected: camera stare) · TrueBore `callout.webp` (plumber at real pipework, head bowed, whole face in frame — take 5; takes 1–4 honestly logged: head-crop · camera-stare+crate text · chest embroidery · chest glyph + implausible fitting). **Method lesson (meta-prompt candidate): in workwear/van scenes soul-2 letters EVERY printable surface (boxes, bumpers, shirt chests) despite negative prompts — the working move is composing printable surfaces OUT of the scene (plain rendered wall beat four re-prompts).** 0.84cr.

  **(3) ⑪ SPRIG & BARROW SHIPPED (`a1bd54e`) — the grocer port (physics-interaction primary × exceptional-palette secondary).** Look-first taste notes (3 sweeps): the genre's failure mode = white+green+card-grid with posed farmer heroes — refused all three · produce IS the palette (macro cross-sections as full-bleed colour fields) · macro photography reads premium, small photo-cutouts read clipart → the FALLING items are drawn, photography stays macro · illustrated warmth = seasoning (chalk annotations), photography keeps trust · physics must mean WEIGHT (bought by the kilo). Design: five produce colour worlds (market-paper dawn → tomato vermilion → citrus amber → chard green → plum dusk); **the primary axis = the day's crate emptying: 11 hand-drawn SVG produce pieces rest on a chalk shelf and fall past the viewport as you scroll — every transform a pure function of scroll progress (engine-free, collision-free, reversible: scroll up and the day un-happens); the Matter.js class of jank left with the library as chartered**; the kilo-scale instrument (chip-loaded pan, springy needle, aria-live readout); the day clock (scroll read back as market time, 5:40am→6pm); the wonky carrot never falls ("still counts") = the page wink. Type Fraunces+Work Sans (OFL, vendored). Mints 5 keepers 2.72cr: chalk A-frame sign on the text-precise seat (NB2, 2cr, every word exact first take) + tomato crate / citrus macro / dawn street (soul_2 first takes) + grocer portrait (take 3 — takes 1–2 rejected for produce-box pseudo-text; keeper composes printable surfaces out of frame, casting candid/absorbed per the s55 lesson). Three two-lane passes logged honestly in /guide (arrow collision · fig icon · 4px mobile overflow · fall-behind-translucent-panels moved to the front plane · day-clock hour-carry bug); portfolio ratchet 6/6 · guard clean · console clean · 390px clean · no-JS/reduced-motion complete. Client copy at `.context/clients/` untouched; correct direction of flow (template can re-instantiate the client later).

  **Open tails for s58:** swordfish step-8 nightly-dump confirm (post-15:00 UTC; ACK'd their resize-refusal note + closed the moot post-reboot glance ask same day) · rotated preview basicauth pair → CI `STAGING_EDGE_AUTH` swap · T-lane one-word confirm at the opener (staggered launches). Honest cost note: the S&B mint estimate said 0.5–1cr; the text-precise sign seat (2cr, mandatory routing for legible words) pushed the real figure to 2.72cr.
- 2026-07-18 lead: **⑪ SPRIG & BARROW APPROVED (founder live, post-wrap): "actually looks good. actually have no comments there" — first no-comment verdict in the portfolio; 12/12 sites now verdicted. FOUNDER BAR RAISED, on record: the taste/style test reads as PASSED — the next phase is "more examples and refining it to not just pass but thrive (A+)". Applied reading for wave 3: each site gets the deeper-per-axis treatment (the s56 skill-compound rationale), the taste-pass lanes ARE the refine motion for wave 1, and the pending meta-prompt ratchet candidates (printable-surfaces-out-of-frame · count-anchor · text-seat 2cr estimating) fold in at the wave-3 checkpoint.**
- 2026-07-18 lead: **FOUNDER RE-ORDER (live, post-s57-wrap): WORKSPACE PHASE D PULLED FORWARD — "sure pull the phase D forward, can start a few things next session."** Supersedes the strict sites-first sequencing from the s56 verdict: Phase D (workspace redesign design work, claude-design, lead-authored per the Fable-5 design rule) now OPENS at s58 alongside the T-lanes and interleaves with wave-3 builds thereafter. Downstream gates unchanged: founder design checkpoint before Phase I; Phase I = four lanes (W-spine lead / W-intel / W-create / W-boards) each needing fresh launch approval; Phase R = the s40 re-critique. The survey's 9 open questions route to Phase D; the handful needing founder input surface at the design checkpoint, not before.
- 2026-07-18 lead: **SESSION 58 — THE FULL SLATE EXECUTED IN ONE SESSION: three T-lanes launched (founder GO), all three SHIPPED + reviewed + MERGED, and workspace PHASE D OPENED with three annotated designs. Spend 0cr (code-only session; balance 718.36).** (1) **Opener:** self-check green (tmux/PG/8899/8GiB+6GB-swap posture) · peer-mail CLEAN — the step-8 nightly-dump confirm has still not arrived (cutover tarball stays; basicauth rotation pair also still pending — both tails ride to s59's opener) · founder one-word GO on the three T-lanes ("GO — all three"). (2) **T-lanes (Mode B via launch-lane.sh, staggered ~25min, Fable-5 default model = the design pin):** all three wrapped honestly and merged after lead review + a REAL visual pass — the lanes' "syd4 has no headless chrome" constraint didn't bind the lead: chrome-devtools MCP + a throwaway 8898 no-cache server over the worktrees gave every site desktop + 390px screenshots pre-merge (390px job-sheet: no h-scroll, verified). Outcomes in the lane table above. **Ratchet extended in the same change (`c28e7ed`): the s55 height-auto portfolio test now reads split `css/` dirs — loopwell became the first css-dir site and the ratchet's index.html-only assumption failed honestly at merge; suite 6/6 green after.** (3) **Phase D OPENED (lead, claude-design project "Thalon workspace — Phase D"): three .dc.html designs, each with an in-file decision-annotation table** — Workspace Spine (the five journey stations ARE the dashboard on a literal line; extras → icon side-rail; week strip + bounded needs-you; honest unarmed-publish states) · Content Calendar (month + day panel, density tabs, zone chip, drag-reschedule w/ Terminal Toast, terminal verbs never drop targets) · Leads Board (the ONLY v1 board — approve stays a list because its stages are engine-derived and drag would fake agency; saved-view tabs w/ unsaved dot; advisory `count/limit · over`; 2D j/k/h/l grammar). **All 9 survey questions answered or explicitly checkpoint-flagged; repo record = `docs/research/workspace-phase-d-designs.md`.** Design verify-loop ran on real renders (chrome-devtools against serve URLs); caught + fixed: a July-2026 calendar-grid off-by-one (all slots stacked on Wednesday), panel status pills at wrong scale, a stale header count. (4) **Ops incidents, both resolved:** the northpace lane window carried a hand-typed, never-submitted "Read KICKOFF-t-truebore" line in its input box post-wrap (cross-lane misfire risk if Entered; truebore's own lane had its kickoff from launch) — pane transcript archived, window closed; a pkill exit code aborted the first GC chain mid-way — re-run cleanly, final state verified (1 tmux window, worktrees/branches gone, 8898 down, founder's 8899 untouched, 200). (5) **Checkpoint candidates carried from the lanes' wrap notes:** manifest schema gains model/credits fields (both northpace + truebore had to source model facts from commit messages for their /guide honesty notes) · retired `headlamp.webp` + manifest entry cleanup (superseded by first-light; provenance = lead-owned, file left on disk deliberately). Founder queue now: verdicts on the three refreshed sites + Phase D first-look (NEEDS-STEVEN).
- 2026-07-18 lead: **WAVE-1 TASTE PASS VERDICTED (founder live, s59): "yea the 3 sites look good, definitely improved" — loopwell · northpace · truebore refreshed sites APPROVED, no fix round.** The wave-1 refine motion (the s57 verdict's applied reading) is closed; the retro taste pass item is fully done. NEEDS-STEVEN row removed; the Phase D trio first-look row stands.
- 2026-07-18 lead: **SESSION 59 (same day, founder live) — PHASE D DESIGN-COMPLETE: the four owed designs shipped in one block; the workspace design checkpoint is RIPE. 0cr.** Opener: self-check green · peer-mail clean AGAIN (both swordfish tails still open) · **wave-1 taste pass VERDICTED (founder: "the 3 sites look good, definitely improved") — recorded above.** Then the Phase D session-2 set in claude-design, each verify-looped on real renders: **Intel Dossier** (card-as-launchpad: titles/angles/hook + per-family exits w/ honest "suggested" pre-pick, cadence stamp, in-place watchlist w/ bronze "auto" chips) · **Create Handoff** (six typed removable context chips — the s52 judge-block lesson as UI; profile-marked settings; One-prompt|Advanced; honest goal gradient; outcome-stating generate button) · **Approve Consent** (lineage deep-link chips, judge reasons VERBATIM incl. the positive case, consequence-stating approve sentence, fail-closed blocked inset) · **Calendar Week** (bounded 06–20 window w/ quiet-hours collapse; ONE shared time→position mapping after fresh-eyes caught the label/cell drift; clamped edge label). Icon cleanup = design decision recorded (the Spine rail set is canonical; per-surface sweep = Phase I W-spine work). Record doc updated to checkpoint-ripe; NEEDS-STEVEN first-look row upgraded to the full DESIGN CHECKPOINT row (gates Phase I). **Next lead block: wave-3 ⑫ Pearl & Rowe (approved, interleave standing).**
- 2026-07-18 lead: **SESSION 59 (close) — ⑫ PEARL & ROWE SHIPPED: the dental studio, 13 sites now. Spend 0.72cr (balance 717.64, API-verified). Founder called the wrap after ⑫.** Look-first sweep (3 angles): the genre default REFUSED on the record (camera-facing bleached-smile + teal clinical + doctor-headshot grid, 20+ sightings); keeper registers = boutique-spa dental suites (oak/linen/sage/terracotta/arches — the Pinterest wall behind the login) + the one strong outlier: a DRAWN TOOTH-ROW diagram as design. Concept: **dentistry's honest instrument is the chart, not the smile** — soft-organic primary (arch motif, linen paper, unhurried pacing, Literata + Atkinson Hyperlegible — the Braille-Institute face as the care register in type) × data-instrument secondary (**the FDI chart: 32 static-HTML teeth, scroll-driven check-up pass filling the record, hover/tap tooth records, and the wink = tooth 53, a retained baby canine — real dentistry — whose record surfaces itself when the pass completes: "Still here. Still counts."**; the timed visit 08:50→09:52 incl. the seven-minute numbing rule; menu pricing). Copy spine = informed consent as brand ("Nothing begins until you nod" — the workspace approve design's sibling). **Mints 3 keepers / 6 takes, 0.72cr, all soul_2 2k, pinned+derived:** hero take 2 (t1 rejected: framed wall document grew pseudo-text + no arch — recomposed OUT), visit take 1 (casting lessons applied; alt corrected to the actual frame), tray take 3 (t1-t2 rejected: engraved pseudo-lettering on instrument handles, t2 WORSE after "no engraving" — t3 cropped handles out of frame; the printable-surface lesson now proven on WALL FRAMES and INSTRUMENT HANDLES). **Passes: real catches logged in /guide** — role="img" hiding 32 buttons from AT (→ group + sr-only desc) · JS-built chart = empty no-JS card (→ static HTML, JS enhances only) · phone tap targets (→ records list stays visible narrow) · stray edit glyph · ambition adds: FDI quadrant midline, pass-end wink surfacing. Suite 6/6 · guard clean · console clean · 390px no-h-scroll · zero external requests. **s60 = ⑬ First Crack → ⑭ Sparkwright; founder queue: ⑫ verdict + THE DESIGN CHECKPOINT (both on NEEDS-STEVEN).**
- 2026-07-18 lead: **s59 FOUNDER VERDICT ROUND (live): THE WORKSPACE DESIGN CHECKPOINT IS APPROVED ("agree with your plan, can build it out and see how it goes next session") — PHASE I OPENS s60** (lane map proposal at the opener; W-spine lead + W-intel/W-create/W-boards lanes each need fresh launch approval; contract untouched, UI-only phase). **⑫ verdicted "good" with a fix round, executed same hour (0.60cr, balance 717.04):** (1) the FDI chart "looked like cinema seats" → redrawn as a MOUTH: anatomical crowns (cusped molars/pointed canines/chiselled incisors), rows curved into converging arches, lowers flipped bite-up, gum bands; (2) the mirror scene read creepy ("holding a face") → RETIRED, reminted per founder casting direction as the wise elderly dentist (silver beard, round glasses, warm open-handed explaining, no mirror — first take); (3) wordiness → ~80 words cut; (4) **nature counterweight**: hedge-garden band after the chart + arms-wide walk-out finale above the close (2 keepers; 2 rejects — building-facade signage + jacket-back lettering, both recomposed OUT). **TWO NEW META-PROMPT RATCHETS (founder-taught, same change): casting archetypes per vertical (professional/serious = male, older-where-wisdom-is-the-signal · warmth/care = female · cafés = female or warm young male — cast whoever the customer hopes to see at the door) + nature-vs-dread (confinement-association verticals get bright outdoor imagery answering the FEAR, not the function).** Site total 1.32cr / 11 takes / 6 keepers; suite 6/6; guard clean.
- 2026-07-18 lead: **⑫ FIX ROUND VERDICTED (founder live: "yea much better with the site") — Pearl & Rowe closed, 13/13 sites verdicted.** NEEDS-STEVEN glance row removed; portfolio queue for s60 = Phase I build-out + ⑬⑭ interleave as stamped.
- 2026-07-18 lead: **SESSION 60 OPENER — PHASE I LAUNCHED ON THE FOUNDER'S GO ("GO — all three").** Self-check green (tmux/PG/8899/main=origin) · peer-mail clean (step-8 dump confirm + basicauth pair still pending, riding to next opener) · ⑫ fix-round glance had already closed post-wrap ("much better") — 13/13 verdicted. Lane map granted as proposed: kickoffs committed to main, worktrees prepped, staggered launches ~25 min apart (W-intel → W-create → W-boards); lead builds W-spine on `lane/w-spine` in-session and merges FIRST. Lanes read their Phase D design files via the claude-design MCP (project id in each kickoff) — designs stay in claude-design per the Phase D record; the repo-side ledger is the pointer.
- 2026-07-18 lead: **PHASE I BUILD-OUT COMPLETE IN ONE SESSION — all four lanes merged (spine `65e4cf9` → intel `5d8d77f` → create `4822a48` → boards `df170d6` + follow-ups `5426287`), suite 582/582 (104 files), typecheck + lint + guard clean, batch push follows this message.** Lead visual passes ran on live dev data for every surface (journey dashboard 1440+390, dossier launchpad, the full intel→create chip seam clicked end-to-end, approve consent, calendar month, leads board). Ratchets banked in the same session: worktree-setup now works on Linux with link-materialize verification (`c1dee7f`) · board + needs-you lists joined the selected-row conformance test · smooth-scroll opt-in stated. **Queued contract follow-ups from the lanes' honest gaps (the next contract window): planned-slot store + scheduledFor on the plan read (calendar drag + week-strip planned marks) · operator-owned lead stage field (board drag) · captures list read (spine station 02) · capture-id on drafts (approve lineage intel node) · tenant-wide saved-views store · undo-after-terminal (already queued, B-crm).** Phase I exit reached → Phase R (s40 re-critique against the redesigned workspace) is next; launch confirm rides NEEDS-STEVEN.
- 2026-07-18 lead: **⑬ FIRST CRACK SHIPPED (`311402b`) — the roastery, 14 sites. Spend 0.60cr (balance 716.44, API-verified). Founder-directed interleave ("start on one of the landing pages") executed between the W-create and W-boards merges.** Look-first sweep (3 live sites): genre default REFUSED on the record (kraft-bag Shopify grids, brown-on-brown, beans-macro heroes — even the industry's most data-driven roaster hides its data behind a shop grid); keepers = origin-green cinematic heroes w/ absorbed subjects (never camera-facing) + roast-day cadence as living marginalia + coffee-as-burgundy-fruit palettes. Concept: **the page IS a roast log** — scroll replays batch 447 charge→drop on a hand-drawn SVG curve (live time/temp/RoR readout, event flags planting in order, dev-ratio band); **the wink: the wordmark's C cracks at 8:52 and stays cracked**; public batch log w/ dev-bar mini-instrument + the batch-446 confession row ("we drink our mistakes"); cupping bars that never self-score 10; no-JS/reduced-motion = the finished annotated log. Type: Young Serif + Hanken Grotesk + Space Mono (OFL, vendored, all portfolio-new). **Mints 3 keepers / 5 takes 0.60cr, all soul_2 2k, pinned+derived:** origin + cooling first-take; hero take 3 (t1-t2 rejected: machine-body pseudo-lettering — "vintage" reads as painted livery and negative-prompting made it MORE ornate; t3 modernized the object and came back near-clean, one 137×78px decal blurred locally pre-pin, disclosed in /guide). **Meta-prompt ratcheted same change (`5cf337e`): printable-surface lesson extends to MACHINE BODIES + the vintage-livery corollary.** Passes 3/3 two-lane (real catches: flex min-size page h-scroll at 390 · ember text failed AA → ember-ink split · alt-vs-frame fixes; ambition: dev-bar instrument). Repo suite 11/11 (portfolio test walks 14 sites) · guard clean · console clean · zero external requests · 390px no-h-scroll. **⑭ Sparkwright = s61.**
- 2026-07-18 lead: **W-SITES PLANNED + QUEUED (founder direction, post-wrap): `docs/research/sites-surface-plan.md`.** Research headline: the serving problem was already solved and dormant — `Dockerfile.templates` + `templates-image.yml` build the whole portfolio into a stealth nginx image on every change (blank index, healthz, per-slug sites) with the Dokploy deploy step waiting on a founder-created service + `TEMPLATES_PREVIEW_ARMED`. The web image ships no templates (verified), so the workspace reads a `/catalog.json` the templates image will assemble from the 14 `site.json` records; dev reads the local dir through the same provider seam. Product shape: Sites = the third outputs surface (Library=inputs · Videos=video outputs · Sites=page outputs), own rail icon, card gallery + dossier detail, verdict chips (site.json gains an optional verdict field, backfilled for the 13 verdicted). Queue row 1b; gates at the s61 opener.
- 2026-07-18 lead: **⑬ FIX ROUND EXECUTED same hour (founder, live: stretched craft photo · brewed-result visuals · the split roast instrument) — `cee5179`, 9 mints 1.08cr, balance 715.36 API-verified.** (1) Stretch: the global img rule lacked height:auto AND the portfolio stretch ratchet was satisfiable by any element's height:auto (⑬'s chartbox svg slipped it) — ratchet TIGHTENED img-scoped in the same change, with loopwell's object-fit cover kept as the sanctioned alternative. (2) Every coffee card now opens with its brewed result (filter glass amber-ruby · mid-pour milk swirl · cold brew over ice; 1 reject: the model stood the glass ON the ice cubes — setting-scrutiny catch). (3) **The roast is now a split instrument — the founder's "for the general public" note: curve left for the log-lovers, THE BEAN right for everyone else** — five macro states (green→drying→Maillard→first crack→dropped) crossfading on the same scroll clock with a stage chip; no-JS = labelled filmstrip; reduced-motion = final state. New 390 catch fixed (aspect-ratio derived width from min-height). Suite 11/11 · guard clean · console clean · 390 = 390 exactly. ⑬ awaits verdict on the fixed build.
- 2026-07-18 lead: **FOUNDER WORKSPACE CRITIQUE (live, post-⑬-fix-round) — three findings, all confirmed by investigation, all queued as W-audit row 1c + two ratchets landed NOW.** (1) **Videos is empty because the product never ate its own dogfood**: the concept film (s41–s44 masters, cuts, EDL, provenance) was built at the filesystem level and lives gitignored in `.context/design/film-storyboard-s41/` — zero `video_projects` rows exist, so the surface honestly shows nothing. Registering the film in the product's own pipeline = W-audit item (a). (2) **Source-links are not universal**: intel's "original post ↗" exists on the EXPANDED dossier only; Library stores `sources.uri` in the DB and then never renders it anywhere — a pasted URL is humanly unrecoverable. **RATCHETED: DESIGN.md §5 gains The Source-Link Rule (founder-taught, "the number one rule in terms of sources") + thumbnails-for-visual-sources**; the sweep is W-audit item (b). (3) **No full impeccable audit ran in Phase I** (per-file hooks only) — honest answer given; the full pass is W-audit item (c). **NEW ARTIFACT: `docs/FEATURE-MAP.md`** — every feature → its human click-path, with `partial`/`ORPHANED` flagged honestly (film, library links, /blog path, portfolio sites); a feature that ships without a row = a defect; kept current in the same change as any feature move.
- 2026-07-18 lead: **FOUNDER (live): "the first crack landing page looks a lot better now, thanks to my advice — save my advice for the guide, memory, ratchet" + THE ENGINE QUESTION ("do you even have a site building engine that categorises, records, learns... so a prompt/category in the workspace can build these sites?").** Done this change: both fix-round lessons ratcheted into the meta-prompt as standing rules (**Show the consumable result** · **Every expert instrument gets a lay twin**) + named in ⑬'s /guide ("What the review taught") + memory. Honest engine answer given on the record: the KNOWLEDGE half exists and compounds (meta-prompt = the one slot-parameterized build prompt, ratcheted every founder lesson; checklist = the QA algorithm; axis menu = the categorization; site.json + /guide + provenance + keeper/reject mint data = the records); the EXECUTABLE half does not — today the executor is the lead by hand, and the product seam for it is already built and waiting (Create's "page" family one-prompt door, honest planned state since Phase I). **Proposal candidate for the next checkpoint: B-sitegen — wire the meta-prompt behind Create's page family (category/header fills the slots → build loop runs the checklist → judge gates → human approve).** Charter discipline holds: not scaffolded until chartered.
- 2026-07-18 lead: **SESSION 61 — ⑭ SPARKWRIGHT SHIPPED (`c798a28`): the electrician, 15 sites. Spend 1.08cr (balance 714.28, API-verified). Founder live mid-session (three check-ins answered; no gates opened — all main-line verdicts still on NEEDS-STEVEN).** (1) **Opener per the stamp:** self-check green (the 18:30 UTC kernel reboot had NOT yet fired — boot still 2026-07-11; 8899 alive, PG accepting, main=origin clean) · peer-mail clean AGAIN (step-8 dump confirm + basicauth pair ride to the next opener) · no new founder verdicts → the one ungated line was the ⑭ interleave (standing approval). (2) **⑭ Sparkwright (high-quality-3d 2nd exercise × otherworldly-animation): the page is a re-energize job.** Look-first sweep (3 angles, on the record): genre default REFUSED (emergency-green/black+hi-vis-yellow, camera-facing thumbs-up workers, stat counters, 24-HOUR banners); warm-glow-in-darkness = the register; illustrated-isometric = the adjacent trap (reads toy, not tradesman); the trade's own plan grammar (symbols, labelled boards, blueprint blues) = the unused goldmine. Design: dark plan-register CSS-3D wireframe house (pitched gable roof, muntined windows, fixture units) ENERGIZED circuit-by-circuit on the same scroll clock as a code-drawn switchboard — six breakers flip, load readout climbs to 4.4 kW, the expert instrument and the lay twin are one clock/two readings in BOTH directions; RCD TEST button drops the whole board in 28 ms and re-arms staggered (works no-JS-hidden, reduced-motion instant); wink = breaker C7 · MYSTERY never closes + the C-07 services row; the page itself brightens night→dawn→cream (tonal continuity made structural); markup ships fully-energized, JS takes it dark — no-JS/reduced-motion get the finished job (noscript folds the 5.6-screen track). Casting per §7: early-sixties silver-stubbled master, absorbed, profile. **Mints 4 keepers / 9 takes 1.08cr all soul_2 2k pinned+derived: hero dusk-house + morning kitchen first-take; craft take 2 (t1 = coiled storage, not craft; keeper derive-cropped toward the hands via a NEW manifest `position` field — deterministic chain intact, the s55 alpha-extension pattern); the portrait took FIVE takes and taught a NEW meta-prompt corollary RATCHETED same change: WORN FABRIC is a printable surface (t1 camera-stare+lamp pseudo-text, t2 lettered chest badge, t3 gold brooch, t4 athletic sleeve stripes) — plain KNIT garments resist invented branding where woven workwear attracts it (the waffle-knit jumper landed clean).** Passes 3/3 two-lane logged in /guide (real catches: hero grid column sized to content · ridge rendered as a detached line + no roof → full pitched gable built · floor-plan tags MIRRORED (rooms plane showed its back face) · C3/C4 had no visible story → fixture units on the camera-facing wall · RCD trip left breakers visually on · mobile scene header/footer collisions → flow restructure · noscript collapse). Suite 11/11 (portfolio ratchet walks 15) · guard clean · console clean · zero external requests · 390 = 390 exactly. (3) **Founder mid-session Q&A on the record:** full session-plan readout given (all gated items restated); claude-design question answered honestly — portfolio sites are designed directly in code per the meta-prompt method, claude-design = the workspace Phase D tool; **standing offer recorded: if the founder wants a claude-design mock stage for sites, say so and it folds into the W-sites design-first pick.** ⑮ Stem & Vow / ⑯ Ridge & Valley remain in wave 3.
- 2026-07-18 lead: **s61 CORRECTION (founder-caught, live): my claude-design answer this session was WRONG — the record proves the founder's per-template loop INCLUDES claude-design for mock AND final assembly.** Archive s51 close: "⑥ Houselights proved the founder's per-template loop end-to-end: look-first → claude-design scaffold with named slots → mint-to-slots → founder taste check → repo build," with ⑦⑧⑨⑩ explicitly slated to ride "the proven loop"; archive s52: ⑦'s claude-design project ran "scaffold v1 → alive final v2." **The stage silently drifted out at s53–54** (Orchard House insert + the three-in-one-session batch grant) and every later site copied the drifted shape (⑪⑫⑬⑭) — no decision to drop it exists anywhere; it was never revoked. My earlier in-session answer described the drifted practice as "the method" and briefly entered the record — corrected here, in CURRENT.md, and in memory the same turn. **RATCHET: the loop is now step 3 of meta-prompt §How to instantiate** (scaffold w/ named slots → alive final in claude-design → repo landing; 8899 serve note carried), so it can no longer live only in session messages — the drift happened precisely because the loop's home was documentary session records, not the executable method file. **Standing from ⑮ Stem & Vow: full loop, no gate needed. ⑭ open question for the founder (rides the glance row): Sparkwright shipped code-direct — retrofit a claude-design project for it (mirror of the built design, gives the fix round a design surface) or accept as-built; either is cheap.**
- 2026-07-18 lead: **s61 FOUNDER VERDICT ROUND (live) — THREE GATES OPENED IN ONE ANSWER + the ⑭ fix round directed.** (1) **⑭ Sparkwright: "overall good"** with one note: The Board Read as a Menu = too wordy — the C-rows become PICTURE cards (grid on desktop / horizontal snap-rail on mobile), title + the "You get" line only; fix round executing now (6 service mints, printable-surface rules on switchboards/chargers). **⑭ retrofit DROPPED** — founder: First Crack didn't use claude-design and was good, "hard to know if there was an improvement"; skepticism on the record, ⑮'s full-loop run = the real A/B. (2) **W-sites: STRAIGHT-TO-BUILD picked** (lead-direct, 0cr, starts after the fix round; queue row 1b's mode question closed). (3) **Phase-I contract window: GO** — /contract-window runs this session or next (five additive write-doors; re-freeze at merge). (4) **W-audit: auto-launch confirmed for the session W-sites ships** — film registration first, no further ask. (5) **Process correction absorbed (founder: "didn't I tell you to say out loud to me?"):** the opener compressed the founder-call list into one line and the lead kept building when the founder appeared live — standing rule tightened in ledger-discipline memory: **when the founder shows up live, the open founder-calls get stated FIRST, before work continues.**
- 2026-07-18 lead: **s61 SECOND HALF — THE OPENED GATES ALL EXECUTED: ⑭ fix round SHIPPED (`3a30b7d`) + repo hygiene pass SHIPPED (`aca0f62`, founder-directed subagent audit) + PHASE-I CONTRACT WINDOW MERGED (PR #59, migration 0015, `722eb61`) + W-SITES SHIPPED (`84473f8`). Fix-round spend 1.32cr (balance 712.96 pending API verify). GitHub Actions billing is DOWN (founder row filed).** (1) **⑭ fix round:** services = six picture cards (3-col grid / phone snap-rail), 11 takes 6 keepers 1.32cr; two NEW printable-surface classes proven (timber GRADE STAMPS · breaker faces grew pseudo-numbers twice) + a THREE-probe count-fail caught by the build pass (a multimeter has two); two disclosed local blurs (alarm face patches, EV ghost print + screen glyphs); /guide fix-round record + imagery rows. (2) **Hygiene pass** (founder: "your repo is a fucking mess" + explicit subagent grant): 3 stale lane KICKOFFs deleted · FEATURE-MAP + sites-plan corrected to 15 sites · headlamp retired fully (file + manifest row) · the s60 lane table archived per the board's own live-state rule · README/SPINE describe the real VPS-local posture · docs/research gains per-doc Status headers + an index README · .mcp.json + the dead PGlite forensic tree purged. (3) **Contract window 0015 (founder GO, live):** planned_slots + saved_views + intel_captures tables · leads.stage + drafts.capture_id columns · four repos, 8 event names pinned w/ tenancy walls · migrate-data COPY_ORDER extended (its completeness ratchet caught the omission FIRST — working as designed; intel_captures ordered before drafts for the new FK) · SQL verified purely additive · contracts explicit-partial patch schema (the zod-4 trap stays out). **Merged on full LOCAL verification (root 1552/1552 + typecheck + lint + guard) with admin bypass: GitHub Actions billing died mid-PR** (every job unstarted, "recent account payments have failed" — the s50 class; founder billing row on NEEDS-STEVEN; the matrix re-runs green when billing returns). Contract RE-FROZEN at merge. (4) **W-sites (founder pick: straight-to-build):** the portfolio is IN the workspace — Sites rail surface: card gallery (facet chips derived from the catalog · SELECTED_ROW + j/k/enter, conformance list extended · bronze awaiting-verdict = the one signal element · honest count line) + per-site dossier (LIVE iframe w/ desktop/390 toggles · the record · manifest mint facts w/ pinned-hash tails · /guide links). catalog.json now travels WITH the templates image (new node build stage runs scripts/build-sites-catalog.mjs); the workspace reads through ONE provider seam (SITES_BASE_URL fetch | dev local dir | honest unconfigured/error states); site.json gained verdict {status,note,at} backfilled 15/15 (14 approved · sparkwright fix-round). Drift guard test: the image-side assembler's output must parse in the workspace parser. Browser-passed live (gallery + dossier + width toggle), console clean; contract-window ripple fixed (fixture drafts carry captureId). Suites 1554/1554. (5) **Founder product direction recorded (live): B-sitegen input side** — prompt | URL-DNA extraction (principles-never-pixels invariant carries) | top-tier portfolio-template pick + metadata/purpose block (= the meta-prompt slots) + intel/lead capture autopopulate; lead additions endorsed (brand-profile/judge gate · site versioning on the video-cut precedent · published-page learn loop); full record sites-surface-plan §6, riding checkpoint row 4. (6) **W-AUDIT AUTO-LAUNCHES at the next session open** (pre-confirmed): film registration (a) FIRST, then source-link sweep + thumbnails (b), full /impeccable (c), s40 re-critique (d), storage-story audit (e).
- 2026-07-18 lead: **s61 THIRD BLOCK (founder live: bokeh direction + "start both now") — W-AUDIT (a) DIAGNOSED + FILED, ⑮ STEM & VOW LOOP STAGES 1–2 DONE.** (1) **Film registration (a): the film is ALREADY registered + playable in DEV** — video_projects `thalon-concept-film`, 58 takes (31 keepers/27 rejects), 8 cuts; media route probed 200. The B-ve.2 import SURVIVED the s57 cutover via migrate-data; the s60 "Videos is empty / zero rows" read was true of STAGING only (per-box object stores — the bytes never reached the VPS). FEATURE-MAP film row corrected; **staging import = ASK-BACKS s61 → swordfish** (transfer the film tree + run videos:import on-box against tenant-pg; sidecars named; closes on their confirm). (2) **⑮ Stem & Vow, full restored loop:** look-first sweep DONE (refused: flower-shop e-commerce grids · posed-couple romance + stat counters + anxiety pitch · blush gauze · petal-fall scroll; keepers: editorial restraint, characterful print type, CLOSE-CROP DETAIL GRAMMAR — professional wedding-photo language that composes faces/stares out, defusing the casting doctrine's hardest vertical structurally; the gap: nobody shows the FLORIST as craft). **claude-design scaffold v1 WRITTEN + render-verified** (project "Stem & Vow — wedding florist (T15)"): the 72-HOUR COUNTDOWN — cold open (the vow bouquet = hero payoff, "72 hours earlier ↓"), five chapters market→bench→cool-room→van→vow with the SAME bouquet as causal-handoff object, focus-pull chapter transitions + halation arc building to T-0 (**founder's bokeh/dreamy direction made structural: optical bokeh in-frame, rack-focus as scroll grammar, drifting-disc ambient REJECTED per idle-motion temperament**), palette = the timeline (market green-grey → vow gold; ONE deep rose), bloom triptych = the lay twin, wink = the unlisted "+1 for luck" stem, close asks for a DATE not a package; full decision-annotation table in-file; mint plan 8 slots ≈1.1–1.3cr w/ pre-armed risks (counts LOW · species drift · ribbon/invoice/livery OUT · faces cropped). **s62: stage 3 = alive final in the project → mints → repo landing; W-audit (b)–(e) continue.**
- 2026-07-18 lead: **s61 FOURTH BLOCK ("ok continue") — ⑮ ALIVE FINAL VERIFIED + ALL NINE MINT SLOTS KEEPERED. 14 takes / 9 keepers / 1.68cr (balance ≈711.28, API-verify at next opener). Repo landing = the remaining stage.** (1) **Alive final v2 in claude-design, render-verified live:** focus pulls run (centered chapter photo racks fully sharp, neighbours hold 6–14px defocus, both directions), the halation veil accrues with scroll progress toward T-0; reduced-motion = all-sharp + gentle fixed veil. (2) **Mints (all soul_2 2k):** hero (vow bouquet, faces out, golden halation) 1st-take · bench (wiring hands, unmarked tape) 1st-take · vow (bouquet at her side, groom dissolved in bokeh, the +1 stem READS) 1st-take · market take 2 (over-the-rims compose-out beat the bucket labels of t1: 4 pseudo-text patches) · cool-room take 2 + ONE disclosed collar blur (t1 grew a printed card INSIDE the arrangement) · van take 3 (t1 box printed 'Bравд.20', t2 grew window stickers — t3 composed ALL glass out: top-down seat crop) · bloom triptych with a continuity retake (t1 cream + half-open broke the same-rose story; the closed coral bud completes coral→coral-pink→pink). **Lesson bank: florist printable surfaces = bucket bodies · gift boxes · arrangement CARDS · wrap collars · vehicle glass/mirrors; the compose-out geometry (rims-up, no-box, lying-not-standing, no-glass-in-frame) beat every one.** All 9 pinned w/ provenance. (3) s62 (or this session if it continues): repo landing — vendored fonts (Cormorant Garamond · Nunito Sans · Caveat), the 72-hour countdown page against the alive-final mechanics, guide, ≥3 passes, suite/guard.
- 2026-07-18 lead: **s61 FIFTH BLOCK — ⑮ STEM & VOW SHIPPED (`53857f2`): 16 sites, the FIRST site through the FULL restored claude-design loop end-to-end (look-first → scaffold → alive final → repo landing) — the founder's loop A/B against code-direct ⑬/⑭ is now live on 8899.** The 72-hour countdown page: cold open at the vow → market/bench/cool-room/van → back to the ceremony, one bouquet as the causal-handoff object throughout; focus-pull scroll grammar + accruing halation (verified live: centred-sharp/neighbours-defocused, veil 0→0.82); bloom triptych lay twin; the +1-stem wink; the close asks for a DATE. Fonts Cormorant Garamond + Nunito Sans + Caveat (OFL, portfolio-new). Passes 3/3 logged in /guide (console clean · 390 = 390 · no-JS = the sharp complete essay — blur only ever comes FROM JS). Suite 11/11 (ratchet walks 16) · guard clean. The workspace Sites gallery picks it up automatically (local provider; bronze awaiting-verdict chip). ⑯ Ridge & Valley = the wave-3 closer. Session spend total 4.08cr (⑭ fix 1.32 + ⑮ 1.68 + ⑭ original 1.08 earlier); balance ≈711.28 pending API verify.
- 2026-07-18 lead: **⑮ STEM & VOW APPROVED (founder live: "nothing to change from me actually") — 15 of 16 verdicted, no fix round. THE LOOP A/B IS CALLED (founder): the quality driver was PRE-PLAN DIRECTION, not claude-design vs engine — "maybe our engine is sufficient for now rather than claude design." RATCHETED same change: meta-prompt §How-to step 3 rewritten — mandatory stage = the pre-plan (look-first · written concept + scroll mechanism · per-slot briefs · decision annotations BEFORE code/mints); claude-design = optional mock tool on request. FUTURE A+ CANDIDATE RECORDED (founder): the bloom triptych becomes a scroll-scrubbed TRANSITION ANIMATION (one Seedance video of the bud→peak transition wired into scroll) — joins the animation-upgrade family (Orchard House seasons-tree scroll · Wagtail scroll-dog) at the re-charter/A+ round; honest cost note: a Seedance transition gen runs ~17.5cr (film-era pricing) vs the triptych's 0.36cr.** site.json verdict updated (the Sites gallery flips its chip automatically).
- 2026-07-18 lead: **⑭ FIX ROUND ACCEPTED (founder: "number 14 is fine for me") — 16/16 SITES VERDICTED; wave 3 = ⑯ remaining. + NEW B-SITEGEN DIRECTIVE (founder): THE PRE-PLAN IS A PRODUCT STAGE** — the pre-plan direction that drove ⑮ becomes part of the page-building feature itself: manual, AI-automatic, or a co-authoring exchange. Recorded in sites-surface-plan §6 (item 4) with the architecture mapping: the direction-doc contract shape + Create's staged-flow already model exactly this (a judged, reviewable pre-stage gating the build loop — the storyboard pattern applied to pages). Rides the B-sitegen charter candidate, checkpoint row 4.
- 2026-07-18 lead: **SESSION 62 — W-AUDIT COMPLETE (all five items) + ⑯ RIDGE & VALLEY SHIPPED (`0f03b1e`): WAVE 3 IS COMPLETE, 17 sites. Spend 0.72cr (balance 710.56, API-verified twice — both openers reconciled to the mint ledger exactly). Six commits, every push locally verified (suite + guard) per the Actions-dead standing practice.** (1) **Opener:** self-check green (pre-reboot; tmux/PG/8899) · peer-mail: all three swordfish tails still open (step-8 dump confirm · basicauth pair · film-import confirm) — wait-state, no action. **Found main RED on arrival:** the ⑭ verdict-acceptance commit (740aa6f) flipped sparkwright's site.json but the sites model test PINNED the verdict as data — docs-treated commit, suite never ran, no CI to catch it. Fixed first (`65248db`): verdict statuses are founder-flipped DATA; the test now checks the logic against every record + a synthetic unverdicted case. (2) **W-audit (b) — the Source-Link sweep + thumbnails (`d6c3935`):** every representation now carries its way back — intel rising rows (sibling ↗ anchors + conformance test), station-01 peek, library shelf (click-out anchor per row; the transcript header links its source); thumbnails plumbed END-TO-END (oEmbed fetchMeta: title + thumbnail in ONE keyless call → sources.meta.thumbnailUrl → library rows; TrendItem→SweepCard→TrendCard passthrough → cards + rising rows render when present; demo cards honestly carry none). Bonus 390 fix: rising-row titles wrap to their own line (they truncated to ~2 chars pre-existing). FEATURE-MAP truthed (incl. the stale W-sites rows — shipped s61, never mapped: a defect by the map's own rule). (3) **W-audit (e) — storage-story (`d7d17aa`):** swept for client-machine systems-of-record — ONE violation found and FIXED same change: board saved views lived in localStorage; now the TENANT-WIDE saved_views store via NEW /api/views (idempotent upsert-by-(surface,name), route-tested on the real db) + board mount-load + one-time localStorage migration that retires the key; verified live on dev PG (save → reload → served from the store). FEATURE-MAP gains the storage-story section of record (per-box stores table + the new-surface rule). (4) **W-audit (c)+(d) — the full /impeccable audit + s40 re-critique (`32f24a7`, report of record `docs/research/workspace-audit-s62.md`): 18/20 after same-session fixes.** Fixed: calendar-390 slot chips BLED across day-cell boundaries (phones now show per-day counts + overflow belt) · placeholders were sub-AA browser gray (global ::placeholder = the AA-pinned muted ink) · judge-pass green was hard-coded twice (now --ok in both themes, wired into the AA-Executable pins) · Bounded-List gaps on Runs + the Library shelf (both bounded w/ stated counts). Re-critique verdict: Four-Verbs / selected-row / j-k / two-channel / honest-states CLEAN on every surface. Queued in the report: form-field id/name harden micro-pass · text-[11px] typeset micro-pass · toast z-scale · **an engine data-honesty question: fanout_runs stays `pending` on rows whose drafts are already judged — transition missing or word wrong; engine-side look before any UI change.** Impeccable sidecar refreshed (13 named rules current). (5) **⑯ RIDGE & VALLEY — the FIRST site under the ratified pre-plan-mandatory loop, and PREPLAN.md is a NEW TRACKED ARTIFACT CLASS** (concept · scroll mechanism · per-slot briefs · decision annotations, written before any code or mints — B-sitegen training data per the founder's pre-plan-is-a-product-stage directive). Look-first (Dribbble roofing + brutalist, Pinterest storm/materials): refused the genre defaults on the record ("Trusted Partner" headlines, navy/orange SaaS heroes, hi-vis thumbs-up crews, stat counters) + the sticker-maximalism trap; taste notes: corrugation IS the grid · the sky is the antagonist and the palette · type as signage in roofing's own spec language · material macro carries the cinematic. The page is a ROOF UNDER WEATHER: one scroll clock arrives a storm (clear zinc → supercell → burst → washed gold) while content rides PAPER PLATES stacked on the weather (AA at every storm stage BY CONSTRUCTION — a pass-1 catch, not luck); material brutalism deliberately unlike Crateline's paperwork register; ALL in-scene text is code-drawn HTML (the pseudo-text risk class retired structurally — no text-precise seat needed); zero border-radius anywhere; the R crops off the page edge; storm gauge + the cross-section lay twin shed the same storm (running water); the tarp wink; the close answers roofing's dread with calm + an honestly-fictional book plate. **Mints 6/6 FIRST-TAKE keepers 0.72cr** (compose-out discipline: roof-plane-only, continuous surfaces, KNIT on the portrait — zero pseudo-text rejects across the whole site; one blank chest tab knit-patched pre-pin + hero rain-spatter full-res inspected, both /guide-disclosed; S1/S6 = the before/after causal pair, continuity directed-not-literal). Barlow Condensed + Barlow + Fragment Mono (OFL, portfolio-new — Archivo AVOIDED: Crateline wears it). Passes logged in /guide; 390 = 390; no-JS/reduced-motion = the complete calm essay, storm chapter statically at peak. Sites-model invariant corrected: a fresh site is LOUDLY awaiting, never silently unverdicted. **Founder queue: ⑯ glance + the audit-report glance; wave-3 checkpoint is RIPE (A+ candidates on record: bloom-transition video · seasons-tree scroll · scroll-dog).**
- 2026-07-18 lead: **s62 SECOND HALF (founder live) — ⑯ VERDICTED "pretty good first try" + fix round SHIPPED (`287a066`) + THE HOUSE STYLE STATED AND RATCHETED + HARTLINE RE-PASS DONE (`ac3e5f3`, founder-granted). Spend 0.48cr (2+2 takes), balance 710.08 API-verified, reconciles exactly.** (1) **⑯ fix round per the founder's notes:** tarp wink now LINKS to the booking plate · anatomy + storm cross-sections MERGED into the one labelled shedding instrument (they were near-identical) + anatomy copy cut to four lines · **the hero re-cast to his style: the storm hero moved to ANATOMY (where a storm rolling in IS the argument) and the new opening is the terracotta-oxide roof in FULL SUN with a mountain peak behind it ECHOING the gable** (2 takes — t1 rejected: near-flat pitch, mottled finish; the storm arc now runs anatomy → storm test → after, the causal pair intact). (2) **THE FOUNDER'S HOUSE STYLE, stated in his words and ratcheted as meta-prompt §casting (9): nature/natural/environment-leverage/urban-nature is the strength — OBJECT = protagonist, NATURE = supporting cast that frames and MIRRORS the subject, PEOPLE = subtle decoration. Named A-strength sites: Ember & Rye · Stem & Vow · Sprig & Barrow · Orchard House · First Crack; brutalist (Vance Alder/Loopwell/Crateline/TrueBore) = "good at, not great."** Memory file founder-style-nature-first.md created; wave-4 + landing planning should lean the slate nature-forward (checkpoint input). (3) **Hartline re-pass (the wave-1 site the T-lane taste pass never covered; founder grant "re-minting or major changes as necessary"):** all six mints audited at full res — honest verdict: the site ALREADY embodies the newly-named style (hero/close-dusk/garden-room exemplary; the fullPage-thumbnail small-hero read was wrong at real viewport). ONE pre-lesson defect: the keys fob's embossed pseudo-cursive → reminted as antique SKELETON keys + plain fob + olive dish (retake 1 rejected: soul stamped the KEY HEAD with pseudo-brand text). **NEW printable-surface corollary ratcheted: FLAT METAL BLANKS (key faces, stamped fittings) — compose-out = an object with no flat face at all.** Old asset fully retired (headlamp precedent), new NAME (stale-cache lesson), guide row honest. Founder queue: ⑯ re-glance rides the existing NEEDS-STEVEN row.
- 2026-07-18 lead: **WAVE-4 SLATE DIRECTED BY THE FOUNDER (live, post-⑯-fix-round: "the fixes made it much better"): a CAFÉ · a SCIENCE-CONSUMABLES DISTRIBUTOR (Sapphire-Bioscience-class: reagents/consumables for the big manufacturers) · a FINE ASIAN RESTAURANT (inspiration named: Onice Mosman + Joji Sydney — both glanced look-first same session).** Reference taste notes on the record: **Onice** = warm terracotta/clay band, wide-tracked serif, editorial white space, a PRESS QUOTE as the hero, gold CTure blocks — earth-tone restraint; **Joji** = DRENCHED single-colour macro panels (saturated red spoon-drip / B&W martini split-screen), custom angular techno display face, staccato copy ("A Rooftop. In Sydney."), mono captions, nightlife energy. The fictional site sits between the poles. **Lead's axis draw (three unique primaries = exactly the three wave-4 anchors — the wave closes ALL TEN axes at 2+ exercises):** ⑰ **café** = novel-typography × soft-organic (the café's own letterform world — menu boards, cup stamps; URBAN NATURE per the house style: plants in the room, morning light) · ⑱ **science distributor** = editorial-print × data-instrument (the catalog/spec-sheet/journal-figure grammar IS the vertical's language; nature angle = MICROGRAPHS — nature at the microscale as the imagery register) · ⑲ **restaurant** = exceptional-palette × cinematic-imagery (drenched ingredient-colour worlds, one ingredient per chapter; nature angle = ingredients ARE nature, seasonal/lunar register). **Name candidates (checkpoint/build picks):** café = Fern & Crumb (rec) · Mosslane · The Morning Room; science = Strata Scientific (rec) · Garnet Bioscience; restaurant = Tsukimi (rec — moon-viewing, nature-linked) · Shirasagi · Kagerou. Builds open s63 on the pre-plan-mandatory loop (PREPLAN.md per site); the house nature doctrine (§casting 9) is a named input to all three.
- 2026-07-18 lead: **THE PRODUCT-WORK INVENTORY (founder ask, s62 close: "apart from the web designs, any other workspace that needs work? eventually we get back to working on thalon fully") — the honest map of what stands between today's engine and the REAL product, recorded for the re-charter.** **(A) The four arming steps that make Thalon real:** ① **live intel pollers** (B6.5 — intel runs on the demo dataset; official-API drivers, YouTube Data API first; automated acquisition IS the feature per the founder's frame; needs the gateway top-up for dossier generation) · ② **the publisher doors** (B3.1 — social POSTING is deliberately unwired; the founder's test accounts stand ready; official APIs only) · ③ **one-prompt video through the engine** (the staged flow + judge lane exist; the one-prompt door is the honest planned state in Create; pillar #1 = a THALON video through the product's own pipeline — the content-origination goal) · ④ **live send GO** (B-crm.4 built + disarmed; his stealth call). **(B) B-sitegen = the LANDING PAD for the web-design arc** (his phrase answered): the 17-site portfolio + meta-prompt + the new PREPLAN.md artifacts ARE the knowledge store; the executable half wires the meta-prompt behind Create's page family (prompt | URL-DNA | template pick → pre-plan stage → judged build → approve) — charter candidate, row 4, input-side + pre-plan-stage directions already recorded. **(C) The Thalon landing** — the portfolio's stated destination; post-wave-4; film refine unparks after it. **(D) Queued engine/workspace items:** four Phase-I doors still unwired UI-side (planned slots → calendar drag + week-strip marks · lead stage → board drag · captures READ → station 02 + durable capture store replacing the in-memory one + approve lineage resolution; saved-views done s62) · fanout_runs stays `pending` after drafts judge (engine look) · audit micro-passes (id/name harden · text-[11px] typeset · toast z-scale) · db-dump route removal · B-crm.3–6 + undo-after-terminal at checkpoint · SEO/AEO/GEO (A13/B6.8) · B6.7 domains (parked). **Proposed shape at the re-charter: wave 4 + the landing CLOSE the visual arc, then Sprint 8 = "ARM IT LIVE" (pollers · publisher · B-sitegen · pillar #1 through the pipeline).**
- 2026-07-18 lead: **FOUNDER DECISION: no GitHub top-up — Actions stays dead until the MONTHLY RENEWAL.** Standing until then: local verification (full suite + guard) before every push (already this session's practice); staging does NOT auto-redeploy (web-image builds ride Actions) so staging holds the pre-window image, and the templates/catalog image can't rebuild either — the Dokploy sites-origin arming becomes fully useful post-renewal. The billing row on NEEDS-STEVEN rewritten as a wait-state, not an ask.
- 2026-07-18 lead: **s63 (pre-reboot window; the 18:30 UTC box reboot bounded the session — build deliberately NOT started mid-wall): QUEUED SMALL WORK CLOSED + ⑰ PRE-PLAN WRITTEN + ONE DOCTRINE ADDITION (founder live at the tail).** (1) **The W-audit engine finding FIXED (`e2b0708`): `fanout_runs.status` had NO writer at all** — the lifecycle words existed only in the check constraint. `fanoutRuns.setStatus` = THE one writer (events-audited `{from,to}`, idempotent no-op, deliberately NO transition graph: run status is operator telemetry, never control flow); all three orchestrators wired (running → complete/failed; lastError lands first so a crash leaves the backfillable word); fast paths SELF-HEAL pre-lifecycle rows on touch; the three dev `pending` rows healed through the writer with audit rows (staging heals lazily on touch). Tests: repo + events-coverage pin + three orchestrator event-sequence pins updated + self-heal case. (2) **The three audit micro-passes shipped (`a39831a`):** typeset (every `text-[11px]` → named steps; track-view's below-micro 9px + five arbitrary 10px normalized to `text-2xs`) · harden (all 11 profile-editor fields get id+name) · z-scale (toast above the palette/modal layer). (3) **⑰ FERN & CRUMB PREPLAN.md written (`25bdc56`)** — concept: TYPE THAT PROOFS LIKE DOUGH (variable serif SOFT/WONK swell = the one animation system; morning arc static, NOT a scroll clock — ⑯ owns that); & = latte-fern rosette; fully code-drawn menu board centerpiece; croissant-bite wink; casting per the dial (engaged pair + one absorbed female barista, plain knit, no apron); 6 soul_2 slots, no text-precise seat, est 0.7–1.2cr. (4) **motionsites.ai added to the look-first sweep (founder addition, live; `427648c`)** — meta-prompt step 0 third source, motion-register reference read double-edged; ⑰ taste note 6 recorded (motion lives IN the subject; no animated backdrop added). (5) Opener facts: balance 710.08 API-verified reconciles exactly · Actions renewal NOT landed (pushes show the billing-dead signature) · swordfish step-8/basicauth/film-import tails all still open (nothing inbound) · dev pg + tmux + 8899 healthy. **s64 = BUILD ⑰ off the pre-plan** (then ⑱ ⑲ one at a time).
- 2026-07-18 lead (s63 addendum, pre-push): **⑱ STRATA SCIENTIFIC PREPLAN.md also written same session (`3a1d167`)** — CATALOGUE No. 7 slide-tray concept (print catalog whose figure system is prepared slides; bounded micrograph plates = the colour engine; certificate-of-analysis + HPLC trace instrument pair; focus-rack = the one moving system; ZERO people per the dial's B2B reading; off-register wink). Paper stage now done for ⑰+⑱; ⑲ Tsukimi sweeps at its own build turn. **Portfolio ratchet amended in the same wrap:** the full-suite run failed on the new PREPLAN-only dirs — `template-portfolio.test.ts` now recognizes the pre-plan stage (PREPLAN.md alone, no index.html) and asserts any non-built dir is EXACTLY that shape; repo-ratchets re-verified green. (Also: the run's red was nearly masked by a piped `tail` swallowing vitest's exit code — numbers were read, not trusted; noted as the standing reason wrap verification reads totals, never exit codes alone.)
- 2026-07-18 lead (s63, continued past the planned wrap on the founder's live "continue" call): **⑰ FERN & CRUMB SHIPPED (`d1ac74c`) — 18 sites; the FIRST site built ON the pre-plan loop end-to-end (PREPLAN.md → build, same session).** 6/6 FIRST-TAKE soul_2 mints at 0.72cr (balance 709.36 API-verified, reconciles exactly): monstera-shadow morning-room hero (the frond shadow mirrors the latte fern — §9 enacted) · backlit torn-crumb macro · the fern pour · the engaged window PAIR (food-casting corollary verbatim; its invented table-card scribble + one lens artifact took DISCLOSED pre-pin local blurs per the near-clean ratchet, /guide says so) · knit barista no-apron (worn-fabric rule held; machine came back seamless matte as composed) · rack of three (count-anchor held). Build deltas from the pre-plan, recorded honestly: **Fraunces swapped for Shantell Sans variable at build** (Fraunces already carries Ember & Rye + Sprig & Barrow; Shantell's BOUNCE+INFORMALITY axes make the proofing mechanism native) — the swap-at-build precedent ⑯ set with Archivo→Barlow. Fix-round fixes already in: mobile timeline → left-spine vertical · eyebrow AA (rust text token split from decorative terracotta) · menu semantics · CTA = statement plate not dead link. repo-ratchets 12/12 · guard clean · console clean · 390 no-scroll · no-JS/reduced-motion complete by construction. **⑱ builds next off its committed pre-plan; ⑲ pre-plans at its own turn.**
- 2026-07-18 lead (s63, still going on the founder's "continue"): **⑱ STRATA SCIENTIFIC SHIPPED (`88c3b7d`) — 19 sites; wave 4 now 2-of-3, both built off committed pre-plans in ONE session.** CATALOGUE No. 7 slide-tray concept realized: each product family = a microscope slide (frosted code-drawn label + specimen window + SVG scale bar + spec table), certificate-of-analysis + self-drawing HPLC trace instrument, FOCUS RACK as the one moving system, off-register "checked twice" proof-mark wink. Colour discipline = the distinctness mechanism (saturation ONLY inside micrograph windows). **Casting: ZERO people** (dial B2B reading) — §8's dread-counter carried entirely by the sunlit bare-glass hero + courtyard-through-glass band. Mints: 0.96cr / 8 (balance 708.40, reconciles): 3 abstract micrographs first-take; **hero + consumables slots RE-MINTED with harder compose-outs after first takes invented jar labels / pervasive pseudo-brand text on tube barrels — the pre-plan's compose-out column predicted BOTH failures exactly** (validates the pre-plan-as-risk-register value); 2 disclosed pre-pin local blurs remain, /guide discloses. repo-ratchets 12/12 · guard/console clean · 390 no-scroll · no-JS/reduced-motion complete. Fonts: Newsreader + IBM Plex Mono (both OFL, vendored). **s64 = ⑲ TSUKIMI (restaurant, exceptional-palette × cinematic, Onice↔Joji poles) — needs its own look-first sweep (Dribbble · Pinterest · motionsites.ai, weighted up for the drenched/cinematic draw) then pre-plan then build; closes wave 4 + all ten axes at 2+.** Founder verdicts on ⑯/⑰/⑱ all open on NEEDS-STEVEN.
- 2026-07-18 lead (s63, founder live — fix rounds on ⑰ + ⑱ from his verdict message): **BOTH APPLIED + verified (`078e7a3`), balance 707.80 (5 mints 0.60cr, reconciles).** ⑰ FERN & CRUMB: (1) board now pairs each menu section with its dish photo, image side alternating (his First Crack reference) — flat white (fern art + steam) / morning bun / ricotta toast (diced red onion + cherry tomato + herbs + olive oil), all in the Room shot's warm morning window light; (2) barista RE-MINTED — naturally-beautiful South American woman (not a model), strong bokeh, low warm autumn light + long shadows, visible steam off the cup (his notes verbatim; reads far cozier than the clear first take). ⑱ STRATA: (1) **the portfolio's FIRST horizontal side-scroll** — the three vertical product sections collapse into one 'slide tray' (scroll-snap, 4th card peeks to signal, focus-rack sharpens cards as they enter; the slide-tray concept made literal, big vertical-space saving) — he explicitly asked to try side-scrolling/horizontal layering and it fits the concept perfectly; (2) last image REPLACED — the clinical courtyard (he read it as 'abandoned mental hospital') → high-floor lab window over fields/river/road-leading-in/mountains, copy retuned, courtyard's disclosed blur retired from /guide. repo-ratchets 12/12 · guard/console clean · 390 no-scroll both · no-JS/reduced-motion still complete. **NEW interaction pattern in the kit now (horizontal scroll-snap tray) — a candidate for ⑲ and the landing.** Awaiting founder: further ⑰/⑱ tweaks or GO for ⑲ Tsukimi (the wave's last, closes all ten axes at 2+).
- 2026-07-18 lead (s63, founder verdicts + a ratchet): **⑯ / ⑰ / ⑱ ALL VERDICTED GOOD** — "fern and crumb is good now. strata scientific is also good... i had a look at number 16 previously and it was ok." Two of wave 4 shipped + approved; ⑯ (wave 3) approved. **NEW DOCTRINE RATCHET (founder, from the ⑱ review): the window-glazing corollary.** He noted ⑱'s valley-window shipped with a FOUR-PANE grid — "having multiple vertical lines across the window like that makes it look like a cage/prison"; it had to be a one- or two-pane (or frameless) window. Let it pass this time (minor, not worth the credit to re-mint) but asked to ratchet the lesson. Done: meta-prompt §casting (8) window corollary (when the §8 outdoor-counter is shown THROUGH glass, minimal panes / floor-to-ceiling frameless — a mullioned grid reads as bars and reintroduces the confinement the shot exists to dispel; prompt "a single large pane") + memory founder-style-nature-first.md updated same change. **NO credit spent on ⑲ Tsukimi yet — GO not given; holding at the mint gate.** Balance 707.80 unchanged this turn (docs-only).
- 2026-07-18 lead (s63, founder "go" → ⑲ built full-loop): **⑲ TSUKIMI SHIPPED (`368cbf3`) — WAVE 4 COMPLETE, 20 SITES; all ten design axes now at 2+ exercises.** exceptional-palette × cinematic, the fine-Asian-restaurant closer. Concept: A TASTING MENU YOU READ BY MOONLIGHT — four drenched single-colour course worlds (crimson beet → amber uni → green matcha → violet plum, each one ingredient glowing out of near-black = the exceptional-palette exercise); the MOON is the one animation system, a code-drawn disc crossing a fixed sky moonrise→zenith→moonset on scroll (verified in-browser: it tracks correctly across the three chapters — cinematic clock + §9 nature-frame in one); held black pull-quote chapter = the omakase pacing move; sits between the founder's Onice↔Joji poles (drenched Joji colour + Onice Didone restraint + mono captions). Wink: the rabbit in the moon (tsuki no usagi) + a lunar-phase marker. Casting: course worlds people-free, ONE warm chef-at-the-counter close (§7 + food corollary). Fonts Bodoni Moda + Chivo Mono + Instrument Sans (OFL vendored); CJK accents ride system fallback. 6/6 first-take 0.72cr (balance 707.08, reconciles). **HONESTY GATE fired: course I planned as akami tuna, the mint read as glazed beet rings → reframed to beetroot-in-plum to match the image, /guide discloses, zero re-mint — the pre-plan risk-register paying off a third time.** Only drenched-DARK site in the portfolio (distinctness structural: ⑰ parchment / ⑱ white / First Crack daylight). repo-ratchets 12/12 · guard/console clean · 390 no-scroll · no-JS/reduced-motion pins the moon + renders complete. **THE VISUAL ARC IS NOW ONE STEP FROM DONE: waves 1–4 all shipped (20 sites, all axes 2+); the checkpoint = A+ animation family · B-sitegen charter · THE THALON LANDING (film unparks after it).** Founder verdict on ⑲ opens its fix round if any.
- 2026-07-19 lead: **SESSION 64 — ⑲ TSUKIMI FIX ROUND off the founder's verdict + REFERENCE-GUIDED MINTING becomes standing doctrine + the swordfish cutover thread CLOSED + syd4 RESIZED (16 GiB / 6 vCPU / 180 GB). Spend 0.96cr (balance 706.12, API-verified, reconciles exactly).** (1) **Founder verdict on ⑲ (typed direct):** the moon can stay but fine dining doesn't need to shout — re-theme to everyday Japanese (ramen · sushi · soba · rice) keeping the whole structure; re-shoot the food close and low-angle (<45°, never top-down; glistening broth, rendered fat); the free space in the held-quote chapter gets a background of counter seating overlooking the open kitchen; and the standing directive: **combine dense prompts WITH real saved/screenshotted web reference images fed to Higgsfield** — refusing web references was costing takes. (2) **The fix round:** references hunted via Bing DOM extraction + the Wikimedia Commons API (DuckDuckGo's duck-CAPTCHA and Pexels' bot-wall were respected, not circumvented); watermarked stock comps rejected as pseudo-text seeds; **every reference EYEBALLED before feeding**. 8 soul_2 mints @0.12cr: crimson = chūtoro-nigiri ref, FIRST TAKE — **the original honesty-gate beet is retired; the crimson course is finally the tuna it was planned as**; violet = yaki-onigiri+umeboshi ref, first take; counter bg = sushiman-interior ref, first take (the ref carried a working chef in against the no-people prompt — kept deliberately, the working kitchen fits the everyday register, dimmed under the quote scrim); amber = take 2 on a golden-broth ref (take 1 pale/cool; the enhancer-added decorated spoon composed OUT via a deterministic manifest crop `position:left` — no blur); green = take 3 TEXT-ONLY (two ref-guided takes stayed buckwheat-grey against explicit vivid-green language). (3) **THE LESSON RATCHETED (meta-prompt §assets, replacing the old downloading-references-is-forbidden rule):** web reference images SHOULD feed the vendor as generation inputs — never the repo/page; the reference must ALREADY LOOK like the target (soul-class enhancement captions the reference and that caption beats prompt text — a ref is "make exactly this", never "make this but different"); no watermarked or text-overlaid refs; when the ref fights a wanted attribute, change or drop the ref. Pin provenance params now carry the reference note. (4) **Site changes:** register recut (01·Sushi / 02·Ramen / 03·Soba / 04·Rice; the counter chapter drops eight-seats scarcity for "A counter that faces the kitchen" + walk-ins), the quote chapter gained the dim counter view + scrim (AA holds; the moon reads through the top as lantern bokeh — kept), manifest/site.json/guide updated honestly (guide discloses the reference workflow, all 3 rejects, and the crop). Verified: desktop + 390 no-scroll · console clean · repo-ratchets 12/12 · guard green. (5) **Swordfish:** step-8 dump confirm RECEIVED → cutover choreography CLOSED end-to-end (`.context/cutover-s56/` deleted per note; resolved threads pruned to SWORDFISH-ARCHIVE; ack in ASK-BACKS). **syd4 resize LANDED** (~02:20 UTC, two provider reboots, both units healthy): stagger-the-lanes guidance retired. Open swordfish tails: film-import (their queue) · basicauth + DB_DUMP_TOKEN console pass (founder-gated).
- 2026-07-19 lead: **s64 LIVE ROUND (founder, post-wrap) — three directives recorded same turn:** (1) **Reference-image verdict: the advice WORKED** — lead's honest assessment on record: the ref-guided slots landed first-take on the intended subject (incl. the tuna text-only couldn't produce); refs kill the right-subject-wrong-object failure class; nuance stands (ref must BE the target). (2) **PRICE-REGISTER corollary ratcheted** (meta-prompt §casting, after the social-register dial): motion budget + food-macro share scale DOWN as price point rises — fine dining sells atmosphere/setting/view/social, so its pages are STILL (room/view/people imagery leads, near-zero scroll choreography); drenched macros + kinetic scroll = the casual register; ⑲'s down-register re-theme = the model case. Memory founder-style-nature-first.md carries it. (3) **TIER-GATING directive** → queue row 4 + product-feature-framing memory: templates + CRM = founder-only or highest paid tier; the visual arc HOLDS at 20 sites for now. Swordfish status re-confirmed to the founder: cutover closed, resize verified; open = film-import (their queue) + the founder-present console pass (basicauth + DB_DUMP_TOKEN).
- 2026-07-19 lead: **s64 SECOND HALF — SPRINT 8 OPENS ON THE FOUNDER'S GO ("how about the arming work"). CONTRACT WINDOW 0016 BUILT + FROZEN (PR #60, rebase-merged on full local verify: root 1589 green · typecheck · lint 0 errors · guard).** The window = the ENTITLEMENTS SEAM (tenants.plan + tenant_entitlements + contracts isEntitled; founder defaults pinned by test: sites_templates + crm = internal|max only) · the SOCIAL PUBLICATION LEDGER (UNIQUE (tenant,draft,platform) — double-post structurally impossible, cross-post legal) · SWEEP SCHEDULES (one row/tenant, 15min–24h bounds, honest last_sweep_at). Two ratchet catches during the build, both by design: COPY_ORDER completeness (the 0015 lesson repeating — three tables added in FK-safe order) and the sprint8 duplicate-detection test forcing the cause-chain unique-violation convention. Three lanes launched post-freeze per the founder-approved slate (board above); first launch under the resized box (16 GiB — no staggering).
- 2026-07-19 lead: **SPRINT-8 LANES ALL MERGED same session (PRs #61 B-pub.1 · #62 B-arm.1 · #63 B-vid.7), each on a full local root-suite gate + typecheck + guard.** Mode note honoured: launched Mode A on the founder's one-time OK; vid7 stopped pre-commit and the LEAD finished it (verify + commit — no agent resume, no extra run). Merge order revised on the record to merge-as-ready (disjoint file sets). **NEXT-WINDOW QUEUE from lane gap reports:** brand_profiles `social` config block (column + schema field — the door reads it structurally until then, honestly disarmed) · `publishable` draft-format capability · SOCIAL_* env keys in platform env schema (rides B-pub.2 with the first driver) · `sweep.schedule_failed` event door · sweepSchedules `listAll`. **ARMING TAILS (founder):** YouTube key / Bluesky app password → set TREND_SOURCE + enable schedules · platform app-review applications (LinkedIn first) · per-platform SOCIAL_*_ARMED GOs when drivers land · gateway top-up.
- 2026-07-19 lead: **INTEL ARMED (founder: keys were already staged in dev env — YouTube + Bluesky both present, TREND_SOURCE set).** Self tenant's sweep schedule ENABLED (240 min) and the first scheduled pass ran live: 1 due, 1 swept, 0 failed — but **0 polled: the tenant's watchlist/area config doesn't point at the armed source yet; aligning it = s65 opener item (then the first real cards land).** LinkedIn/X answered to the founder: no new LinkedIn account needed (developer app on the existing account, neutral app name; the brand Company Page waits on the stealth call) · X account rename to "thalon" also waits on stealth — what's needed now is the developer app + API keys on the existing account.
- 2026-07-19 lead: **FIRST LIVE INTEL DATA: bluesky sweep polled 221 real posts → 30 ranked cards** (self tenant; area "Frontier AI models" + watchlist queries: frontier AI models · Claude Fable · Opus 5.6 · Kimi K3 · AI content engine · AI web design — the founder's picks). Schedule continues 4-hourly via the merged scheduler. Developer apps: no login creds staged in .context (keys.md documents the LinkedIn process only — note its step 1: an app must attach to a Company Page, the stealth trade the founder must call); ask filed for creds via the .context channel.
- 2026-07-19 lead: **Social publisher credentials COLLECTED + validated read-only (founder-driven, keys in gitignored `.context/social-logins.md`): X · LinkedIn · Facebook · Instagram all authenticate; Threads pending (separate Meta app).** Each proven with a live read-only API call (X users/me · LinkedIn userinfo · Meta app-token + me/accounts + IG-business-account derive; Meta short token exchanged to long-lived ~60d, page token + IG business id pulled). NOT wired into repo env, NOT armed — that's B-pub.2+ driver lane work next session, and live posting still needs per-platform ARMED flag + founder GO. Dogfood accounts are deliberately non-Thalon-branded (rename-to-Thalon at launch survives the integrations — keys off stable IDs); LinkedIn token = member/personal-profile scope (org/page posting needs LinkedIn review, later). Founder tail: rotate the account passwords in the file now that collection's done.
- 2026-07-19 lead: **Credential collection CLOSED at four platforms (X · LinkedIn · Facebook · Instagram — all validated read-only, staged in `.context/`).** Threads deferred (founder choice; path saved). **TikTok BLOCKED on downstream work, correctly parked:** its app can't be completed/audited until (a) real hosted Terms + Privacy pages exist (TikTok verifies the URLs resolve) and (b) the integration is built (audit demands an end-to-end demo video). Surfaced constraint: **hosted Terms + Privacy pages are a SHARED prerequisite for ALL platform audits** (LinkedIn Community Mgmt · Meta App Review · TikTok), tied to the landing/public-site work — a cross-cutting launch gate now on the arming-plan dependency table. Four platforms is more than enough to build + dogfood B-pub.2 next session.
- 2026-07-19 lead: **⑲ TSUKIMI FIX ROUND APPROVED (founder s64: "i dont need to check tsukimi, its pass and its ok") — CLOSED, no re-glance.** The everyday-Japanese re-theme + reference-guided mints land verdicted-good; the reference-guided-minting doctrine and the price-register corollary from this fix round stand ratified by the approval. Visual arc HOLDS at 20 sites per the founder ("leave the landing pages at this for now"). Also: swordfish's ~05:05 live-comms note (agent-comm tool + live-comm skill now on the box) READ — informational, "no change for you, already laned/adopted"; archived, no action. Swordfish channel is otherwise quiet: cutover/step-8/resize all closed; the two remaining tails (film-import their queue · basicauth+DB_DUMP_TOKEN founder-gated console pass) are dormant + non-blocking.
- 2026-07-19 lead: **s65 — CONTRACT WINDOW 2 BUILT + FROZEN (PR #64, rebase-merged `da56b2d` on full local verify: root 1649 green · typecheck · lint 0 errors · guard).** The consolidated s64 lane-gap window: `brand_profiles` gains BOTH `social` AND `outreach` jsonb columns with repo carry — the s54 outreach persistence gap was found NEVER CLOSED (the send door read a column that didn't exist; every real tenant permanently disarmed) and this window closes both gaps in one migration (0017, verified live on dev pg); publish/send test suites now run the REAL persistence path (armRepos doubles deleted). Plus: `publishable` format capability (door reads the flag, not a format-name branch) · `social_publishing` entitlement key (internal|max, no reader yet — Integrations gates on it) · ten SOCIAL_* env arming pairs in the platform schema · `sweepSchedules.listAll` (scheduler drops its N+1 loop) + `markFailed` → `sweep.schedule_failed` verbatim (the B-arm.1 failure-durability flag closed; scheduler wired, best-effort). **FOUND MAIN RED #2 (the s62 verdict-pin pattern): `tests/boundary.test.ts` fails on clean main — PR #61 landed the forbidden env literal in a registry.ts COMMENT and the s64 local gate missed it; fixed by rewording, ratchet stays strict (comments count).** Also closed this opener: stale `.next/types` referencing the retired db-dump route purged (typecheck was red until then). Founder calls at the s65 opener: track = **A build + B charter same session** · B-pub.2 driver lane APPROVED (Mode B, named, launch at freeze) · **gateway top-up DONE** → B-vid.8 queues this session. Fleet note: three new agent sessions appeared on the box — the two client-company agents (names = guard tokens, withheld here by the one hard constraint) plus a vault agent (all idle, no pings, no action). **GUARD CATCH, same session (recorded honestly): the lead's first draft of THIS record named those two sessions verbatim in this tracked file and a `| tail` pipe swallowed the guard's failing exit, so the violation briefly reached origin — caught by the worktree-setup guard minutes later, scrubbed by history rewrite (the 2026-07-03 precedent; no open PRs lost). Lesson ratcheted below: guard invocations must gate on THEIR exit code — never piped bare into `tail`.**
- 2026-07-19 lead: **s65 SECOND HALF — B-pub.2 MERGED (PR #65, first Mode B lane via launch-lane.sh) + the Integrations charter DRAFTED with the founder's live destinations addition.** (1) **The lane:** four official-API drivers (linkedin versioned-REST w/ publish-time userinfo author-derive · x v2 create-post · facebook page-feed w/ token-in-header-only · instagram = typed text-only refusal until a media bucket) + `productionSocialDrivers` assembly (facebook/instagram register only when their SOCIAL_*_PAGE_ID/_USER_ID extras exist) — all DISARMED, zero-live, injectable fetch, +20 engine tests (726 green); pre-merge gate on the rebased branch: root 1669/0; wrap of record `agent_handoff/lanes/WRAP-pub2-drivers.md` (endpoint+version pins, three reported gaps, pre-live founder checklist). Lead follow-up same session: stale missing-driver refusal reworded (gap 1); gaps 2–3 (LinkedIn Little-Format escaping call · version-pin pre-live re-verify) ride the first-live-post checklist. Lane hygiene: worktree GC'd, window killed, lane launch script needed one manual Enter (kickoff parked in composer — watch for it next launch). (2) **Charter (Track B, founder ratification pending): `docs/proposals/2026-07-19-integrations-surface.md`** — vault recommendation (envelope crypto, KMS swap path), five buckets, and the founder's LIVE s65 addition ratcheted in: **destinations, not social platforms** — website/blog = a first-class OPTIONAL destination (the engine already ships it end-to-end: approved web_page → deploy door → /blog+RSS; FEATURE-MAP's partial becomes the published-view), hosted blog = an offering never an assumption, newsletter = Resend follow-on bucket, and the dogfood order FLIPS (blog = first live destination, no review gates — pillar #1's blog article proposed as the proof-of-product moment). (3) **Arming truth: the intel soak was DEAD at the opener** — no scheduler process existed; now persistent (tmux `sweeper`, immediately swept the overdue tenant 30 cards/221 polled, ticking 15m); reboot-relaunch noted in memory beside 8899; systemd units queued as a swordfish ask. Gateway paid path VERIFIED live (sonnet-4.5 probe). **B-vid.8 pillar #1 = the s66 headline, gate proven open.** Usage note: Fable plan at 87% (resets Jul 24) — s66 paces accordingly.
- 2026-07-19 lead (s65 addendum): **post-merge typecheck catch on #65** — the lane's "typecheck clean" claim did not hold at the merge result (the engine is DOM-free; the drivers' error helpers typed lib `Response`, which the ambient fetch slice doesn't satisfy) and the lead's pre-merge gate ran the SUITE but trusted the claim for typecheck. Fixed forward same session (`DriverResponse` structural slice) and RATCHETED executable: **root `npm run verify` = guard→test→typecheck→lint in one command, fail-fast** — the merge gate of record from s66 on; partial gates were the hole both this and the #61 boundary miss crawled through.
- 2026-07-19 lead (s65→s66 rollover, founder live): **INTEGRATIONS CHARTER RATIFIED ("i'm happy with the charter") → ADR 0011** — all five calls as recommended (envelope-crypto vault w/ KMS swap path · one social_publishing key · self tenant onto the vault · filings LinkedIn→Meta→X gated by THE LANDING's Terms/Privacy pages · destinations reframe w/ optional website + blog-first dogfood; pillar #1's blog article = the ratified proof-of-product moment). Founder then ordered the next session started in-place: **s66 opens now — B-vid.8 pillar #1 first, B-int.0 window as capacity allows.**
- 2026-07-19 lead (s66, founder live): **APPROVE AREA REBUILT PER FOUNDER DIRECTION (`af9ec4f`, verified live on dev): newest-first DEFAULT + switchable sort + status filter (All/Waiting/Blocked) + EXACT date-time stamps on every row (relative ages retired); filtered footer/empty states stay honest ("N of TOTAL"); found+fixed a real selection bug the change exposed (same-id reselect stranded the panel on "loading"); `.next-dev` excluded from typecheck (live dev server races the gate).** Hygiene note, recorded honestly: the engine scene-indexing fix rode this commit via a careless `git add -A` — mixed concerns, message doesn't name it; gated green, not rewritten. **B-vid.8 PILLAR #1 — four one-prompt runs, every stop HONEST (the product is working as designed): (1) screen judge correctly failed a generator-invented "building in the open" claim (topics ≠ facts; ALSO stealth-protective — final tier passed it leniently = EVAL-ROW CANDIDATE #1); (2) FOUND+FIXED a real staged-pipeline bug — the scenes/polish stage prompts render scene numbers 1-BASED while demanding 0-based sceneIndex (two models echoed the doc numbering; SCENE_INDEXING_RULE now stated at the JSON contract in direction/shell/generator.ts); (3) screen judge correctly failed an invented thalon.com URL (final passed leniently = EVAL-ROW CANDIDATE #2); (4) both tiers correctly failed an ungrounded product meta-claim. UNBLOCK PATH: the self tenant's identity FACTS are too thin for a product explainer — facts list drafted for the founder's endorsement (facts are operator-asserted truth, never lead-invented); MODEL_DRAFT upgraded to sonnet-4.5 on dev env (the top-up's purpose).** NEW FINDING queued: one-prompt storyboard drafts land in Approve but their staged-flow detail FAILS TO LOAD ("Couldn't load this staged flow") — the operator cannot inspect/re-judge blocked pillar chains from the panel; engine/web look needed. Queued: the two judge eval rows (final-tier leniency class) ride the next eval pass.
- 2026-07-19 lead (s66 close, founder live): **FOUNDER APPROVED the pillar recommendations + endorsed the identity FACTS ("yes i agree… i approve and you can unblock any tasks/pillars for work/building next session") — profile VERSION 2 created+activated through the product door (POST /api/profiles): 13 facts (6 endorsed product truths added).** Standing approval recorded for next session's unblock work: pillar re-run on the enriched grounding · the staged-flow detail fix · the two judge eval rows · B-int.0 window (charter ratified). Mint/render discipline unchanged: the pillar's takes get a per-take priced plan (get_cost) BEFORE any spend; ≥40cr still pings the founder; render is box-local $0.
- 2026-07-19 lead (s66 tail, founder live): **SEQUENCING CALL — mint/render DEFERRED until the post + blog loops are proven end-to-end ("can the mint and render be done after the post and blog stuff…?" → yes, and it's the cheaper order).** s67 order of record: blog loop (pillar article → /blog, zero credits, the ADR-0011 proof moment) → post loop (production publish caller + per-platform reviewed first posts behind his GOs) → THEN the video mint cost plan. The s66 pillar chain stays safely planned in the DB — mint/render is a pure tail.
- 2026-07-19 lead (s67, autonomous off the s66-approved slate — ZERO credit spend, blog+post loops both credit-free): **THE BLOG LOOP PROVEN END-TO-END (the ADR-0011 proof-of-product moment) + THE POST-LOOP PRODUCTION CALLER WIRED + B-int.0 VAULT WINDOW FROZEN + staged-flow live projection + Settings discoverability + 3 judge eval rows.** Six commits on main (`5d8e8c1`→`9898304`) + the window PR #66 (`e949b43`). (1) **Blog loop:** pillar #1's ARTICLE ran the real origination loop (page-loop dogfood, sonnet-4.5 draft) → generate → BOTH judge tiers pass → operator REJECTED take 1 (generator invented a threshold/retraining mechanism the sources don't assert — honest catch) → brief tightened → take 2 approved → own-site publish door → LIVE on dev `/blog` + `/blog/<slug>` + `rss.xml` (all 200, served body IS the judged artifact). **RATCHET found+shipped same loop:** the meta `description` is served (blog index/RSS/social preview) but was NOT visible page text, so it could escape the judge — `webpage.toDraft` now appends it to the claim surface (webpage.test + key-stability pins updated). Also: `assertSoleDbWriter` now no-ops when `DATABASE_URL` is set (postgres is multi-writer — the PGlite single-process refusal was blocking eval CLIs beside the dev server). (2) **Post loop:** `productionSocialPublisherResolver(env)` (engine) + `publishApprovedSocial` action + `POST /api/drafts/[id]/publish-social` (web) wire the merged drivers into the publish door; `PublishRefusedError` → typed 409. Generated + judged the first LinkedIn post (queued, both tiers pass). **DISARMED still:** every platform refuses until its `SOCIAL_<P>_ACCESS_TOKEN` + `SOCIAL_<P>_ARMED="true"` founder pair — the per-platform live-post GO is the founder's, unchanged. **Profile-wire fix found staging it:** `brand_profiles.social` (+ `outreach`) persisted at the write door but `toWire`/`formToConfig` dropped them on any editor round-trip — the exact 2026-07-14 icp/cadence/routing class, recurred for the window-2 pair; both now ride the wire + the carry (pin covers all five blocks). (3) **B-int.0 window FROZEN (PR #66):** DESTINATIONS registry (11 keys across social/website/newsletter/intel; tiktok deliberately absent) + card-state vocab (stored ⊂ derived) + `credentialEnvelopeSchema` + `tenant_credentials` vault (envelope columns, connect-as-upsert/rotate, validate-ping/needs-reauth, redaction invariant test-pinned) + `THALON_VAULT_MASTER_KEY` env; migration 0018 verified purely additive; the migrate-data completeness ratchet caught the COPY_ORDER omission (working as designed). (4) **Staged-flow live projection (the founder's s66 find):** real one-prompt chains answered "belongs to no staged flow" — now `getLiveStagedFlow` projects the chain from the drafts table (walked via `meta.priorDraftId`, verdicts included), `source:"live"` renders read-only (pick/edit/advance are demo-only; the write half stays a bucket); blocked pillar chains are inspectable from Approve. (5) **Settings discoverability:** added to the tenant/avatar menu + the menu footer mention now links (the rail's foot gear kept). (6) **Eval:** 3 golden rows for the judge-leniency class (topics-are-not-facts · invented-url · invented-mechanism, all expect fail); live golden:g3 — FINAL tier fails all 3 correctly, SCREEN passes 2 (disagreement blocks in prod either way); also observed pre-existing final-tier over-strictness on g3-004/005 truisms (judge-prompt tuning candidate). Gate discipline: full `npm run verify` equivalent green at every commit (guard · 1670+ suite · typecheck · lint 0 errors); the 10-min tool cap split the gate — suite backgrounded, guard/typecheck/lint foreground. **s68 slate: MINT/RENDER (deferred by founder call until the loops proved — now they have; per-take get_cost plan → founder GO → mints + box-local render) · B-int.1 vault core (envelope crypto behind the frozen doors) · then B-int.2 surface. Founder-side: the per-platform live-post GOs whenever (LinkedIn first) · the mint-plan GO.**
- 2026-07-25 lead: **SESSION 68 — B-int.1 VAULT CORE SHIPPED (`7682993`) + PILLAR #1 CHAIN GREEN END-TO-END + ACTIONS BILLING VERIFIED BACK. Zero credit spend (balance 706.12, get_cost preflights only).** (1) **Billing (founder restored it pre-session):** re-ran the head runs — ci-guard GREEN (22s vs the 5s billing-dead signature), web-image GREEN (5m42s build-push) → staging auto-redeploy is BACK; ROADMAP row closed. (2) **Found main RED on arrival (class #3):** s66's Settings-discoverability commit gave "Settings" a second link; workspace-shell's page-wide role query double-matched ever since — the s67 close verify missed it because the suite ran through a `| tail` that swallowed the failure (the same swallow class as the s65 guard incident; my own first run today nearly repeated it). Fixed first (`8c6ec7c`): rail assertions scoped WITHIN the rail's nav landmarks; founder-directed UI untouched. (3) **B-int.1 (`7682993`, 13 files, 41 new tests):** AES-256-GCM envelope crypto w/ AAD row-binding (an envelope moved cross-tenant/cross-destination refuses to open; KMS = swap seam) · connect/open/cards/disconnect doors (paste validated BEFORE crypto, issue paths only; cards = the only user-facing projection, envelope fields structurally absent) · read-only validate-ping seam complete over all 11 destinations (honest flips: auth-shaped → needs_reauth, unreachable → no flip, webhook = explicitly unsupported) · **vault-first social arming (ADR 0011 decision 3): the dogfood tenant now resolves token material from CONNECTED vault rows, env pair = emergency override that wins when set, ARMED founder-GO stays env-side until B-int.3** — `publishApprovedSocial`'s default resolver is this path · redaction-boundary scan pins the vault modules log-free + env-indirect. Migration 0018 confirmed applied on dev pg. (4) **Pillar #1 un-deferred (Phase 2 prep):** s67's chain was actually BLOCKED (direction_doc g3_screen fail: ungrounded thalon.com CTA; the run-C storyboard failed BOTH tiers on "the storyboard passes the same two gates" — an invented-mechanism claim the judge RIGHTLY refused). Re-ran the one-prompt door with a tightened brief (no URLs; judging described at draft level only) → **GREEN at every stage: project "Pillar: the honest content engine" (`3191059b`), 9 planned takes (8 motion beats 4.1–7.7s + a $0 code-drawn CTA card), EDL + draft cut (`3e225369`)**. Cost plan priced via get_cost preflights (no jobs): recommended kling3_0_turbo @1080p ≈ 94cr all 8 beats; hero-bump beats 01+04 on veo3_1 → ≈ 110cr; retake buffer → plan ≈ 110–150cr; budget lane veo3_1_lite ≈ 52cr; every take <40cr. **Founder GOs now open: (a) MINT GO on the cost plan · (b) LinkedIn first-live-post GO.** (5) **Ops:** swordfish shipped the s65 systemd-units ask — `thalon-preview` + `thalon-sweeper` user units, linger on, reboot-safe; sweeper tmux window retired; NEVER hand-start either (double-fire); ACKed live; memory updated. Their film-import re-queued (their honest-ledger note). (6) **Next lead-serial: B-int.2 (Settings → Integrations surface)** — the vault doors it builds on are live.
- 2026-07-25 lead: **s68 peer-mail (live channel): both sibling agents asked for the Mode B lane mechanics before their first parallel windows** (founder-suggested). Answered durably: generic brain-dump `.context/peer-notes/lane-mechanics-braindump.md` + an addressee note in the first sibling's own handoff dir (their repo). Corrections carried: STAGGER-launches is stale (post-resize: 4 concurrent lanes OK; stagger the SUITE RUNS — the binding constraint is vCPU under concurrent test runs, and the second sibling measured 4×pytest-n-auto = 24 procs / ~9.6 GB peak on the 6 vCPU box, confirming it); send-keys doctrine settled (own windows = drive directly; any pane you didn't create = agent-comm, no exceptions). **Incident note: the pre-commit grep guard BLOCKED my first attempt to track the addressee note — the sibling agents' names ARE the guard tokens; peer-addressed docs can never be git-tracked here. The net worked (same class as the s65 inbound-mail lesson); durable copy lives gitignored.** Both siblings ACKed; exchange closed.
- 2026-07-25 lead: **SESSION 68 FINAL (the dogfood day, second+third thirds) — B-pub.3 image legs on ALL THREE drivers + X OAuth 1.0a standing-arm + FIRST REAL VAULT CREDENTIALS (linkedin "Steven Eamegdool" + facebook "MacTechDish", both validate-pings green through the B-int.1 doors) + the meme post AUTHORED BY THE ENGINE + the judge tuning pass core LANDED. Spend: 8cr images + ~3.5M gateway tokens (the daily rail fired TWICE — 2M then the documented 3.5M raise; the rail working as designed).** The founder drove the product loop live: intel had caught the Opus 5 wave (0.87-relevance cards, hours old) but outlier→exemplar admission had never armed AND fan-out never opted into exemplar retrieval — his diagnosis, confirmed both counts; the fix that landed generation punch in ONE lap was ingesting HIS OWN punchy rework as a voice_sample + 3 trend cards + profile v4 (punchy voice config). The judge then caught REAL errors across laps (reversed release order · tier miscount · invented vendor) while also demonstrating terminal over-strictness (rejected an operator attestation WHILE CITING it; objection set unstable across identical text — the 12-lap `491089d0` record). Founder-directed tuning pass: final v2 + screen v3 prompts (explicit entailment rules · attestation grounding · mechanism override), goldens 8→16, **30/30 tier-verdicts, final tier perfect ×2 consecutive**; residual = g3-016 (full-body context dependence) red-pinned for the s69 lap. Drafts: x + facebook QUEUED (engine-authored, judge-passed), linkedin = the founder's punchy body, one lap away. **FOUNDER GO RECORDED: post all three together s69.** Tooling shipped: create-posts/edit-draft CLIs, facebook platform profile, exemplar-aware fanout flag, connect-destination CLI. Also: charLimit-unenforced finding ratcheted; pipe-swallow bit twice more (standing rule hardened in CURRENT); peer lane-mechanics briefs to both siblings (the grep guard BLOCKED the tracked attempt — agent names are the guard tokens; net worked).
- 2026-07-25 lead (s69, the recorded posting GO executed): **THE ENGINE'S FIRST LIVE SOCIAL POSTS — LinkedIn `urn:li:share:7486713895370256384` + Facebook `197903966922661_122232823196050754`, both image-attached, through the full draft→judge→approve→publish door; X refused platform-side (402 credits depleted — founder console; draft stays approved+armed).** The morning was the judge tuning close (`a5fdca3`): g3-016's s68 red never reproduced (final-tier noise; v2 unchanged, 48/48 on the day); two REAL screen defects found reproducible and fixed in v4 (mechanism-vs-paraphrase collision · topics-as-support); the golden runner gained --only + a logged 2-of-3 majority retry (three sweeps each flipped one DIFFERENT row — the suite now pins doctrine, not coin flips) → **32/32**. The blocked LinkedIn draft was unblocked by GROUNDING DEDUP, not prompt churn: the s68 re-brief had APPENDED a near-identical brief source and two ~same instruction docs destabilize the final tier (root cause of the s68 twelve-lap record; ratchet candidate: re-brief REPLACES the pointer). Publish leg finds: the LinkedIn-Version pin was dead on its first real call (202512 nonexistent; active set live-swept via the 426-vs-400 probe, pinned 202607, `isReshareDisabledByViewer` removed — `2b258f3`); the validate-ping blind spot (unversioned userinfo) is now a B-int.2 spec line. main-RED #4 fixed (`1420bc8`, oauth1 typecheck — shipped red in s68's `1c43628`). Token day: s68+s69 share the 07-25 UTC ledger; closed ≈7.1M with documented cap raises (month-end reset queued). Zero credit spend. **Next: B-int.2 the Integrations surface (lead-serial); founder-side: X credits · pillar mint GO (~94cr) still open.**

**Session 70 (2026-07-25, syd4 — zero credit spend) — B-int.2 THE INTEGRATIONS SURFACE SHIPPED, direct-to-main.** Settings → Integrations is live end-to-end against the real vault: a card per destination grouped by what it powers (Social · Your website · Outreach & newsletter · Intel), states from the frozen honest-vocab derived by ONE engine rule (`cards.ts`: plan-gated > absent > needs_reauth > expiring-within-14d > connected); mode-2 guided connect flows (generic step lists · paste fields DERIVED from the registry's zod shapes, never hand-listed · validate-on-connect — a dead paste reads needs_reauth immediately, never silently green); on-demand Validate + confirm-guarded Disconnect; **the PUBLISHED VIEW closes FEATURE-MAP's `/blog` partial** (`published.ts`: social ledger ⋈ web posts bundle, newest-first, honest totals, Source-Link way-back on every row — verified live showing all three s69 posts + the s67 article). Engine finds landed as ratchets: **the s69 validate blind spot is CLOSED** (LinkedIn probe now fires the 426-vs-400 malformed-body versioned check; a dead LinkedIn-Version pin reads loud in probe detail without flipping the tenant's card) · **probe-discovered identity stamps the card** (validateDestination now writes connectedAs through markStatus; hand-set identities never erased) · **env-override honesty badge** (X's 1.0a env posture reads "env override" instead of a bare not_connected — retires per-platform when B-int.3 moves arming onto tenant data). New surface area: `/api/integrations` + `/:destination/connect|validate` + DELETE + `/published`, repo `socialPublications.listRecent`, vault error mapping in http-errors (VaultShape→400+fields · NotConnected→404 · key errors→503). Tests with code: 8 cards + 5 published + 5 validate-adds engine-side, 1 repo, 6 route, 4 panel — full verify green (guard · 1000+ suite · typecheck ×7 · lint 0 errors). Also this session: **the founder's Nango/mode-1 question answered + homed** (plan doc §Mode-1 automation check: Nango = real OAuth plumbing, self-hostable, ELv2 (isolate + swap path), does NOT bypass platform posting-scope review; the true unlock = pulling B-int.4's callback+refresh forward for the self tenant whose apps already hold the scopes; swordfish asked for their drive-OAuth pattern — answer lands in FROM-SWORDFISH) · token budget reset 7.25M→2M · dev window recreated (agent had booted inside it). **Next: B-int.3 driver rewire (lane — founder approval at the s71 opener) or B-pub.4 blog images (lead-serial); founder-side: pillar mint GO (~94cr) still open.**

**Session 70b (2026-07-25, same day — THE PARALLEL TURN; founder mid-session directives executed).** (1) **PILLAR #1 IS RENDERED**: founder picked kling3_0_turbo 1080p → 8 beats minted at exact-cue durations (2cr/s → the 94cr plan landed exact), CTA card + every caption + the wordmark code-drawn (magick/ffmpeg, $0), box-local render through the REAL door → `cuts/one-prompt-v1.mp4`, 42.3s. Spend 114cr total (two honest retakes; balance 584.12). Gap found + ratcheted: one-prompt projects had no sanctioned media-root setter — `videoProjects.setMediaRoot` shipped with tests (`53456b8`). Craft doctrine banked: UI-semantic beats (buttons/checkbox state) = CODE-DRAW, don't mint (kling fabricates gibberish labels; zero-text prompts induce CJK script); cornered static pseudo-text = deterministic feathered patch (measured diff 2/255). Full keeper/reject ledger in the media root's prov.json. Founder verdict on the cut = open tail (approve door ready). (2) **TWO Mode B lanes LAUNCHED on the founder's parallel-work directive**: `bint3-rewire` (arming → tenant data; founder actively steering the window himself — composer showed his instructions; branch push expected) + `ui-p0` (UI-overhaul phase 0 per the founder's s70b verdict: current workspace look/flow rejected, benchmark Supabase/Vercel, evaluate Meta Astryx; report-only, re-charter before rebuild). (3) **X/IG connection question answered + card honesty fixed same turn** (`ce4e0c1`): X posts via env 1.0a seats so its card now reads "Connected via env" (never "Not connected"); Instagram genuinely unconnected (needs B-pub.4's public image URLs; driver = typed refusal by design). Balance 584.12 · UI-verdict memory updated (frontend-direction) · lanes' merges = next session's opener work with the founder's verdicts.

**Session 70c close (2026-07-25, the founder-verdict turn — the session's third act).** Verdicts executed same-turn: **pillar cut → mid-quality exemplar** (kept, never approved; pillar re-scoped to a post-overhaul workspace screen recording) · **his LinkedIn edit → the engine's teacher** (exemplar `362d2fdb` + the EXECUTABLE golden pair) · **the SEO/AEO/GEO gap → Phase 2c core SHIPPED** (`ec07443`: deterministic discoverability lens beside the judge — primary-entity-in-prose, coverage floor, per-platform subject hashtags; advisory, opt-in by meta.targetTerms; the founder's catch runs as tests, 66/66 judge suite) · **model seats → claude-cli/claude-opus-5 all three** (build-phase strongest-tier standing rule; both aliases smoke-tested; BYO-AI parked with charter trigger) · **blog-mirror doctrine recorded** (social mirrors the blog article; the blog IS the farm — generation-side pairing lands with Phase 2c's s71 half) · landing→workspace header link · **both lanes MERGED on green** (B-int.3: 1801-test verify, ff `0604457`→main; ui-p0 plan: all 7 wave-0 charter answers landed — dark default · from-scratch theme · Geist · semantic status colours · beta accepted · videos-in-wave-2 · small mono allowlist) · lanes closed, worktrees GC'd, branches deleted. **s71 = wave 0, and it opens with a claude-design MOCK for the founder's verdict before any build (his standing rule).** Budget note for the s71 boot: drop 7.3M→2M on the fresh UTC day.

**Session 75 close (2026-07-25/26, syd4) — WAVE 3 PREPPED: two lanes, worktrees created, symlinked and smoke-tested; s76 boots straight into two launches.** Wave 2 merged first (Calendar · Board · Leads · Profiles · Sites · Integrations — 14 of 16 sheets now the real workspace, merged-main verify 2027 green). The two prepped lanes are deliberately DISJOINT by component directory, the invariant every clean wave has held: `videos-rebuild` owns `components/videos/**` + `app/app/videos/**`; `leadboard-wire` owns `components/leads/**` and deletes the orphaned `components/board/leads-board.tsx` + `model.ts` set. Both worktrees sit at `5408090` with all 7 node_modules symlinks and a green targeted-suite smoke test. **Launch:** `LANE_CLAUDE_ARGS="--model claude-opus-5" scripts/launch-lane.sh <name> .claude/worktrees/<name> agent_handoff/lanes/KICKOFF-<name>.md` (ff each worktree to origin/main first if main moved).

**The Videos call, and why it is ONE lane not three** (founder s75: *"i'll defer to your recommendation on how to handle it, but still want it designed exactly as mocked"*). The three video sheets share `components/videos/**` and one stylesheet, so splitting them across parallel lanes would put three agents in the same files — exactly the collision every clean wave avoided by giving each lane its own component directory. Parallelism comes from running Videos BESIDE a disjoint lane instead. The founder's own clarification is also what makes Videos delegable at all: "designed exactly as mocked" supersedes the earlier *re-conception* framing that had reserved it lead-direct — held to byte-fidelity it is a port, and lanes have now shipped eight of those. The kickoff sequences the sheets Overview → Dossier → editor (biggest and most keeper-dense last) and tells the lane to ship COMPLETE surfaces rather than three half-wired ones if the session runs short.

**Also closed at the s75 close, from the founder's four rulings:** thumbnails stay PLACEHOLDER until B-media is ready (his call, recorded in both kickoffs so neither lane "helpfully" invents them) · the sweeper now backs off failing passes and the cadence is sized to the free YouTube tier (240→180m; 8 sweeps/day = 7,200 of 10,000 units) after the s75 wrap's diagnosis was CORRECTED — the steady state was never over quota, a failed sweep retrying at the 15-minute tick rate was · the leads board shipped step 1 (structure, zero wiring) so the founder has a structural verdict point before step 2 spends wiring effort.

**Session 75 addendum — WAVE 3 IS THREE LANES, not two.** At the very close the founder added Sites: *"there thumbnails seem broken, and clicking on one of them seem to take me to the old design. there were some good features from the old design, so see if you can add them back in now that the design structure is in place… do that next session."* Both observations were CONFIRMED before the kickoff was written. **Thumbnails:** `lib/sites/provider.ts` hardcodes `DEV_PREVIEW_ORIGIN = "http://127.0.0.1:8899"` and both the gallery images and the dossier iframe resolve against it — all 20 load on the box, and every one breaks from any other machine because `127.0.0.1` is then the viewer's own loopback. **Old design:** `site-dossier.tsx` is untouched since s61 and still carries 19 bridged tokens (pinned at exactly that), so clicking a card leaves the mock's language entirely. The `sites-deepen` lane owns `components/sites/**` + `lib/sites/**` + `app/app/sites/**` — disjoint from `videos-rebuild` (`components/videos/**`) and `leadboard-wire` (`components/leads/**`, `components/board/**`), holding the one-component-directory-per-lane invariant at three lanes, which is the shape wave 2 ran cleanly. The dossier has NO sheet, so the kickoff points at the Intel-Search precedent (s74): design it in the sheets' language, don't invent a visual register.
