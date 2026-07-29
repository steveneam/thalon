# WRAP — lane `staging-dogfood` (s85)

**Branch** `agent/staging-dogfood` (from `24a2b42`) · **no product code touched**
— the diff is two `agent_handoff/` entries and this file. Zero posts, zero
portal visits, zero platform logins, nothing connected.

**The one-line answer:** staging is in far better shape than the kickoff
assumed — tenant #0 is already real there — and it is **exactly one
environment variable** away from completing a full connect. That variable is
not mine to set, and the ask is now written up for swordfish.

---

## 1. Tenant #0 on staging — ALREADY REAL. No seed script written, deliberately.

The kickoff said to establish this rather than assume it, and the assumption
("nothing has actually MOVED there yet") turned out to be wrong.

`GET /api/app/status` (authed through the edge pair):

```json
{"seams":{"db":"postgres","objectStore":"local","queue":"inline","auth":"dev",
"gateway":"configured","tracing":"unconfigured","dataDir":"/data"},
"drivers":{"render":"hyperframes","transcript":"caption-file","searchIntel":"fake"},
"budget":{"tenantDailyTokens":2000000},"tenantSlug":"self"}
```

`db: postgres` confirms the s56 tenant-pg cutover is still in force. Tenant
`self` resolves, and it holds real data — counted through the product's own
doors:

| | staging (`c6fdff58-…`) | box dev (`8159220f-…`) |
|---|---|---|
| brand profile | **active, v3** | active, v5 |
| runs | 6 | 13 |
| leads | **120** (24 scored / 96 dismissed) | 20 |
| library sources | 1 | **118** |
| intel areas | 1 | 1 |
| video projects | 1 | 3 |
| **connected destinations** | **0** | **6** |
| trend cards on the surface | 0 | — |
| `trend_snapshots` rows | (not readable from here) | 16,846 |

Staging's numbers come from its own API doors; the box's from `psql`. The two
trend rows are therefore **different measures and are not comparable** — I can
see staging's rendered trend cards (zero) but not its row counts, having no DB
access there. Staging's leads were genuinely *worked*, not merely imported:
96 of the 120 are dismissed.

**These are two different tenants in two different databases, and they have
diverged.** Staging is not a stale copy of the box — it has *six times* the
leads and a hundredth of the library. Nobody has decided which one is the
tenant of record, and "move the dogfood loop to staging" silently implies
that decision. Flagging it rather than making it (see §5).

**Why no seed script**, despite the kickoff leaving the door open: the product
already has an honest first-run door. `POST /api/profiles`
(`apps/web/src/app/api/profiles/route.ts:91`) calls `repos.tenants.ensure({slug, name})`
— idempotent, slug-scoped from `DEMO_TENANT_SLUG`, creating the tenant row on
first profile save. `openDb()` runs migrations but deliberately never seeds
(`packages/db/src/client.ts:130`), so a fresh deployment starts empty and
self-heals the moment an operator saves a profile. A seed script would have
been a *second, divergent* path to tenant creation competing with a working
one. The gap the kickoff suspected is real in shape but already closed in the
product.

## 2. The connect dance at the real URL — BLOCKED at the vault, and only there

Driven live against `https://preview.swordfish.cfd`, not simulated.

**Bluesky** (the safe subject — app password, no OAuth, no portal):

```
POST /api/integrations/bluesky/connect          → HTTP 503
{"error":"THALON_VAULT_MASTER_KEY is not set — the vault refuses. Generate one
with `openssl rand -base64 32` and set it in the environment (KMS is the
recorded swap path)."}
```

**`THALON_VAULT_MASTER_KEY` is unset on the staging app.** That is the whole
blocker for requirement 2, and it blocks *every* flavor — nothing can be
sealed, so nothing can connect.

**The OAuth begins** all refuse honestly, each naming its own missing keys
(the honest-doors grammar working exactly as designed):

```
POST /api/integrations/linkedin/oauth  → 409 missing_client_pair: SOCIAL_LINKEDIN_CLIENT_ID, SOCIAL_LINKEDIN_CLIENT_SECRET
POST /api/integrations/facebook/oauth  → 409 missing_client_pair: SOCIAL_FACEBOOK_CLIENT_ID, SOCIAL_FACEBOOK_CLIENT_SECRET
POST /api/integrations/instagram/oauth → 409 missing_client_pair: SOCIAL_FACEBOOK_CLIENT_ID, SOCIAL_FACEBOOK_CLIENT_SECRET
POST /api/integrations/reddit/oauth    → 409 missing_client_pair: SOCIAL_REDDIT_CLIENT_ID, SOCIAL_REDDIT_CLIENT_SECRET
```

