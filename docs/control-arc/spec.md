# The control arc — spec

**Status: DRAFT, awaiting the founder's verdict.** Nothing here is built.
Authored s101 (2026-08-04) on his directive: *"incorporate all the good
features, write a plan and spec and wiring for it."*

**Research inputs this spec answers to:**
`docs/research/klaviyo-teardown-s101.md` (the feature findings),
`docs/research/prior-art-saved-segments-s101.md` (rule 10's take-vs-build memo
for part B), and a **Mobbin sweep for all three parts, run s101 on his
directive** — *"use mobbin-mcp so you can find some examples of a high quality
UX/UI with those new features"* — recorded per part below and in the reference
library. Coverage/verdict ledger: `docs/research/ux-refinement-program.md`.

## What this arc is

Three capabilities that look unrelated and are not. Each gives the operator a
**finer grip on the same loop**, and each was found by asking what Klaviyo does
that we don't:

- **A — Arming granularity.** We arm a whole run; they arm a single message.
- **B — Saved segments.** We filter one page at a time; they store a predicate
  that re-evaluates itself forever.
- **C — Channel health.** We record that a credential connected; they record
  whether the message actually landed.

Plus **D**, a naming clarification with no runtime, folded in because it is
nearly free.

**They are independently shippable and deliberately ordered by value-per-risk.**
A is small and makes the live-post grant *safer*; B is the largest and is the
right answer to a debt we already carry; C is a real gap with no surface.

---

## The ground truth this spec was written against

Established by reading the repo BEFORE speccing (rule 12; the s87 ve4 incident
is why). **Two findings changed the plan before it was written:**

**GT-1 — the saved-views primitive is ALREADY BUILT, and nearly unused.**
`saved_views` (tenant · surface · name · `config` jsonb · position; unique on
tenant+surface+name) lives in `packages/db/src/schema/workspace.ts` with a repo
at `packages/db/src/repos/saved-views.ts`, contracts (`savedViewSchema`,
`savedViewPatchSchema`) in `packages/contracts/src/workspace.ts`, a route at
`apps/web/src/app/api/views/route.ts` and a client at
`apps/web/src/lib/views/client.ts`. Built s61/s62. **Part B is therefore an
extension, not a new family** — no new table for storage.

