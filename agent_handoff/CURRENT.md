# CURRENT

## Stamp

2026-08-04 close of session 102 (syd4 — **all five planned phases shipped**,
boot was "gogogo" alone). Wrap verify on main: **exit 0, 3414 passed / 9
skipped** (s101 was 3381/9). Five commits, `4fa663a`…`ea7b4cb`. Zero credits,
zero live posts, nothing armed.

## WHAT SHIPPED (COORDINATION §s102 carries the full record)

**Phase 1 — the Intel capture spine goes DURABLE** (`4fa663a`). Capture ids
were `intel-capture-${counter}` in one process's memory while the `?ctx=` link
they mint is a URL an operator sits on across a deploy. After a restart that
link either vanished or **resolved to a DIFFERENT capture that had taken the
same number** — briefing Create from someone else's pick. The durable table
has existed since s61 and had **never been written to**: dev PG held 0 rows.
Proven live against dev Postgres (not PGlite): promoted a card, confirmed the
row and its event, restarted the server, resolved the pre-restart id in the
fresh process with full context and the pick on the board.

**Phase 2 — control-arc part A** (`f0eb16e`), his approved next build.
Per-destination `off`/`review`/`live`, ANDed with the master key: **a
master-armed tick with no per-destination config publishes NOTHING**. No
migration. **Grounding corrected the spec four times** — the contract's
placement was a circular import; the resolver needs `{tenantId, platform}`
because the consumer is cross-tenant; the tick ROUTE is not where arming
happens (`scripts/run-publish-queue.ts` is); and `armState` is withheld from
the driver call. **Nothing is armed by this change.**

**Phase 3 — window 0027** (`23ceea2`): **Schedule's saved view had never once
persisted.** It has asked for `"schedule"` since the s86 rename while the
contract still said `"calendar"`, so both doors 400d — and both call sites
swallow errors by design, so the preference silently reset for sixteen
sessions. Proven live before and after. The migration RENAMES the stranded
rows (dev PG's one row was Schedule's own preference, orphaned), and the
generated migration would have **FAILED** on any db holding one.

**Phase 4 — nine Intel debts + the harness bug** (`6ed5725`). `busy` names its
action · add-area/save-description no longer double-submit (**the guard is a
REF**) · copy buttons stop lying · the × that PAUSES wears a pause mark ·
reason bars carry a name and value · machine-written text is attributed · the
j/k grammar is visible · the count pill reserves its box. **The
`.btn:disabled` dress was PROMOTED TO THE SHELL** — and the ratchet followed
it, so it protects the four surfaces nobody has passed yet.

**Phase 5 — the Integrations research pass** (`ea7b4cb`), the first for that
row. **On the honesty half we were already ahead of the comparison set.** Four
shape gaps taken, the strongest being **Coda's blast-radius disclosure**: a
broken account names what depends on it — and after part A the consumer knows
exactly which rows those are, so A, C and the broken-credential state join up
on one card.

## Resume prompt (session 103, syd4)

**Resume · Thalon** — nothing is mid-flight; the s102 plan is fully executed.
**The full ordered plan is COORDINATION §s103**; the short form:

**PHASE 0 — part A2, his directive at the s102 close, and it runs FIRST.**
Verbatim: ***"there can be an option for the posting, like a toggle on whether
i want to post on all or just selectively. the rest we can go with your
recommendations."*** It goes ahead of part B because it completes the thing he
just approved and used, and B is a larger build that has not started.
`postingScope = "selective" | "all"`, defaulting to `selective`; full wiring
in `docs/control-arc/spec.md` §Part A2. **NO MIGRATION — grounded at the s102
close**: every reader of `brand_profiles.social` is a KEYED lookup
(`publish.ts:244`, `social-arming.ts:128`, `cards.ts:189`) and nothing
iterates the block's keys, so a scalar field cannot be mistaken for a
platform. **Three bindings, all in the spec and all recorded on his board so
he can overrule any of them:** it sits UNDER the master key (three gates, all
AND — `all` cannot arm anything `SOCIAL_QUEUE_ARMED` has not, and that key
still rests empty) · **`all` never overrides an explicit `review`** · `all` is
LIVE rather than a snapshot **and says so in words before he flips it**.
**It is an OVERLAY, never a mutation** — flipping back to `selective` restores
exactly the arrangement he left, which is what makes it safe to try. The
engine change is confined to `passArmStateResolver`; the consumer is
untouched. **Its surface half rides phase 2's pass** (same card, one control
surface).

