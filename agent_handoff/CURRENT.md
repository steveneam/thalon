# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-05 (session 10) · **Sprint 4 FULLY complete (B4.5 residue closed via PR #20) · pass 2.5 chartered as A11 / Sprint 5 (B5.1–B5.4, deterministic video creation) · Hyperframes research + Mode B worktree ratchets landed · work starts next session on founder go.** Main @ `ea3f41c` + wrap commits.

## Resume prompt (paste verbatim to resume next session)

> Stamped 2026-07-05 15:28 (UTC+10:00). Safe to `/clear` after reading — see the clear-safe line at the end.

**Resume · Thalon** — stamped **2026-07-05 15:28 (UTC+10:00)** · Sprint 5 (pass 2.5, A11) chartered, lane-boarded, Mode B-ready → build starts this session. E:\thalon, main @ wrap commit.

▎ ▸ Read `CLAUDE.md` → `agent_handoff/CURRENT.md` → `CHARTER.md` ("Sprint 5 — deterministic video creation", amendment A11) → `COORDINATION.md` (Sprint-5 proposed lanes + the 2026-07-05 B4.5/A11 wrap message) → **`docs/research/hyperframes-integration.md` (required kickoff reading — pins the composition contract, producer API, lint-as-core-gate, player/SDK surfaces)**.

▎ ▸ **First act (lead terminal, no agents needed): B5.2 pipeline lane — the Sprint-5 contract window.** Stage registry in contracts (per-format ordered stage list, count is config, default 3: structure → scenes/effects → polish; export = deterministic core); pinned `storyboard` + `direction_doc` schemas; deterministic direction.md renderer/parser (front-matter + per-scene sections) with the byte-identical round-trip ratchet; deterministic-first prefill; one-prompt mode = same stages auto-advanced. `pillar_script` keys stay byte-stable (pin before code moves). Contract freezes at its merge.

▎ ▸ **Then: Mode B wave (founder preference, 2026-07-05)** — render B5.1 + ui B5.4 run in **founder-opened terminals** on **lead-prepped worktrees**: lead runs `git worktree add .claude/worktrees/<lane> -b agent/<lane>/<bucket>` then `npm run worktree:setup -- .claude/worktrees/<lane>` (junctions node_modules, copies env/vault includes, verifies identity+eslint+guard — the 2026-07-05 ratchet), authors one kickoff prompt per window, founder pastes them. **Fresh founder go still required before the wave launches** (standing rule). Lint WORKS in prepped lanes (old "skip lint" caveat retired); **never `npm install` in a lane** (preinstall guard blocks it; installs run in main). Ratchet B5.3 closes the sprint on the lead terminal. Merge train: pipeline → render → ui → ratchet.

▎ ▸ **[you] — unchanged, needed at pass 3 (none block Sprint 5):** pillar-#1 topic/angle + tenant profile at gitignored `.context/tenants/<company>.v1.json`; gateway credit top-up; LinkedIn/X OAuth apps (B3.1 long pole); `0b11d48` scrub decision.

▎ ▸ **✅ SAFE TO CLEAR.** As of the stamp: working tree clean, local = remote, suite 428/2 green, lint 0 errors, guard passing, doctor all-green, no mid-edit state, no open PRs, no live worktrees.

---

## Pointer

Read in order: `CLAUDE.md` → this file → `CHARTER.md` (Sprint 5 / A11) → `COORDINATION.md` (Sprint-5 lanes). Seams Sprint 5 builds against: `packages/engine/src/render/{render,target}.ts` (the `RenderTarget` seam B5.1 implements) · `packages/contracts/src/format-registry.ts` (where B5.2's stage registry + schemas land) · `packages/engine/src/pipeline/single-draft.ts` (the spine the staged pipeline composes) · `packages/platform` env choke point (driver selection).

## Delta (this session — session 10)

- **B4.5 residue closed (PR #20, `ea3f41c`)**: `fanout_runs.last_error` (migration 0004) + `fanoutRuns.recordLastError` (single writer, tenant-scoped, events-audited) wired into all three generation paths (spine + fanout + waterfall; their plain irrecoverable `Error`s upgraded to `IrrecoverableGenerationError`); record-before-throw, clear-on-successful-backfill; `FeedRun` carries it to the queue UI for free. Suite 424 → 428.
- **Sprint-4 exit checkpoint held in-chat → founder directed pass 2.5.** Ratified: (1) **Hyperframes default render driver** (verified real: HeyGen's Apache-2.0 HTML→video framework, active, chromium+ffmpeg already toolchain) with Remotion demoted to swap path — A6 growth gate retired; (2) **direction.md = strict-schema markdown** (round-trip ratcheted), never freeform; (3) **staged-flow UI ships in-pass** on fake drivers. Staged model: ~3 stages default (structure → scenes/effects → polish), count is registry config; one-prompt mode = same stages auto-advanced; every stage judged; stage interactions → edit_diffs → eval rows.
- **A11 written into CHARTER.md** (Sprint 5, B5.1–B5.4) + Sprint-5 lane board cut in `COORDINATION.md` (pending founder go). Memory updated (build-strategy, product-feature-framing, future-tooling).
- **Founder-directed Hyperframes docs read-around → `docs/research/hyperframes-integration.md`** (required Sprint-5 kickoff reading). Headlines: lint = browser-free CORE gate before render spend; player = render-free live stage previews for B5.4; SDK edits = RFC-6902 patches → `edit_diffs` verbatim; keyless local TTS/captions/music stack (Kokoro · Whisper alignment · MusicGen) = pass-3 $0 TTS default; variables = typed template slots (root w/h/duration/fps compile-time); Windows dev renders are screenshot-fallback (fine — cache keys on manifest hash), Docker/Lambda for prod artifacts.
- **Mode B unblocked (founder-directed pre-work):** root cause = Windows denies true symlinks without admin → worktrees silently got empty `node_modules`. Fixes landed: `scripts/worktree-setup.ps1` (`npm run worktree:setup -- <path>`: junctions all five node_modules, copies `.worktreeinclude` gitignored set, verifies identity/eslint/guard; idempotent, repairs broken lanes — proven end-to-end in a smoke worktree incl. PGlite tests); root `preinstall` guard (`scripts/guard-worktree-install.mjs`) blocks `npm install` inside worktrees (npm v7+ clobbers linked node_modules); `@thalon/*` vitest aliases completed for `packages/db` + `eval` (were missing — worktree tests would have exercised MAIN's sources); `settings.json` symlinkDirectories extended to all five. "Skip lint in lanes" caveat retired.

## Next action

Paste the resume prompt above — first act is B5.2 (contract window, lead terminal, no approval needed); the render+ui subagent wave needs the founder's fresh go when proposed.

## [you] — founder-supplied (pass 3; nothing blocks Sprint 5)

- Pillar #1 topic/angle + confirm the tenant profile draft (`.context/tenants/<company>.v1.json`).
- Gateway credit top-up (judge tier + live dogfood).
- LinkedIn + X OAuth developer apps (B3.1 long pole — paperwork, start anytime).
- Decision: scrub the guard token from historical commit `0b11d48`? (one-time branch-protection relax; HEAD clean).
