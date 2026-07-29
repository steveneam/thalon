# CURRENT

## Stamp

2026-07-29 (session 86, syd4 — **zero credit spend**; Opus 5). **PASS 1 OF THE UX
PROGRAMME IS COMPLETE ON THE D4 FOUR, BOTH APPROVED LANES MERGED, AND ALL FOUR SHEETS
ARE ON THE CANVAS BYTE-IDENTICAL.** Final verify on merged main: **2840 passed /
9 skipped, 0 lint errors**. Tree clean, pushed. Zero posts.

**THE FOUNDER STEERED THREE TIMES MID-SESSION AND ALL THREE LANDED.**

1. *"i assume when you click on the task or box in the Schedule, it expands, and you
   would get a good thumbnail there too?"* — **it did NOT.** A click opened a text-only
   verb menu, so the one place with room for a real picture showed none. It now opens a
   card that leads with the media at card width, anchored BELOW the chip so you can
   still see what you clicked.
2. *"the preview needs the bigger spot in the middle, and those information rows like
   visibility, first comment etc can go to the right instead"* — **Composer was rebuilt
   to three columns (330 / 522 / 300).** Write left, see the result middle, turn knobs
   right. The judge moved LEFT beside the body (it names a denylist hit marked IN the
   body). The five destinations became a full-width band underneath.
3. *"clicking on the preview expands it into its own tab or large popout"* — **Expand**
   is on the preview head. The column gives the preview the biggest RESTING spot; the
   popout gives it TRUE platform width, which no column on a 1440 screen can. **The
   popout is drawn as its own state in pass 3** — drawing it open now would hide the
   layout it sits inside.

**HIS FLOW QUESTION WAS ANSWERED WITH FACTS, AND THE FACTS SAY NO.** He asked whether
Composer appears after prompt → Generate. Ground-truthed: **today the app runs Create →
Generate → `/app/approve`, and there is no composer route at all.** The sheet's
`Create ›` breadcrumb asserts a flow that is not built. Sharper still: **a fan-out makes
MANY drafts**, so "the composer" is ambiguous — per-draft from the Approve queue, or one
straight after Generate? Recorded as **the** pass-2 question for this surface (programme
file, open decision 3), not quietly picked.

**PASS 1 — WHAT CHANGED, AND WHAT CAME OUT.** Schedule: the post's own picture in every
grid chip with the platform as a BADGE on the thumb, so "Planned · LinkedIn" left the
chip entirely (the border says planned, the badge says LinkedIn); a text-only post keeps
the slot with an "Aa" mark because the ABSENCE of a picture is information; an engine run
stopped pretending to be a post. Composer: the preview became the post — large media,
hashtags in the platform's link colour, LinkedIn's own action row; media gained an icon
toolbar; a cover-frame picker landed as the Postiz video-schema finding applied *where it
is true*. Channels: nine two-letter boxes became nine real brand marks, CURRENT · 6 /
NOT CONNECTED · 3 grouping, account avatars, a live line per card, icon-only actions.

**TWO THINGS WERE CUT, AND THE CUTS DID MORE WORK THAN THE ADDITIONS.** Composer's first
preview draft carried *"41 reactions · 6 comments · 2 reposts"* **on an unpublished
post** — invented engagement reading as real, exactly the rule-5 failure the programme
forbids. Gone. And a NOT-CONNECTED channel lost its account block and its "door
disarmed" line (it has no account, and an unconnected door is disarmed by definition) —
that subtraction is what got the connect dance back above the fold.

**THE FOLD IS NOW A RULE, NOT ADVICE: ALL THREE SHEETS OVERFLOWED 940 ON THEIR FIRST
CUT.** Schedule's expanded card lost its Unschedule row; Composer put the action row AND
the honesty caveat below the fold, i.e. the pass's own point was invisible; Channels
pushed the entire connect-dance section off. **None of them looked wrong in the render —
the content simply stopped, which reads as "that is where it ends".** Also learned: when
a sheet will not fit, **cut STRUCTURE before padding** (Channels went 992 → 925 on copy
compression alone and only fit at 914 once a card stopped pretending to be an identity).

**A SHARED-VOCABULARY TRAP, NOW WRITTEN INTO THE WORKING LOOP.** `.info` / `.tip` live in
`Analytics.dc.html`'s own `<style>`, **not** in `theme.css`. Pasting the ⓘ markup without
that block made Schedule's tooltip render as raw body copy and wreck the footer. Same
trap for any class a sibling sheet defines locally.

