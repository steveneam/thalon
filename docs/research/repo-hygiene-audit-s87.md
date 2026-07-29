# Repo hygiene audit — s87 (founder-directed)

> The ask, near-verbatim: lint/prune/refactor for hygiene; old workspace design
> to archives, out of code and verification; every folder/file's dependencies,
> paths and freshness; no stale or dead code; resolve the dedupe and
> two-gitignores mess; and find out why verification is slow "when some of
> [it] is not functioning in the current thalon design anymore". Then ratchet
> the hygiene so it does not rebuild (mid-audit follow-up directive).
>
> **Method: measure first, prune second, never guess** — every claim below has
> a command behind it. Standing enforcement: `tests/repo-hygiene.test.ts`
> (runs in every verify) — the founder's "system/ratchet in place" ask.

## The headline, honestly

**The repo is largely clean — the demolish-don't-renovate discipline held.**
The audit found real drift, but small: two orphaned components, three
gitignores, one doubly-superseded doc presenting as current, one unmarked
superseded sheet. And the central suspicion — *verification is slow because it
verifies retired code* — is **false**: the profile shows every heavy suite is a
CURRENT feature. Verification was slow for a mechanical reason (below), now
fixed.

## What the audit measured, and what changed

### 1. Verification speed — the real cause and the fix

Profile (`vitest --reporter=json`, full suite): 346 files, **1311s summed
test time, ~342s wall**. Top offenders were all live features —
`publish.test.ts` 45.7s, `create/run.test.ts` 32.5s, `outreach/send.test.ts`
31.1s… The pattern behind all of them: **every db-backed test booted a fresh
PGlite and replayed the full migration set** (~1.2s/test × ~150+ tests).
Nothing stale; a per-test tax.

**Fix shipped: migrate once, boot many** (`packages/db/src/client.ts`
`openTestDb` + `packages/platform/src/db-client.ts`). First call per worker
migrates one template and snapshots its datadir (`dumpDataDir` — the API the
production `dumpTo` door already trusts); every later test db boots from the
snapshot. Isolation unchanged (every test still gets its own instance);
migration correctness keeps uncached exercisers (`rls-ratchet.test.ts`,
`migrate-data.test.ts` build their own instances, plus the template build
itself). **Proof = the whole suite green, unchanged. Measured: 342s → ~279s
wall, 1328s → 1017s test time on the first run** (worker-count sensitive;
the win compounds as db-backed tests grow). Net-positive-speedups rule
satisfied: provably non-breaking, gates untouched.

### 2. Dead code — found, verified, deleted

Orphan scan (every non-framework source file checked for imports repo-wide,
multi-line-import safe): **21 candidates → 19 false positives (barrel exports,
one-ref-by-surface) → 2 confirmed dead**: `components/ui/skeleton.tsx`,
`components/workspace/error-notice.tsx`. Deleted; their bridge-burndown pins
lowered in the same change (the bridge ratchet caught the deletion — the
ratchets police each other, which is the system working).

### 3. Duplication — smaller than it feels

Content-hash scan over all tracked files >1KB: **the only non-font duplicate
in the repo is AGENTS.md ↔ CLAUDE.md, which is deliberate and documented.**
The ~1MB of duplicated fonts across `proprietary/templates/sites/*/fonts/`
is per-site self-containment BY DESIGN — deduping would couple portfolio
artifacts. Verdict: no action; both facts are now pinned in the hygiene
ratchet's allowed-pairs list.

### 4. Gitignores — three → ONE

Root + `apps/web/.gitignore` + `infra/.gitignore` merged into the root file;
the two sub-files deleted. Every pattern's semantics verified with
`git check-ignore` before commit (`.next-dev/`, `cdk.out/`, `next-env.d.ts`,
coverage, `*.pem`, tsbuildinfo…). The hygiene ratchet pins "exactly one
tracked .gitignore" forever.

### 5. Old workspace design → archives (with the two honest exceptions)

- `docs/research/mock-sheets/archive/` created (README states the policy:
  reference-only, no pass, no verdict, no gate). **`Wave 0 – Triage
  spine.dc.html` marked SUPERSEDED and moved** — zero code citations.
- **`Calendar.dc.html` deliberately NOT moved**: the live `/app/calendar`
  surface's CSS is ported 1:1 from it — the sheet is load-bearing until the
  Schedule rename rebuild, and it archives IN that change.
- **`docs/FRONTEND.md` deliberately NOT moved**: ~23 live citations (landing
  components cite it as spec; CHARTER, ADRs, schema docblocks). Its workspace
  half is now **archived in place** via a sharpened status header; the landing
  half stays live until the portfolio-end landing work. Lesson worth keeping:
  *"archive" sometimes means a status header, not a move — citations are
  load-bearing.*
- The hygiene ratchet enforces the archive contract: live code citing an
  archived sheet fails.

### 6. Freshness map (top level)

`docs/` is lean: SPINE.md current (touched 3 days ago) · DATA-SPINE (B6.7-era
audit, reference) · FEATURE-MAP + OBJECT-STORE current · FRONTEND split-doc
(above) · specs under `docs/<slug>/` covered by the spec-ground-truth ratchet.
`scripts/` (21 files): all live; `migrate-pglite-to-tenant-pg.ts` becomes an
archive candidate when the founder confirms the step-8 dump (open tail on the
deploy memory). Root `tests/` = the repo-ratchets project, all current.
`agent_handoff/lanes/` kickoffs+wraps stay — they are the ground-truth
ratchet's historical corpus. `eval/`, `.impeccable/`, `infra/` current.

### 7. Bridge burn-down — one holdout, and it converges

The legacy-token bridge map is down to **one entry**:
`components/settings/settings-panel.tsx` (7 tokens) — exactly the surface
with no sheet (workspace spec gap §5.2). The W3 Settings pass closes the gap,
burns the bridge to zero, and deletes the bridge block + its ratchet, per that
ratchet's own doctrine. No action now; the convergence is the point.

## The standing system (his follow-up directive)

`tests/repo-hygiene.test.ts` — five checks in every verify: ONE gitignore ·
no tracked junk files · **no orphan modules** (exemptions need reasons) · no
undeclared duplicate-content files · archived sheets are reference-only.
Red-checked: a planted orphan fails it; removal restores green. Runtime
~2s — cheap enough to never be skipped. Sibling ratchets it composes with:
spec-ground-truth (citations), bridge-burndown, mono, surface-CSS-scope,
tenancy/RLS, shell-inventory, events-coverage.

## Queued on founder verdicts (not silently done)

- Library/Transcription route collapse → workspace spec §5.3 verdict.
- Calendar → Schedule rename (retires + archives `Calendar.dc.html`) → his
  open call.
- Channels/Integrations/Settings split → §5.4 verdict; settings bridge burns
  with W3.
- `migrate-pglite-to-tenant-pg.ts` retirement → the step-8 dump confirm.