**GT-2 — and it has a live bug, proven this session.**
`SAVED_VIEW_SURFACES` in `packages/contracts/src/workspace.ts` is
`["leads", "calendar"]`, and the same list is a CHECK constraint on the table.
But its one caller, `apps/web/src/components/schedule/schedule-surface.tsx`,
asks for surface `"schedule"` — the name it took at the s86 Calendar→Schedule
rename. `isSavedViewSurface("schedule") === false`, so **every read and every
write 400s**, and both call sites swallow the failure by design ("Views store
unreachable: the surface keeps the sheet's own defaults" / "Best-effort").
**Schedule's density/scope preference has never once persisted, and nothing
ever said so.** Same shape as the s100 clamp and the s101 breakpoints: an
assumption that outlived its dependency, failing silently.

**GT-3 — arming is global in two separate places.**
`apps/web/src/lib/create/families.ts` gates *generation* per FAMILY as a
compile-time constant (`video` ✓, `post` ✓ since s98, `email` conditional,
`page` ✗), read by both the surfaces and `apps/web/src/app/api/create/route.ts`.
Separately, `packages/engine/src/social/queue-consumer.ts` gates *publishing*
with one boolean env var `SOCIAL_QUEUE_ARMED`, consumed via
`apps/web/src/app/api/social/queue/tick/route.ts`.

**GT-4 — the data already carries the granularity part A needs.**
`publish_queue` in `packages/db/src/schema/ops.ts` has `platform` on every row.
Per-platform arming is a change to the *decision*, not to the schema.

**GT-5 — the event log is a real substrate.** `events` in the same file is
append-only with a `bigserial` total order (`seq`), `entityType`/`entityId`,
`event`, `payload` jsonb, `actor`, and a tenant+created index. Part B's
"…never published" style predicates read it.

**GT-6 — the fan-out conflates trigger and profile context.** `FanoutRequest`
in `packages/engine/src/fanout/fanout.ts` carries `sourceId`, `platforms`,
`bucket`, `exemplar`, `targetTerms`. `bucket` routes through the profile's
routing table (what we already knew — a *conditional* split); `targetTerms`
arrives from the intel handoff (properties of the triggering capture — a
*trigger* split). Nothing names the difference.

---

## Part A — arming granularity

### The problem
`SOCIAL_QUEUE_ARMED` is one boolean for every platform and every draft. To let
one Bluesky post go out, the operator arms *everything that is due*. The
founder's own standing note — *"arming is per-run; the queue consumer's key
rests EMPTY"* — is a workaround for a gate that cannot express what he means.

### The shape
Klaviyo's per-message `draft` / `manual` / `live`, where **`manual` routes the
recipient to a Needs-Review tab instead of sending**. That is Approve, arrived
at independently. We take their *granularity*, not their vocabulary.

**An arm decision becomes a per-destination fact rather than a global boolean.**

```
armState(destination) -> "live" | "review" | "off"
  live    the consumer may publish this destination's due rows
  review  due rows are HELD and surfaced as needing the operator (our Approve)
  off     due rows are not touched and say so
```

### Wiring
- **Contract (new)**: `armStateSchema` (new) + `ARM_STATES` (new) in
  `packages/contracts/src/publish-queue.ts` — beside the queue vocabulary it
  gates, not in a new file.
- **Storage**: per-destination arm state is tenant CONFIG, not a new table.
  It rides the existing tenant profile config surface; **no migration.**
  *(Open call O-1 below: config vs a column on `tenant_credentials`.)*
- **Engine**: `packages/engine/src/social/queue-consumer.ts` — `armed?: boolean`
  becomes `armed?: (destination: string) => ArmState`, defaulting every
  destination to `off`. **The disarmed-by-default doctrine is unchanged and
  non-negotiable**: the module's own header ("it ships DISARMED, and that is
  not a configuration detail") governs, and a resolver that throws or returns
  nothing means `off`.
- **Route**: `apps/web/src/app/api/social/queue/tick/route.ts` resolves the
  per-destination state instead of reading one env var. `SOCIAL_QUEUE_ARMED=true`
  keeps working as "every connected destination is `live`" so the current live
  grant does not change meaning mid-flight.
- **Surface**: the arm state renders on each channel card in
  `apps/web/src/components/settings/integrations.tsx`, in the
  `CREDENTIAL_CARD_STATES` register from `packages/contracts/src/integrations.ts`.

### Why this is safer, not looser
Today "armed" is all-or-nothing, so testing one platform arms every platform
that happens to be due. Per-destination arming means the blast radius of a GO
is exactly the destination it named. **The sequence gate gets narrower, not
wider** — which is the only reason this is proposed before the founder asked.

### The drawn shape — Mobbin, s101
- [Mistral AI · Admin Controls](https://mobbin.com/screens/a67d96bf-8814-4126-affd-05710bb60af6) — **the structural match**: one row per service with an `Enabled` COLUMN, and the change confirmed in words by a toast ("Integration disabled successfully"). **TAKEN**: arm state is a per-row control in a column, and the flip is confirmed — we already own the toast (`apps/web/src/components/workspace/action-toast.tsx`).
- [Base44 · Integrations](https://mobbin.com/screens/53905efe-ddc0-4c0f-bcbc-2f4bc9fd46da) — a connected connector carries its **state word under its name** (`Gmail / Active`), the group head carries the count (`Connected 2`), and a capability qualifier rides beside the verb (`Connect · Read only`). **TAKEN**: `live`/`review`/`off` is a word under the destination name, never a bare coloured dot.
- [WRITER · Deploy](https://mobbin.com/screens/25b85e04-18f4-42b8-a7ee-0019fb1ed405) — a Draft toggle, and beneath it an option marked **UNAVAILABLE that names its own reason AND the control that unlocks it** ("Draft agents can not be made visible… Deploy this agent via the toggle above"). **TAKEN — this is our s81 aria-disabled grammar, drawn**: an inert control states the reason and points at its unlock.
- Three-state control: a **seg** (`live | review | off`) in the shell's own `.seg` vocabulary, not a binary toggle — a toggle cannot express `review`, and `review` is the whole point.

### Done when
A destination set to `review` holds its due rows and says so on the card; a
destination set to `live` publishes only its own; absent config = `off`
everywhere; the existing env var still means what it meant. Ratchet: a test
pinning that an unresolvable destination is `off`.

---

## Part B — saved segments

### The problem, already on the books
The s100 Intel gate recorded *"no filter, no sort and no find over 58 cards,
with only 4 visible at once"*. The tempting fix is a filter box on Intel: wrong
twice over — it is per-surface, and it is forgotten on navigation.

### The shape
A **segment is a saved predicate that re-evaluates itself**, rendered as named
view tabs on any list surface. Per the prior-art memo, the model and its SQL
serializer are TAKEN, not built.

### Wiring
- **Dependencies (new)**: `@react-querybuilder/core` (MIT, headless, no React
  at runtime) and `@react-querybuilder/drizzle` (MIT, peer `drizzle-orm >=0.38.0`;
  ours is 0.45.2). A dep add is a stop-and-report, not a lane call.
- **Storage**: the existing `saved_views` row. The predicate is a
  `RuleGroupType` stored in the `config` jsonb it already has. **No migration
  for the predicate.**
- **Contract window (REQUIRED, and it is the only migration in part B)**:
  `SAVED_VIEW_SURFACES` in `packages/contracts/src/workspace.ts` widens from
  `["leads", "calendar"]` to the real surface list, and the matching CHECK
  constraint on `saved_views` migrates with it. **This is also the fix for
  GT-2** — `"schedule"` becomes legal and Schedule's preference persists for
  the first time. `"calendar"` retires in the same window (the surface was
  archived at s95).
- **The safety boundary — ours, hand-written, per surface (new)**:
  `packages/contracts/src/segment-fields.ts` (new) — one allowlist per surface
  mapping operator-facing field names to real columns, plus a fixed operator
  dictionary. **A client field name is NEVER interpolated into SQL**, even
  parameterized; an unknown field is a 400. RLS (`tenantIsolation()` on every
  table) remains the backstop beneath it, not the plan.
- **Evaluation**: predicates compose into the existing tenant-scoped repo
  queries as Drizzle where-clauses. Event-shaped predicates ("picked but never
  published") read `events` per GT-5.
- **Surface**: a view tab strip per list surface, reading
  `apps/web/src/lib/views/client.ts`. **The chrome is ours to draw** — the
  vendor's React components are REJECTED (DOCTRINE 0; adopting a vendor's UI is
  the renovation the founder rejected at s72).

### The drawn shape — Mobbin, s101 (his directive: *"use mobbin-mcp so you can find some examples of a high quality UX/UI with those new features"*)

The pattern is close to unanimous across seven products, and it is NOT a
"segment builder surface" — it is three additions to a list a surface already has.

- [Contractbook · contracts](https://mobbin.com/screens/93115f27-5920-40c7-9197-6ba0cca45a51) — **the single closest reference.** A `Views` section in the rail (`All contracts` · `My contracts` · `+ Add a view`); a filter row of chips that **read as sentences** — `Status is equal to Rejected ⊗` · `Created on is in this week ⊗` · `Owned by me is true ⊗` · `+ Add a filter`; `Clear all` and **`Save as a new view`** at the row's end; the save is a bare Name modal whose Save button is **disabled until a name exists**; the footer counts *in this view* ("1 contract in this view"). **TAKEN whole.**
- [Twenty · companies](https://mobbin.com/screens/0d0a915c-7436-452f-95ce-d50c88820d46) — same grammar with views as TABS carrying counts (`All Companies 3`), plus `Reset` beside `Save as new view`. **TAKEN**: a view carries its count, which is our own house rule (a count belongs on the thing it counts).
- [Aboard · people](https://mobbin.com/screens/fb73ff64-0744-4e05-b744-0d231223dc61) — rail views with counts (`Active 4` · `Archived 0`) and chips in the same sentence form. **TAKEN** (confirms the two above).
- [Confluence · database](https://mobbin.com/screens/5b90695b-ac32-4dbe-a706-503f0de2a6d0) — the builder as a side panel with an **explicit editable `and ⌄` row between filters**, and — importantly — **two distinct saves: `Add as new view` vs `Save changes`**. **TAKEN both**: our predicates mix AND/OR so the conjunction must be visible and editable, and editing a saved view must not silently fork it.
- [AutoSend · apply filters](https://mobbin.com/screens/e45e734b-545d-4ab0-8096-12d1a6dee29e) — **the ANTI-PATTERN, recorded on purpose**: a modal of three naked dropdowns (Field ⌄ / Condition ⌄ / Value). It is what we would build by default and it reads as a database form, not a sentence. **REJECTED.**
- [Airtable](https://mobbin.com/screens/43c68538-9718-48ce-85b0-fc3e236641af) · [folk](https://mobbin.com/screens/9d0dac91-fa78-4cbc-92f7-411c303c63f5) — both put a **view-TYPE / display picker** in the create dialog (Table vs Pipeline; Collaborative vs Personal vs Locked). **REJECTED for us, twice over**: our surfaces each have exactly one drawn rendering, so a view changes the PREDICATE not the layout; and per-view privacy is a multi-user concept with one operator. Noted for the multi-tenant day.
- [Snowflake · query history](https://mobbin.com/screens/5f5aefdf-ec96-4616-8621-6fc7000e63d8) — filters as a toggle-list popover of available fields. **REJECTED**: it scales to dozens of columns we do not have, and it loses the sentence reading.

**The resulting shape: no new surface.** A view strip above an existing list, a
chip row under it, `+ Add a filter` opening a small popover, and `Save as a new
view` appearing only once a filter exists. That is why part B is an extension.

**Still owed before the chips are drawn:** nothing from research — the sheet
itself. This surface has no drawn sheet, and DOCTRINE 0 says the sheet comes
first (the s101 staged rebuild is the precedent).

### Done when
A named segment on one surface survives a reload, a restart and a different
browser; an unknown field is refused with its own sentence; the Intel debt row
"no filter/sort/find" closes; Schedule's preference persists.

---

## Part C — channel health

### The problem
`tenant_credentials` in `packages/db/src/schema/integrations.ts` records
`status`, `connectedAs`, `validatedAt` and `expiresAt` — **whether we can talk
to a platform, never whether what we said arrived.** Nothing in the product
would notice silent throttling, a shadowban, or an API that accepted a post and
buried it.

### The shape
Klaviyo's deliverability hub, translated. **It needs no ML** — it is recording
what the platform already tells us and what the publish path already sees.

### Wiring
- Publish outcomes already flow through `packages/engine/src/social/queue-consumer.ts`
  and land as `events` rows (GT-5). Channel health is a **read-model over
  events**, not a new write path.
- Surface: a health line per card in
  `apps/web/src/components/settings/integrations.tsx`, in the existing
  `CREDENTIAL_CARD_STATES` register.
- **Honesty rule, binding:** where we have no evidence a post landed, the card
  says exactly that. No inferred "healthy" — the Analytics reserved-box
  precedent governs.

### The drawn shape — Mobbin, s101
- [Apollo · Deliverability Suite](https://mobbin.com/screens/a1c48191-2cff-4946-9476-5873a0a5b3ef) — **the structural match, and it is honest at zero**: "Emails sent successfully **0%** — 1 Delivered · 0 Bounced", three cards (Delivery performance / Inbox interactions / Reply engagement), and a Recommendations panel reading **"Nothing to act on yet"**. **TAKEN**: the honest empty state for a health surface says nothing needs action — it does not paint a green tick over an absence.
- [Resend · Metrics](https://mobbin.com/screens/10cd4610-62f2-4872-a23b-e4404a7e448d) — `EMAILS 17` sits **immediately beside** `DELIVERABILITY RATE 100%`, and bounce/complaint are their **own tiles**, not a footnote under success. **TAKEN, and it is our standing rule drawn**: a rate never appears without its denominator (a 100% success rate over our two live posts must show the two), and a failure metric gets equal weight.
- [beehiiv · Posts Report](https://mobbin.com/screens/e4d0a793-ba8a-4756-a5d3-b14e8e9445f8) — a row of raw COUNTS above the rate gauges. **TAKEN**: counts first, rates second.
- [Deel · Slack integration](https://mobbin.com/screens/7b7a9f07-cad9-4c17-807a-d9e2df6f45ac) — a warning band on the integration itself naming a partial failure **with its count and a verb** ("Some of the Slack accounts couldn't be matched… [Match accounts]"). **TAKEN**: channel health surfaces as a band ON the card, carrying the number and the door — not a status colour.
- [Cake Equity · messages](https://mobbin.com/screens/12174b3d-e825-4f83-8661-3c28ddcb0118) — the same facts at PER-MESSAGE altitude. **TAKEN**: health lives at two altitudes — the destination card (aggregate) and the published row (per item).

### Done when
A destination that has published states its last success and its last refusal
verbatim; one that never has says so rather than reading clean; no rate renders
without the count it was computed from.

---

## Part D — trigger vs conditional split (naming only)

Per GT-6, `FanoutRequest` conflates two kinds of context. Klaviyo names them:
a **trigger split** branches on the event that started the run; a **conditional
split** branches on what you already knew. Applied here: `targetTerms` (from
the capture) is trigger-derived; `bucket` routing (from the profile) is
conditional. **Documentation + type naming only, no runtime change**, landing
in `packages/engine/src/fanout/fanout.ts` and the fan-out profiles under
`proprietary/`.

---

## Explicitly NOT in this arc

- **Predictive scores on objects** (decay on a capture, expected engagement on
  a draft) — **LATER, dependency named: D2.** We have no outcome data to fit
  on, and we have ruled twice against numbers we cannot ground.
- **Cohort benchmarks** — **REJECT today: one tenant.** Parked with its
  trigger (several real tenants).
- **A flow-builder canvas** — **REJECTED for the third time**, same reason as
  the Board s91 and the s101 staged pass: that grammar promises editable
  wiring, and our loop is linear with one human gate.

## Open calls for the founder

- **O-1 (part A):** per-destination arm state as tenant profile config (no
  migration) or as a column on `tenant_credentials` (a contract window, but the
  state then lives beside the credential it governs). **Lead's recommendation:
  config first** — it is reversible and needs no window.
- **O-2 (part B):** two new MIT dependencies. A dep add is a stop-and-report by
  standing rule, so this is his call, not a lane's.
- **O-3 (order):** the arc is written A → B → C. A is smallest and improves
  safety; B is largest and closes a recorded debt. **Lead's recommendation: A
  first**, then the Mobbin sweep that unblocks B.
