# Landing arc — three A+ sites, then Thalon's own landing page

> **Status: SPECCED s103, ORDER DECIDED, nothing blocking — build opens s104
> with the three sites.** Founder-directed at the s103 close. Spec of record
> for the A+ animation family and the Thalon landing page it feeds.

## The ask, verbatim

> *"i want you to plan to do more landing pages. the A+ options, i want you to
> create a new site rather than make the current landing pages (for A+) A+, so
> that we have more options. so you can make it a bit different, like the A+
> dog walking animation idea can be a Vet landing page now and etc. So plan and
> spec for that, because I want you to then take in all that knowledge and make
> a landing page for thalon. because i want to use the higgsfield credit before
> it expires since i plan to not continue it. and yes, i think using claude
> design for the initial mock actually did help the landing page have a bit
> more clarity and structure."*

## What this changes, stated plainly

Three founder decisions land here, and two of them amend standing method.

1. **The A+ family becomes NEW SITES, not upgrades.** The animation-upgrade
   family was banked as three upgrades to sites that already exist —
   `proprietary/templates/sites/wagtail-and-co` (scroll-dog),
   `proprietary/templates/sites/orchard-house` (seasons-tree) and
   `proprietary/templates/sites/stem-and-vow` (bloom video). His call: **spend
   the idea on a new vertical instead**, so the portfolio gains options rather
   than polish. The three existing sites are untouched and keep their verdicts.
2. **claude-design is RESTORED for the initial mock.** The s62 loop A/B retired
   it to OPTIONAL, concluding *"quality = PRE-PLAN DIRECTION, not the mock
   tool"* (`proprietary/templates/meta-prompt.md` §How-to step 3). He now
   reports it *"actually did help the landing page have a bit more clarity and
   structure."* **This is an amendment, not a reversal:** the mandatory pre-plan
   stays exactly as it is, and the claude-design mock comes back in FRONT of it
   for landing-page work. Both, never either.
3. **Higgsfield is being SUNSET.** He plans not to continue the subscription,
   so the balance is a **use-it-or-lose-it asset**: `584.12` credits, Plus plan,
   verified s103 (unchanged since s79 — nothing has been spent in twenty-odd
   sessions). This makes [[own-visual-engine-directive]] materially more
   urgent, and it puts a clock on every mint in this arc.

## The ORDER — DECIDED by him, s103 close

> ***"do the three sites first next session"***

**The three A+ sites lead; the Thalon landing page is the capstone.** He set
this directly rather than by the expiry date, so **the expiry question is
CLOSED as a blocker** — it was only ever asked to decide this, and he decided
it. (A date is still useful for pacing the spend and remains a nice-to-know on
his board, but nothing waits on it.)

**The one protection that survives, and matters MORE now:** the Thalon landing
page's mint budget is **ring-fenced before the first A+ mint**. With the sites
going first, an over-running fix round on site B or C is exactly how the front
door ends up unfunded. Reserve it, then spend the sites out of what remains.

**Within the session:** the sites lead. The s104 phase-0 honesty fix (~1hr, a
defect s103 introduced) rides after them, and **control-arc part B is the item
that slips** if the session fills — it has no clock, and the credit does.

## The three A+ sites

Each takes a banked animation idea and moves it one vertical sideways — near
enough that the instrument still makes sense, far enough to be a genuinely new
option. His example sets the pattern; the other two are my recommendation under
*"and etc."* and each is a one-word overrule.

| # | The banked idea | Its current home | **The new vertical** | Why it carries |
|---|---|---|---|---|
| A | **scroll-dog** — a dog that walks as you scroll | wagtail-and-co (dog walking) | **Veterinary practice** (his call) | The same walk cycle, but the scroll now carries a *care* story rather than a service list — and a vet is a higher-trust, higher-value vertical than a walker, so the archetype shifts older/calmer per meta-prompt §casting (7) |
| B | **seasons-tree** — one tree through four seasons on scroll | orchard-house (orchard) | **Garden & landscape design studio** | The instrument *is* the pitch: a garden designer sells what a space becomes over a year, which is precisely what the scrubbed tree shows. Orchard sold fruit; this sells time |
| C | **bloom video** — scroll-scrubbed bloom transition (Seedance, ~17.5cr) | stem-and-vow (florist) | **Botanical perfumery** | Bloom → scent is the oldest move in fragrance, and it rescues the idea from being "a florist again." Also the strongest case for the exceptional-palette axis, which the wave-4 anchors already wanted |

**Naming, casting and the house style are NOT re-derived here** — they come
from `proprietary/templates/meta-prompt.md` and the standing doctrines already
ratcheted into it (§casting archetypes-per-vertical, nature-vs-dread,
printable-surface, reference-guided minting). Read it before the first mint;
that is the standing rule and this arc does not get an exception.

## Method, per site — the loop as amended

1. **claude-design initial mock** *(restored, decision 2)*. Structure and
   clarity first, before any prose or asset thinking.
2. **PREPLAN.md**, mandatory and unchanged — the artifact class introduced at
   s62 and the reason quality moved. Precedent to copy:
   `proprietary/templates/sites/ridge-and-valley/PREPLAN.md`.
