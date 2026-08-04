# The Video arc — plan + spec (design passes × remaining engine)

> **Status: APPROVED — founder, 2026-07-29 s86 close ("approve, wrap up and prepare for next session"). Both specs approved in the same word.** Authored s86 beside
> `docs/create-engine/spec.md` on the founder's ask (*"did you do the same plan and
> spec for the Video arc?"* — the answer was no, so this is it). It unifies what is
> already built and audited into one flow map so the video sessions aren't lost.
> **Nothing here re-audits**: s78's audit and s80/s81's fixes are the baseline.

> ⚠ **CORRECTION (s87 lead, 2026-07-29) — this spec shipped with a FALSE core claim,
> now fixed throughout.** As approved, it said B-ve.4 (AI EDL diffs) and B-ve.5
> (aspect lens) "remain" and scheduled them as engine lanes. Ground-truthed against
> git and the live surface while preparing those very lanes: **B-ve.1–.7 ALL shipped
> and merged by s51** — B-ve.4's proposer + judge-gated approve door + replay-verified
> agent saves + eval rows (`f645548`, 2026-07-16), B-ve.5's aspect lens with lineage
> (PR #49, s50), B-ve.6's track view, B-ve.7's agent reframe — **and the s72
> exact-mock rebuild carried them**: the s78 audit marks "review an agent proposal /
> apply / dismiss with a reason" and "derive a 9:16 / 1:1 recut" `present` at line
> numbers that still hold, and the shell inventory pins `"video.propose_edl_diff"`
> today. The false line survived authoring because ADR-0010's bucket list was read as
> a todo list without re-testing it against the repo — the rule-11 inherited-plan trap,
> in a spec. **V5/V6 below are therefore requirements to HOLD, not build items; the
> build order is rewritten; the lane this spec scheduled for B-ve.4 is cancelled.**
> What actually remains of the arc: V1's five affordances (sheets-first), V2
> thumbnails + track colour, V4 credit badges, V3's pass-2 gate, V7 render honesty,
> V9's render gates, and pass-3 states.

## What

The video feature's remaining work, connected end to end: the four surfaces (Videos
Overview · Video Dossier · the editor · plus the Composer's video destination), the
audit's five no-affordance jobs (V1 — the charter's engine buckets are ALL built,
per the correction note), the Descript script-first evaluation, and the joins to the
Create engine (video family in) and the publish path (Composer video settings out).
Flow of record:

```
Create (video family: one-prompt | staged wizard)      Videos Overview (the list)
        │                                                      │
        ▼                                                      ▼
   video project ──► DOSSIER (project home: takes · versions · renders)
        │                                                      │
        ▼                                                      ▼
     EDITOR (timeline + AI diffs + aspect lens SHIPPED; script-first eval = pass-2 gate)
        │
        ▼
  cut/render ──► COMPOSER video tab (cover frame + per-platform video settings)
        │
        ▼
   Approve ──► Schedule ──► publish (existing, gated, untouched)
```

## Context — what is already true (cite, never re-derive)

- **Charter ratified AND FULLY BUILT** (ADR-0010, A17 — see the correction note):
  B-ve.1 contracts/EDL + golden replay (s46) · B-ve.2 read-only Videos surface (s47) ·
  B-ve.3 timeline editor MVP (s48) · **B-ve.4 AI diffs — proposer, judge-gated
  approve door, replay-verified agent saves, eval rows (s49)** · **B-ve.5 aspect
  lens — derive door, measured crop/pan, lineage (s50)** · B-ve.6 track view ·
  B-ve.7 agent reframe (s51). Nothing in the charter's engine list remains unbuilt.
- **Audit baseline**: s78 = 36 findings, 27 operator jobs (8 worked / 4 dead doors /
  15 no affordance) → s80/s81 = **21 work · 0 dead doors · 5 no affordance**; render
  gate 38 → 30 drifted (most of it one 19px defect). The five missing jobs, four of
  one theme: **compare two versions · save as a named variant · delete a version ·
  check on a render after coming back · audition a take before swapping.**
