# ADR 0009 — TypeScript stays the core; Rust only as targeted modules behind seams

- **Status:** accepted (founder, 2026-07-16, session 45: "let's follow your recommendation")
- **Context home:** `docs/research/video-editor-tools.md` (the survey whose OpenCut Rust-core finding prompted the question).
- **Relates to:** ADR 0004 (render-driver seam — the pattern this policy generalizes).

## Context

The OpenCut rewrite (Rust core for a cross-platform frame-accurate editor) prompted the question: should Thalon migrate to a Rust core for smoothness/robustness as a web tool?

## Decision

**No migration. TypeScript remains the core.** Thalon is an orchestration engine: its wall-clock lives in LLM-gateway calls, vendor mints, Postgres, and ffmpeg subprocesses (already native C, as are sharp/libvips). Rewriting the coordination layer moves none of that, while costing a multi-month port of the engine/contracts/db/judge/eval stack and its test suite (1193 tests at this stamp), freezing the roadmap mid-portfolio, and trading away the iteration velocity that is the build's actual moat. Robustness at Thalon's altitude comes from structural invariants (one-status-writer, judge gates, tenancy on every schema, CI guard), not from a systems language.

**Escape hatch (the policy):** if profiling ever shows a genuinely CPU-bound hot path, adopt Rust as a **small module behind an existing seam** (napi-rs native module or WASM), isolated exactly like license-gated deps — incremental and reversible, never a rewrite. Browser-side heavy compute routes to WebCodecs first.

**Robustness budget instead routes to** the already-identified cheap hardening: `next build` CI job, RLS ratchet on the tenant Postgres, WAF at the edge.

## Consequences

- Any future "rewrite in X" proposal starts from this ADR: it must name the profiled CPU-bound path and why a seam-isolated module can't carry it.
- The B-video-editor candidate builds on the TS engine + ffmpeg/Hyperframes per the survey; OpenCut's Rust core remains a watch item as a possible *module* swap (preview/engine), not an architecture.

*Tag: opinion (architecture policy — revisit only with profiling evidence); the seam-isolation discipline it leans on restates the licensing-hygiene invariant.*