**Where the OAuth path stops, and why** — three gates, in order, and it fails
at the first: (1) no client pair in staging's env → 409 before a state row is
ever minted; (2) even with the pair, the staging callback URL is not
registered on the Meta/LinkedIn apps — browser-only portal work that needs the
founder's hands (`NEEDS-STEVEN` `2026-07-28n`); (3) only then does consent
need a human browser. So the honest statement is that OAuth on staging is
**two env asks and one portal visit** from the consent screen — not that it
"nearly works".

**The s84 callback claims re-tested, anonymously, and they hold:**

```
GET /api/integrations/callback/bluesky                            → 307
  → https://preview.swordfish.cfd/app/settings/integrations?connect_error=bluesky%3A+the+platform%27s+callback+carried+no+code%2Fstate…
GET /api/integrations/callback/linkedin?code=fake&state=deadbeef  → 307
  → …?connect_error=linkedin%3A+oauth+state+%22deadbeef%22+not+found+for+this+tenant
GET /api/integrations   (anon control)                            → 401
```

The callback is genuinely exempt from the edge basicauth, genuinely redirects
to the **real origin** (not `0.0.0.0:3000`), and is genuinely inert against a
forged state. Nothing was widened to get this.

**The failure is isolated to staging's env, not the code.** The identical code
path has all six destinations connected on the box, including
`bluesky | @steveneam.bsky.social | connected | 2026-07-28 15:42:45+00`. So
with the vault key set, Bluesky on staging needs **nothing further from
swordfish, the founder, or a portal** — it is app-password flavored. That is
the shortest path to a real end-to-end connect at the real address, and it is
one variable long.

## 3. Why I could not just set it myself

Checked rather than assumed, per rule 11 — the environment is a variable I
control *until proven otherwise*, and here it is proven otherwise:

- `.github/workflows/web-image.yml:101` comment, authoritative: the Dokploy key
  *"carries NO create-class grant — `application.update` is impossible with it
  by design"*.
- The `.context` copy of the key is dead. Read-only probe:
  `GET /api/application.one` → `{"message":"Unauthorized"}` HTTP 401.

So I have **zero** control-plane access to staging env. This is a swordfish
ask by construction, not by preference — written up in
`ASK-BACKS-FOR-SWORDFISH.md` with the exact command, the 32-byte/base64
constraint, the warning that it is a key-encryption key (rotating it orphans
every sealed row), and the note that it must **not** reuse the box's dev key.

## 4. The dogfood loop cannot be repointed at staging — three reasons, all structural

Requirement 3 asked for this or an exact statement of what blocks it. It is
blocked, and not by one thing:

1. **The publish half has no destination.** No channel can connect (§2), so
   there is nothing for the loop to loop over.
2. **The intel half would sweep fake data.** Staging reports
   `"searchIntel":"fake"`, and its schedule is
   `{"enabled":false,"cadenceMinutes":240,"lastSweepAt":null,"configured":false}`
   — **no sweep has ever run on staging.** The box sweeps live every 180 min
   (`last_sweep_at 2026-07-29 00:33:11+00`).
3. **There is no runner on staging, and one cannot be added from here.**
   `scripts/run-sweep-scheduler.ts` is a *direct DB client* — it calls
   `openDb()`, not HTTP — so it needs staging's `DATABASE_URL`, which I do not
   have and cannot obtain. And it cannot run *beside* the staging app either:
   `Dockerfile.web` builds a Next **standalone** runtime that copies only
   `.next/standalone`, static, public, `proprietary/prompts`,
   `proprietary/profiles` and `packages/db/drizzle` — **no `scripts/`, no
   `tsx`, no TS sources.**

**What it would take** — and the design already anticipated this. The
scheduler's own docstring says *"production cron is deploy wiring, not this
script's job."* The cheapest correct path needs no image change, no DB route
and no new secret: the sweep already has a gated HTTP door,
`POST /api/intel/sweep`. A cron calling that door on a cadence — from the box,
which already holds the edge-auth pair, or from swordfish — drives the intel
half against staging directly. Then arm the schedule through the config door
and set a real `TREND_SOURCE`. **I did not build this**: it is a new periodic
job against a live origin, it is out of an env/ops lane's scope to introduce
unasked, and it is worthless until §2 unblocks. Recommending, not shipping.

## 5. Findings that are not mine

