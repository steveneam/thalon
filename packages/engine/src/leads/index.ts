/**
 * B-crm.1 leads intake (A16 / ADR 0008): waitlist bridge + CSV import over
 * the frozen Sprint-7 window 1 contract. Acquisition invariant: intake
 * paths exist for official-API/operator-supplied contacts ONLY — no
 * scraping, no purchased lists (structural: contracts LEAD_SOURCES is the
 * whole vocabulary). Scoring (B-crm.2) lives in ./scorer.ts when it lands.
 */
export * from "./csv";
export * from "./csv-import";
export * from "./intake";
