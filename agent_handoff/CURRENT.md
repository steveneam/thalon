# Session handoff — CURRENT

> **One file, overwritten at every session wrap (AGENTS.md rule 9).** Pointer + delta + next action only — never a state dump, never a copy of CHARTER/COORDINATION content (link instead). History lives in git.

## Stamp

2026-07-04 (session 4) · **B2.1 merged (PR #11) + B2.2 merged (PR #12) — Sprint-2 contract re-frozen; wave-1 lanes cuttable on founder go**

## Pointer

Read in order: `CLAUDE.md` → `CHARTER.md` (Sprint-2 table + amendment A5) → `docs/adr/0002-sprint2-expansion.md` → `COORDINATION.md` (Sprint-2 lane board + the three 2026-07-04 session-4 messages — B2.1 proof, B2.2 window, A5 landing).

## Delta (this session)

- Sprint-1 exit signed off; **amendment A5 landed** (`docs/adr/0002-sprint2-expansion.md`).
- **B2.1 merged (PR #11)**: tenant #2 as one JSON data file — zero code (criterion met literally); live slice on it queued one draft and blocked one on a real g3 tier disagreement (I3 on a second tenant).
- **B2.2 merged (PR #12)**: the sprint's single contract window (time-coded chunks · new source kinds · `modality`/`visual_ref` seam · `source_metrics` · sources unique index) + timed ingest (fail-loud SRT/VTT/plain parser, segment-atomic timed chunking, `TranscriptProvider` seam, caption-file driver). **Contract re-frozen.**
- Ratchet (founder-prompted): root eslint over packages/proprietary/eval + **lint as a CI step** — CI had never run eslint; lint now gates the PR.
- Direction pinned (board message + agent memory): Whisper driver = in-house, Windows-native (whisper.cpp/faster-whisper, MIT); B3.7 = port-the-pattern (Apache-2.0, no clean room; pgvector + object store + ONNX/DirectML; WSL2 interim; verify weights licence at bucket time).

## Next action

**Cut wave-1 lanes on founder go**: waterfall (B2.3) + exemplar (B2.4) as in-session worktree subagents per the Sprint-2 board (`COORDINATION.md`) — kickoffs say "skip lint, lead verifies at merge" (worktree symlink caveat), merge-order waterfall → exemplar. Wave 2 (demo B2.5 + ui B2.6) follows. **Lane launch always needs fresh founder approval.**

## [you] — founder-supplied, needed as buckets start (not before)

- B2.3 dogfood: your first pillar video — its caption/SRT file (own media; the caption-file driver is live) or the raw file once the Whisper driver lands.
- B2.5 dogfood: your website URL + which flows to demo.
