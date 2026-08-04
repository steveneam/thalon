# CURRENT

## Stamp

2026-08-04 close of session 101 (syd4 — **the LAST un-rebuilt surface is
rebuilt**, and the Klaviyo findings are a **grounded spec with a next-session
plan**). Boot was "gogogo, audit things through mobbin-mcp and postiz lens as
needed" + a Klaviyo research directive; he then asked for the features to be
incorporated as a spec + plan, and mid-turn for a Mobbin sweep of them. Wrap
verify on main: **exit 0, 3381 passed / 9 skipped** (s100 was 3377/9). Zero
credits, zero live posts.

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

**THE CONTROL ARC — spec, wiring and plan** (`docs/control-arc/spec.md`, DRAFT
pending his verdict). The Klaviyo findings became three independently shippable
parts (A per-destination arming · B saved segments · C channel health, plus D a
free naming fix), each with its exact wiring — file paths, schemas, which
migrations are needed and which are not. **It passes the spec-ground-truth
ratchet**, so every path and schema it cites either exists or is marked `(new)`.

**Grounding it first — rule 12 — changed the plan twice before it was written,
and found a live bug:**
- **The saved-views primitive part B needs was ALREADY BUILT at s61** (table,
  repo, route, client, contracts) and has sat nearly unused. Part B is an
  extension, not a new family — the exact s87 ve4 trap, caught this time.
- **`SAVED_VIEW_SURFACES` still says `["leads","calendar"]`** while Schedule
  has asked for `"schedule"` since the s86 rename, so every read and write
  400s and **both call sites swallow it by design**. Schedule's density/scope
  preference has never once persisted, silently. Proven, not inferred.

**Rule 10 ran before any of it was planned** —
`docs/research/prior-art-saved-segments-s101.md`. Verdict **TAKE+**:
`@react-querybuilder/core` + `@react-querybuilder/drizzle` (both MIT,
registry-verified, headless, and their Drizzle peer range covers our 0.45.2)
for the predicate model and its SQL serialization; we hand-write only the
per-surface column allowlist the library deliberately leaves to the caller,
which is the part that makes a browser-supplied predicate safe.

**A Mobbin sweep for all three parts, on his mid-turn directive** — recorded in
the spec and the reference library. The finding that shaped part B: the
best-in-class pattern is **not a segment-builder surface** but three additions
to a list that already exists (view strip · chips that read as sentences ·
"Save as a new view" in the filter row). Contractbook is TAKEN whole;
AutoSend's three-naked-dropdowns modal is recorded as the ANTI-pattern because
it is what we would otherwise have built.

**One latent flake found and fixed** while gating this work: a Schedule test
whose fixture derived `decidedAt` from `Date.now()` collided with slots pinned
at 11:00 — **it failed every afternoon and healed itself every morning.**

## Resume prompt (session 102, syd4)

**Resume · Thalon** — every live surface has been touched by the research and
rebuilt to a sheet. Nothing is mid-flight. **The full ordered plan is
COORDINATION §s102**; the short form:

**THE ARC IS VERDICTED** — his answer, verbatim: ***"A first, config, yes to
the deps."*** `docs/control-arc/spec.md` has no open calls left. Note that
*"A first"* orders the ARC; it does not put a feature ahead of a correctness
bug, so Intel still leads.

**PHASE 1 — correctness.** The Intel bug carried since s100: **capture ids are
in-process**, so an Intel exit silently vanishes or resolves to the **WRONG
capture** after a restart. A wrong-target promote beats a dead door for
severity. Do it first.

