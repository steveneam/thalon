/**
 * B2.4 — Exemplar library (ADR 0002 decision 4: retrieval, not
 * fine-tuning). High-performing reference posts (`exemplar`) and the
 * tenant's own voice samples (`voice_sample`) enter as sources with generic
 * metrics, embed into the existing grounding index, and are retrieved
 * top-k into fan-out context; every run records the exemplar ids it used
 * (provenance). Two invariants land as executable ratchets here:
 * exemplars are grounding-only — a deterministic n-gram overlap gate
 * blocks verbatim reuse — and PII is stripped at ingest, deterministically,
 * before anything is stored.
 */
export { stripPii, type PiiStripResult, type PiiStripStats } from "./pii-strip";
export {
  EXEMPLAR_KINDS,
  ingestExemplar,
  type ExemplarKind,
  type ExemplarMetricInput,
  type IngestExemplarDeps,
  type IngestExemplarInput,
  type IngestExemplarResult,
} from "./ingest-exemplar";
export {
  retrieveExemplarContext,
  type ExemplarContext,
  type RetrieveExemplarContextDeps,
  type RetrieveExemplarContextInput,
} from "./retrieve";
export {
  checkNgramOverlap,
  runExemplarOverlapGate,
  EXEMPLAR_OVERLAP_GATE,
  OVERLAP_NGRAM_SIZE,
  type ExemplarChunkRef,
  type ExemplarOverlapOutcome,
  type NgramOverlapResult,
  type OverlapMatch,
  type RunExemplarOverlapGateInput,
} from "./overlap-gate";
export {
  exemplarProfileSchema,
  loadExemplarProfile,
  type ExemplarProfile,
  type LoadedExemplarProfile,
} from "./profile";