- **Postiz has NO video editor** (verified against their live API docs, s85). The
  take is the *pipeline seam*: per-platform video settings as declared schema
  (YouTube title/thumbnail/made-for-kids; TikTok privacy/duet/stitch/autoAddMusic/
  brand-content). That slice ships with the Create spec's D3 work.
- **Editor craft references** (programme file, seeded s85): VEED (left icon rail;
  multi-track timeline **colour-coded by kind**; clip inspector; **credit badges on
  metered tools**) · Vimeo (**frame thumbnails on clips**; duration badges; minimal
  split/delete toolbar) · **Descript — the paradigm: edit video by editing its
  script**, timeline secondary.
- **Why Descript fits us specially**: our videos are generated from beats — the beat
  text already IS the script and the render already follows it (direction.md is the
  driving artifact, founder doctrine 2026-07-05). Retiming by dragging pixels fights
  the model; editing the beat and re-rendering IS the model.
- **The founder's thumbnails note, made three times**: every reference puts frame
  thumbnails on timeline clips; ours are plain blocks. First visual fix.
- The film tree (s43) is the reference project shape; both masters replay from
  checked-in EDL fixtures (golden tests).

## Requirements

V1. The five no-affordance jobs gain affordances: version compare (two cuts side by
    side), save-as-named-variant, delete-a-version (reversible refusal rules), render
    status visible on return (Overview + Dossier badges), take audition (play before
    swap). No new engine verbs where an existing door suffices.
V2. Timeline clips render **frame thumbnails**; tracks are colour-coded by kind
    (video/audio/captions/music — VEED). The cover frame the Composer picks is the
    same artifact family.
V3. **Script-first evaluation is a pass-2 decision gate, not a silent adoption**: a
    beats panel as the editor's primary surface (edit beat text → re-render that scene
    through the judge) with the timeline kept for what text cannot express (music,
    exact cuts). Criteria to judge it: does a beat edit round-trip to a rendered
    scene faster than a timeline edit; does it reduce the audit's job-failure count.
    **DECIDED s97 — HOLD, not adopted** (record in §Phase 4a below).
