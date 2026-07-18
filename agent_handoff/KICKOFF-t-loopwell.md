# Lane kickoff — T-loopwell (s58 wave-1 taste pass)

You are a taste-pass lane agent on branch `lane/t-loopwell` in this worktree. The founder approved this run. You refine ONE existing portfolio site to the standing **A+ bar** ("not just pass, thrive" — founder, s57).

## Scope — hard boundaries

- You own **ONLY `proprietary/templates/sites/loopwell/`**. Touch no other path — not the shared portfolio test, not COORDINATION.md, not handoff files, not other sites.
- **NO minting, zero credit spend.** Never call the vendor (Higgsfield) MCP or any generation tool. Everything you add is code-drawn (SVG/CSS/JS) or already on disk.
- **Never `npm install`** (root preinstall guard blocks it; this worktree is prepped).
- Commit to `lane/t-loopwell` only. Do NOT push, do NOT merge, do NOT touch main. The lead batch-reviews and merges.

## Read first (in the worktree)

1. `proprietary/templates/meta-prompt.md` — especially **the representation ladder**, **casting & social register**, and the wink register (§Be exploratory). The §Non-negotiable gates are part of this brief.
2. `proprietary/templates/iteration-pass-checklist.md` — the two-lane pass you must run.
3. The site itself: `proprietary/templates/sites/loopwell/` (index.html, css/, js/, guide/, site.json).

Site identity: **Loopwell** — usage analytics for product teams (tech-saas). Axes: **data-instrument primary**, exceptional-palette secondary.

## The taste pass — three audits (s55/s56 ratcheted lessons, applied retroactively)

1. **Representation ladder** (the founder's "most important point"): walk every load-bearing sentence/paragraph. Feature prose especially → convert to **live 0cr code-drawn instruments** where the visual carries the SAME information load (this is Loopwell's own primary axis — feature claims about analytics should BE working miniature instruments, not text). Decorative substitution that drops information is the failure this rule beats.
2. **Casting & social register**: audit every human image (there is little human imagery on this site — audit what exists): no camera-stare heroes, casting-for-trust, countable claims vs copy promises. Also check code-drawn scenes' implied claims against copy.
3. **Playfulness**: the page needs exactly ONE deliberate wink in the vertical's own visual language (the Houselights one-letter neon flicker is the register — a single playful flaw that makes the page feel hand-made). If one exists, sharpen it; if not, add it. Never stack several.

Plus: any asset replacement that keeps a filename gets a `?v=s58` cache-bust stamp (s55 stale-cache lesson). New filenames need no stamp.

## Gates (unchanged, non-negotiable)

- Reduced-motion + no-JS = complete content, hard-state alternatives for every animation.
- 390px-wide clean; no layout shift; no jank; zero external network requests.
- Honest `/guide` update in the same change: what the taste pass changed and why, real catches logged.
- No AGPL or copied third-party code; no downloaded imagery, ever.

## Passes + verification

- Run **at least two full two-lane passes** (fault-hunt AND ambition-push per the checklist). A pass that only fixes faults does not count. Log real catches in `/guide`.
- Verify locally by static analysis (parse the HTML, check asset refs resolve, grep for external URLs, exercise the JS logic mentally or via node where it's pure). syd4 has no headless-chrome libs — the lead does the visual pass at batch review on the 8899 preview; say so honestly in your wrap.

## Wrap

1. From the worktree root: `pwsh scripts/ci-grep-guard.ps1` — must be clean.
2. One conventional commit on `lane/t-loopwell` (e.g. `feat(templates): loopwell taste pass - ...`). **No AI attribution anywhere** — no Co-Authored-By, no Generated-with.
3. End with a founder-readable summary: prose→instrument conversions made, casting findings, the wink, pass catches, anything needing lead attention. Then stop — do not idle-loop.
