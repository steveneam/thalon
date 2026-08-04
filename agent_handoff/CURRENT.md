# CURRENT

## Stamp

2026-08-04 close of session 99 (syd4 — **V9 SHIPPED, and with it the whole
video arc**; zero credits, zero live posts). Boot was "gogogo", interrupted
mid-session by the founder's own live bug report ("in the Intel feature, why
are you taking the whole transcript and putting it into the title!!!?") —
real, fixed first. Wrap verify on main: **exit 0, 3339 passed / 9 skipped**.

## WHAT SHIPPED (COORDINATION §s99 carries the full records)

**The founder's Intel bug** (`93d0045`) — the card never had a title field:
the dossier h2 and rising rows were wired to the item's raw `text`, which on
video sources is the platform's whole title+description+transcript blob
(**1,947 chars rendering as the headline** on live dev). The headline is now
the FIRST LINE (the TrendItem contract's title position), word-cut at 160,
verbatim text on hover. Live-confirmed: 55-char h2, 1,947-char hover.

**V9 — all four surfaces gated.** Overview (`4505e9e`, 21 agents) · Dossier
(`9a63573`, 37) · editor (`8d1ed8f`, 41) passed first time. **The Composer
FAILED its gate** (58 agents, `matches_sheet: false`) — fixed in two rounds
(`749b833` then `3fdb2a5`) and re-verified by live probe + screenshot. Every
confirmed finding behind all four gates was fixed the same session; the
deferred ones are on their `docs/research/ux-refinement-program.md` rows.

**The two defects worth remembering:** a blanket `.composer-surface a {
color: inherit }` had every door on that surface rendering body-grey against
the sheet's blue — including three doors I had just added — and
`toErrorResponse` was handing Drizzle's `Failed query: … params: <tenant
uuid>` straight to the browser, where surfaces print refusals verbatim by
design.

## Resume prompt (session 100, syd4)

**Resume · Thalon** — the video arc is CLOSED; the Create loop is live
end-to-end; no arc is mid-flight. Candidates, no fixed order (re-test at the
opener, rule 11):

1. **UX programme** — the remaining un-passed rows in
   `docs/research/ux-refinement-program.md`. The four video rows and Composer
   now carry full s99 gate records; the untouched surfaces (Integrations,
   Intel, Leads, Profiles) are the honest next front. **Intel especially** —
   the founder found a live defect there this session, and its row still
   reads "untouched — not ready".
2. **The `meta.mediaRefs` split reader** (s99 gate finding, back-end): the
   Composer reads `mime`, the engine's `readDraftFitMedia` + the publish
   door's `mediaRefsSchema` read `contentType`. Unexercised today; whichever
   producer lands first, one reader goes blind. One shared reader BEFORE the
   media pass.
3. **More Create dogfood** — the post door is armed and proven; each run is
   subscription-only until media enters. Page generation still needs its OWN
   founder word.
4. **Simplify candidate** (s96, still open): plat-mark paths in THREE surface
   copies (approve/analytics/schedule) → `components/media`.

▎ ▸ **THREE FLAGGED contract-window asks** (raise together at the next
window): the Dossier's drawn "Restore brings it back" needs a cut
retire/restore column (standing since s96) · a project **delete/rename** verb
(`video-projects` repo has only create/setMediaRoot/setAudioBed/get/list — the
grid already shows two near-duplicate one-prompt runs nobody can clean up) ·
a **recorded project ORIGIN** (`projectKind` decides the engine-authorship
mark by sniffing whether the description starts "One-prompt").
▎ ▸ **Token rail:** the founder's standing 2M/day pin in `.env.local` is
UNTOUCHED and was not hit this session.
▎ ▸ **Design work = Fable 5 direct, never delegated** (standing s51); every
lane/subagent launch needs fresh founder approval; Mode B default.
▎ ▸ **Traps worth keeping:** `next dev` at `localhost:3111` (`npm run dev`),
started and STOPPED in-session (s99 left it stopped) · scripts
need `set -a; source apps/web/.env.local; set +a` · chrome-devtools `fill`
does NOT reach React controlled inputs (type via keyboard or use the API
wire) · one workspace `.data` root since `68d9873`, NEVER re-pin · chip
platform words live in aria-labels · `placeColumn` returns `{placed,
overflow}` · sheet-verbatim CSS = impeccable findings intentional (DOCTRINE
0) · vitest doesn't typecheck (`npx tsc --noEmit -p apps/web` FROM THE REPO
ROOT — from inside apps/web the path resolves wrong and exits 0 on a lie) ·
eslint must run from `apps/web`, not the root (the react plugin crashes) ·
canvas writes need `finalize_plan` (UUID `f5d304cb-cd0e-484d-8542-7b6561e1ef30`).
▎ ▸ **⛔ SEQUENCE GATE, current truth:** **post = ARMED** (founder GO s98);
**page still 409s** at `POST /api/create` until his word; bluesky = the one
platform granted for live testing; queue consumer's key rests EMPTY — arming
is per-run; youtube CANNOT arm. **Two live posts total, both bluesky, both
under the grant. Zero credits ever spent.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · GATE ON EXIT CODE ·
verify-on-main = THE gate · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin (this wrap) · staging rolls s93–s99 with the
next auto-deploy · four social channels connected · dev PG live · 8899
preview + sweeper user units keep running — NEVER hand-start the sweeper.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and
pushed; s100 boots on "gogogo" alone (this file + COORDINATION §s99 carry the
whole state).

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   doctor` (data-root row must read ONE store) · `bash
   ~/work/swordfish/provisioning/checks/needs-steven-hygiene.sh`.

## Pointer

CLAUDE.md → this file → COORDINATION.md (§s99) →
`docs/research/ux-refinement-program.md` → `docs/research/mock-sheets/README.md`
→ agent_handoff/NEEDS-STEVEN.md → `docs/research/prior-art-portal-automation-s84.md`
(BEFORE ANY PORTAL WORK). `docs/video-arc/spec.md` is now a CLOSED record.

## Delta (session 99)

A one-word boot spent on the video arc's last item, and the arc closed. The
session's lesson is the gates' own: **three surfaces passed first time and
the fourth did not**, and the fourth's failures included two doors' worth of
drift I had introduced an hour earlier — which is exactly what a gate is for.
The founder's mid-session report landed the same way: the Intel headline had
been wrong on every video card since the feature shipped, and no test caught
it because the mock's fixture was a short post. Both are arguments for
checking the rendered thing against real data rather than the fixture.
Credits ran out mid-Composer-gate on Fable 5; the session continued on Opus 5
and resumed the gate from its own run id rather than dropping it.
