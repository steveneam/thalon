export const meta = {
  name: 'be-check',
  description: 'Thalon back-end check — parallel invariant lenses (tenancy · the judge gate · contracts + windows · honest doors · provenance + events · licensing), each finding adversarially verified before it survives. Runs WHILE BUILDING (over a diff) or over a BUILT area.',
  whenToUse: 'Before committing engine/db/API work: {mode:"building"} reviews the diff. Auditing a shipped area: {mode:"built", area:"packages/engine/src/social"}. Front-end peer: fe-check.',
  phases: [
    { title: 'Review', detail: 'Thalon-invariant lenses inspect in parallel' },
    { title: 'Verify', detail: 'adversarially refute each finding; drop the false positives' },
  ],
}

/*
 * Adapted for Thalon (s77) from a sibling project's `review-gauntlet`, at the
 * founder's direction, and kept deliberately symmetric with `fe-check`.
 *
 * The machinery is theirs and is the valuable part: parallel lenses, a
 * no-barrier pipeline so a lens's findings verify the moment it returns, and
 * adversarial verification that defaults `real:false` and tries to REFUTE —
 * which is what stops a confident-sounding review from manufacturing work.
 *
 * The LENSES are entirely Thalon's, because an invariant lens is only worth
 * anything when it names the actual invariant. Every one below traces to a
 * rule this repo already enforces or a failure it has already paid for.
 */

const _A = (typeof args === 'string')
  ? (() => { try { return JSON.parse(args) } catch { return { scope: args } } })()
  : (args || {})

const MODE = _A.mode === 'built' || (_A.area && !_A.mode) ? 'built' : 'building'
const AREA = _A.area ? String(_A.area) : null
const DIFF_SCOPE = _A.scope ? String(_A.scope)
  : 'the uncommitted working-tree changes; if the tree is clean, the latest commit (HEAD)'
const GIT = 'git'

const TARGET = MODE === 'built'
  ? `AREA: ${AREA || 'packages/'}\n` +
    `Read the area's actual code (Read/Grep). Judge what EXISTS, including what is MISSING.`
  : `CHANGE SCOPE: ${DIFF_SCOPE}.\n` +
    `Inspect the ACTUAL change with ${GIT} (\`${GIT} diff HEAD\`, \`${GIT} show <sha>\`) plus ` +
    `Read/Grep for context. Judge what this change INTRODUCES; ignore pre-existing debt it does ` +
    `not touch.`

const THALON = (
  'Thalon = a standalone, generic, MULTI-TENANT content and social-automation engine. Workspaces: ' +
  'packages/contracts (zod schemas — the frozen cross-lane contract), packages/db (drizzle schema ' +
  '+ repos), packages/engine (fan-out, judge, trend, social, render, ingest), packages/platform ' +
  '(env, object store), apps/web (Next.js App Router). The moat lives in proprietary/. Brand, ' +
  'grounding sources and the compliance denylist are per-tenant CONFIG AND DATA, never hard-coded.'
)

