# CURRENT

## Stamp

2026-08-04 close of session 101 (syd4 — **the LAST un-rebuilt surface is
rebuilt: the staged pane has a sheet and speaks it**; plus the Klaviyo
teardown he asked for). Boot was "gogogo, audit things through mobbin-mcp and
postiz lens as needed" + a Klaviyo research directive. Wrap verify on main:
**exit 0, 3381 passed / 9 skipped** (s100 was 3377/9). Zero credits, zero live
posts.

## WHAT SHIPPED (COORDINATION §s101 carries the full record)

**The staged surface — sheet AUTHORED and BUILT in one session** (`21c211a`),
which was his own call at the s100 close (*"doors now, rebuild next session"*,
sheet first). It was the last surface wearing wave-0 bridge styling, and **the
only live surface never in the UX programme's coverage ledger at all** — a debt
with no row, the one kind that table cannot catch. It has row 22 now.

**His report — "the layout of it in the Approve section looks horrible" — had
one cause, made twice and nested:** Tailwind `xl:` VIEWPORT breakpoints laying
out a CONTAINER that is 560px wide whatever the viewport. Measured at 1440×940
before touching anything, and again after, on his own data:

| | before | after |
|---|---|---|
| direction editor | **182px**, beside a **342px** preview stub | the full column |
| its inner grid | three **46.7px** columns → "Aspect (compile-time frame)" on four lines | chips, no grid |
| clipped elements | **4** (incl. 240px of his own CTA off the right edge) | **0** |
| pane height | **3219px** in a 764px box | **1120px** in 644 |
| hard-`disabled` on a live run | **26 of 41** | **1 of 21** |
| preview at scroll bottom | gone — you scrubbed blind | **pinned, on screen** |

The one remaining hard-disabled control is the locked stage's rail button,
whose reason ("not generated yet") is its own adjacent line.

**Its first research pass, same session** (Artlist → direction as CHIPS ·
Elicit → every stage says what it PRODUCED · Gemini Gems → the ask pinned above
the steps · Grain/Copy.ai/Asana → an outline is an index, one open ·
ElevenLabs → the frame at its true aspect). **Node canvases REJECTED a third
time**, same reason as the Board s91. **Postiz: nothing to take, stated.**

**Three structural results beyond the layout:** `storyboard-cards.tsx` DELETED
(it and the direction editor's near-duplicate scene cards became one
`scene-index.tsx` — they had already drifted on how they render an absent
visual line) · a live chain gets FACTS with one sentence saying why the verbs
are missing, never 26 rendered-and-greyed controls · the bridge-burndown
ratchet fired and was lowered in the same change, the whole
`components/staged/` block leaving the map at zero.

**KLAVIYO TEARDOWN** — `docs/research/klaviyo-teardown-s101.md`. Docs +
architecture, not visual (Mobbin has ONE Klaviyo screen and the memo says so
rather than inventing a UI review). Short list by value-per-risk: **(1)
per-step arming** — their per-MESSAGE `draft`/`manual`/`live`, where `manual`
routes the recipient to a "Needs Review" tab, which both independently
validates Approve and beats us on granularity (we arm a whole run, they arm a
message) · **(2) segments as live saved predicates** — the right answer to the
Intel filter debt, saved views everywhere rather than a filter box on one
surface; **charter candidate, prior-art sweep first (rule 10)** · **(3) channel
health** (their deliverability hub) — a real gap no surface owns · (4)
trigger-split vs conditional-split as a naming distinction for the fan-out
profiles · (5) scores on objects — **LATER, dependency named: D2** · (6)
benchmarks — REJECT (one tenant), parked with its trigger.

## Resume prompt (session 102, syd4)

**Resume · Thalon** — every live surface has now been touched by the research
and every one is rebuilt to a sheet. Nothing is mid-flight.

**THE HIGHEST ITEM IS STILL NOT A UX ONE — it is the Intel correctness bug
carried since s100: capture ids are in-process**, so an Intel exit silently
vanishes or resolves to the WRONG capture after a restart. Do that first.

**Then the rest of the Intel debt list** (itemised on its ledger row,
gate-ordered): no `.btn:disabled` dress anywhere on the surface · `busy` locks
everything without saying which action runs, and add-area/save-description run
OUTSIDE it (double-submittable) · dismiss is terminal and irreversible while
the Search tab's dismissed targets get Restore · the sweep schedule is armed
with no door · no filter/sort/find over 58 cards with 4 visible at a time —
**note that Klaviyo's segment finding (memo §1) argues this last one should be
solved once, properly, rather than as a filter box on Intel.**

**Cheap and worth doing early:** the `--jobs intel` HARNESS bug — it reports
the angle radios as "no affordance" because `surface-jobs.mjs` matches
/angle/i against textContent. Fix the selector, not the product.

