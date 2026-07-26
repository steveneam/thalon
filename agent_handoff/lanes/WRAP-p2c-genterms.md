# WRAP — lane `p2c-gen` (Phase 2c generation side, s71)

Branch `agent/p2c-genterms`, one commit, `npm run verify` green (guard + full
suite + typecheck + lint, unfiltered). No contract change was needed —
`drafts.meta` is open jsonb, exactly as the kickoff asserted.

## What shipped

**Generation now DECLARES `meta.targetTerms` on social drafts**, closing the
loop the discoverability lens (shipped, frozen) was waiting on. The lens is
opt-in by data and now the data arrives.

1. **`packages/engine/src/fanout/target-terms.ts`** (new) — the deterministic
   derivation core: `deriveTargetTerms` + `normalizeTermList` +
   `MAX_TARGET_TERMS = 6`. Exported from the engine's fanout index.
2. **`proprietary/prompts/fanout-generate.v2.md`** (new; v1 untouched for
   provenance) — v1 plus the discoverability section modeled on the founder's
   live edit (`eval/golden/discoverability-seed.jsonl` disc-002): NAME THE
   SUBJECT (canonical entity naturally in prose), STATE THE PURPOSE (what the
   subject is/for, at least once), LEAVE ROOM FOR BREADTH (a shape that can
   carry a second vendor/entity — his edit note), subject-bearing hashtag
   where the platform's policy allows, and the `targetTerms` output rule
   (3–6, first = primary entity, never stuff). `PROMPT_FILE` bumped to v2 —
   prompt version rides the generation key, so new-prompt runs never
   fast-path-collide with v1 runs.
3. **`fanoutShellOutputSchema`** gains optional `targetTerms` (Zod boundary,
   same repair-retry loop). Optional on purpose: a shell that omits it still
   drafts, and the core falls back deterministically.
4. **`FanoutRequest.targetTerms`** (new, optional) — caller-supplied
   candidates: the monitored area's intel keywords when the fan-out came from
   an intel handoff. Normalized once; shown to the shell as a TARGET TERM
   CANDIDATES prompt block; folded into the generation key (candidate-
   differing runs are different runs; candidate-less key material is
   shape-identical to before) and recorded on the run's params as provenance.
5. **`scripts/create-posts.ts`** (today's production caller) gains optional
   `CREATE_TARGET_TERMS` (comma-separated).

## Derivation rules as built

Per draft, in priority order, applied in `generatePlatformDraft`:

1. **Shell-declared canonical entities from the brief** (`[0]` = the primary
   entity — "AI" for a post about AI, the founder's catch).
2. **Caller candidates** — the intel handoff's monitored-area keywords
   (`FanoutRequest.targetTerms`).
3. **The active brand profile's `identity.topics`** (last-priority fill).

Concatenate → trim → drop blanks → dedupe case- and punctuation-insensitively
(the SAME normalization the lens applies to term matching, so "Model-Agnostic"
≡ "model agnostic" here exactly as there; first casing wins) → cap at 6.
An all-empty result **omits the meta key entirely**: term-less drafts judge
byte-identically to pre-Phase-2c ones, the lens stays opt-in by data.

Notable consequence: **tenant #0's tracked profile carries six identity
topics**, so every self-tenant draft now declares terms and gains the
advisory `discoverability` judge row (the eval dogfood-slice pin was updated
to the new honest baseline — queued/blocked stays g3_final-only, verified by
the new pipeline tests).

## Tests (all with scripted fakes, zero live model calls)

- `packages/engine/src/fanout/__tests__/target-terms.test.ts` — derivation
  unit tests (priority, dedupe, cap, empties) + fan-out integration: sensible
  meta.targetTerms; candidates → shell request + run params; no-input drafts
  carry no key; generation-key separation and idempotent replay.
- `proprietary/judge/src/__tests__/pipeline.test.ts` — NEW pipeline-level
  coverage (the lens itself untouched, its golden pair still green): a judged
  draft with terms gains the `discoverability` row (pass + warn cases); a
  warn NEVER blocks the queue; no terms ⇒ no row; malformed terms ⇒ honest
  fail row.
- Updated pins: fanout.test.ts prompt version v1→v2 (2 sites), dogfood-slice
  gate list (+discoverability).

## Blog-mirror pairing notes (Phase 2c (d) — NEXT slice, not this lane)

- The webpage/origination paths already carry `meta.seo` (B6.8) and the
  seo-lens; the social side now carries `meta.targetTerms`. A blog mirror of
  a social draft should NOT re-derive from scratch: the social draft's
  targetTerms are the subject's entities — hand them to the mirror as the
  candidate list (same `FanoutRequest.targetTerms` seam), and let the page's
  own shell declare `meta.seo` on top. The two vocabularies stay separate on
  purpose (terms = subject entities; seo = title/description/slug), so the
  pairing is a data handoff, not a schema merge.
- The waterfall path (`packages/engine/src/waterfall/` — video_transcript →
  clip_plan drafts) does NOT declare targetTerms; its meta is the STRICT
  `clipPlanDraftMetaSchema` (parsed, not open), so giving clip plans terms
  means touching that schema — a deliberate small change for a later slice,
  flagged here rather than smuggled in.
- The intel→create handoff (`CreateContext.keyword`/`areaName`, rendered as
  chips) has no server-side post-generation route yet; when Create grows one,
  it passes `keyword` (and the area's term list) straight into
  `FanoutRequest.targetTerms` — the seam is ready.

## Open / for the lead

- Nothing blocking. No contract change, no schema change, no new env.
- Two behavior deltas to know at review: (a) fan-out prompt version is now
  `fanout-generate.v2` (new generation keys — old runs replay under v1 keys
  untouched, new runs generate fresh); (b) tenant #0 drafts always carry
  targetTerms now (topics fallback), hence the dogfood gate-list pin update.
