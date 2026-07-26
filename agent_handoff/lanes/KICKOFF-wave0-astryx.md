# KICKOFF — lane `wave0-astryx` (UI overhaul WAVE 0: the Astryx foundation)

> **LAUNCH GATE — do not launch this lane until the founder's wave-0 mock GO
> is recorded at the s72 opener.** The mock-first standing rule outranks the
> lane prep: the founder verdicts the 11-surface claude-design canvas first.
> Prep (worktree, kickoff, board row) was founder-approved s71 close ("plan a
> parallel workflow for next session"). If his verdict asks for fix rounds,
> the lead runs them and THEN launches this lane with the amended spec.

Read `CLAUDE.md` (the repo protocol) first, then `docs/research/ui-overhaul-plan.md`
IN FULL — §4.2 wave 0 is your scope, **§5's four doctrines are binding
requirements**, §1.3 documents the already-proven stack fit. You are on branch
`agent/wave0-astryx`. Work ONLY here. `packages/contracts` + the db schema are
FROZEN — this lane needs neither.

## Mission

Install the Astryx foundation under the existing workspace WITHOUT rebuilding
any surface: pinned `@astryxdesign/core` + CLI, the Thalon theme authored
FROM SCRATCH in `defineTheme`, the CSS layer cascade + Tailwind-v4 bridge,
the labeled `AppShell`/`SideNav` shell, and the re-pinned token ratchets.
Exit = every existing surface still renders and functions inside the new
chrome; `npm run verify` green.

## The theme IS the mock — token values of record

The founder-verdicted mock (claude-design project `f5d304cb`) is the spec.
Its token set, verbatim (map into `defineTheme`'s color/typography/radius/
motion config; keep the oklch values exact):

```
Neutral ramp (usage-mapped: 100/200/300 bg default/hover/active ·
400/500/600 border default/hover/active · 700/800 fills · 900/1000 text):
  bg   oklch(0.152 0.009 262)   rail oklch(0.132 0.009 262)
  100  oklch(0.188 0.010 260)   200  oklch(0.215 0.011 258)
  300  oklch(0.245 0.012 256)   400  oklch(0.305 0.012 256)
  500  oklch(0.365 0.013 255)   600  oklch(0.445 0.013 254)
  700  oklch(0.560 0.014 254)   800  oklch(0.680 0.014 254)
  900  oklch(0.735 0.014 255)   1000 oklch(0.935 0.006 255)
Accent (the ONE action color):
  act oklch(0.635 0.135 252) · hover oklch(0.675 0.135 252)
  text oklch(0.985 0.003 252) · subtle 13% alpha
Brand (mark ONLY — never status, never interactive):
  brand-hi oklch(0.80 0.14 76) · brand-lo oklch(0.60 0.12 68)
Semantic status (amber = needs-you ONLY):
  ok oklch(0.735 0.150 152) · warn oklch(0.795 0.135 78)
  err oklch(0.665 0.185 27) · subtle fills at 13-14% alpha
Thermal (word-in-pill, survives verbatim):
  cool oklch(0.580 0.080 245) · warm oklch(0.800 0.140 90)
  rising oklch(0.700 0.160 55) · hot oklch(0.570 0.200 35)
Type: Geist (ui) / Geist Mono (data-only allowlist: timestamps, ids in
  detail views, judge codes in tooltips). Roles: headline 17/600 ·
  title 14/600 · body 14/400 · label 12.5/500 · big 28-30/600 tabular ·
  data mono 11.5. Radius: card 10 · control 7 · pill full.
  Motion: 130ms cubic-bezier(.3,.7,.4,1).
DARK IS DEFAULT; light mode ships as the toggle (Theme provider mode).
```

## Steps (small, verifiable; commit as you go)

1. `npm i` additions in `apps/web` ONLY: `@astryxdesign/core` (PIN the exact
   version; record it in the wrap) + the CLI as a devDep. MIT-check the
   installed tree (license hygiene rule). NO `@astryxdesign/build`, NO
   charts (`@canary` — barred).
2. Author `apps/web/src/theme/thalon.theme.ts` (defineTheme, from scratch,
   the table above) + `astryx theme build` output wired per the documented
   layer cascade: `reset → theme → base → astryx-base → astryx-theme →
   components → utilities`, with the `tailwind-theme.css` bridge so existing
   Tailwind surfaces keep rendering on Astryx tokens.
3. Adopt `AppShell` + `SideNav`/`TopNav` with **labeled navigation** — order
   and labels exactly as the mock: Home · Intel · Create · Approve(count) ·
   Calendar ┃ Leads · Library · Videos · Sites · Runs ┃ Profiles · Settings.
   Needs-you count chip (amber) + ⌘K + `+ Create` + tenant switcher carry
   over into the new topbar. Existing pages mount inside unchanged.
   **The topbar also carries the ASYNC-WORK TRAY (founder round 7, mocked on
   the Dashboard frame):** a neutral "N working" chip with spinner while any
   render/mint/fan-out runs, a green completion dot, and a dropdown tray
   (per-job row: label · progress · honest ETA · View→ when done) — read
   from the events spine + run states, honest by construction; completion
   raises the dot, never a modal. Wave 0 ships the chip+tray shell reading
   real run states; per-job progress % can land per-pipeline later — show
   stage words (rendering · judging) where % would be a lie.
4. Re-pin `apps/web/src/lib/__tests__/tokens-contrast.test.ts` to the NEW
   token source (same AA pairs discipline; values change, the ratchet
   survives). Extend it with the §5 pairs: warn-on-100, err-on-100,
   ok-on-100, act-text-on-act.
5. `astryx init` → the component index lands in the repo agent docs
   (apps/web/AGENTS.md section, guard-safe wording).
6. NEW ratchet (named in §4.3): a lint/test failing any `u-eyebrow` /
   uppercase-mono usage outside the data-label allowlist — executable form
   of disease #1. Add it seeded with the current violations EXPECTED (they
   burn down per wave-1 surface; the test pins the count so it only ratchets
   DOWN).
7. Full `npm run verify` (never filtered) + a live browser screenshot pass
   of 3 old surfaces inside the new shell (headless chrome is local).

## Out of scope — do not touch

Wave-1 surface rebuilds (dashboard/approve/intel — next lanes) · charts ·
the landing (`/` keeps its own register) · contracts/db · any publish path.

## Wrap

`agent_handoff/lanes/WRAP-wave0-astryx.md`: pinned version, theme file path, what
the cascade looks like, screenshot evidence list, the mono-allowlist
ratchet's starting count, anything that fought you (swizzle used? why).
Guard + commit on the branch; the LEAD merges on green post-merge verify.