V4. Every metered AI action in the editor carries a **cost marker at the control**
    (VEED's credit badge): copilot verbs, B-ve.4 diffs, scene re-renders.
V5. [SHIPPED s49 — HOLDS as a regression bar, not a build item] AI edits are
    *proposed EDL diffs*, judged before apply, shown as a diff (never a silent
    rewrite). Built: `edl/propose.ts` + the approve door; `"video.propose_edl_diff"`
    is in the shell inventory. The s78 findings against it (applied-proposal
    evidence destroyed · proposal marked by colour alone) fold into the pass work.
V6. [SHIPPED s50 as B-ve.5 — HOLDS likewise] The aspect lens exists (derive door,
    measured crop/pan handles, lineage stamps); vendor reframe stays rejected
    (225cr vs 0cr, founder ruling). Remaining aspect work is whatever the passes
    find against the sheets — the engine is built.
V7. [BUILT s97 — HOLDS as a regression bar] Render progress and durations are
    honest (Profound's checklist pattern; real elapsed, no invented ETAs); a
    returned-to render names its state in words. Built across s82/s96/s97:
    A4 adoption + in-flight words (s82), Overview/Dossier return badges (s96),
    and s97's elapsed honesty — live `Rendering… 1m 04s` from the job's
    recorded clocks, the finished render naming its real duration, the failed
    one naming how long it ran, and `runCutRender`'s measured `elapsedMs` on
    the `video_cut.rendered` event (absent when unmeasured, never invented).
V8. The density doctrine (Create spec §Density) applies: inspector detail in
    popovers, preview popouts, tooltips for rationale; one open tooltip per sheet.
V9. [SHIPPED s99 — the arc's last item] All four surfaces pass the render gate
    against their sheets; drift is a defect. Passed first time: Videos Overview
    (`4505e9e`, 21 agents) · Video Dossier (`9a63573`, 37) · the editor
    (`8d1ed8f`, 41). **The Composer FAILED its gate** (58 agents,
    `matches_sheet: false`) on four HIGHs — every door rendering grey, native
    `title=` where the sheet draws a popover, the fit band degenerating at one
    destination, and a platform refusal understated as amber — all four fixed
    and re-verified by live probe + screenshot. Each surface carried its own
    fix round in the same session; the confirmed findings are the commits' own
    records, the deferred ones are on the ux-refinement-program rows.
V10. Zero credit spend in build/test: renders in tests replay fixtures; live mints
     stay founder-gated per the standing credit discipline.

## Design

**Surfaces (design lead-direct; sheets → founder verdict → exact-mock build):**
1. **Videos Overview** — ~~pass 1 needs a fresh Mobbin sweep; nothing banked yet~~
   **BANKED s87** (`docs/research/ux-refinement-program.md` §"Videos Overview —
   the list": VEED · Riverside · Loom · Arcade · ClickUp). Render-state badges
   ride the rows (V1/V7); Loom's metrics triplet stays EMPTY until
   `publication_metrics` has rows — never zeros (rule 5).
2. **Video Dossier** — **BANKED s87 likewise** (§"Video Dossier — the project
   page": Synthesia · Adobe Express · Google AI Studio · Fibery · Sana ·
   Frame.io). The sweep's own synthesis: four of the five no-affordance jobs
   are ONE well-drawn version rail (Synthesia's breadcrumb selector + Adobe's
   marked group + Fibery's naming confirm); take audition is the one separate
   affordance.
3. **Editor** (`Videos.dc.html`) — pass 1 = thumbnails + track colour + credit
   badges (V2/V4; references banked s85); pass 2 = the script-first gate (V3);
   pass 3 = states (V7, the audit's refused/empty/loading matrix).
4. **Composer video tab** — already specced in the Create spec (cover frame drawn
   s86; platform video settings per D3 slice). No separate work here.

**Engine:** nothing from the charter's bucket list remains to build (correction
note). The D3 video settings slice shipped with the s87 contract window. The one
candidate engine verb left is `beats→scene re-render`, and only if the V3 gate
adopts script-first (its cost rides that decision). **Gate DECIDED s97: HOLD —
the verb is not built** (§Phase 4a).

**The Create ↔ Video joins (founder, s86: "the Video would be linked with the
Create right in some cases?" — yes, three ways, two of which exist in the engine):**
1. **In — Create makes videos.** The video family's two modes ARE the video feature's
   front door: one-prompt (`origination/`, armed today) and the wizard's staged mode
   (`direction/` storyboard → scenes → polish). A video Create run's child IS a video
   project; the run lands in the Dossier.
2. **Out — videos ride posts.** A rendered cut is library media: attachable to any
   post run as **use**-role media (the wizard's media dialog lists rendered cuts
   beside uploads, Leonardo's "Your generations" tab shape). The Composer's video tab
   then carries the cover frame + per-platform video settings.
3. **Repurpose — the waterfall.** `packages/engine/src/waterfall/` already exists for
   exactly this: a pillar video derives posts/clips. Specced join: "Repurpose" on the
   Dossier seeds a Create run with the video attached + caption/SRT drawn from its
   direction doc (the pillar doctrine — prompt + URL → video + caption/SRT). The
   blog-mirror rule applies to the derived set like any other run.
The boundaries hold: the editor never absorbs Create; the Composer never absorbs the
editor; Create hands off at the dossier.

## Decisions

1. **Script-first is evaluated, not assumed.** It fits beat-generated video uniquely,
   but the timeline MVP just shipped and works; the gate (V3) decides with criteria.
   Reversible either way.
2. **Overview + Dossier get their own Mobbin pass** — the only part of the video arc
   with zero banked references. Editor references are banked; do not re-search them.
3. **No Postiz editor imitation** — there is nothing to imitate; said plainly so the
   ask ("see how postiz creates and edits videos") reads answered, not skipped.
4. **Aspect lens = own-engine recut** (founder ruling s44/s45, standing).
5. **Assumption:** the five no-affordance jobs need no new tables — versions/takes
   rows exist; the work is doors + surface. Flag at kickoff if the repos disagree.

## Testing / invariants

Golden EDL replays stay the editor's spine (both film masters, framemd5). New doors
get refusal-pinned tests (delete rules, diff-apply only post-judge). Render gate
screenshots per surface. Judge gate on every AI-proposed diff — safety, never
loosened. Sequence/publish gates untouched.

## Out of scope

The engine's model roster / minting economics (asset method files own that) · music
sourcing (s44 recipe stands) · live platform publishing of video (sequence gate) ·
landing/marketing video.

## Build order (founder sequences)

1. Overview + Dossier sheets pass 1 (references BANKED s87 — programme file
   §Overview + Dossier) + the editor's thumbnail/track-colour/credit-badge pass
   (V2/V4) — lead-direct, one design session.
2. Founder verdict → surface builds (lane-able: exact-mock from verdicted sheets).
   **V1's five affordances land here** — the version rail + render badges + take
   audition; doors as the sheets demand, no new tables assumed (Decision 5).
3. Pass-2 script-first gate (V3) — evaluated with the SHIPPED B-ve.4 diffs in hand;
   nothing blocks it but the pass itself.
4. Pass 3 states across the four surfaces (V7 honesty, V9 render gates).

## The s95 execution plan (stamped s94, on the founder's direction — "refine the plan and spec … then you can start on them")

> **Phase 1 EXECUTED s95 (2026-08-02), lead-direct.** All four sheets amended
> and re-exported to `docs/research/mock-sheets/`; every surface opened with a
> fresh Mobbin pull (the s94 MCP error did not recur) — the banked sets held
> everywhere, the Dossier gained Resend's revert-confirm register, and the
> Schedule month-media question closed NEGATIVE (no honest month treatment
> found; thumbs stay week+agenda). Each sheet's header carries its amendment
> record; renders verified at 1440×940, no clip.
>
> **Phase 2 CLOSED — W3 APPROVED (founder in-session, s95).** His review
> asked two editor additions, drawn the same session as **s95b** (fresh
> founder-directed pull: Leonardo's Video Dimensions glyphs + tool rail,
> Arcade's timeline-edge tools, Squarespace's toolbar-on-selection): the
> aspect seg's ⓘ names each frame (shape + format + platforms — 16:9 the
> full video / 9:16 short-form clips / 1:1 feed posts) and the timeline
> grows the Split · Crop · Text · Delete tools row (EDL-only, unbadged,
> acts on the selected block; complements the copilot, never replaces it).
> Then his word: *"Everything else is ok … W3 is approved."*
> **Phase 3 is UNBLOCKED — builds in the order below.**
>
> **Phase 3 EXECUTED s96 (2026-08-03), lead-direct, in order** (`13f363d` ·
> `591e9ec` · `ea29e49`): editor p1+s95b deltas → Overview/Dossier + V1's
> five affordances → Schedule S1–S3. Decision-5 pre-check HELD for
> named-variant (a name IS a mark, through the one save door, no new
> columns); the delete/restore half split — delete ships with the TRUE
> preservation sentence, the sheet's "Restore brings it back" is NOT
> rendered because no column records a retired cut: **the retire/restore
> column is the flagged contract-window ask** for the next window (s90
> freeze respected). One V4 truth adaptation, stated in code and test:
> Recut stays unbadged (this engine's recut is the aspect lens's own local
> derive, 0 credits — absence says free); Retake ⚡ + Propose ⚡1 are the
> metered marks. B-media.0's backfill door got its missing runner
> (`scripts/backfill-take-posters.ts`, 66 posters derived, 0 credits).
> Verify 3303/9 exit 0; all four surfaces browser-passed on real data.
> **Remaining in this arc: Phase 4** — the V3 script-first gate (own
> decision session), then pass-3 states (V7/V9).

**Where the arc actually stands (re-grounded s94, per rule 12 — no inherited
claims):** the three sheets EXIST since the s72 verdicted export
(`docs/research/mock-sheets/Videos Overview.dc.html` · `Video Dossier.dc.html` ·
`Videos.dc.html`) and the three surfaces are BUILT exact-mock to them
(`apps/web/src/app/app/videos/page.tsx` ·
`apps/web/src/app/app/videos/[projectId]/page.tsx` ·
`apps/web/src/app/app/videos/[projectId]/edit/page.tsx`, components under
`apps/web/src/components/videos/`). What has NOT happened is the
research-refinement pass over those sheets — the ledger's word is exact:
"REFERENCES BANKED (s87), SHEETS NOT STARTED" means the pass-1 AMENDMENT
draws, not first draws. So s95 is the same shape as the s94 Sites build: amend
the verdicted sheets from the banked references, get the verdict, ship the
deltas — never a from-scratch surface.

**Phase 1 — the design block (lead-direct, Fable 5, claude-design canvas
`f5d304cb` → re-export to `docs/research/mock-sheets/`):**
- `Videos Overview.dc.html` amendment: VEED state badge ON the thumb +
  duration badge + the honest "No Preview Available" tile as a drawn state;
  Riverside's history-count meta line ("2 recordings · 5 edits" — ours:
  takes/cuts counts from the project's own rows); ClickUp kind label. NO
  metrics triplet until D2 (Loom REJECT-until-data, recorded above).
- `Video Dossier.dc.html` amendment: THE VERSION RAIL — Synthesia breadcrumb
  version selector with the published pill, Adobe's marked-versions group
  (save-as-named-variant), Fibery's naming confirm for delete/restore
  (reversibility in words), AI-Studio radio rows as the compare-two precursor,
  and the take-audition play door. This is V1 drawn.
- `Videos.dc.html` (editor) amendment: frame thumbnails on clips + track
  colour by kind (V2) + credit badges on metered verbs (V4 — copilot verbs,
  B-ve.4 diffs, scene re-renders).
- Per the s93 re-check precedent, the block opens with a FRESH Mobbin pull per
  surface to confirm the banked patterns still read best-in-class; banked
  citations above are the floor, not the ceiling.

**Phase 2 — ONE verdict ask** (hands-free week: a single texted word covers
the three amended sheets + the Schedule amendment — see
`docs/schedule-refinement/spec.md`, drawn in the same block).

**Phase 3 — builds on GO (order within the phase):**
1. Editor p1 deltas (V2/V4) — smallest, pure surface; the render-gate
   screenshot re-baselines after.
2. Overview + Dossier amendment deltas + **V1's five affordances**. Existing
   doors first: the cuts routes already shipped
   (`apps/web/src/app/api/videos/[projectId]/cuts/[cutId]/route.ts` ·
   `…/approve/route.ts` · `…/derive/route.ts` · `…/propose/route.ts`); data =
   `packages/db/src/schema/video.ts` (`videoProjects` · `videoTakes` ·
   `videoCuts`) via `packages/db/src/repos/video-projects.ts` ·
   `video-takes.ts` · `video-cuts.ts`. Decision 5 pre-check at kickoff:
   named-variant + delete/restore must come from THESE rows; if a column is
   genuinely missing it is a contract-window ask `(planned)`, flagged before
   any build — the s90 windows stay frozen until then.
3. Schedule calendar deltas (its own spec, same GO).
**Zero credit spend throughout** (V10): renders replay fixtures; no live mints.

**Phase 4 — after the deltas land:** the V3 script-first gate gets its own
decision session (criteria already in V3), then pass-3 states (V7/V9).

> **Phase 4a — the V3 gate DECIDED s97 (2026-08-03), lead-run on the stated
> criteria: script-first is NOT adopted. HOLD — timeline-primary stands.**
>
> **Criterion 1 (round-trip speed): NO.** A beat edit round-trips to a
> rendered scene strictly slower than a timeline edit wherever both can
> express the change — the beat path CONTAINS the timeline path's whole tail
> (save → local render → judge gate) and adds Propose (⚡1, metered) plus,
> for any content change, a vendor mint ahead of it (kling3_0/soul-class
> models on the takes' own provenance rows: minutes and credits, against the
> timeline's local milliseconds at 0 cr). No recorded elapsed contradicts
> this — no job or event row carries an elapsed time at all, and that
> absence is V7's own work item, not this gate's. Where text expresses what
> the timeline cannot (new footage from new words), the editor already
> carries the script channel in its right place: the copilot ask + the s95b
> re-brief retake door — metered, ⚡-marked, secondary by design.
>
> **Criterion 2 (the audit's job-failure count): NO.** The s78 walk's 19
> failing jobs (15 no-affordance + 4 dead doors of 27) were driven down by
> TIMELINE-side work, re-verified in code this session: the s80/s81 fixes,
> V1's five affordances (s96), the s96 tools row
> (`splitBeat`/`deleteBeat`/`insertCaptionForBeat`/`removeMusicCue`), the
> bounded undo spine (`past`/`future` + `baseEdl` + Discard), the
> beforeunload guard, back-to-master via `lineage.parentCutId`, and live
> compose-don't-overwrite copilot chips. The gaps that remain (swap the
> music bed for a different track · add a beat from the pool · pre-render
> preview of an unsaved edit) are exactly "what text cannot express" — a
> beats-primary panel fixes none of them.
>
> **Consequence:** the `beats→scene re-render` engine verb is NOT built —
> its cost rode this gate and nothing else justified it. Credit discipline
> also weighs the same way: a beats-primary loop puts the metered verb at
> the centre of editing; the shipped design keeps free verbs primary and
> metered verbs ⚡-marked at the control (V4/V10). Decision 1's
> reversibility stands — the revisit trigger is dogfood evidence (B-create.5
> onward) that operators reach for text-directed edits beyond the copilot
> ask, i.e. the re-brief door coming to dominate editor usage.
>
> **Phase 4b, first half BUILT s97 (`1ddcf2c`): V7 elapsed honesty** — see
> the V7 requirement's own record. **Phase 4b, second half SHIPPED s99: V9,
> and with it THE ARC.** All four surfaces now hold against their sheets
> (Overview `4505e9e` · Dossier `9a63573` · editor `8d1ed8f` · Composer
> `749b833` + the gate-round-2 fixes), each with the refused/empty/loading
> matrix distinct in both themes at 1440×940. **Three passed first time; the
> Composer's gate FAILED** (`matches_sheet: false`) and its four HIGHs were
> fixed and re-verified live. Every confirmed finding behind those gates was
> fixed in the same session. **Nothing in this arc remains.** What the gates
> recorded but deliberately did not fix is on the surfaces' own
> `docs/research/ux-refinement-program.md` rows, and the two contract-window
> asks (a project delete/rename verb + a recorded project ORIGIN; the standing
> retire/restore column) go to the founder at the next window.

**Interleave:** B-create.5 dogfood (the first real Create run) stays its own
gate and can land before, between or after these — it needs a spend statement
+ his GO, and none of the above depends on it.

## Reconciliation ledger

| source | item | status |
|---|---|---|
| s78 audit + s80/81 | jobs table, 5 no-affordance | **incorporated** (V1; baseline, not re-audited) |
| VEED | multi-track by kind, credit badges, inspector | **incorporated** (V2/V4/V8) |
| Vimeo | frame thumbnails, duration badges | **incorporated** (V2) |
| Descript | script-first paradigm | **decided s97 — HOLD** (both criteria answered no; the copilot ask + re-brief door stay the script channel, secondary — §Phase 4a) |
| Postiz | video editor | **n/a — does not exist**; settings schema slice → Create/D3 |
| s44/s45 | 9:16 own-engine recut recipe | **incorporated** (V6 = B-ve.5) |
| B-ve charter | .4 AI diffs / .5 aspect | **already built** (s49–s51; correction note — the spec's original 'remain' claim was false) |
| video-editor-tools survey | OTIO/wavesurfer/OpenCut/Remotion verdicts | standing; OpenCut stays a watch item |
| Founder s86 | popouts/popovers/tooltips | **incorporated** (V8 via Create §Density) |