**PHASE 2 — control-arc part A, the session's main build. NO MIGRATION.**
Grounding after his verdict made "config" cheaper than the spec assumed:
`brand_profiles.social` already holds per-platform publishing config whose
absent-platform state already means *"the refusal ladder's unarmed rung"*, so
arm state is one field on `socialCadenceSchema` defaulting to `off`. Full
wiring in spec §Part A. **Three traps it records, all from the repo's own
history:** (1) the same config gap has shipped **THREE times** — a block added
to the contract and dropped by the repo on create, unreadable for any real
tenant; run `packages/db/src/__tests__/brand-profile-config-blocks.test.ts`;
(2) never `z.record()` over an enum key — zod 4 makes it exhaustive; (3) do not
overload `maxPostsPerDay: 0` — "paused" is a cadence answer, "armed" is an
authorization answer. **The env var and the per-destination state are AND, not
OR** (stricter than the spec's first draft, and reversible in one line).
**Its surface half wants phase 5's Integrations pass first.**

**PHASE 3 — the saved-views contract window: a PROVEN live bug.** Grounding the
spec found it (GT-2): `SAVED_VIEW_SURFACES` is still `["leads", "calendar"]`,
but `schedule-surface.tsx` has asked for `"schedule"` since the s86 rename —
every read/write 400s and **both call sites swallow it by design**, so
Schedule's density/scope preference has never once persisted. Widen the list,
migrate the CHECK, retire `"calendar"`. Justified on the bug alone; that it
also lays part B's only migration is a dividend, not the reason.

**PHASE 4 — the Intel debt, gate-ordered.** Cheap first: the `--jobs intel`
HARNESS selector (`scripts/surface-jobs.mjs` matches /angle/i against
textContent — fix the selector, not the product). Then the s100 list: no
`.btn:disabled` dress · `busy` doesn't name its running action and add-area/
save-description run OUTSIDE it · dismiss is terminal while Search's targets
get Restore · the sweep schedule is armed with no door · no attribution on
model-written text · a judge-gated dossier says "not armed yet" · copy buttons
lie · the × that PAUSES wears the destroy glyph · reason bars have no
accessible name · the 1.3s band pop shifts tabs 91px · no keyword path · the
keyboard grammar is invisible. **STRUCK from this list: "no filter/sort/find
over 58 cards"** — that is control-arc part B, solved once for every surface.

**PHASE 5 — the last definition-of-done debt.** Integrations · Leads ·
Profiles · Source Media are the only `—` rows left. **Integrations first, and
consider pulling it ahead of phase 2's surface half** — part A's control cannot
honestly be drawn onto a surface that has not had its research pass.

**DELIBERATELY NOT IN s102: parts B and C.** B is approved and its deps are
approved, but *"A first"* is an order, and B owes a DRAWN SHEET before any
build (DOCTRINE 0; the s101 staged rebuild is the precedent). Drawing that
sheet is the natural s103 opener, its Mobbin sweep already banked. A half-built
A beside a half-built B is worse than either finished.

**WAITING ON HIM — now just ONE item, and it blocks nothing:** the three s101
staged design calls (live-chain editing · the dropped "low-res stub" title ·
one-scene-open-at-a-time). The control-arc calls are CLOSED and archived.

▎ ▸ **Founder calls made THIS session:** ***"A first, config, yes to the
deps"*** — the whole control arc verdicted in one line (order A→B→C · arm state
as tenant config · both MIT deps approved). Archived on the closed board with
its reasoning intact. s100's "doors now, rebuild next session" was also
executed as given.
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
· canvas writes need `finalize_plan` (UUID `f5d304cb-cd0e-484d-8542-7b6561e1ef30`)
· **a fixture time derived from `Date.now()` can drift into a fixture time
pinned to a literal hour** — `schedule-s96.test.tsx` had `decidedAt = now − 2h`
against slots pinned at 11:00, so it failed EVERY AFTERNOON between 13:00 and
14:00 and went green again by itself each morning (found + fixed s101; fixture
times are now anchored to a fixed hour of today, never to the wall clock).
▎ ▸ **⛔ SEQUENCE GATE, current truth:** **post = ARMED** (founder GO s98);
**page still 409s** at `POST /api/create` until his word; bluesky = the one
platform granted for live testing; queue consumer's key rests EMPTY — arming
is per-run; youtube CANNOT arm. **Two live posts total, both bluesky, both
under the grant. Zero credits ever spent.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · GATE ON EXIT CODE ·
verify-on-main = THE gate · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin (`4d01501`, this wrap) · staging rolls s93–s101
with the next auto-deploy · four social channels connected · dev PG live ·
8899 preview + sweeper user units keep running — NEVER hand-start the sweeper.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and pushed;
s102 boots on "gogogo" alone. **The PLAN is COORDINATION §s102** (§s101 is
what shipped) and `docs/control-arc/spec.md` is VERDICTED — read the plan
before the history.

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   verify` before any new work.

CLAUDE.md → this file → COORDINATION.md (**§s102 = the plan; §s101 = what
shipped**) → `docs/control-arc/spec.md` (**VERDICTED — no open calls**) →
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
