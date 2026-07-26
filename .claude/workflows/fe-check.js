export const meta = {
  name: 'fe-check',
  description: 'Thalon front-end check — jobs-to-be-done walkthrough, the V·R·D·A·R·N interaction lenses plus a DEAD-DOOR lens, each finding adversarially verified, then a rendered-vs-sheet gate. Runs WHILE BUILDING (over a diff) or over a BUILT surface.',
  whenToUse: 'Before committing FE work: {mode:"building"} reviews the diff. Auditing shipped UI: {mode:"built", surface:"Intel", route:"/app/intel", sheet:"Intel.dc.html"}. Backend peer: be-check.',
  phases: [
    { title: 'Tasks', detail: 'G1 — jobs-to-be-done walkthrough; which JTBD have a working affordance vs a gap' },
    { title: 'Review', detail: 'V·R·D·A·R·N + DEAD-DOOR lenses inspect the surface in parallel' },
    { title: 'Verify', detail: 'adversarially refute each finding; drop the false positives' },
    { title: 'Render', detail: 'G2 — shoot the surface against its sheet, both themes' },
  ],
}

/*
 * Adapted for Thalon (s77) from a sibling project's `fe-review` workflow, at
 * the founder's direction. What was kept, and what had to change:
 *
 *  KEPT — the machinery, which is the valuable part: review→verify as a
 *  PIPELINE with no barrier (a lens's findings verify the moment that lens
 *  returns), adversarial verification that defaults `real:false` and tries to
 *  REFUTE (this is what stops a plausible-sounding audit from inventing
 *  work), the G1 jobs-to-be-done walkthrough (the only gate that finds
 *  MISSING affordances — no audit of existing code can), and a mandatory
 *  rendered gate that is never silently skipped.
 *
 *  CHANGED — the scope model, and this is the structural one. Theirs reviews
 *  a DIFF before commit. The founder is asking for the opposite: a walk over
 *  SHIPPED surfaces ("each page, section, feature, and buttons"), where the
 *  code is not changing and the question is whether what exists actually
 *  works. So the unit is a SURFACE (route + sheet), every lens reads the
 *  live surface rather than `git diff`, and G2 diffs against the surface's
 *  mock sheet instead of eyeballing a container width.
 *
 *  ADDED — the DEAD-DOOR lens. Thalon's own worst failure mode is not an
 *  ugly control; it is a control that renders perfectly and does nothing,
 *  because the repo has an honest-refusal vocabulary ("isn't wired yet") and
 *  it is easy for a surface to look finished while its door is unarmed. The
 *  founder found exactly this: Intel's Ready-to-create promotes correctly
 *  into Create, where Generate is disabled for post and page. A generic FE
 *  lens does not look for that; this one does.
 *
 *  DROPPED — their provenance/omics grounding, their --stage-* token names,
 *  and the license lens (Thalon's licensing rule is real but belongs to a
 *  dependency review, not a surface walk).
 */

const _A = (typeof args === 'string')
  ? (() => { try { return JSON.parse(args) } catch { return { surface: args } } })()
  : (args || {})

/*
 * TWO MODES, one lens set — the founder's requirement: "check for such things
 * WHILE BUILDING and for BUILT surfaces".
 *
 *   building : the unit is a DIFF. Lenses read `git diff HEAD` (or a named
 *              scope) and judge what the change introduces. This is the
 *              pre-commit gate.
 *   built    : the unit is a SURFACE. Lenses read the surface's live code and
 *              judge what EXISTS, including what is missing. This is the audit.
 *
 * The lenses are identical in both modes and that is deliberate: a check worth
 * blocking a commit on is worth finding in shipped code, and one vocabulary
 * means a finding reads the same whenever it surfaces.
 */
const MODE = _A.mode === 'built' || (_A.surface && !_A.mode) ? 'built' : 'building'
const SURFACE = _A.surface ? String(_A.surface) : null
const ROUTE = _A.route ? String(_A.route) : null
const SHEET = _A.sheet ? String(_A.sheet) : null
const DIFF_SCOPE = _A.scope ? String(_A.scope)
  : 'the uncommitted working-tree changes; if the tree is clean, the latest commit (HEAD)'
