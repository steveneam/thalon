# Prior art — saved segments / filter predicates (s101, 2026-08-04)

**Trigger:** AGENTS.md rule 10 — the Klaviyo teardown named a segment
primitive as a charter candidate, and a predicate DSL is exactly the
"generic-named capability someone has already built" this rule exists for.
Run inline by the lead (subagent launches need fresh founder approval).

**Scope, narrowed by grounding.** The question was *"build a saved-segment
family?"*. Grounding the repo first — rule 12 — cut it in half before any
research happened:

> **The storage half is ALREADY BUILT and almost entirely unused.**
> `saved_views` (tenant · surface · name · `config` jsonb · position, with a
> unique index on tenant+surface+name) exists in `packages/db/src/schema/workspace.ts`,
> served by `apps/web/src/app/api/views/route.ts` with a client at
> `apps/web/src/lib/views/client.ts`, contracts in
> `packages/contracts/src/workspace.ts`. Built s61/s62. **It has exactly one
> caller** — `apps/web/src/components/schedule/schedule-surface.tsx`, storing a
> single density/scope preference.

So the real question is only: **how do we express, store and evaluate the
PREDICATE?** Everything else is wiring an existing table to more surfaces.

## The sweep

| Candidate | License | What it is | Verdict |
|---|---|---|---|
| **`@react-querybuilder/core` + `@react-querybuilder/drizzle`** | **MIT** (registry-verified: core 8.22.0, drizzle 8.16.2) | A JSON-serializable query model (`RuleGroupType`) with official serializers to **Drizzle ORM**, parameterized SQL, JsonLogic, Mongo, CEL and ~12 more. `core` is headless — no React at runtime; every integration is an *optional* peer dep. Drizzle peer range `>=0.38.0`; **ours is 0.45.2 ✓** | **TAKE (model + Drizzle serializer)** |
| The same project's **React UI components** (+ MUI/Bootstrap/Chakra adapters) | MIT | The drag-and-drop rule builder chrome | **REJECT — DOCTRINE 0.** Our surfaces are ported mock sheets; adopting a vendor's chrome is renovation, and the founder rejected exactly that at s72 |
| `json-logic-js` | MIT | JSON rules evaluated **in memory** | **LATER, narrow use.** Reachable *through* the same model (RQB exports to it) if we ever need to evaluate a saved predicate client-side without a round trip. Not needed for v1 |
| `sift.js` / Mongo-query-in-JS | MIT | Mongo query syntax, in-memory | **REJECT** — in-memory only; would mean loading every row before filtering, which defeats the point at Leads/events scale |
| `ts-sql-query`, `data-query`, jQuery QueryBuilder | MIT-ish | Alternative query builders / serializers | **REJECT** — each replaces or duplicates Drizzle, which is our ORM of record. RQB *complements* it |
| Hand-rolled DSL + evaluator | — | Our own AST, parser, serializer | **REJECT for the model, KEEP for the boundary** — see below |

**License posture:** every TAKE is MIT, adoptable as a real dependency. No
AGPL/SSPL candidate was adopted or read for code.

## What the research actually changes about the plan

1. **We do not design a query language.** `RuleGroupType` is the stored shape,
   it is already JSON, and it drops into the `config` jsonb column the table
   already has. No migration for the predicate itself.
2. **We do not write a SQL serializer.** `@react-querybuilder/drizzle` emits
   Drizzle where-clauses, so predicates compose with our existing tenant-scoped
   queries instead of going around them.
3. **We DO hand-write the safety boundary, and it is small.** The consensus
   across every source is the same: *never interpolate a client-supplied field
   name into SQL, even parameterized* — map client field names through a
   **hardcoded allowlist** to real columns, and map operator strings through a
   **fixed operator dictionary**. That allowlist is per-surface, it is ours, it
   is ~20 lines per surface, and it is the one part no library can supply
   because only we know which columns an operator may filter on. **This is the
   "flying car" half: the library gives us the wheel; the allowlist plus RLS
   gives us a predicate surface that is safe to accept from a browser AND
   incapable of crossing a tenant boundary.**
4. **RLS stays the backstop, not the plan.** Every serialized predicate runs
   inside an already-tenant-scoped repo call; `tenantIsolation()` on the table
   means even a defect in the allowlist cannot read another tenant's rows.

## The UI question

No source produced a clean visual record for saved-filter builders (the search
returned library docs, not product teardowns), and **Mobbin was not swept for
this — that is owed before the surface is drawn**, per the definition of done.
What the library comparison does settle: the *chrome* is ours to draw, because
we are rejecting the vendor's. The Klaviyo teardown's own §3 finding stands as
the interim steer — **the smallest thing that can be armed or filtered should
show its own state** — which argues for filter *chips* over a query box.

## Verdict summary

**TAKE+** — adopt `@react-querybuilder/core` for the model and
`@react-querybuilder/drizzle` for serialization; go further than the library by
adding the per-surface column allowlist it deliberately leaves to the caller,
and by storing predicates in the `saved_views` row that already exists.

**Founder-manual work this deletes: none was proposed** — the burden test finds
no recurring human step in this plan. The nearest thing is naming a saved view,
which is a one-time act per view and is the point of the feature.

**What is still owed before the surface is drawn:** a Mobbin sweep of
saved-filter/segment UIs (Linear · Attio · Notion · Airtable · Retool are the
obvious set).
