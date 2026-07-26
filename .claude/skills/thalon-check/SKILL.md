---
name: thalon-check
description: Thalon's build-and-audit checklist — the front-end interaction checks (dead doors, reversibility, discoverability, provenance, sheet fidelity) and the back-end invariant checks (tenancy, the judge gate, contract windows, honest doors, events, licensing). Use while BUILDING any surface, route, repo or engine seam, before committing; and to AUDIT anything already shipped. Invoke when writing or reviewing UI, API routes, repos, schemas or drivers.
---

# thalon-check — what to check, while building and after

> **Origin (founder, s77):** he asked for *"a robust frontend and backend skill
> to check for such things while building and for built surfaces"*, after
> finding by hand that Intel's Ready-to-create scrolled inside its own card,
> could not be un-picked, and handed off to a Generate button disabled for
> post and page. Every check below traces to a real defect this repo has
> already paid for — nothing here is generic advice.

**Two ways to run it.** Inline (this file) is the default and costs nothing:
walk the lists while you build, and again before you commit. The fan-out
version (`.claude/workflows/fe-check.js`, `be-check.js`) runs the same lenses
as parallel agents with adversarial verification — **it needs the founder's
explicit opt-in**, so use it for a whole-surface audit, not for a two-line
change.

```
Workflow({ name: "fe-check", args: { mode: "building" } })                      # the diff you're about to commit
Workflow({ name: "fe-check", args: { mode: "built", surface: "Intel",
                                     route: "/app/intel", sheet: "Intel.dc.html" } })
Workflow({ name: "be-check", args: { mode: "building" } })
Workflow({ name: "be-check", args: { mode: "built", area: "packages/engine/src/social" } })
```

---

## The rule that governs every check below

**An honest refusal is CORRECT and is never a finding.** A disabled control
that says why, a driver that refuses in the operator's own words, a stated
"not wired yet" — these are the product working as designed. The bug is the
control that *looks* live and isn't, or the success that isn't one.

---

## FRONT END — V·R·D·A·R·N, plus the one that matters most here

### DEAD DOOR (check this first)
Thalon's signature failure: a control that renders perfectly and does nothing.

- Walk **every** button, link, chip, tab, row and key binding. For each, name
  the handler or route behind it. If you cannot name it, it is dead.
- **Follow the door through.** A control that works but lands somewhere
  unusable is still a dead path — the founder's own example: Intel →
  "Create post · suggested" promotes correctly into `/app/create`, where
  `Generate` is disabled for `post` and `page`. Both halves "work"; the
  journey does not.
- Distinguish *dead* from *honestly refusing*. Disabled + a reason = fine.

### V — Visible
A state change must show at the control, not only in a banner. Watch for: a
selected control with no ring or tint; a busy state that locks the surface
without saying which action is running; **loading indistinguishable from
empty** (different facts here — a surface that conflates them lies to its
operator and to the screenshot gate).

### R — Reversible
Every change has a way back. Watch for: a selection with no path to
*unselected* where unselected is meaningful; a filter you can apply but not
clear; a destructive action with no confirm and no undo.
*Proven s77: Intel's angle picks were optional by their own comment and could
never be un-picked.*

### D — Discoverable
Interactive things must look interactive, and capabilities must be findable.
Watch for: a clickable row with no hover or cursor affordance (reads as
static, so nobody tries it); an icon-only control with no accessible label;
keyboard affordances (`j/k`, `a/r/e`, Enter) that exist but are never
announced; **a list dense enough to need sorting or filtering that offers
neither** — the founder named "filters, sort by" specifically.

### A — Attributable
The VISIBLE PROVENANCE doctrine. Watch for: a score, band or verdict with no
route to its reasons; engine-authored content not marked as such; provenance
that lives only in a mouse `title` and never in the accessible name; status
carried by colour without its word. **Every fact is a door** — a stated fact
with no way through to its evidence is a finding.

