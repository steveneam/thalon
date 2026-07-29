# The Video arc — plan + spec (design passes × remaining engine)

> **Status: DRAFT, awaiting founder verdict.** Authored s86 beside
> `docs/create-engine/spec.md` on the founder's ask (*"did you do the same plan and
> spec for the Video arc?"* — the answer was no, so this is it). It unifies what is
> already built and audited into one flow map so the video sessions aren't lost.
> **Nothing here re-audits**: s78's audit and s80/s81's fixes are the baseline.

## What

The video feature's remaining work, connected end to end: the four surfaces (Videos
Overview · Video Dossier · the editor · plus the Composer's video destination), the
two unbuilt charter buckets (B-ve.4 AI edits, B-ve.5 aspect lens), the Descript
script-first evaluation, and the joins to the Create engine (video family in) and the
publish path (Composer video settings out). Flow of record:

```
Create (video family: one-prompt | staged wizard)      Videos Overview (the list)
        │                                                      │
        ▼                                                      ▼
   video project ──► DOSSIER (project home: takes · versions · renders)
        │                                                      │
        ▼                                                      ▼
     EDITOR (timeline MVP shipped; script-first eval; AI diffs = B-ve.4)
        │
        ▼
  cut/render ──► COMPOSER video tab (cover frame + per-platform video settings)
        │
        ▼
   Approve ──► Schedule ──► publish (existing, gated, untouched)
```

## Context — what is already true (cite, never re-derive)

- **Charter ratified** (ADR-0010, A17): B-ve.1 contracts/EDL + golden replay (s46) ·
  B-ve.2 read-only Videos surface, film imported (s47) · B-ve.3 timeline editor MVP —
  `executePlan`, save door (server-derived versions, compile-checked), render door
  (fire-and-poll, single-flight), five ops, wavesurfer music knobs (s48). **B-ve.4
  (AI-proposed EDL diffs through the judge gate) and B-ve.5 (aspect lens) remain.**
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
V4. Every metered AI action in the editor carries a **cost marker at the control**
    (VEED's credit badge): copilot verbs, B-ve.4 diffs, scene re-renders.
V5. B-ve.4: AI edits are *proposed EDL diffs*, judged before apply, shown as a diff
    (never a silent rewrite) — the charter shape, unchanged.
V6. B-ve.5: the aspect lens productizes the s45 9:16 recut recipe (per-beat
    recomposition, measured pans) as an engine capability; vendor reframe stays
    rejected (225cr vs 0cr, founder ruling).
V7. Render progress and durations are honest (Profound's checklist pattern; real
    elapsed, no invented ETAs); a returned-to render names its state in words.
V8. The density doctrine (Create spec §Density) applies: inspector detail in
    popovers, preview popouts, tooltips for rationale; one open tooltip per sheet.
V9. All four surfaces pass the render gate against their sheets; drift is a defect.
V10. Zero credit spend in build/test: renders in tests replay fixtures; live mints
     stay founder-gated per the standing credit discipline.

## Design

**Surfaces (design lead-direct; sheets → founder verdict → exact-mock build):**
1. **Videos Overview** — pass 1 needs a fresh Mobbin sweep (asset-grid/media-library
   patterns); nothing banked yet. Render-state badges ride the rows (V1/V7).
2. **Video Dossier** — pass 1 needs the sweep too (project-detail-with-versions);
   versions/compare/audition live here (V1).
3. **Editor** (`Videos.dc.html`) — pass 1 = thumbnails + track colour + credit
   badges (V2/V4); pass 2 = the script-first gate (V3); pass 3 = states (V7, the
   audit's refused/empty/loading matrix).
4. **Composer video tab** — already specced in the Create spec (cover frame drawn
   s86; platform video settings per D3 slice). No separate work here.

**Engine:** B-ve.4 then B-ve.5 as chartered (their contract windows exist); the D3
video settings slice ships once, shared with B-create; a `beats→scene re-render` verb
only if the V3 gate adopts script-first (its cost rides that decision).

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

1. Overview + Dossier Mobbin sweep → sheets pass 1 (lead-direct, with the editor's
   thumbnail/credit-badge pass — one design session).
2. Founder verdict → surface builds (lane-able: exact-mock from verdicted sheets).
3. B-ve.4 (engine lane; judged diffs) → pass-2 script-first gate with it in hand.
4. B-ve.5 aspect lens (engine lane).
5. Pass 3 states across the four surfaces.

## Reconciliation ledger

| source | item | status |
|---|---|---|
| s78 audit + s80/81 | jobs table, 5 no-affordance | **incorporated** (V1; baseline, not re-audited) |
| VEED | multi-track by kind, credit badges, inspector | **incorporated** (V2/V4/V8) |
| Vimeo | frame thumbnails, duration badges | **incorporated** (V2) |
| Descript | script-first paradigm | **gated** (V3 pass-2 decision, criteria stated) |
| Postiz | video editor | **n/a — does not exist**; settings schema slice → Create/D3 |
| s44/s45 | 9:16 own-engine recut recipe | **incorporated** (V6 = B-ve.5) |
| B-ve charter | .4 AI diffs / .5 aspect | **incorporated** (unchanged shape) |
| video-editor-tools survey | OTIO/wavesurfer/OpenCut/Remotion verdicts | standing; OpenCut stays a watch item |
| Founder s86 | popouts/popovers/tooltips | **incorporated** (V8 via Create §Density) |
