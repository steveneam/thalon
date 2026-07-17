# ADR 0010 — B-video-editor chartered: EDL-driven editing over the video-project contract

- **Status:** accepted (founder, 2026-07-16, session 46: ratified as proposed at the checkpoint; directed to start at s45 close)
- **Amendment (B-ve.5 half-window, founder-confirmed s50 2026-07-17):** the contract re-opened ADDITIVELY for the aspect lens and re-froze at the B-ve.5 merge — `videoCutLineageSchema` (parent-cut pin + declared W:H aspect, stored at `meta.lineage`, the meta.attribution pattern: no table change) + `VIDEO_DERIVE_ASPECTS`/`DERIVE_CANVAS` (9:16 → 1080×1920, 1:1 → 1080×1080) + one additive repo door `videoCuts.stampLineage` (one-way: identical replay no-op, conflicting stamp fails loud, parent same-project through the tenancy wall, `video_cut.lineage_stamped` event in-transaction). Lineage is provenance with an honest staleness signal only — **no auto-sync exists**: a parent edit never touches a derived cut. Wave-2 verdict landed at the same checkpoint: **mint the full slate ⑥–⑩**, starting the following session.
- **Amendment (B-ve.4 half-window, founder-confirmed s49 2026-07-16):** the frozen B-ve.1 contract re-opened ADDITIVELY for exactly four needs and re-froze at the B-ve.4 merge — (1) `video: copy` output mode (the G-score mux made expressible; stream-copy refusals at the schema door), (2) `audioCue.fadeIn` + `bitrateKbps` (the hand mux carried a 1.2s entry ease and a 192k encode the ledger never recorded — both recovered from the master's own waveform and proven by exact audio framemd5), (3) `edlDiffSchema` + `videoCutAttributionSchema` (the AI-assist wire: measured ops each carrying `why`; agent saves must carry base-cut pin + model + prompt hash + the exact diff), (4) eval origin `cut_diff_review` (migration 0011, constraint-widening only). Wave-2 + credit verdicts at the same checkpoint: slate HELD to B-ve.5/sprint end; Plus retained regardless; claude-design chartered as a landing+workspace design phase after wave 2.
- **Context home:** `docs/research/video-editor-tools.md` (tooling survey + integration sketch; supersedes it as the decision of record)
- **Relates to:** ADR 0004 (render-driver seam) · ADR 0008 (Sprint 7 charter this interleaves with) · ADR 0009 (TS core — this build names no Rust modules)

## Context

The founder asked for "basically a video editor" in-app (s44), re-affirmed with the direction that AI may assist the editing *or* the operator does it manually (s45). The shipped product covers staged video *creation* (B5.2/B5.4) but has no *editing* surface over a finished project. Sessions 42–45 hand-built every operation such an editor would automate — take swaps, trims/clone-extensions, caption plates + placement, measured music alignment, per-beat grades, aspect recomposition, churn-audited QA — and the two hand recipes (`build-captions.sh`, `build-9x16.sh`) are edit decision lists in shell form. The concept-film project tree is the founder-directed reference shape for the video-project contract.

## Decision

Charter **B-ve.1–.5** per the survey §4. The productization is **one new schema (EDL), one compiler, one workspace surface**; everything else is reuse (judge gate, render seam, provenance pinning, one-status-writer, per-tenant config).

1. **B-ve.1 — contract window:** video-project + EDL schemas (OTIO-shaped JSON, zod, tenant-scoped) in `packages/contracts`; EDL→ffmpeg-filtergraph compiler in the engine; **golden tests replay both film masters (16:9 + 9:16) byte-stable from checked-in EDL fixtures** — the hand recipes become executable ratchets.
2. **B-ve.2 — project surface (read-only):** browse takes/cuts/provenance in the workspace; reject reasons visible (the learning material).
3. **B-ve.3 — timeline editor MVP (manual first):** reorder / trim / take-swap / caption moves / music offset + waveform lane (wavesurfer with the s44 measured-envelope overlay); server render; versioned cuts.
4. **B-ve.4 — AI-assist:** the agent proposes **EDL diffs** (music alignment + caption placement first — the measured ops) through the same door the UI writes; diff view → operator approve; judge gate on all text layers; every applied diff replayable + attributed; corrections → eval rows.
5. **B-ve.5 — aspect lens:** per-beat crop/pan handles; vertical/square recuts as derived EDLs.

**Adopted seats:** OTIO schema *shape* (not the WIP JS bindings) · ffmpeg assembler of record + Hyperframes for HTML-native layers (already ours) · wavesurfer.js (BSD-3) · mediabunny (MPL-2.0 — used unmodified, isolated behind a clean interface per licensing hygiene) for client-side preview/scrub · auto-editor (Unlicense) / PySceneDetect (BSD-3) as ingest-side suggesters when client footage arrives. **Watch item:** OpenCut's Rust core (MIT; headless+MCP roadmap) as a possible future *module* swap per ADR 0009. **Ruled out on the hot path:** Remotion (commercial gate, consistent with its B5.1 demotion), anything AGPL, any vendor-metered edit operation.

## Invariants (safety one-way)

- **No vendor-metered call on any edit path.** Edit operations are 0-credit local/deterministic; generative elaboration (e.g. Seedance) stays a *creation* seat, never an edit op.
- **Aspect variants are own-engine recuts, never vendor reframe** (s44 directive; 0cr vs 225cr proven).
- **An edited caption/text layer is content like any other draft** — it passes the judge harness (denylist + grounding) before a cut can be marked approved.
- **AI edits go through the same contract door as manual edits** (EDL diffs → operator approval), replayable and attributed; corrections feed the eval suite (AGENTS.md rule 6).

## Consequences

- B-ve.1 opens as a sprint contract window (contract-window skill) immediately on ratification; the film tree is the reference shape and the two recipes become EDL fixtures.
- Wave-2 template minting was **held** at the same checkpoint (no slate verdict yet); B-ve.1–.3 burn no credits, so the build is independent of the month-end vendor-tier call.
- License facts re-verified 2026-07-16 (survey stamp = charter date); re-verify at each later bucket if the gap grows.
- CHARTER.md amendment A17 records the bucket table; lane sequencing stays on COORDINATION.md.

*Tag: the four invariants above are invariants; the bucket ordering and seat picks are opinions (revisable at checkpoints).*
