# WRAP — lane `ui-overhaul-p0` (phase 0, s71)

**Deliverable:** `docs/research/ui-overhaul-plan.md` — the re-charter document.
Committed on `agent/ui-overhaul-phase0`. Report-only as chartered: no UI code,
no repo dependencies touched (all empirical work in `~/lane-scratch/`, outside
the repo).

**Recommendation in three sentences.** Adopt Astryx as the component and token
layer in a hybrid shape: a Thalon `defineTheme` carries the brand, Tailwind v4
stays for layout through Astryx's own bridge, and the signature pieces
(HeatGrade, thermal grammar, video surfaces, charts) stay custom on Astryx
tokens. It earns this on evidence: MIT throughout (StyleX included, and not
even a consumer dependency), a **passing production build on our exact stack**
(Next 16 + Tailwind v4 + Turbopack, scratch-tested on this box), 106
components against our 6 hand-rolled primitives, per-tenant theming-as-config
that matches the product's own brand-as-data doctrine, and a CLI + hosted MCP
server that makes the design system agent-readable — the way this repo is
actually built. The honest caveats are priced in: core is beta v0.1.8 (pin +
codemods), charts are `@canary` (stay custom), and the audit shows half the
problem is discipline, not library — Supabase's own UI is shadcn-based — so
the plan pairs adoption with the benchmark systems (graded neutral ramp,
three-role type scale, labeled nav, stat-tile grammar, one-accent discipline)
and a purge of the workspace's self-narrating mono-HUD voice.

**What the audit found (live walk, every surface):** five cross-cutting
diseases — mono-eyebrow-as-scaffolding (the docs' own rule, violated
everywhere), the UI narrating its design rules at operators, jargon leakage
(UUIDs/env vars/judge codes at eye level), no interaction ramp (4 neutrals, no
hover/active/selected ladder), and dead geometry + imagery starvation (the one
thumbnail surface, Sites, instantly reads best). The workflow bones (Four
Verbs, Source-Link, bounded lists, j/k, honest states) are right and survive
as requirements on the new language.

**For the founder:** §4.6 of the plan holds 7 checkpoint questions to answer
before wave 0 — the load-bearing ones are light-vs-dark default (your named
benchmarks are all dark-first; light-first wasn't in your survival list),
theme-from-scratch vs extend, fonts (keep Geist or own a pairing), and beta
risk acceptance. Wave map: 0 foundation → 1 triage spine (dashboard/approve/
intel) → 2 making surfaces (create/calendar/videos re-conception) → 3 long
tail → 4 landing. Total 8–12 lane-sessions, checkpointed per wave.

*Lane clean: guard green, committed on branch, main untouched. The lead merges.*
