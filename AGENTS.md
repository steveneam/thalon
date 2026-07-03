# AGENTS.md — Thalon repo operating protocol

> **Canonical name: `AGENTS.md`.** `CLAUDE.md` is a hardlink/copy kept so Claude Code auto-loads this file. Edit `AGENTS.md`; the alias tracks it. If you are any agent other than Claude Code, read `AGENTS.md`.

This is a **standalone, generic, multi-tenant content and social-automation engine**. You are a build agent working inside this repository. Read this file before writing anything.

## ⛔ The one hard constraint

This repository must contain **zero references to the two forbidden upstream brand names** (the portfolio's anchor product and its sibling) — no files, strings, config, dependencies, or wiring — in any **git-tracked** file. The engine is genuinely generic and needs neither of them.

- The forbidden tokens are defined as **fragments** inside `scripts/ci-grep-guard.ps1`, on purpose, so this protocol, that guard, and every other tracked file stay clean and never trip their own check.
- Enforcement is `scripts/ci-grep-guard.ps1`: a case-insensitive grep over **git-tracked files only** (the correct CI semantics — CI only ever sees committed files). It must return **zero hits**; it exits non-zero on any hit. Run it before every commit. See `CI-GUARD.md`.
- The vault pointer at `.context/` is **gitignored** precisely because the research vault's absolute path contains a forbidden token. Never move vault-pointing content out of `.context/` into a tracked file.
- Any downstream brand is the **operator feeding generic tenant data at runtime**, external to this repo — never committed, never named in code. Brand/voice, grounding sources, and the compliance denylist are per-tenant **config and data**, never hard-coded.

## Build discipline

1. **No feature code before the charter.** The build follows the portfolio build-bootstrap ritual (orient → founder interview → approved agile-bucket charter → build one bucket at a time with a checkpoint between each). The paste-ready prompts are in `.context/PROMPTS.md` (gitignored). Do not scaffold features until the founder has approved the charter.
2. **Read the vault first.** Authoritative product context is the read-only research vault; the pointer and reading order are in `.context/READ-ME-FIRST.md`. You are **read-only** in the vault — cite its pages, never write to it.
3. **Multi-tenant from table one.** Every schema carries a tenant/org identifier; brand/grounding/compliance are data, never baked in. The repo ships a generic self/demo tenant only.
4. **Safe vertical slices.** A fan-out never emits an ungated draft — every draft passes the shared judge harness (denylist + grounding-to-provided-sources) before it can reach the Approve queue. No publish path is wired until it is explicitly a build bucket.
5. **The moat lives in `proprietary/`.** Put the novel artifacts (judge harness, prompt chains, fan-out/niche profiles, tuned heuristics) there, separate from boilerplate and third-party code. See `proprietary/README.md`.
6. **Dogfood + eval from day one.** Every override/correction becomes one eval row in the same change; a green suite is the ship gate. Use a $0/self-hostable eval stack (MIT/Apache only) — no commercial-gated deps on the hot path.
7. **Small, verifiable steps.** Plan, then execute one step; write tests with code and run them; keep changes small; stop at each bucket checkpoint for human review.
8. **Leave a ratchet.** Every expensive lesson becomes a durable artifact **in the same change** — a test, a CI check, a charter amendment, a code seam, or a rule in this file. Route each lesson to exactly one home (link, don't copy) and prune the stale neighbour as you add. A lesson that lives only in chat is lost.
9. **End every session clear-safe, unprompted.** Reach a verified boundary (never stop mid-edit), run the grep guard, commit and push, then hand the founder a stamped resume prompt (pointer + delta + next action — never a state dump) **and mirror it into `agent_handoff/CURRENT.md` (one file, overwritten each wrap) so any fresh session resumes without chat history**. When upcoming buckets are dependency-independent, proactively propose parallel worktree lanes (branch per bucket, disjoint file sets, merge at each checkpoint) including any pre-requirements — the lane board is `COORDINATION.md`.

## Licensing hygiene

No AGPL code embedded in this repo (reference-only patterns must be re-implemented). Prefer public-domain / MIT / Apache / CC0 on the hot path. Record any commercial/cert gate as a launch gate with a swap path — flag, do not silently block — and isolate it behind a clean interface.

---
*Canonical. Keep this file generic and standalone. Universal agent ground rules and the wiki schema live in the research vault referenced by `.context/READ-ME-FIRST.md`.*
