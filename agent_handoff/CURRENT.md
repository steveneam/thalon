# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-05 (session 7) · **Sprint 3 chartered (A6: origination + profiles, B3.8–B3.11 + B3.12 pull-trigger); Sprint-2 exit review folded into Sprint 3 (B2.5 dogfood = opener, B2.3 dogfood = first generated pillar); next: B3.8 profile spine (lean)**

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` (new Sprint-3 table + amendment A6) → `docs/adr/0003-sprint3-origination.md` (why origination, dogfood flywheel, Remotion growth-gate downgrade) → `COORDINATION.md` (Sprint-2 board; Sprint-3 lanes not yet cut).

## Delta (this session)

- **Founder correction that re-framed the exit review:** no pillar video/caption/SRT exists or will ever be founder-supplied — generating it is the product. Product frame: (1) content creation + posting from prompt + saved profile, (2) viral/trend intel for format re-use, (3) pre-saved switchable operator profiles. All in agent memory (`content-origination-goal`, `product-feature-framing`, `publisher-test-accounts`).
- **A6 chartered** (founder approved, shape delegated to lead): B3.8 profile spine (data first, UI deferred) → B3.9 pillar origination (`pillar_script` format; reuses B2.5 crawl + B1.2/1.3/1.4 machinery; adds GitHub ingest) → B3.10 Remotion render seam (MP4 + deterministic SRT from the authored script; licence corrected to **growth gate** — free ≤3-person co. incl. for-profit) → B3.11 loop closure + profile editor UX. ADR 0003.
- Repo fixes: dropped deprecated `baseUrl` from `packages/engine` + `proprietary/judge` tsconfigs (TS7 removal); `npm install` on main picked up playwright from PR #15; full typecheck green (`716881d`).
- Harness: `Grep`/`Glob` added to global `~/.claude/settings.json` permissions allow.

## Next action

**B3.8 — profile spine (lean)**, lead terminal: design the rich `brand_profiles` data shape (company facts, voice, philosophy, audience, offers, links), seed demo tenant + fictional tenant #2, wire active-profile resolution into generation context. Editor UI stays deferred to B3.11. Sprint opener alongside it: **B2.5 dogfood** on the pinned docs-search flow (needs `npx playwright install chromium` + founder confirming the exact flow at run time).

## [you] — founder-supplied, needed as work starts (not before)

- Profile content for your two real companies (runtime data, never committed) — needed during B3.8.
- B2.5 dogfood: confirm the exact docs-search flow when we run the opener.
- File LinkedIn + X OAuth developer apps (B3.1's long pole — paperwork only, start anytime).
- Gateway credit top-up — judge tier is needed **this sprint** (origination leans on the sonnet final gate).
