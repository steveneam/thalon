# CURRENT

## Stamp

2026-08-02 (session 93, syd4 — **zero credit spend, zero posts, zero founder
hands**). Two founder directives ran this session: **the Mobbin re-check pass
over all six built surfaces** ("ensure the surfaces that you made are indeed
world class design") and **the stamped s93 plan** ("continue with the plan you
had for this session too") — the B-create.4 remainder shipped: **Create home
rebuilt to the s90b ask-card sheet + the wizard built at `/app/create/guided`,
both exact-mock, lead-direct.** Plus his staging ask answered: **preview
reachable, carrying the s92 code.** Verify on main at the wrap: **exit 0,
3251 passed / 9 skipped (+24 over s92), 0 lint errors** — the literal
`npm run verify`, single-lane, dev server stopped first.

## WHAT SHIPPED

**MOBBIN RE-CHECK (`7a8ba72`; record = `ux-refinement-program.md` §s93
re-check):** 24 fresh references against the LIVE renders (dark+light, real
dev data). Dashboard/Board/Approve/Runs/Analytics **validated** — rejects
recorded (greeting personas · selection-bulk · duration-trend-on-n=2 ·
Dub/Ghost's real-reading zeros = the rule-5 anti-pattern shipped at scale).
**Two live defects found and fixed with test rows:** raw-hour ages
("oldest has waited 380h" hid sixteen days) → shared `waitLabel()` rolls to
days at 48h, the recorded 26h-not-1d decision preserved below it (dashboard
tile · board cards · week-card wait lane); Approve's scope-note singular
("1 staged draft advance**s** through **its** own flow"). Composer's populated
state stays honestly uncheckable behind the first-real-run gate.

**CREATE HOME REBUILT (`cf5a0c0`):** `/app/create` = the s90b ask-card
exact-mock — headline question · ONE centered 740px ask-card (family seg ·
pick-chip · Start guided · Generate in its own bottom row) · run-line of REAL
facts (profile platforms + version · every gate on · the family's true word)
whose expanded state = the kept s90a plan card (s74 keeper shape) · sugg chips
= REAL Intel picks through the existing `?ctx=` spine (empty/failed reads say
so) · recent-line = the feed's newest run with its Composer door. Old
prompt-hero/two-card layout DELETED. Probed: headline at 172 · recent-line
bottom 916 ≤ 940 (the sheet's own measure). 26 tests, every honesty pin
carried (unread≠empty · doors only where they exist).

**CREATE WIZARD BUILT (same commit):** `/app/create/guided` = the s90b-amended
sheet exact-mock — accordion slots (What → Platforms → Sources & media →
Review plan), brief TUCKED behind its line. **Platform chips carry
`deriveCreatePlan`'s OWN verdicts** via new pure **`POST /api/create/plan`**
(R3 refusals-before-spend; live render: TikTok "connect to publish", verbatim
refusal on the title). Review = the derived plan (refusals verbatim · real
judge gates g1/g3_screen/g3_final · cost honesty incl. `unestimated` words).
**Generate → new `POST /api/create` → `runCreate`** — the founder's sequence
gate enforced SERVER-side (`lib/create/families.ts` read at the route;
executable ratchet `api/create/route.test.ts` pins post/page → 409 verbatim);
success doors to `/app/create/run/[runId]`. **Media dialog = STATED deferral**
(lands with the media pass) — a fact line, never a dead button. 13 surface
tests + 4 route-gate tests.

**STAGING (his ask):** `preview.swordfish.cfd` — 401 without edge auth (the
stealth posture working), 200 with it on landing + `/app` + approve +
analytics; **auto-deploy has staging on s92 code** (`/app/board` 404s as
deleted, board toggle + Composer routes serve). The s93 builds roll with the
next deploy. No swordfish coordination was needed.

## Resume prompt (session 94, syd4)

**Resume · Thalon** — s93 ran the Mobbin re-check (2 fixes, 4 surfaces
validated) and shipped the Create home + wizard rebuilds. **Nothing awaits a
verdict.** s94 is a build session:

1. **Sites + Library rebuilds, lead-direct** (the `/app/transcription`
   retirement rides Library's) — sheets W2-VERDICTED s91; existing surfaces
   `components/sites/` + `components/transcription/` replace per DOCTRINE 0.
2. **B-create.5 dogfood stays the gate** for every populated state (Composer ·
   Runs create-parent grammar · Analytics bands · the wizard's real run) — a
   real Create run, bluesky test grant; never seed fake runs to screenshot.
3. **Composer follow-ons stay gated:** popout = pass 3 · media tools = media
   pass (the wizard's Select-media line arms then too) · first-comment = queue
   settings seat · G1 = D2.

**Read first:** CLAUDE.md → this file → COORDINATION §s93 →
`docs/research/ux-refinement-program.md` (§s93 re-check + rows 5/6) →
`docs/create-engine/spec.md` §Routes → runway §9.

0. **Self-check** — tmux `thalon` · `pg_isready` · both user units (needs
   `XDG_RUNTIME_DIR=/run/user/$(id -u)`) · `git status` + this stamp · `npm run
   doctor` · `bash ~/work/swordfish/provisioning/checks/needs-steven-hygiene.sh`.

▎ ▸ **⛔ HIS s90 CONSTRAINT: no console visits this week** (dated 2026-08-01 —
re-test, don't assume expired). Console batch stays PARKED on NEEDS-STEVEN.
▎ ▸ **The wizard's Generate spends when clicked** (metered judge calls ride
every dispatch) — it is door-gated and plan-previewed, but a LIVE click is a
real run; the s93 gate was verified with faked dispatch in tests, zero spend.
▎ ▸ **The s90 windows stay frozen** — s93 touched neither packages/db nor
packages/contracts (both new routes read existing engine seams; the plan
route is pure).
▎ ▸ **impeccable hook notes:** create.css + wizard.css join the SHEET-VERBATIM
ports (DOCTRINE 0) — radius/font findings intentional, not suppressed.
▎ ▸ **Dev server stopped at wrap**; 8899 preview + sweeper user units keep
running — NEVER hand-start the sweeper.
▎ ▸ **Traps worth keeping:** Bash cwd PERSISTS (`git -C`/absolute paths) ·
`npx vitest run` has NO `--project web` (path filters work) · vitest doesn't
typecheck (`npx tsc --noEmit -p apps/web`) · theme = localStorage
`thalon-workspace-mode` (default dark — flip it for light shots, not
prefers-color-scheme) · react-hooks/set-state-in-effect is a lint ERROR: use
the stamped-key derived-loading pattern (wizard-surface shows it).
▎ ▸ **⛔ SEQUENCE GATE unchanged AND now executable:** post/page generation
409s at `POST /api/create` until his GO (flip `lib/create/families.ts`, retire
the two route-test pins with it); bluesky armed for testing on his recorded
words; queue consumer's key EMPTY; youtube CANNOT arm. **Nothing posted. Zero
credits spent.**
▎ ▸ **Standing:** stealth · hermes-relay = founder · design lead-direct ·
every lane/subagent launch needs fresh founder approval · GATE ON EXIT CODE ·
verify-on-main = THE gate, re-run after your LAST commit · rules 10/11/12 ·
platform logins live durably in `.context` · no AGPL embedded · wrap =
verify+commit+push+restamp.
▎ ▸ **State:** main = origin (this wrap) · staging on s92 code, s93 rolls with
the next auto-deploy · four social channels connected · dev PG live · edge
auth creds = `.context/staging-secrets-from-swordfish.md`.
▎ ▸ **✅ SAFE TO CLEAR** — nothing in flight; no lanes; tree clean and pushed;
s94 boots on "gogogo" alone (this file carries the whole plan; no verdicts
are open).

## Pointer

CLAUDE.md → this file → COORDINATION.md (§s93) → `docs/workspace/spec.md`
→ `docs/create-engine/spec.md` → `docs/research/ux-refinement-program.md`
→ NEEDS-STEVEN.md (PARKED header) →
`docs/research/prior-art-portal-automation-s84.md` (BEFORE ANY PORTAL WORK).

## Delta (session 92)

s92 merged the analytics lane, wired the pipeline board and armed the
Composer; it deferred the Create home + wizard builds to s93 with the sheets
already verdicted. s93 spent exactly that: the re-check directive first (the
founder's world-class bar applied to what was already built — two real
defects surfaced by looking, both fixed with tests), then the two builds, and
the wizard closed the loop the spec drew — brief → derived plan → gated run →
the Composer. What remains is the stated s94 pair (Sites · Library) and the
dogfood run that lights every populated state.
