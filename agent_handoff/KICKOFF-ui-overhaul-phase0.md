# KICKOFF — lane `ui-overhaul-p0` (workspace UI/UX overhaul, phase 0, s70b)

You are a Mode B RESEARCH lane in a git worktree on branch
`agent/ui-overhaul-phase0`. Read `CLAUDE.md` (repo root) first — every rule
binds you (grep guard, no AI attribution). Launch approval: founder, s70b.

**Step 0 — model check:** design-direction work is authored by the strongest
tier only (standing founder rule). If you are not running as Fable 5
(`claude-fable-5`), STOP and write that as your only wrap line.

## The founder's verdict (verbatim intent — this is the brief)

The current workspace UI/UX "is not working for me, i dont get the flow and
interactions." Spacing, colouring, font, and guiding are "not right" across
EVERY surface (features, video editor, calendar, create, alerts, approve).
It "doesnt look world class or modern saas (like supabase, vercel)". Thalon
was built on shadcn and "honestly does not look good" — **consider switching
to Meta's Astryx** (github.com/facebook/astryx — Meta's open-sourced design
system: 150+ accessible components, brand-level theming, dark mode,
templates, CLI + MCP server, StyleX underneath). Directive: **overhaul
completely**.

## Mission — produce the plan, build NOTHING

Phase 0 is report-only. Deliverable = `docs/research/ui-overhaul-plan.md`
(tracked, guard-clean), committed on your branch. The founder re-charters on
that document before any rebuild wave starts. No UI code changes, no
dependency changes to the repo, no edits outside `docs/` and your wrap file.

### 1. Astryx evaluation (the founder's named candidate — verify, don't assume)
- What it actually ships: component coverage vs our surfaces (boards,
  calendar, editors, queues, forms, command palette, toasts, charts?),
  theming/brand-token story, dark mode, density, accessibility, the CLI and
  MCP server (agent-readability is a real fit signal for THIS repo's
  workflow), templates.
- **License** (hygiene rule: MIT/Apache preferred; anything else = flagged
  with a swap path) — check Astryx AND StyleX AND any transitive gates.
- **Stack fit — be ruthless here:** Next.js App Router + RSC compatibility,
  Turbopack + the StyleX compiler (build-plugin story), Tailwind v4
  coexistence during migration, bundle impact, SSR/theming flashes.
  Evaluate in a SCRATCH project OUTSIDE the repo (e.g. ~/lane-scratch/) —
  NEVER `npm install` inside the worktree (preinstall guard will refuse).
- Migration shape: shadcn primitive → Astryx component map for what we
  actually use (badge/button/card/skeleton + the hand-rolled surfaces);
  what has no Astryx analog and stays custom.

### 2. Benchmark teardown (what "world class" concretely means)
Supabase dashboard, Vercel dashboard, Geist design system, Linear if useful
— headless chrome is available locally for public pages (look-and-learn
only; never download assets into the pipeline). Extract the SYSTEMS, not
screenshots: spacing scale + density rhythm, type scale/weights/mono usage,
color architecture (neutrals ramp, accent discipline, dark-mode strategy),
navigation & wayfinding patterns, empty/loading/error state language,
motion. Also note what the swordfish workstation on this box does that
reads better (the founder says it does — their repo's provisioning/docs may
reveal their UI stack; ask nothing of them, just read).

### 3. Honest audit of the current workspace against that bar
Surface by surface (dashboard/spine, intel, create, video editor, calendar,
approve, boards, library, runs, settings/integrations): name the specific
failures — spacing/density, type, color, guidance/flow ("i dont get the
flow"), interaction cost. The incumbent system is documented in `DESIGN.md`
+ `PRODUCT.md` + `docs/research/workspace-ux-v2.md` — read them as the
thing being judged, not as constraints.

### 4. The plan (the founder's re-charter document)
- Recommendation with a spine: Astryx adoption / hybrid / token-level
  redesign on current stack — argued from the evidence, with license and
  stack-fit verdicts stated plainly. If Astryx loses, say so and to what.
- Rebuild strategy: wave map (which surfaces first), the token/theme
  foundation step, coexistence plan (two systems during migration), test
  impact (list-grammar conformance tests, impeccable hook), effort ranges.
- What SURVIVES the overhaul (founder taste signals that still hold unless
  he revokes them): warm/organic mark, deliberate asymmetry, honest states,
  the Four-Verbs rule, Source-Link rule, Bounded-List rule, amber=signal
  channel discipline. The visual LANGUAGE is what's being replaced.
- The checkpoint questions the founder must answer before wave 1.

## Wrap

`agent_handoff/WRAP-ui-overhaul-phase0.md`: one-page summary + pointer to
the plan doc + your recommendation in three sentences. Guard + commit on
your branch; the lead merges. Do NOT push to main.
