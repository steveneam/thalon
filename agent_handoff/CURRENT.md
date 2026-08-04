# CURRENT

## Stamp

2026-08-04 close of session 100 (syd4 — **window 0026 FROZEN, Intel gated for
the first time, and both of the founder's live reports fixed**; zero credits,
zero live posts). Boot was "gogogo", interrupted twice by the founder's own
findings — both real, both fixed the same session. Wrap verify on main:
**exit 0, 3377 passed / 9 skipped** (s99 was 3339/9).

## WHAT SHIPPED (COORDINATION §s100 carries the full records)

**Contract window 0026** (`61e0b91` + `bb1dec9`) — **removal RETIRES, it never
destroys**, exactly as he decided at the s99 close. `retired_at` on both
`video_cuts` and `video_projects`; s82's hard delete BECAME the retire door
(`videoCuts.remove` gone, `output-file.ts` DELETED — nothing unlinks a render
any more); rename REFUSES on collision, never merges; reads exclude retired
with one sanctioned opt-in. The Dossier's **Restore door is rendered** and the
confirm now says the sheet's Restore sentence — the s96 test that pinned its
ABSENCE is inverted.

**Two warm-up honesty fixes** (`eb65a46`) — one shared `meta.mediaRefs` reader
(the Composer read `mime`, everything else read `contentType`), and
`projectKind()` reads the runner's recorded stamp instead of sniffing a prose
sentence.

**INTEL — first research pass AND first gate, both s100.** The gate (45
agents) returned `matches_sheet: false`, 24 confirmed, 16 dead/missing jobs.
Two fixed and live-proven:
- **The flagship path was DEAD on 30 of 58 cards** (`26007df`): a Bluesky card
  id carries an AT-URI whose SLASHES were interpolated raw into the path, so
  Promote *and* Dismiss 404'd on every Bluesky card. Proven 404 raw / 200
  encoded. It hid because every automated walk landed on a slash-free YouTube
  uuid — **including the repo's own `--jobs create`, which passed while the
  flagship path was broken.**
- **The s77 pick-list clipping came BACK** (`b8fd008`): the 420px clamp was
  measured against a guessed maximum (4 titles) when the contract allows 5, so
  option 8 was sliced mid-sentence. The clamp is DELETED — the schema is the
  bound, and the sheet has no scroll container.

**The founder's two live reports, both real:**
- **His video dead-ended in Approve** (`0369752`). The chain blocked at stage 2
  on a judge disagreement and stopped; no video project or cut was ever made.
  The pane offered nothing because it deferred approve/reject/re-judge to "the
  draft panel's own doors" — a panel it had REPLACED. A stalled band now names
  the stage, quotes the failing claim, and carries Re-judge. **Proven on his
  draft: re-judge → g3_screen PASS, blocked → queued.**
- **"The scenes look like placeholder" — they are not.** Nine real, on-brand,
  grounded scenes. The stub PREVIEW and the grey *visual hint* prose are what
  read as filler; he had also only seen scene 1 of 9.

**The judge is not defective** — two gates split on one sentence and the
disagreement policy held. The defect was a correct block with no door.

## Resume prompt (session 101, syd4)

**Resume · Thalon** — window 0026 is frozen and rendered; Intel is gated and
its debt list is written down; nothing is mid-flight.

**FIRST, and it is the founder's own call this session:** *"doors now, rebuild
next session"* — **rebuild `components/staged/`**, the LAST un-rebuilt surface
in the workspace (wave-0 bridge styling, no mock sheet of its own). That is
the other half of his report: *"the layout of it in the Approve section looks
horrible."* **Draw the sheet FIRST** (DOCTRINE 0; design is lead-direct, never
delegated — s51), then rebuild the 7 components to it. Known content problems
the sheet must answer: the right column squeezes the direction form (title
truncated, "Aspect (compile-time frame)" wrapping three lines), the preview is
an unlabelled-looking `LOW-RES STUB`, and each scene's *visual hint* is
director's prose wearing body-copy grey.