- **The two databases have diverged and nobody has chosen a tenant of record**
  (§1 table). Before staging can *be* the dogfood home, someone decides:
  migrate the box's 118 sources + 16.8k trend snapshots over, accept staging's
  120 leads as the real ones, or run both. This is a founder/charter call.
- **`searchIntel: "fake"` on staging** may well be deliberate. Recorded in the
  swordfish note as informational with no action requested.
- **A TIME-BOMB TEST, found by accident and reproducible on demand.** Two
  tests in `apps/web/src/components/calendar/__tests__/calendar-surface.test.tsx`
  **fail for ~9 hours of every day and pass for the other 15.** I changed no
  code, so they are not mine — but they are red on this branch right now and
  the lead will hit them.
  - *Failing:* "marks today on the current week and carries older waiting work
    into it" and "+N more is a real control that opens the agenda at Needs-you
    scope". Both: `AssertionError: expected null not to be null`.
  - *Cause, verified:* the tests build fixtures from the real wall clock
    (`function today()` → `new Date()`, test file line 18) and never pin it —
    the fake-timer setup at line 341 is in a different describe block. They
    assert `container.querySelector(".nowline")` is non-null. But `NowLine`
    (`calendar-surface.tsx:944`) returns null outside the day window, and
    `DAY_WINDOW = { start: 6, end: 21 }` (`calendar-model.ts:19`). This box is
    `Etc/UTC` and the suite ran at **02:18 UTC** → outside the window → no
    now-line → red. **The component is behaving correctly; the test is
    unpinned.** Any suite run between 21:00 and 06:00 UTC goes red.
  - *Fix (not mine to make — product code, and out of this lane's scope):*
    `vi.setSystemTime` a fixed mid-window hour in that describe block, the
    same way line 341 already does elsewhere in the file.
  - *Adjacent design question, worth a look during D4 `Schedule`:*
    `week-card.tsx:176` picks `FULL_WINDOW` when the current hour falls outside
    `DAY_WINDOW`, so the dashboard always shows a now-line. The calendar
    surface does not (`calendar-surface.tsx:240` — `expanded ? FULL_WINDOW :
    DAY_WINDOW`), so at 2am an operator sees a grid with no "now" on it. Two
    surfaces, two answers. Flagging, not fixing — the D4 sheet is redrawing
    this surface anyway.
- **No defects found in anything this lane actually targeted.** Every
  integration door I hit refused correctly and legibly; the honest-doors
  grammar did the entire diagnostic job — each 409 named its own missing keys,
  which is why the ops ask could be written complete in one pass instead of
  drip-fed. That is the ratchet working, and it is worth saying so.

## 6. Gates

```
npx vitest run --maxWorkers=2
  Test Files  1 failed | 327 passed | 4 skipped (332)
       Tests  2 failed | 2761 passed | 9 skipped (2772)
    Duration  733.66s
```

**The 2 failures are the wall-clock bomb in §5, not this branch.** Proven,
not assumed — same commit, same code, nothing edited, only the timezone moved
into the day window:

```
UTC now: 02:23  |  Sydney now: 12:23 (inside DAY_WINDOW 06–21)
TZ=Australia/Sydney npx vitest run …/calendar-surface.test.tsx
  Test Files  1 passed (1)
       Tests  22 passed (22)
```

So the honest stamp for this branch is **2763 passing, 0 real failures, 9
skipped** — and the suite is green for the 15 hours a day it is run inside
06:00–21:00 local. Never `pkill`ed (the other lane's suite was untouched).

- `npm run typecheck` (workspace-wide, incl. `@thalon/web`) — **exit 0**.
- No `npm install` in the worktree. `thalon-sweeper` not restarted, not
  touched — the other lane's env is undisturbed.
- Secret hygiene: the diff was grepped for every known credential value
  (edge pair, Dokploy keys, dump token, DB password, app id) — clean. Live
  probes passed credentials via `curl --config`/`--data-binary @file`, never
  argv, so nothing leaked into `ps`.

## 7. For the lead

Nothing here merges into a running system — the diff is documentation. The
value is: **staging holds a real tenant #0 already, and one env var
(`THALON_VAULT_MASTER_KEY`) is the single gate between it and a proven
end-to-end Bluesky connect at the real address.** The swordfish ask is
written; the founder decision (does staging hold his real tokens — I
recommend Bluesky-only to start) is one line in `NEEDS-STEVEN`
(`2026-07-29a`). Neither needs a portal visit.

**The lead rebases, reviews and merges.** Not merged, no PR opened.
