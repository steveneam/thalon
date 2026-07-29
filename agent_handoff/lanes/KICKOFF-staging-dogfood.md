# KICKOFF — lane `staging-dogfood` (make staging the tenant's real home)

**Founder GO on record, s85, by name** ("ig-post + staging-dogfood"). Launch is
Mode B in the `thalon` tmux session. You own `agent/staging-dogfood`, worktree
`.claude/worktrees/staging-dogfood`, branched from `24a2b42`.

**You touch no product code.** Your scope is env/ops, seeding scripts and
`agent_handoff/`. If a fix you want lives in `apps/web` or `packages/`, that is
a finding for your wrap, not an edit — the other lane (`ig-post`) is live in
`packages/engine` and you must not collide with it.

---

## Why this lane exists

s84 made staging a REAL origin, and that quietly retired a whole class of pain.
`preview.swordfish.cfd` now has `APP_ORIGIN` set, swordfish exempted
`/api/integrations/callback/` from the edge basicauth (priority-100 Traefik
router, keeps ratelimit + noindex), and the callback joined the app gate's
public list. The connect dance therefore completes at a real address instead of
`localhost:3111` behind a dying port-forward.

Nothing has actually MOVED there yet. The dogfood loop still runs against dev on
the box. This lane closes that gap: staging becomes where the tenant actually
lives, so the product is exercised the way an operator would meet it.

## What "done" looks like

1. **Tenant #0 exists on staging and is real.** Establish first what the
   staging DB actually holds — do not assume. Staging has been on `tenant-pg`
   since the s56 cutover (`DATABASE_URL`; rollback is unsetting it). There is
   **no seed script in the repo** (`scripts/` has none — check for yourself),
   so decide whether you are writing one or driving the existing doors. If you
   write one it must be **idempotent** and **tenant-scoped**, and it must seed a
   GENERIC demo tenant — never a brand, never anything from `.context/`
   (multi-tenant is a product invariant; brand/voice/grounding are runtime data
   that never enter the repo).

2. **The connect dance is proven end-to-end at the real URL.** Drive it and
   report what happened, with the actual HTTP results — not "it should work."
   `scripts/connect-destination.ts` exists; read it before writing anything new.
   **Bluesky is the safe subject** (app password, no OAuth round trip, and it
   holds the founder's standing test grant). For the OAuth platforms, prove the
   *begin → callback → vault row* path as far as it goes without needing his
   browser, and say precisely where it stops and why.

3. **The dogfood loop points at staging**, or you have stated exactly what
   blocks that and what it would take.

## Hard constraints

- **⛔ Zero posts.** Connecting a channel is not posting. The publish queue
  consumer's arm key rests EMPTY and stays empty; `SOCIAL_QUEUE_ARMED` is not
  yours to set. Bluesky's test grant covers testing, and even that needs no
  post from you to finish this lane — if you think it does, ask the lead first.
- **⛔ Never drive a platform LOGIN from the box.** AGENTS.md rule 11, and the
  memo `docs/research/prior-art-portal-automation-s84.md` — READ IT before any
  browser work. Datacenter-IP reputation is why that road ends in captcha, and
  the stealth-patch class was REJECTED on ROI. **Related and current: the s85
  lead re-tested the cookie transplant and it is DEAD** — Facebook clears the
  auth pair server-side on first contact from the box, with a correct import and
  a clean user-agent (see `agent_handoff/NEEDS-STEVEN.md` entry `2026-07-28n`).
  Do not retry it, and do not escalate it. Portal work belongs to the founder.
- **Secrets stay where they are.** `.context/` is gitignored because it holds
  real credentials; nothing from it may land in a tracked file, a script default
  or a commit message. The staging edge-auth pair and the Dokploy key are
  CI/ops secrets — never commit either.
- **Stealth holds.** `thalon.org` stays unwired (CT-log exposure); staging keeps
  its neutral hostname and its edge auth. Do not widen the basicauth exemption
  beyond the callback path that swordfish already carved.
- Do not restart the `thalon-sweeper` unit without saying so — it CAPTURES env
  at start, and a restart mid-session changes behaviour under the other lane.

## How to work

- Ground-truth every claim: `curl` it, read the response, quote it. This lane's
  entire value is that someone finally checked.
- Gate on `npx vitest run --maxWorkers=2` (two lanes on a 16 GiB box; three full
  suites OOM it, measured s82). **Never `pkill -f vitest`** — it matches every
  worktree and would kill `ig-post`'s suite.
- `vitest` does NOT typecheck — run the workspace typecheck too.
- Never `npm install` in a worktree.

## When you finish

Write `agent_handoff/lanes/WRAP-staging-dogfood.md`: what is now true on
staging, verbatim evidence for each claim, what you found that is not yours, and
anything that still needs the founder. Then tell the lead. **The lead rebases,
reviews and merges** — do not merge to `main` yourself, and do not open a PR.
