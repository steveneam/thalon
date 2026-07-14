/**
 * B1.1 landed: src/ingest/ — source -> chunks -> embeddings -> grounding
 * index. B1.2 landed: src/fanout/ — one source -> N platform-native drafts.
 * B2.3 landed: src/waterfall/ — a timed source -> candidate clip windows ->
 * highlight-select -> N clip_plan drafts.
 * B2.4 landed: src/exemplar/ — exemplar/voice_sample ingest + retrieval into
 * fan-out context, with its PII-strip and overlap-gate ratchets.
 * B2.5 landed: src/demo/ — site crawl -> flow map -> storyboard (judged) ->
 * approved demo_plan -> deterministic Playwright drive -> raw capture
 * (video + synthetic cursor track + event trace, content-addressed).
 * B3.9 landed: src/origination/ — operator prompt + active-profile identity
 * + optional grounding sources (site crawl / repo readme) -> one judged
 * pillar_script draft. Multi-source grounding assembly lives in
 * @thalon/judge (collectGroundingChunks, run INSIDE the pipeline by
 * default) so no judge caller can under-ground a draft.
 * B3.10 landed (thin, pass 1 per A9): src/render/ — approved pillar_script
 * -> deterministic SRT from the authored beats + content-addressed render
 * manifest behind the RenderTarget seam (real Remotion target = pass 2).
 * B3.15 landed (thin deploy per A9): src/webpage/ — operator prompt +
 * active-profile identity + optional grounding -> one judged web_page
 * draft (body = the artifact's extracted visible text; self-containment
 * enforced structurally) -> approved draft ships via the DeployTarget seam
 * (real Vercel adapter = pass 2).
 * B3.12 landed (skeleton per A9): src/trend/ — watchlist (runtime config)
 * -> TrendSource seam poll (official-API drivers = pass 2) -> deterministic
 * outlier ratios in core -> outliers auto-ingest as exemplars via the B2.4
 * path (PII-stripped, G1 denylist-screened), snapshots into source_metrics.
 * B6.4 landed (A12/ADR 0005): src/trend/ grew intel v2 — monitored areas
 * expand deterministically into rationed per-sweep queries (candidate
 * generation) and an EdgeRank-shaped config-weighted ranker scores every
 * polled item per area (embedding relevance × engagement ratios ×
 * velocity/freshness, one reason line per armed signal); ingested outlier
 * exemplars carry area provenance as additive sources.meta.trend keys.
 * B5.2 landed (A11): src/direction/ + src/pipeline/staged-video.ts — the
 * staged video pipeline: stage plan (contracts registry, count is config)
 * -> storyboard (structure) -> direction_doc (scenes/effects, polish), each
 * stage judged before it advances (structural gate on queued/approved);
 * deterministic-first prefill; deterministic export (timeline/SRT/dims);
 * one-prompt mode = the same stages auto-advanced. pillar_script untouched.
 * B6.8 landed (A13): src/search/ — search intel as Intel's second half:
 * profile-seeded keyword compilation (deterministic core + judged AI
 * expansion via the pinned search.keyword_expand shell op) -> search_targets;
 * SearchIntelSource seam (fake default, GSC skeleton deploy-gated, paid
 * tools a fail-loud swap path) -> append-only search_snapshots -> horizon
 * opportunity math (position window x rising impressions x below-expected
 * CTR, reason strings); on-page pack (question H2s/answer-first, JSON-LD
 * honesty, llms.txt) beside the judge's advisory seo_aeo lens.
 *
 * Layout rule (SPINE §1): each module is deterministic core orchestration
 * with a shell/ subfolder for its LLM calls. shell/ code returns candidate
 * values only — it never imports repositories or writes anywhere (enforced
 * by tests/boundary.test.ts at the repo root).
 */
export * from "./assets";
export * from "./ingest";
export * from "./fanout";
export * from "./waterfall";
export * from "./exemplar";
export * from "./demo";
export * from "./origination";
export * from "./render";
export * from "./webpage";
export * from "./trend";
export * from "./direction";
export * from "./pipeline/staged-video";
export * from "./search";
export * from "./leads";
export * from "./outreach";