**BOTH LANES MERGED, AND BOTH STOPPED WHERE THEY WERE TOLD.** `ig-admission` built the
publish-scoped pending admission s85 designed-and-reported: 5-min TTL, revoked in a
`finally`, source key reconstructed from `family`+`contentHash` so serving A's bytes
under B's URL is unrepresentable. **Ships disarmed, security bound stated, each clause
test-pinned.** `transcription-free` actioned his own s79 ruling — free + deterministic by
default on **both** embed passes (the board's file set had missed `area-relevance.ts`, so
"free" would have still billed), AI-enhance per-ingest, one artifact. It **hit its file
boundary and asked** rather than editing ad-hoc, and it **refused to allowlist a test
file** when the B4.4 metering ratchet fired on a doc-comment — that allowlist is the
weakening the ratchet exists to prevent.

## Resume prompt (session 87, syd4 — "gogogo" boots this)

**Resume · Thalon** — s86 finished pass 1 on the D4 four, merged both approved lanes,
and synced the canvas. **s87 = the VIDEO ARC, and the two build tasks pass 1 exposed.**

**Read first:** CLAUDE.md → this file → **`docs/research/ux-refinement-program.md`**
(the programme's memory: per-surface status, cited references, open decisions, the
working loop) → `docs/research/mock-sheets/README.md` §Proposals.