**PHASE 1 — control-arc part B, and it opens with a DRAWN SHEET.** B is
approved and its two MIT deps are approved (`@react-querybuilder/core` +
`@react-querybuilder/drizzle`), but **DOCTRINE 0 says the sheet comes first**
and B has none — the s101 staged rebuild is the precedent. Its Mobbin sweep is
already banked in `docs/control-arc/spec.md` (the finding that shapes it:
**not a segment-builder surface** but three additions to a list that already
exists — view strip · chips that read as sentences · "Save as a new view" in
the filter row; Contractbook TAKEN whole, AutoSend's three-naked-dropdowns
modal recorded as the ANTI-pattern). **Its only migration was laid at s102**
(window 0027 widened `SAVED_VIEW_SURFACES`), and the saved-views primitive it
extends was built at s61 — B is an extension, not a new family.
**Design work = Fable 5 lead-direct, never delegated** (standing s51).

**PHASE 2 — part A's SURFACE half + A2's scope toggle, ONE pass.** They are
one control surface, and s102 phase 5 cleared the prerequisite: Integrations
has had its research pass. The per-destination control is a **seg**
(`live | review | off`) in the shell's `.seg` vocabulary — not a toggle, which
cannot express `review`, and `review` is the whole point; the SCOPE mode is
the head control above them. Spec §Part A carries the drawn shape (Mistral's
per-row Enabled column · Base44's state word UNDER the name, never a bare dot ·
WRITER's inert-control-states-its-reason); §Part A2 carries the mode's two
copy obligations. **Each destination's seg keeps showing its STORED value**
with the mode's effect stated beside it — never blanked, never rewritten, or
the overlay stops being legible and the flip back stops being lossless.
**Land the connected/available SPLIT in the same pass** — it is the research
pass's own top finding and both controls land better on a split list.

**PHASE 3 — the Integrations p1 the research pass earned.** The other three
takes: the **blast-radius disclosure** on a `needs_reauth` seat (its rows are
part A's `holds`), the honest "managed elsewhere" state for an `envOverride`
seat, and class grouping (`card.class` exists and does nothing).

**PHASE 4 — the last three `—` rows:** Leads · Profiles · Source Media. Each
is a research pass, not a rebuild.

**CARRIED, recorded not fixed (all with reasons, on their ledger rows):**
Schedule's **month-density chips clip their own text** (found by the phase-3
restore — month was always clickable but nothing had ever restored INTO it) ·
the Intel **dossier-absence REASON does not reach the wire** (unarmed vs model
failure vs **denylist** all read the same; the copy now states what is true
and stops asserting a cause — carrying the reason is a contract-window ask) ·
Intel dismiss reversibility · the sweep schedule's missing door · the
add-chip's missing keyword path.

**WAITING ON HIM — still just ONE item, and it blocks nothing:** the three
s101 staged design calls (live-chain editing · the dropped "low-res stub"
title · one-scene-open-at-a-time). **A2 is NOT waiting on him** — he
delegated its details ("the rest we can go with your recommendations"), the
three calls are made and recorded on his board as FYI, and any of them is a
one-line reversal if he disagrees when he sees it.

▎ ▸ **Founder call made at the s102 CLOSE:** ***"there can be an option for the
posting, like a toggle on whether i want to post on all or just selectively.
the rest we can go with your recommendations."*** → **part A2**, specced and
first in the s103 order. The three judgement calls it delegated are made,
stated on his board, and each reversible in a line. The build itself executed
the s101 plan as given under his standing *"A first, config, yes to the deps"*.
▎ ▸ **The lesson worth keeping:** **three of the five phases were bugs that
every automated check agreed were fine.** A capture id that resolves to the
wrong row, a saved view whose 400 is caught by design, a copy button that
reports success before the write — each is *valid, idiomatic, passing* code.
This rhymes exactly with s101's `xl:` breakpoint and s100's guessed clamp, and
the answer is the same one a third time: **run the thing and look at what it
did**, rather than reading what it should do.
▎ ▸ **A ratchet that names one surface protects one surface.** The
`.btn:disabled` dress was written up for shell promotion at s79 and copied
locally four times instead; the fifth finding is what moved it. When a fix is
scoped "for now", the note that says so is not the ratchet — moving it is.
▎ ▸ **Grounding before building changed part A four times** (rule 12), and one
of the four (the circular import) would have failed at runtime, not at review.
▎ ▸ **Design work = Fable 5 direct, never delegated** (standing s51); every
lane/subagent launch needs fresh founder approval; Mode B default.
▎ ▸ **Traps worth keeping:** `next dev` at `localhost:3111` (`npm run dev`),
**started and STOPPED in-session (s102 left it stopped)** · scripts need
`set -a; source apps/web/.env.local; set +a` · chrome-devtools `fill` does NOT
reach React controlled inputs · **do NOT run `npm run verify` in the
background while still editing — it reads files off disk as it goes, and s102
burned two runs "failing" on its own half-finished refactor** · **`npm run
verify`'s exit code is the gate — read the logged `VERIFY EXIT` line; the
task-completion notice reports the ECHO's exit, not verify's** · vitest does
NOT typecheck (`npx tsc --noEmit -p apps/web` FROM THE REPO ROOT) · eslint runs
from `apps/web` · one workspace `.data` root, NEVER re-pin · sheet-verbatim CSS
= impeccable findings intentional (DOCTRINE 0) · **a drizzle-generated CHECK
migration FAILS on rows that violate the new constraint — the data move goes
BETWEEN the drop and the add** · **a React state flag cannot guard a
double-submit** (both presses read the same rendered value; use a ref) ·
**never assert a substring over RANDOM data** — `readers.test.ts` checked
`expect(auth).not.toContain("ks")` across a whole OAuth 1.0a header *including
the signature*, an HMAC blob that is random per request, so a signature that
happened to contain "ks" failed the run: **measured at 0.67%, about one run in
148** (found + fixed s102 when it fired during the wrap; the fix made the test
STRONGER — it now also catches a plaintext leak of the access-token secret,
which it never checked). **Second flake of this class in two sessions** — s101's
was a fixture time derived from `Date.now()` colliding with slots pinned at
11:00, so it failed every afternoon and healed each morning. Both are an
assertion sitting where the data is random; when a test fails once and passes
on re-run, find the randomness before re-running.
▎ ▸ **⛔ SEQUENCE GATE, current truth — UNCHANGED and now NARROWER:** **post =
ARMED** (founder GO s98); **page still 409s** at `POST /api/create` until his
word; bluesky = the one platform granted for live testing; the queue
consumer's key rests EMPTY. **Part A made a GO narrower, never wider**: its
blast radius is now exactly the destination it names, and absent config = off
everywhere. **Two live posts total, both bluesky, both under the grant. Zero
credits ever spent.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · GATE ON EXIT CODE ·
verify-on-main = THE gate · rules 10/11/12 · platform logins live durably in
`.context` · no AGPL embedded · wrap = verify+commit+push+restamp.
▎ ▸ **State:** main = origin (`<this wrap>`) · staging rolls s93–s102
with the next auto-deploy · **migration 0027 ships with it and is applied to
dev PG already** · four social channels connected · dev PG live · 8899 preview
+ sweeper user units keep running — NEVER hand-start the sweeper.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and pushed;
s103 boots on "gogogo" alone. **The PLAN is COORDINATION §s103** (§s102 is
what shipped) and `docs/control-arc/spec.md` is VERDICTED with part A's build
record in it — read the plan before the history.

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   verify` before any new work.

CLAUDE.md → this file → COORDINATION.md (**§s103 = the plan; §s102 = what
shipped**) → `docs/control-arc/spec.md` (**part A BUILT; B is next and owes a
SHEET**) → `docs/research/ux-refinement-program.md` (**Integrations row now
carries its research; Intel's row carries what remains**) →
`docs/research/mock-sheets/README.md` → agent_handoff/NEEDS-STEVEN.md →
`docs/research/prior-art-portal-automation-s84.md` (BEFORE ANY PORTAL WORK).
`docs/video-arc/spec.md` is a CLOSED record.

## Delta (session 102)

The session's shape was five planned phases, all of which landed — but the
thing worth carrying is what the bugs had in common. **Three of the five were
defects that every automated check agreed were fine.** A capture id resolving
to the wrong row is a counter doing exactly what counters do. A saved view
that 400s is caught by a `catch {}` written on purpose, for a good reason. A
copy button says "copied" because the code says so — it simply never waited to
find out. None of them is a mistake in the sense a lint rule understands.

That is the same lesson as s101's `xl:` breakpoint (valid, idiomatic
responsive CSS that was the whole bug) and s100's clamp measured against a
guessed maximum. Three sessions running, the highest-severity finding has been
invisible to the type checker, the linter and the suite, and visible the
moment someone ran the thing and looked at what it actually did. The wrap's
trap list now carries that as a working method, not an anecdote.

The second keeper is smaller and more actionable: **a ratchet scoped to one
surface protects one surface.** `.btn:disabled` was written up for shell
promotion at s79, and four surfaces pasted the local copy instead — each paste
reasonable, the aggregate a shell-wide defect that kept being re-found. The
note saying "this should move up" was not the ratchet. Moving it was.