**THEN: the Intel debt list** (all itemised on its ledger row, gate-ordered).
The highest is **not** a UX item: **capture ids are in-process**, so an Intel
exit silently vanishes or resolves to the WRONG capture after a restart — a
correctness bug. After that: no `.btn:disabled` dress anywhere on the surface
· `busy` locks everything without saying which action runs, and add-area/
save-description run OUTSIDE it (double-submittable) · dismiss is terminal and
irreversible while the Search tab's dismissed targets get Restore · the sweep
schedule is armed with no door · no filter/sort/find over 58 cards with 4
visible at a time.

**Also worth doing early, cheap:** the `--jobs intel` HARNESS bug — it reports
the angle radios as "no affordance" because `surface-jobs.mjs` matches
/angle/i against textContent. Fix the selector, not the product.

▎ ▸ **Founder calls made THIS session, both on record:** staged surface =
doors now, rebuild next session with a sheet first. The g3_screen/g3_final
split = investigated, **judge NOT changed** — it was working; the defect was
the missing door.
▎ ▸ **Token rail:** the standing 2M/day pin in `.env.local` is UNTOUCHED and
was not hit. Zero vendor credits spent; zero live posts.
▎ ▸ **Design work = Fable 5 direct, never delegated** (standing s51); every
lane/subagent launch needs fresh founder approval; Mode B default.
▎ ▸ **Traps worth keeping:** `next dev` at `localhost:3111` (`npm run dev`),
**started and STOPPED in-session (s100 left it stopped)** · scripts need
`set -a; source apps/web/.env.local; set +a` · chrome-devtools `fill` does NOT
reach React controlled inputs · one workspace `.data` root since `68d9873`,
NEVER re-pin · **vitest does NOT typecheck** (`npx tsc --noEmit -p apps/web`
FROM THE REPO ROOT — it caught a test-only type error this session that a
green suite had hidden) · eslint runs from `apps/web`, not the root ·
sheet-verbatim CSS = impeccable findings intentional (DOCTRINE 0) · **a shared
class is only shared if its CSS is** — `.notice-band` is scoped to
`.editor-surface`, so its markup rendered as plain text on Approve until the
rule was defined there too · canvas writes need `finalize_plan` (UUID
`f5d304cb-cd0e-484d-8542-7b6561e1ef30`).
▎ ▸ **⛔ SEQUENCE GATE, current truth:** **post = ARMED** (founder GO s98);
**page still 409s** at `POST /api/create` until his word; bluesky = the one
platform granted for live testing; queue consumer's key rests EMPTY — arming
is per-run; youtube CANNOT arm. **Two live posts total, both bluesky, both
under the grant. Zero credits ever spent.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · GATE ON EXIT CODE ·
verify-on-main = THE gate · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin (this wrap) · staging rolls s93–s100 with the
next auto-deploy · four social channels connected · dev PG live · 8899 preview
+ sweeper user units keep running — NEVER hand-start the sweeper.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and pushed;
s101 boots on "gogogo" alone (this file + COORDINATION §s100 carry the state).

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   doctor` (data-root row must read ONE store) · `bash
   ~/work/swordfish/provisioning/checks/needs-steven-hygiene.sh`.

## Pointer

CLAUDE.md → this file → COORDINATION.md (§s100) →
`docs/research/ux-refinement-program.md` (**the Intel row now carries the full
debt list**) → `docs/research/mock-sheets/README.md` →
agent_handoff/NEEDS-STEVEN.md → `docs/research/prior-art-portal-automation-s84.md`
(BEFORE ANY PORTAL WORK). `docs/video-arc/spec.md` is a CLOSED record.

## Delta (session 100)

The session's lesson is one shape seen three times: **an assumption that
outlived the thing it depended on, and nothing failed loudly when it did.**
The staged pane pointed at doors on a panel it had itself replaced. The pick
list clamped against a "structural maximum" nobody had checked against the
contract — and the same wrong number came back one option later. The Intel
client interpolated an id that stopped being slash-free the day Bluesky was
added, and the repo's own gate walked past it because it kept landing on a
YouTube card. Each was found by DRIVING the real surface with real data, and
each is now pinned by a ratchet that reads the thing it depends on rather than
restating it. The founder found two of the three himself, which is the part
worth not repeating.