const GIT = 'git'

/** What every lens is pointed at, phrased for the mode. */
const TARGET = MODE === 'built'
  ? `SURFACE: ${SURFACE || 'the workspace shell'} · route ${ROUTE || '/app'}` +
    `${SHEET ? ` · sheet docs/research/mock-sheets/${SHEET}` : ''}.\n` +
    `Read the surface's components and route (Read/Grep under apps/web/src) and the sheet if named. ` +
    `Judge what EXISTS, including what is MISSING.`
  : `CHANGE SCOPE: ${DIFF_SCOPE}.\n` +
    `Inspect the ACTUAL change with ${GIT} (\`${GIT} diff HEAD\`, \`${GIT} show <sha>\`) plus ` +
    `Read/Grep for context. Judge what this change INTRODUCES; ignore pre-existing debt it does ` +
    `not touch.`

/** Shared grounding — specific to THIS system, never generic FE advice. */
const THALON = (
  'Thalon = a multi-tenant content + social-automation workspace. Next.js (App Router) + React, ' +
  'DESKTOP workspace, dark by default with a light toggle. THE SPEC IS THE MOCK SHEET: ' +
  'docs/research/mock-sheets/*.dc.html + theme.css, and DOCTRINE 0 says the sheet is ported 1:1 — ' +
  'the sheet wins every appearance call. Shared shell classes (.card, .row, .pill*, .btn*, ' +
  '.thumb-sm/.thumb-md, .excerpt, the type roles) live in apps/web/src/app/app/workspace.css and ' +
  'are READ-ONLY; every per-surface stylesheet is scoped under its own `.<name>-surface` root ' +
  '(README rule 6, pinned by surface-css-scope.test.ts) because the sheets reuse class names with ' +
  'different values across surfaces. Token grammar: --n-100..--n-1000 neutral ramp, --heat-* ' +
  'thermal words, --act accent; --color-brand-hi/lo is THE MARK ONLY (never status, never ' +
  'interactive). Colour is never the only channel — the thermal band always carries its WORD. ' +
  'Doctrines that bind the UI: media-first · EVERY FACT IS A DOOR (a stated fact should be ' +
  'clickable to its evidence) · brand is not status · VISIBLE PROVENANCE, and "the judge gates — ' +
  'it never rewrites". Honest states are a FEATURE: an unarmed door must say so rather than ' +
  'pretend, and "empty" and "broken" are different facts that must never look alike.'
)

