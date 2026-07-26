# proprietary/ — the moat

This folder holds the **novel artifacts that make this engine defensible**, kept deliberately separate from boilerplate (auth, CRUD, UI plumbing) and from third-party-licensed code. It is the build-side IP: the one folder that is *most* this project's own work and *least* transplantable. Isolating it keeps the moat auditable ("what's ours vs. licensed-in" at a glance), protectable, and easy to carve out for any IP/licensing review.

## What lives here (as it gets built)

- **`judge/`** — the shared grounding + compliance judge harness: a general, tenant-configurable gate (denylist + grounding-to-provided-sources), with any per-tenant rules supplied as data. This one harness is reused across compliance, disclosure, voice-lint, and AI-visibility checks — build it once. It is the safety-critical stage: no draft reaches the Approve queue without passing it.
- **prompt chains** — the ideate → script/draft → per-platform fan-out prompt graph, versioned.
- **fan-out / niche profiles** — the per-tenant, per-platform profile objects (tone, denylist, char limits, disclosure string) that turn one source into many on-brand, never-overclaiming drafts.
- **tuned heuristics** — clip/highlight scoring rubrics, best-time models, and any other hand-tuned logic that is genuinely ours.
- **`templates/`** — the template-portfolio factory method: the factory meta-prompt (`templates/meta-prompt.md`) and the two-lane iteration-pass checklist (`templates/iteration-pass-checklist.md`) that every B7.2 surface and B7.4 template runs.
- **`prompts/`** — versioned prompt packs, starting with the B7.2 shot-list (`prompts/b7.2-shot-list.md`): per-slot minting prompts for Thalon's own surfaces with credit-class tags.

## What does NOT live here

- Routine plumbing (auth, database wiring, generic UI components) — those stay in their natural place in the app tree.
- Third-party or copyleft code — never embed AGPL; re-implement referenced patterns and keep the re-implementation clearly ours.
- Tenant data (brand/voice profiles, grounding sources, denylists) — that is runtime input supplied by the operator, not committed source.

## Constraint

Everything here stays **generic**: the judge harness and profiles are configurable, and any specific tenant's rules arrive at runtime as data — never baked in. (The brand-token guard that once enforced a naming ban was retired 2026-07-26 by founder call; genericness is the invariant, and it is unchanged.)

> Empty for now — this is pre-charter scaffolding. Populate as buckets are built.