const LENSES = [
  {
    key: 'tenancy',
    brief:
      'MULTI-TENANT FROM TABLE ONE — the one-way safety invariant; it is never loosened. Flag: a ' +
      'new table without tenant_id, or one not added to the list in ' +
      'packages/db/src/__tests__/tenant-id.test.ts; a composite unique index that does NOT lead ' +
      'with tenant_id (structural idempotency keys are tenant-salted; transitive salting via a ' +
      'tenant-scoped uuid FK belongs in the exemption map WITH a reason); a repo query whose WHERE ' +
      'omits ctx.tenantId, or a cross-tenant write that returns empty instead of throwing ' +
      'NotFoundError; a cache/registry/module-level map keyed without the tenant; an API route that ' +
      'trusts a client-supplied tenant id instead of resolveTenantCtx.',
  },
  {
    key: 'judge-gate',
    brief:
      'NO UNGATED DRAFT EVER REACHES APPROVE (AGENTS.md rule 4) and THE JUDGE GATES — IT NEVER ' +
      'REWRITES. Flag: a generation path that can emit a draft without passing the shared judge ' +
      'harness (denylist + grounding-to-PROVIDED-sources); any code that mutates model output to ' +
      'make it pass rather than failing it; a gate whose failure is downgraded to a warning on the ' +
      'publish path; grounding checked against sources that were not the ones provided; a new ' +
      'publish/send/mint door that is armed by default rather than behind an explicit two-key or ' +
      'founder-GO arming; a refusal softened into a fake success.',
  },
  {
    key: 'contract-window',
    brief:
      'CONTRACTS FREEZE PER SPRINT; a lane needing a mid-flight contract edit is a RE-PLAN, never an ' +
      'ad-hoc edit. Flag: a change to packages/contracts or the drizzle schema from inside a lane ' +
      'while a window is frozen; a NON-ADDITIVE contract change (a renamed/removed field, a ' +
      'tightened type) outside a window; a migration that is not purely additive (anything beyond ' +
      'CREATE/ADD); a zod `.partial()` used to build a partial-override schema (zod 4 trap, pinned ' +
      'in contracts/src/__tests__/intel.test.ts — .partial() does NOT strip .default(), so unset ' +
      'values silently pin); a nullable column inside a structural idempotency key (Postgres NULLs ' +
      'are distinct, so replay-appends-nothing breaks — use a sentinel default); a registry/meta ' +
      'change that stops pre-window rows parsing (prove additivity with a test).',
  },
  {
    key: 'honest-doors',
    brief:
      'HONEST STATES ARE A FEATURE — the back-end half of the DEAD-DOOR problem. Flag: a route or ' +
      'seam that returns a plausible SUCCESS while doing nothing (the worst failure mode here); a ' +
      'silent truncation, cap or sampling with no log and no surfaced count; an error swallowed into ' +
      'an empty list so the caller cannot tell "none" from "failed"; a driver refusal flattened into ' +
      'a generic message instead of surfacing the provider\'s own words VERBATIM (proven s77: ' +
      '"youtube search responded 429" hid quotaExceeded-vs-rateLimitExceeded-vs-keyInvalid for ~18 ' +
      'hours because the body was discarded); a retry loop with no backoff on a metered API; a ' +
      'capability rendered as available when its env/vault key is absent.',
  },
  {
    key: 'provenance',
    brief:
      'EVERY STATE-CHANGING REPO WRITE EMITS AN events ROW IN THE SAME TRANSACTION; reads and ' +
      'idempotent replays emit NOTHING. Flag: a new state-changing repo door with no event, or an ' +
      'event name not pinned in the sprint\'s repo test (see the header of events-coverage.test.ts ' +
      'for where pins live); an event emitted on a read or on a no-op replay; a content-addressed ' +
      'artifact written without its provenance sibling; an AI/engine-authored value stored with no ' +
      'actor tag; a mutable overwrite of something documented as immutable (content-addressed keys ' +
      'are never rewritten); a value that a downstream surface will present as fact with no route ' +
      'back to its evidence (VISIBLE PROVENANCE).',
  },
  {
    key: 'licensing-and-secrets',
    brief:
      'LICENSE IS A HARD GATE and SECRETS NEVER LAND IN THE REPO. Verify the CURRENT license of any ' +
      'newly-used dependency at decision time — do not assume. Flag: AGPL anywhere in-tree ' +
      '(reference-only patterns must be re-implemented, never embedded); a commercial/cert-gated ' +
      'dep on the hot path without a recorded launch gate AND a swap path behind a clean interface; ' +
      'a non-MIT/Apache/CC0/public-domain addition to the hot path with no note. Secrets: a key, ' +
      'token or credential in a tracked file; a secret logged or echoed in an error; a vault ' +
      'envelope written unbound to its AAD; an env override that silently outranks tenant vault ' +
      'data with no stated precedence.',
  },
]

const FINDINGS_SCHEMA = {
  type: 'object',
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title', 'file', 'severity', 'detail', 'fix'],
        properties: {
          title: { type: 'string' },
          file: { type: 'string', description: 'file:line' },
          severity: { type: 'string', enum: ['blocker', 'high', 'medium', 'low'] },
          detail: { type: 'string', description: 'the invariant breached + the evidence' },
          fix: { type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  required: ['real', 'reason'],
  properties: {
    real: { type: 'boolean', description: 'true ONLY if the breach is concrete and survives an honest refutation' },
    reason: { type: 'string' },
  },
}

log(`be-check [${MODE}]: ${MODE === 'built' ? AREA || 'packages/' : DIFF_SCOPE}`)

phase('Review')
const reviewed = await pipeline(
  LENSES,
  (L) => agent(
    `You are the ${L.key} lens for a Thalon back-end check. ${THALON}\n\n${L.brief}\n\n${TARGET}\n\n` +
    `Return findings — an EMPTY list if nothing falls in YOUR lens. Be specific: file:line, the ` +
    `invariant breached, severity, the concrete fix. A DELIBERATE, documented refusal or an ` +
    `explicitly-disarmed door is CORRECT and is NOT a finding. Do NOT edit anything.`,
    { label: `lens:${L.key}`, phase: 'Review', schema: FINDINGS_SCHEMA },
  ),
  (review, L) => parallel(
    (((review && review.findings) || [])).map((f) => () =>
      agent(
        `Adversarially verify this ${L.key} finding — TRY TO REFUTE it. Read the actual code at ` +
        `${f.file}. Default real=false unless the breach is concrete and the code truly does it. ` +
        `Remember: a documented deliberate refusal is not a breach, and a disarmed-by-design door ` +
        `is not a bug. Finding: ${JSON.stringify(f)}`,
        { label: `verify:${L.key}`, phase: 'Verify', schema: VERDICT_SCHEMA },
      ).then((v) => ({ ...f, lens: L.key, verdict: v })),
    ),
  ),
)

const RANK = ['blocker', 'high', 'medium', 'low']
const all = reviewed.flat().filter(Boolean)
const confirmed = all
  .filter((f) => f.verdict && f.verdict.real)
  .sort((a, b) => RANK.indexOf(a.severity) - RANK.indexOf(b.severity))
log(`be-check: confirmed ${confirmed.length} / ${all.length} raw findings`)

return {
  mode: MODE,
  area: AREA,
  scope: MODE === 'building' ? DIFF_SCOPE : undefined,
  confirmed,
  dropped: all.length - confirmed.length,
}
