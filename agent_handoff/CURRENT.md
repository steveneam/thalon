# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-04 (session 5) · **Wave 1 merged — B2.3 (PR #13) + B2.4 (PR #14) on main; wave 2 (demo B2.5 + ui B2.6) cuttable on founder go**

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` (Sprint-2 table) → `COORDINATION.md` (Sprint-2 lane board + the 2026-07-04 wave-1 messages — lane cut, merge-train wrap).

## Delta (this session)

- **B2.3 merged (PR #13)**: `packages/engine/src/waterfall/` — deterministic candidate windows (pure core) → highlight-select shell (`highlight-select.v1.md`) → `clip_plan` drafts, `fanout_runs`-anchored with fan-out's exact idempotency/backfill semantics; clip-plan body/meta shape documented for B2.6 in `waterfall/schemas.ts`. Lead review fix pre-merge: duplicate `windowIndex` rejection at the shell boundary (would have stranded a half-persisted platform behind backfill).
- **B2.4 merged (PR #14)**: `packages/engine/src/exemplar/` — PII-strip-before-hash ingest (invariant), generic `source_metrics`, retrieval scoped to exemplar/voice_sample kinds, opt-in exemplar-aware fan-out (exemplar ids fold into the generation key; provenance on run params + draft meta; plain runs byte-identical), deterministic 8-word n-gram overlap gate → `judge_results.gate = "exemplar_overlap"` + blocked via the one transition fn (invariant).
- Founder Q&A (pipecat/livekit): **not integrating** — they're real-time conversational voice-agent orchestrators, not ASR; transcription quality = model choice behind the existing `TranscriptProvider` seam. Parakeet-TDT-via-ONNX (sherpa-onnx) recorded as a second driver candidate for a bake-off vs whisper.cpp/faster-whisper at Whisper-driver bucket time (agent memory: future-tooling-candidates).
- Root suite now 187 tests; the orchestrator-worktree caveats (skip lint in lanes, `@thalon/*` vitest aliasing) held — engine's config covered both lanes since they lived inside `packages/engine`.

## Next action

**Cut wave-2 lanes on founder go**: demo (B2.5) + ui (B2.6) per the Sprint-2 board (`COORDINATION.md`) — kickoffs carry the same caveats ("skip lint, lead verifies at merge"); B2.6's kickoff should include the clip-plan draft shape (`packages/engine/src/waterfall/schemas.ts`) and the Sprint-1 queued UI follow-ups (approve-panel refresh after save-edit, aborted-run rows, operator re-judge action). B2.5 adds Playwright (Apache-2.0) as the drive/capture dep. **Lane launch always needs fresh founder approval.**

## [you] — founder-supplied, needed as buckets start (not before)

- B2.3 dogfood (unblocked now): your first pillar video's caption/SRT file (caption-file driver is live; raw media works once the Whisper driver lands).
- B2.5 dogfood: your website URL + which flows to demo.
