# Lane kickoff — T-truebore (s58 wave-1 taste pass)

You are a taste-pass lane agent on branch `lane/t-truebore` in this worktree. The founder approved this run. You refine ONE existing portfolio site to the standing **A+ bar** ("not just pass, thrive" — founder, s57).

## Scope — hard boundaries

- You own **ONLY `proprietary/templates/sites/truebore/`**. Touch no other path — not the shared portfolio test, not COORDINATION.md, not handoff files, not other sites.
- **NO minting, zero credit spend.** Never call the vendor (Higgsfield) MCP or any generation tool. Everything you add is code-drawn (SVG/CSS/JS) or already on disk — including the one new minted file described below, which the lead already minted and exported for you.
- **Never `npm install`** (root preinstall guard blocks it; this worktree is prepped).
- Commit to `lane/t-truebore` only. Do NOT push, do NOT merge, do NOT touch main. The lead batch-reviews and merges.

## Read first (in the worktree)

1. `proprietary/templates/meta-prompt.md` — especially **the representation ladder**, **casting & social register**, and the wink register (§Be exploratory). The §Non-negotiable gates are part of this brief.
2. `proprietary/templates/iteration-pass-checklist.md` — the two-lane pass you must run.
3. The site itself: `proprietary/templates/sites/truebore/` (index.html, js/, guide/, site.json, assets/).

Site identity: **TrueBore Plumbing** — 24/7 emergency plumbing (trades-plumbing). Axes: **physics-interaction primary**, brutalist-raw secondary.

## The handed-in remint (wire it, don't mint)

`proprietary/templates/sites/truebore/assets/callout.webp` is a lead-minted s57 casting remint: a plumber at real pipework, head bowed, whole face in frame, candid/absorbed (takes 1–4 were rejected for head-crop, camera-stare + crate pseudo-text, chest embroidery, chest glyph — the keeper composes printable surfaces out of frame). It is pinned with provenance and sits unwired. Your job: place it in the callout/tradie human slot where the page's current human imagery (or its absence) fails the social-register audit, replacing any failing reference. If a replaced asset file becomes fully unreferenced, leave the file and its manifest entry on disk and flag it for lead cleanup — provenance records are lead-owned. New filename ⇒ no cache stamp needed; any SAME-name asset replacement you make gets `?v=s58` (s55 stale-cache lesson).

## The taste pass — three audits (s55/s56 ratcheted lessons, applied retroactively)

1. **Representation ladder** (the founder's "most important point"): walk every load-bearing sentence/paragraph. Protocol/process prose especially → **drawn gauges and code-drawn instruments at 0cr** (response times, pressure, callout steps — the trade's real language is gauges, fittings, and job cards; show it). The visual must carry the SAME information load as the words it replaces.
2. **Casting & social register**: audit every human image: no camera-stare, casting-for-trust (a working tradie absorbed in the job, not a posed model), countable claims vs copy promises. The callout.webp placement above is the known fix; audit the rest too.
3. **Playfulness**: the page needs exactly ONE deliberate wink in the vertical's own visual language (the Houselights one-letter neon flicker is the register; Sprig & Barrow's wonky carrot that never falls is another). If one exists, sharpen it; if not, add it. Never stack several.

## Gates (unchanged, non-negotiable)

- Reduced-motion + no-JS = complete content, hard-state alternatives for every animation (including the physics interactions).
- 390px-wide clean; no layout shift; no jank; zero external network requests.
- Honest `/guide` update in the same change: what the taste pass changed and why, the remint's provenance note (model/credits are in assets/manifest.json), real catches logged.
- No AGPL or copied third-party code; no downloaded imagery, ever.

## Passes + verification

- Run **at least two full two-lane passes** (fault-hunt AND ambition-push per the checklist). A pass that only fixes faults does not count. Log real catches in `/guide`.
- Verify locally by static analysis (parse the HTML, check asset refs resolve, grep for external URLs, exercise pure JS via node where useful). syd4 has no headless-chrome libs — the lead does the visual pass at batch review on the 8899 preview; say so honestly in your wrap.

## Wrap

1. From the worktree root: `pwsh scripts/ci-grep-guard.ps1` — must be clean.
2. One conventional commit on `lane/t-truebore` (e.g. `feat(templates): truebore taste pass - ...`). **No AI attribution anywhere** — no Co-Authored-By, no Generated-with.
3. End with a founder-readable summary: prose→instrument conversions made, the casting placement, remaining casting findings, the wink, pass catches, anything needing lead attention. Then stop — do not idle-loop.
