/**
 * Skeleton (amendment A3). Fills in per bucket:
 *  - src/ingest/  — B1.1: source → chunks → embeddings → grounding index
 *  - src/fanout/  — B1.2: source × profile × platform → drafts
 *
 * Layout rule (SPINE §1): each module is deterministic core orchestration
 * with a shell/ subfolder for its LLM calls. shell/ code returns candidate
 * values only — it never imports repositories or writes anywhere (enforced
 * by tests/boundary.test.ts at the repo root).
 */
export {};
