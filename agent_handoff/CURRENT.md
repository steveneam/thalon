# CURRENT

## Stamp

2026-08-05 close of session 103 (syd4 — boot was "gogogo" alone). Wrap verify
on main: **exit 0, 3441 passed / 9 skipped** (s102 was 3414/9). Three commits,
`353f8b9`…`37cbce5`. Zero credits, zero live posts, nothing armed, the queue
consumer's master key still EMPTY.

## WHAT SHIPPED (COORDINATION §s103 carries the full record)

**His directive from the s102 close is DELIVERED END TO END** — engine, write
door and surface. He can open Integrations, flip **Post to: Selected | All**,
and flip it back to find exactly the arrangement he left.

**1 — part A2's engine** (`353f8b9`). `postingScope = "selective" | "all"` as
an OVERLAY inside `passArmStateResolver`; the consumer is untouched and nothing
stored is ever rewritten. No migration, as grounded. **Grounding corrected the
spec's binding 3, and it mattered:** the spec promised `all` would cover *"new
channels you connect"*, but nothing in the connect path writes a posting entry
and the publish door refuses a platform without one — and a claimed-then-
refused row is marked `failed`, **terminal, no retry ladder**. Reading an
absent entry as `live` would have **burned drafts that `off` merely holds**.
So `all` covers what is CONFIGURED. `passArmStateResolver` had no direct test
before this; it has real-db coverage now.

**2 — the write door** (`6944e9d`). Neither engine half could be set by
anything in the product. **Founder call taken mid-build:** `brand_profiles` is
append-only, so the obvious write mints a version per toggle flip and buries
the Profiles history — he chose **in-place on the active row + the events
spine** (`brand_profile.social_updated`). `updateSocialConfig` is that repo's
one in-place write. Arming an unconfigured destination CREATES its entry,
which also authorizes a manual publish — stated at the control before the
first flip.