**Lead-serial, cannot be delegated (founder rule — design is lead-direct):**
1. **THE VIDEO ARC** — his standing ask, four pieces (Videos Overview · Video Dossier ·
   the editor · the ENGINE). Start from the s78 audit + s80/s81 results, **do NOT
   re-audit**. Known: 5 jobs still have no affordance, 4 of them one theme (compare two
   versions · save as a named variant · delete a version · check on a render after
   coming back). **Postiz has no video editor** — take their per-platform video SETTINGS
   schema, not an editor they do not have; craft references are VEED/Vimeo/**Descript**,
   and Descript's script-first paradigm is the one that fits beat-generated video.
2. **The Composer POPOUT state** (his ask, deferred by design): preview at true platform
   width, drawn as its own state in pass 3.

**Founder decisions waiting, both surfaced by this session's work:**
- **Where does Composer live in the flow?** Per-draft from Approve, or one after
  Generate? There is no composer route today at all. Programme file, open decision 3.
- **The app-side rail rename** — the product still says Calendar while the spec says
  Schedule. Build task, needs its own go.

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run doctor` ·
   `bash ~/work/swordfish/provisioning/checks/needs-steven-hygiene.sh`.

▎ ▸ **s86 shipped:** `dedb615` lane kickoffs · `35a87b0` Schedule pass 1 · `aeab1c1`
Composer pass 1 · `7d2caf8` Channels pass 1 · `899548e` programme record + canonical
head · `16a77a4` ig-admission merged · `337716a` transcription-free merged · `9ca4963`
Composer rebuilt on his call · `a7c3bf0` stale-measurement correction.
▎ ▸ **⚠️ BUDGET:** the lane windows reported **84% of the weekly limit used** mid-session
(resets **Jul 31, 11pm UTC**). He was asked and chose "sync the canvas now". Worth
checking headroom before opening the video arc, which is the biggest surface area left.
▎ ▸ **Canvas is CURRENT and byte-identical** to the repo on all four D4 sheets
(Analytics 39341 · Schedule 36959 · Composer 36945 · Channels 33000), project
`f5d304cb-cd0e-484d-8542-7b6561e1ef30`.
▎ ▸ **`impeccable` RELAXED ON THE SHEETS, on his ruling** (*"since our designs and layout
are based on mobbin.mcp, you can relax the impeccable rule a bit until the final pass,
for consistencies and stuff and landing pages"*). `docs/research/mock-sheets/**` is now
in `.impeccable/config.json` `ignoreFiles`. **`apps/web/**` and landing pages are NOT
covered** — the shipped product and the public surface keep the rule. **It expires:** the
re-arm trigger is written into the programme file (§The `impeccable` waiver) — when pass
3 closes a surface, audit it, reconcile the ramp into `design.json`, drop the ignore.
▎ ▸ **A trap that cost real time, worth remembering:** the Bash tool's working directory
PERSISTS across calls. A `cd` into a lane worktree left later relative-path edits landing
in the LANE instead of main — caught by `git status`, reverted, redone. Use absolute
paths after any `cd`.
▎ ▸ **Waiting on ONE founder word, unchanged from s85:** swordfish correctly did NOT
re-issue the `thalon-deploy` credential (a relayed approval is not an in-session
confirmation). One 30-second confirm covers BOTH that and the templates-preview
credential → `NEEDS-STEVEN` 2026-07-29e.
▎ ▸ **⛔ SEQUENCE GATE unchanged:** bluesky armed for testing on his recorded words;
every other platform is per-platform + per-post GO; the queue consumer's key rests
EMPTY. Instagram's media path is now BUILT end to end and **disarmed** — it needs his
per-platform GO, which he has not given. **Nothing was posted.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · design is lead-direct, never
delegated · every lane/subagent launch needs fresh founder approval · GATE ON EXIT CODE,
never pipe the suite · vitest does NOT typecheck · **verify-on-merged-main = THE gate** ·
research before build (rule 10) · check the ENVIRONMENT before his hands (rule 11) ·
platform logins live durably in `.context` · no AGPL embedded · wrap = verify+commit+
push+restamp.
▎ ▸ **State:** main = origin, pushed · staging on s85 code + the OCI label · four social
channels connected.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; tree clean and in sync; both lane
worktrees GC'd and their tmux windows killed.

## Pointer

CLAUDE.md → this file → `docs/research/ux-refinement-program.md` →
`docs/research/mock-sheets/README.md` → COORDINATION.md → NEEDS-STEVEN.md →
`docs/research/prior-art-portal-automation-s84.md` (READ BEFORE ANY PORTAL WORK).

## Delta (session 85)

s85 drew the D4 sheets, started the 3-pass UX programme, merged `ig-post` +
`staging-dogfood`, swept the rail (Calendar → Schedule across 15 sheets), and cleared the
founder's board 46 → 6. Its one wrong inherited claim — the "PROVEN" Meta cookie
transplant — had already been caught and withdrawn at its own opener by re-testing.

## THE s86 CLOSE — the Create spec (supersedes the next-action list below where they conflict)

**The founder ruled Create is THE feature** (*"everything depends on it"*) and asked for
a plan + spec so Composer-style orphans stop happening. **Delivered:
`docs/create-engine/spec.md` (DRAFT — his verdict is the s87 opener).** One engine
(Brief → Plan → Generate → Composer → Approve) over the existing family engines; Prompt
mode kept; a Jasper-style rail wizard (Intel-prefilled, platform routing per Kompozy's
table as tenant config, media import with **use | reference** roles per Runway's
pattern, HubSpot-style plan-review with cost before spend); the Composer un-orphaned as
the run-scoped checkpoint. Postiz D3 settings-schema slice pulled forward; video wizard
= the staged direction mode; D2 stats slot named and honest-until-built. Build order
B-create.1–.5 proposed, founder sequences. The spec carries the reconciliation ledger
he asked for (incorporated / deferred-with-trigger / rejected, per source).

**Also this close: the `impeccable` waiver** — relaxed on `docs/research/mock-sheets/**`
per his ruling, scoped (apps/web + landing keep the rule), re-arm trigger written into
the programme file.

## Next action — s87 RECOMMENDED PLAN (refined at the s86 close, founder-directed)

**TWO SPECS await his verdict at the opener** (approve / edit / feedback each):
`docs/create-engine/spec.md` + `docs/video-arc/spec.md`. Late s86 refinements already
in them: the Composer **master + forks** variant model (Mobbin-evidenced: Sprout one-
body+preview-rail, HubSpot duplicate-to-fork, Later popout-per-profile — tabs stay,
gain divergence badges + "re-derive from master"); the **density doctrine** (his
directive: pop-outs/popovers/tooltips, named per control); the **Create↔Video joins**
(video family in · rendered cuts as use-role media · `waterfall/` = the Repurpose
bridge — the engine for it already exists).

**THE TWO PARALLEL LANES (his ask: best value), proposed for his named GO:**
- **Pre-lane, lead, small:** ONE contract window covering both (`create_runs` + media
  `role` + `platform_routing` + D3 settings slice incl. the video variant +
  `publication_metrics`). Frozen before launch per contract discipline.
- **Lane A — `create-engine` (B-create.2):** plan derivation + run orchestrator +
  reference-describe seam over the existing family engines. Fake-driven, zero UI,
  zero spend. Files: `packages/engine/src/create/` (new) + contracts/db from the
  window. *Gated on the Create spec verdict.*
- **Lane B — `analytics-spine` (D2):** `postAnalytics` connector verb + sweep tick +
  repos, honest per-platform gaps. **Why it wins the second slot:** it lights the
  APPROVED Analytics sheet with real data AND fills the Composer "stats" slot he
  named, it is the charter's "founder's named ask", and it depends on NEITHER spec —
  safe even if he edits Create. Files: `packages/engine/src/social|trend` + sweep.
- Disjoint by construction (create/ vs social+trend), both engine-only, no sheets
  touched, ships disarmed. NOT picked, with reasons: Calendar→Schedule app rename
  (small, low value — rides any later lane) · B-ve.4 (better after the script-first
  gate) · surface builds (need verdicted sheets first).

**Lead-serial track:** on the video spec's approval, the Videos Overview + Dossier
Mobbin sweep → video sheets pass 1 (the only arc surfaces with zero banked
references); Create sheets follow his sequencing. Budget note: weekly limit was 84%
(resets Jul 31 11pm UTC) — verdicts + contract window are cheap; the design passes
are the heavier spend.
