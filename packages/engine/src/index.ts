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
 *
 * Layout rule (SPINE §1): each module is deterministic core orchestration
 * with a shell/ subfolder for its LLM calls. shell/ code returns candidate
 * values only — it never imports repositories or writes anywhere (enforced
 * by tests/boundary.test.ts at the repo root).
 */
export * from "./ingest";
export * from "./fanout";
export * from "./waterfall";
export * from "./exemplar";
export * from "./demo";