3. **Code-direct build** into `proprietary/templates/sites/<slug>/` *(new per
   site)*, matching the anatomy every existing site already has: `index.html`,
   `site.json`, `assets/`, `fonts/`, `guide/`, `PREPLAN.md`.
4. **Mint against the plan**, reference-guided (standing doctrine s64): a
   reference must ALREADY look like the target, never watermarked, fed as
   generation input. `get_cost` preflight, and **any single mint ≥40cr pings
   him first** — standing rule, unchanged by the sunset.
5. **The animation is the point.** Each of these three sites exists for its
   instrument; a site that lands with a beautiful hero and a dead scroll has
   missed the assignment.
6. **`/guide` honesty page**, enforced — fictional business and AI-generated
   imagery both disclosed. Ratchet: `tests/template-portfolio.test.ts`.
7. **Fix round.** Every site in the portfolio's history has had one. Budget for
   it up front rather than discovering it at zero credits.

## Then: the Thalon landing page

The capstone, and the reason the other three come first.

**It is not a portfolio site and must not be built as one.** The portfolio
sites sell fictional businesses to imagined customers; this one sells Thalon,
to people who will actually land on it. Two constraints the portfolio does not
carry:

- **Stealth is still live and still his call.** `thalon.org` is unwired
  deliberately (CT-log exposure), and the hostname posture has not changed.
  Building the page does not publish it — **landing where it is served, and
  under what name, is a separate founder decision** and this spec does not
  presume it.
- **It must be honest about what Thalon does today**, which is the same rule
  every surface in this repo carries. No claimed capability that the engine
  does not have.

**What it inherits from the three sites:** the strongest instrument of the
three becomes the landing page's scroll spine. Which one that is cannot be
decided here — it is decided by building them, which is exactly the founder's
stated reason for this order.

**Budget: ring-fenced.** The landing page's mint allowance is reserved before
the first A+ mint, so a fix round on site B can never eat the front door.

## Budget — 584.12 credits, and the shape of the spend

Estimates, not commitments; `get_cost` preflight governs every actual mint.

| Line | Estimate | Note |
|---|---|---|
| Site A (vet) — stills + scroll instrument | ~60cr | stills historically ~0.72cr first-take; the instrument is the cost |
| Site B (garden design) — stills + seasons scrub | ~60cr | |
| Site C (perfumery) — stills + **bloom video** | ~90cr | the Seedance video (~17.5cr) plus variants; the most expensive of the three |
| Fix rounds ×3 | ~90cr | every site has had one; budgeting it is not pessimism |
| **Thalon landing — RING-FENCED** | **~180cr** | reserved first, spent last |
| Unallocated reserve | ~100cr | the sunset means unspent credit is lost, so the reserve is a floor to spend down, not to protect |

**The sunset changes the disposal rule:** normally unspent credit is saved.
Here it evaporates, so any reserve left when the arc completes should be spent
on **variant coverage for the Thalon landing** (aspect recuts, alternate heroes)
rather than banked.

## Ground truth — exact dependencies

Existing, cited verbatim:

- `proprietary/templates/meta-prompt.md` — the factory prompt, casting
  doctrines, mint rules, §How-to step 3 (the claude-design line this amends)
- `proprietary/templates/sites/wagtail-and-co` · `.../orchard-house` ·
  `.../stem-and-vow` — the three A+ ideas' current homes, **untouched by this arc**
- `proprietary/templates/sites/ridge-and-valley/PREPLAN.md` — the PREPLAN precedent
- `tests/template-portfolio.test.ts` — the portfolio ratchets (structural
  completeness, self-containment/no external hosts, asset manifest, `/guide` honesty)
- `docs/proposals/2026-07-11-visual-uplift-and-template-portfolio.md` — the arc's original proposal

Planned by this spec:

- `proprietary/templates/sites/<vet-slug>/` *(new)*
- `proprietary/templates/sites/<garden-slug>/` *(new)*
- `proprietary/templates/sites/<perfumery-slug>/` *(new)*
- the Thalon landing page's home *(planned — the repo already serves a landing
  at `/`; whether this replaces it or is built beside it is decided at build
  time, and the existing landing keeps its own register either way)*

## Done when

Three new portfolio sites exist, each carrying a working scroll instrument
rather than a still hero, each verdicted through the same loop every other site
went through; and Thalon has a landing page built by someone who had just built
those three. The credit is spent rather than forfeited, and nothing about the
stealth posture changed without him saying so.

## Open calls — his, and each is one line

1. ~~The expiry date.~~ **CLOSED — he set the order directly** (*"do the three
   sites first next session"*), which is all the date was ever needed for. A
   date would still help pace the spend; nothing waits on it.
2. **The two verticals I chose** — garden design for the seasons-tree,
   botanical perfumery for the bloom. His *"and etc."* delegated these; both
   are one word to overrule and cheap to change before a mint.
3. **Where the Thalon landing is served, and under what name.** Stealth is
   unchanged and this is his call — building it does not decide it.