const LENSES = [
  {
    key: 'DEAD-DOOR',
    brief:
      'DEAD DOOR — Thalon\'s signature failure: a control that renders perfectly and does nothing. ' +
      'Walk EVERY button, link, chip, tab, row and keyboard affordance on this surface and classify ' +
      'each: (a) works; (b) honestly refuses — disabled/aria-disabled WITH a title or adjacent copy ' +
      'saying why (this is CORRECT and is not a finding); (c) DEAD — it looks live but no handler, ' +
      'no route, or a handler that silently no-ops. Also flag a door that works but leads somewhere ' +
      'dead: the founder\'s own example is Intel → "Create post · suggested", which promotes ' +
      'correctly into /app/create where Generate is DISABLED for post and page, so the product\'s ' +
      'most natural path dead-ends. Grep for the route or handler behind each control and say which ' +
      'exists. An honest refusal is not a bug; an unlabelled dead control is.',
  },
  {
    key: 'V-visible',
    brief:
      'VISIBLE. Every state change must have a cue AT the control, not only in a banner. Flag: a ' +
      'selected/changed control with no ring, tint or mark; a busy action that locks the surface ' +
      'with no indication which action is running; a loading state indistinguishable from empty ' +
      '(these are different facts here — a surface that cannot tell them apart lies to its ' +
      'operator and to every gate).',
  },
  {
    key: 'R-reversible',
    brief:
      'REVERSIBLE. The operator can undo every change. Flag: a selection with no path back to ' +
      'unselected where unselected is a MEANINGFUL state; a filter or chip that can be applied but ' +
      'not cleared; a destructive action with no confirm or no undo. (Proven live, s77: Intel\'s ' +
      'angle picks were optional by their own comment yet could never be un-picked once chosen — ' +
      'this exact lens would have caught it.)',
  },
  {
    key: 'D-discoverable',
    brief:
      'DISCOVERABLE. Interactive things must LOOK interactive, and the surface\'s own capabilities ' +
      'must be findable. Flag: a clickable row/header with no hover state and no cursor affordance ' +
      '(reads as static, so operators never try it); an icon-only control with no accessible label ' +
      'or tooltip; a keyboard affordance (j/k, a/r/e, Enter) that exists but is never announced; ' +
      'MISSING sort/filter controls on a list dense enough to need them — the founder named ' +
      '"filters, sort by" specifically, so a long list with no way to narrow it IS a finding.',
  },
  {
    key: 'A-attributable',
    brief:
      'ATTRIBUTABLE (the VISIBLE PROVENANCE doctrine). A shown fact must say where it came from, ' +
      'and never by colour alone. Flag: a score, band or judge verdict with no route to its ' +
      'reasons; AI/engine-authored content not marked as such; provenance that lives only in a ' +
      'mouse `title` and never in the accessible name; any status carried by colour without its ' +
      'word. Also: "every fact is a door" — a stated fact with no way through to its evidence.',
  },
  {
    key: 'R-rhythm',
    brief:
      'RHYTHM / fidelity to the sheet. Flag: a rect that visibly departs from the sheet (measure, ' +
      'do not eyeball); a bounded list whose max-height is BELOW its real content so a scrollbar ' +
      'appears inside a card at normal density (proven live, s77: Intel .pick-rows bounded at 176px ' +
      'while holding 307px); text clipping mid-word at realistic density; a fixed box that reflows ' +
      'as data resolves. Reserve the box, then fill it.',
  },
  {
    key: 'N-nonbreaking',
    brief:
      'NON-BREAKING. A surface must not regress a neighbour. Flag: an unscoped rule in a ' +
      'per-surface stylesheet (rule 6 — it silently restyles a sibling); an edit to the READ-ONLY ' +
      'workspace.css; a shared class overridden in a way that flattens another surface\'s ' +
      'legitimate override; a control added into a fixed-width region that crowds its neighbour.',
  },
]

const JTBD_SCHEMA = {
  type: 'object',
  required: ['tasks'],
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['task', 'affordance', 'status'],
        properties: {
          task: { type: 'string', description: 'a concrete job the operator came to this surface to do' },
          affordance: { type: 'string', description: 'the control that serves it, or "—" if none' },
          status: { type: 'string', enum: ['present', 'dead', 'gap'], description: 'present = works; dead = the control exists but does not work; gap = no control at all' },
          note: { type: 'string' },
        },
      },
    },
  },
}

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
          detail: { type: 'string', description: 'the check breached + the evidence' },
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
    real: { type: 'boolean', description: 'true ONLY if concrete and it survives an honest refutation' },
    reason: { type: 'string' },
  },
}

const RENDER_SCHEMA = {
  type: 'object',
  required: ['shot', 'matches_sheet', 'notes'],
  properties: {
    shot: { type: 'boolean', description: 'did scripts/shoot-surface.mjs succeed' },
    matches_sheet: { type: 'boolean' },
    notes: { type: 'array', items: { type: 'string' } },
    gate_note: { type: 'string', description: 'when not shot, exactly what the main loop must verify inline' },
  },
}

log(`fe-check [${MODE}]: ${MODE === 'built' ? `${SURFACE || 'shell'} ${ROUTE || '/app'}` : DIFF_SCOPE}`)