**Three OPEN CALLS are waiting for him in `Staged.dc.html`'s header** — they
are questions the sheet asks, not decisions taken for him: (a) a live chain
gets facts, not a form — is "read here, edit in Videos" the right split, or
should live stage editing become a bucket? (b) the preview lost its "(low-res
stub)" title, since his own report was that the scenes are not placeholder;
(c) scenes collapse to one-open-at-a-time, which kills the 3219px scroll but
means you cannot eyeball all nine narrations at once.

▎ ▸ **Founder calls made THIS session:** none new — s100's "doors now, rebuild
next session" was executed as given.
▎ ▸ **The lesson worth keeping:** the defect was invisible to every automated
check because `xl:` is *valid CSS that reads as responsive design*. It only
became a fact when the container was MEASURED. Two of the three s100 defects
were found the same way. Measure the container, not the viewport.
▎ ▸ **A ledger cannot catch a row it does not have** — the staged surface was
never in the coverage table, so 20 rows read complete while a surface sat
un-passed. The next audit starts from the FILE LIST, then reconciles to the
table.
▎ ▸ **Design work = Fable 5 direct, never delegated** (standing s51); every
lane/subagent launch needs fresh founder approval; Mode B default.
▎ ▸ **Traps worth keeping:** `next dev` at `localhost:3111` (`npm run dev`),
**started and STOPPED in-session (s101 left it stopped)** · scripts need
`set -a; source apps/web/.env.local; set +a` · chrome-devtools `fill` does NOT
reach React controlled inputs · one workspace `.data` root since `68d9873`,
NEVER re-pin · **vitest does NOT typecheck** (`npx tsc --noEmit -p apps/web`
FROM THE REPO ROOT) · eslint runs from `apps/web`, not the root ·
**`npm run verify`'s exit code is the gate — a wrapper that ends in `echo`
returns 0 no matter what verify did; read the logged `VERIFY EXIT` line** ·
sheet-verbatim CSS = impeccable findings intentional (DOCTRINE 0) · **a shared
class is only shared if its CSS is** — and s101 adds its sibling: **a NEW class
name can COLLIDE with the shell** (`.dir.screen` hit `.screen` and turned three
caption rows into 940px screens; caught by counting DOM nodes, not by looking)
· canvas writes need `finalize_plan` (UUID `f5d304cb-cd0e-484d-8542-7b6561e1ef30`).
▎ ▸ **⛔ SEQUENCE GATE, current truth:** **post = ARMED** (founder GO s98);
**page still 409s** at `POST /api/create` until his word; bluesky = the one
platform granted for live testing; queue consumer's key rests EMPTY — arming
is per-run; youtube CANNOT arm. **Two live posts total, both bluesky, both
under the grant. Zero credits ever spent.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · GATE ON EXIT CODE ·
verify-on-main = THE gate · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin (`21c211a`, this wrap) · staging rolls s93–s101
with the next auto-deploy · four social channels connected · dev PG live ·
8899 preview + sweeper user units keep running — NEVER hand-start the sweeper.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and pushed;
s102 boots on "gogogo" alone (this file + COORDINATION §s101 carry the state).

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   verify` before any new work.

CLAUDE.md → this file → COORDINATION.md (§s101) →
`docs/research/ux-refinement-program.md` (**Intel's row carries the full debt
list; Staged is row 22**) → `docs/research/klaviyo-teardown-s101.md` →
`docs/research/mock-sheets/README.md` → agent_handoff/NEEDS-STEVEN.md →
`docs/research/prior-art-portal-automation-s84.md` (BEFORE ANY PORTAL WORK).
`docs/video-arc/spec.md` is a CLOSED record.

## Delta (session 101)

Two lessons, and they rhyme with s100's. **The first: a defect can be valid,
idiomatic code.** `xl:grid-cols-3` is textbook responsive design; it was also
the whole bug, because the container it governed was never the viewport. No
lint, no type and no test could see it — it took measuring the actual box. That
is the same shape as s100's clamp measured against a guessed maximum, and it
has the same answer: read the thing you depend on rather than restating it.

**The second: the coverage ledger had 20 rows and the workspace had 21
surfaces.** The staged pane was never listed, so a table whose whole job is
naming debts silently agreed there were none left. An index is only as honest
as the enumeration that built it — the next audit starts from the file system.

The Klaviyo work landed the more interesting strategic finding: the two things
worth taking are not features but *granularities* — arming per message rather
than per run, and membership as a live predicate rather than a static list.
Both are cheaper than they look, and the first makes the live-posting grant
safer rather than looser, which is the rare kind of change worth proposing
before he asks.