**3 — the surface** (`37cbce5`). Part A's seg (`Off · Review · Live` — a
toggle cannot say `review`), A2's scope head control, and the
connected/available SPLIT with counts (the s102 research pass's top finding).
Each seg keeps showing its STORED value with the mode's effect stated beside
it. **ONE BUG, catchable only by running it:** under `all`, an unconfigured
destination's card claimed *"this destination posts"* while the engine leaves
it `off` — the card contradicting the engine, one commit after that very
correction. Green suite, clean types, clean lint. **Fourth session running.**

**Proven live against dev Postgres** (not just tests): flipped bluesky to
review — its cap of 2 survived untouched; flipped scope to `all` — every
stored state unchanged, each card explaining itself; flipped back — precisely
the arrangement left behind; two events on the spine, still 5 profiles at
version 5. **Workspace restored to its as-found state.**

## Resume prompt (session 104, syd4)

**Resume · Thalon** — nothing is mid-flight; s103's phases 0 and 2 are fully
executed and pushed. **The plan is COORDINATION §s103** (its shipped-block is
what happened; the plan text below it is what remains).

**PHASE 1 — control-arc part B, and it OPENS WITH A DRAWN SHEET.** It was the
s103 plan's phase 1 and was deliberately not started: phase 2 was promoted
ahead of it because it completed the founder's own directive while B is my
recommendation. **B is untouched and is the opener.** Approved, with its two
MIT deps approved (`@react-querybuilder/core` + `@react-querybuilder/drizzle`),
but **DOCTRINE 0 says the sheet comes first** and B has none — the s101 staged
rebuild is the precedent. Its Mobbin sweep is banked in
`docs/control-arc/spec.md`; the finding that shapes it: **not a segment-builder
surface** but three additions to a list that already exists — view strip ·
chips that read as sentences · "Save as a new view" in the filter row.
Contractbook TAKEN whole; AutoSend's three-naked-dropdowns modal is the
recorded ANTI-pattern. **Its only migration was laid at s102** (window 0027
widened `SAVED_VIEW_SURFACES`) and the saved-views primitive it extends was
built at s61 — B is an extension, not a new family. **Design work = Fable 5
lead-direct, never delegated** (standing s51).

**PHASE 2 — the Integrations p1's REMAINING three takes.** s103 landed two of
four (the split, and the arm control the row was waiting for). Still owed: the
**blast-radius disclosure** on a `needs_reauth` seat — richer now, because
part A's `holds` name exactly which rows a broken credential is holding up —
the honest **"managed elsewhere"** state for an `envOverride` seat, and
**class grouping** (`card.class` exists and still does nothing).

**PHASE 3 — the last three `—` rows:** Leads · Profiles · Source Media. Each
is a research pass, not a rebuild.

**CARRIED, recorded not fixed (all with reasons, on their ledger rows):**
Schedule's **month-density chips clip their own text** · the Intel
**dossier-absence REASON does not reach the wire** (unarmed vs model failure
vs **denylist** all read the same; carrying the reason is a contract-window
ask) · Intel dismiss reversibility · the sweep schedule's missing door · the
add-chip's missing keyword path.

**WAITING ON HIM — still just ONE item, and it blocks nothing:** the three
s101 staged design calls (live-chain editing · the dropped "low-res stub"
title · one-scene-open-at-a-time).

▎ ▸ **Founder call made DURING s103:** the arm flip's storage shape — **in
place on the active row + one event per flip**, rather than a new brand-profile
version each time. Proven: 5 profiles / version 5 after two flips.
▎ ▸ **A2's three delegated judgement calls are made and live** (under the
master key · `all` never overrides `review` · live-not-snapshot, said in
words). Each is a one-line reversal if he disagrees now that he can see them.
▎ ▸ **The lesson, fourth session running: RUN IT AND READ IT.** s100's guessed
clamp, s101's `xl:` breakpoint, s102's three bugs, and now a card asserting the
opposite of its own engine. Every one was valid, idiomatic, passing code. The
suite is at 3441 and could not see any of them.
▎ ▸ **Grounding before building corrected the spec again** (rule 12) — and
this one would have burned drafts terminally, not just read wrong.
▎ ▸ **Traps worth keeping:** `next dev` at `localhost:3111` (`npm run dev`),
**started and STOPPED in-session (s103 left it stopped)** · **the Bash tool's
cwd PERSISTS between calls — an earlier `cd apps/web` made later repo-root
greps report "no such file"; `cd` to the root in the same command** · scripts
need `set -a; source apps/web/.env.local; set +a` · chrome-devtools `fill`
does NOT reach React controlled inputs (click works) · **`screen.findByText`
on a word the surface uses twice is ambiguous — scope it (`{selector}`)** ·
**do NOT run `npm run verify` in the background while still editing** ·
**`npm run verify`'s exit code is the gate — read the logged `VERIFY EXIT`
line** · vitest does NOT typecheck (`npx tsc --noEmit -p apps/web` FROM THE
REPO ROOT) — it caught every hand-built `SocialPublishConfig` literal when the
new field became required · eslint runs from `apps/web` · one workspace `.data`
root, NEVER re-pin · sheet-verbatim CSS = impeccable findings intentional
(DOCTRINE 0) · **a zod `.default()` on a config block MATERIALIZES on parse —
three exact-equality assertions moved; strengthen them, never loosen** ·
`packages/db` exposes `repos` as its ONLY query API (no raw select in a test)
· a drizzle-generated CHECK migration FAILS on rows violating it · a React
state flag cannot guard a double-submit (use a ref) · never assert a substring
over RANDOM data.
▎ ▸ **⛔ SEQUENCE GATE, current truth — UNCHANGED and NARROWER STILL:** **post
= ARMED** (founder GO s98); **page still 409s** at `POST /api/create` until his
word; bluesky = the one platform granted for live testing; the queue
consumer's key rests EMPTY. Parts A + A2 only ever NARROW a GO — absent config
is off everywhere, and `all` cannot arm what the master key has not. **Two live
posts total, both bluesky, both under the grant. Zero credits ever spent.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · GATE ON EXIT CODE ·
verify-on-main = THE gate · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin (`37cbce5` + this wrap) · staging rolls s93–s103
with the next auto-deploy · **no new migration this session** (A2 and the write
door are both migration-free) · four social channels connected · dev PG live ·
8899 preview + sweeper user units keep running — NEVER hand-start the sweeper.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and pushed;
s104 boots on "gogogo" alone. **The PLAN is COORDINATION §s103** and
`docs/control-arc/spec.md` is the spec of record — **part A BUILT (engine +
surface), A2 BUILT (engine + surface), B is next and owes a SHEET, C
unstarted**.

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   verify` before any new work.

CLAUDE.md → this file → COORDINATION.md (**§s103 = what shipped AND the plan**)
→ `docs/control-arc/spec.md` (**A + A2 BUILT; B is next and owes a SHEET**) →
`docs/research/ux-refinement-program.md` (**Integrations row now carries its
first p1 and names what it still owes**) → `docs/research/mock-sheets/README.md`
→ agent_handoff/NEEDS-STEVEN.md → `docs/research/prior-art-portal-automation-s84.md`
(BEFORE ANY PORTAL WORK). `docs/video-arc/spec.md` is a CLOSED record.

## Delta (session 103)

The session delivered one directive end to end — engine, a write door that did
not exist, and the surface — and the thing worth carrying is that **the same
mistake was made twice in one session, in two different layers, and only one
of them was caught by thinking.**

The first was caught by grounding before building: the spec promised `all`
would cover "channels you connect", and the connect path writes no posting
entry, so `all` would have raised destinations the publish door then refuses —
and a refused row is marked `failed`, terminally. That correction went into
the contract, the resolver, and the spec.

The second was the *same claim*, rendered. One commit later the card said
"this destination posts" over a destination the resolver leaves off. Nothing
caught it: not the types, not the linter, not 3441 tests. Loading the page and
reading the card caught it in seconds.

So the fourth session running, the highest-severity finding was invisible to
every automated check and obvious to a person looking at the product. The
difference this time is that the bug was a *contradiction of a correction the
same session had already made* — which says the risk is not just untested
code, but a fact that is fixed in one layer and left stale in another. Fixing
a claim means finding everywhere the product makes it.