// G1 — the only gate that finds MISSING affordances. No audit of existing code can.
phase('Tasks')
const jtbd = await agent(
  `You are the jobs-to-be-done lens for a Thalon front-end check. ${THALON}\n\n${TARGET}\n\n` +
  `Enumerate the concrete jobs an operator comes to this surface to do (in building mode: the jobs ` +
  `the touched surfaces serve). For each, name the control that serves it and mark it: present ` +
  `(works), dead (the control exists but does nothing useful), or gap (no control at all — e.g. no ` +
  `way to sort or filter a long list). Prioritise GAPS and DEAD controls; finding what SHOULD exist ` +
  `but doesn't is the entire point of this gate, and no audit of existing code can do it. Verify ` +
  `every claim against the code — do NOT edit anything.`,
  { label: 'jtbd', phase: 'Tasks', schema: JTBD_SCHEMA },
)
const tasks = (jtbd && jtbd.tasks) || []
const broken = tasks.filter((t) => t.status !== 'present')
log(`G1: ${broken.length} dead-or-missing of ${tasks.length} operator tasks`)

phase('Review')
const reviewed = await pipeline(
  LENSES,
  (L) => agent(
    `You are the ${L.key} lens for a Thalon front-end check. ${THALON}\n\n${L.brief}\n\n${TARGET}\n\n` +
    `Return findings — an EMPTY list if nothing falls in YOUR lens. Be specific: file:line, the ` +
    `check breached, severity, the concrete fix. An HONEST refusal (a disabled control that says ` +
    `why) is CORRECT and is NOT a finding. Do NOT edit anything.`,
    { label: `lens:${L.key}`, phase: 'Review', schema: FINDINGS_SCHEMA },
  ),
  (review, L) => parallel(
    (((review && review.findings) || [])).map((f) => () =>
      agent(
        `Adversarially verify this ${L.key} finding — TRY TO REFUTE it. Read the actual code at ` +
        `${f.file}. Default real=false unless the problem is concrete and the code truly does it. ` +
        `Remember: an honest refusal is not a bug, and a deliberate sheet-faithful choice is not a ` +
        `bug. Finding: ${JSON.stringify(f)}`,
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
log(`lenses: confirmed ${confirmed.length} / ${all.length} raw findings`)

// G2 — Thalon already owns a better render gate than an ad-hoc screenshot: shoot-surface.mjs
// parses the viewport from the sheet's own theme.css and REFUSES to call a shot green until the
// surface is actually ready (it is what caught the 127.0.0.1 bug in s76).
phase('Render')
const render = await agent(
  `You are the rendered-vs-sheet gate for a Thalon surface audit. ${THALON}\n\n` +
  `${MODE === 'built' ? `SURFACE: ${SURFACE} · route ${ROUTE}${SHEET ? ` · sheet ${SHEET}` : ''}` : `CHANGE SCOPE: ${DIFF_SCOPE} — first identify which routes the change actually touches`}.\n` +
  `The dev server should be up on 3111 — check with ` +
  `\`curl -s -o /dev/null -w "%{http_code}" http://localhost:3111<route>\`. Use LOCALHOST, never ` +
  `127.0.0.1: Next blocks /_next cross-origin, so a healthy app paints its loading state forever ` +
  `while curl still returns 200. If reachable, run ` +
  `\`node scripts/shoot-surface.mjs --route <route>\` from the repo root (it shoots dark AND light ` +
  `at the sheet's own geometry and refuses a not-ready surface), then READ the PNGs it writes and ` +
  `compare against the sheet. Report concrete departures: wrong rect, clipped text, a scrollbar ` +
  `inside a card, a state that renders as a browser default. If the server is unreachable, set ` +
  `shot=false and return gate_note naming exactly what must be verified inline — this gate is ` +
  `mandatory and is never silently skipped. Do NOT edit anything.`,
  { label: 'render-gate', phase: 'Render', schema: RENDER_SCHEMA },
)

return {
  mode: MODE,
  surface: SURFACE,
  route: ROUTE,
  scope: MODE === 'building' ? DIFF_SCOPE : undefined,
  jtbd: tasks,
  dead_or_missing: broken,
  confirmed,
  dropped: all.length - confirmed.length,
  render,
}
