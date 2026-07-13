/**
 * B-crm.1+2 leads engine (A16 / ADR 0008): intake (waitlist bridge + CSV
 * import) and deterministic scoring over the frozen Sprint-7 window 1
 * contract. Acquisition invariant: intake paths exist for official-API/
 * operator-supplied contacts ONLY — no scraping, no purchased lists
 * (structural: contracts LEAD_SOURCES is the whole vocabulary). Scoring is
 * config-weighted math with readable reasons — zero LLM calls in this cut.
 */
export * from "./csv";
export * from "./csv-import";
export * from "./intake";
export * from "./scorer";
export * from "./scoring-job";