### R — Rhythm (fidelity to the sheet)
The sheet is the spec; measure rather than eyeball. Watch for: a bounded list
whose `max-height` sits **below its real content**, so a scrollbar appears
inside a card at normal density (*proven s77: `.pick-rows` bounded at 176px
holding 307px*); text clipping mid-word at realistic density; a box that
reflows as data resolves — reserve the box, then fill it.

### N — Non-breaking
Watch for: an unscoped rule in a per-surface stylesheet (**rule 6** — it
silently restyles a sibling; pinned by `surface-css-scope.test.ts`); any edit
to the READ-ONLY `workspace.css`; a shared class overridden so it flattens
another surface's legitimate override (`.thumb-sm`/`.thumb-md` are overridden
by four surfaces on purpose).

### The render gate — mandatory, never skipped
`node scripts/shoot-surface.mjs --route <route>` shoots dark and light at the
sheet's own geometry and **refuses to call a shot green until the surface is
ready**. Use `localhost`, never `127.0.0.1` — Next blocks `/_next`
cross-origin, so a healthy app paints its loading state forever while `curl`
still returns 200. Then **open the PNGs and look at them.**

---

## BACK END — the invariants

### Tenancy (one-way; never loosened)
`tenant_id` on every table, and the table named in
`packages/db/src/__tests__/tenant-id.test.ts`. Composite unique indexes lead
with `tenant_id`. Every repo `WHERE` carries `ctx.tenantId`; a foreign write
throws `NotFoundError` rather than returning empty. No module-level cache
keyed without the tenant. Routes resolve tenancy server-side, never from the
client.

### The judge gate
**No ungated draft ever reaches Approve**, and **the judge gates — it never
rewrites.** Watch for: a generation path that can emit a draft without the
shared harness (denylist + grounding to the *provided* sources); code that
mutates output to make it pass; a gate downgraded to a warning on the publish
path; a new publish/send/mint door armed by default instead of behind
explicit arming plus a founder GO.

### Contract windows
Contracts freeze per sprint. A lane needing a mid-flight contract edit is a
**re-plan**, not an ad-hoc edit. Outside a window, changes are additive-only;
migrations are `CREATE`/`ADD` only. Two traps with scars: zod 4's
`.partial()` does **not** strip `.default()` (write an explicit
`…OverridesSchema` with `.optional()`), and Postgres NULLs are distinct in
unique indexes, so a nullable column inside an idempotency key breaks
replay-appends-nothing (use a sentinel).

### Honest doors
Watch for: a route that returns a plausible success while doing nothing; a
silent truncation or cap with no log; an error swallowed into an empty list so
the caller cannot tell *none* from *failed*; **a provider refusal flattened
instead of surfaced verbatim** (*proven s77: `youtube search responded 429`
hid `quotaExceeded` vs `rateLimitExceeded` vs `keyInvalid` for ~18 hours
because the body was discarded*); a retry loop with no backoff on a metered
API.

### Provenance + events
Every state-changing repo write emits an `events` row **in the same
transaction**; reads and idempotent replays emit nothing. Event names get
pinned in the sprint's repo test. Content-addressed artifacts are immutable
and carry their provenance sibling. Anything a surface will present as fact
needs a route back to its evidence.

### Licensing + secrets
Verify a new dependency's **current** license at decision time. No AGPL
in-tree. Commercial/cert gates are recorded as launch gates with a swap path
behind a clean interface — flag, never silently block. No key, token or
credential in a tracked file, and none in a logged error.

---

## Before you commit

1. `npm run verify` — **the** gate. Write it to a file and read the file;
   **never pipe the suite through `tail`** (it hid a failure for three
   sessions). Note that `vitest` does **not** typecheck — a green suite with a
   broken build is a real outcome here, twice on record.
2. The render gate above, for anything visual.
3. Leave a ratchet **in the same change**, as high up the ladder as it goes:
   executable (test · CI check · constraint) > structural (seam · type ·
   schema) > configuration > documentary. Tag it **invariant** (safety, never
   loosened) or **opinion** (convention, freely revised).
