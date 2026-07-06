import type { SearchIntelRow, SearchIntelSource, SearchPollRequest } from "./search-source";

/**
 * Deterministic test double for the B6.8 search-intel seam: no network, no
 * OAuth, no quota — keeps every search test keyless. Doubles as the
 * first-run dogfood driver (the registry default until GSC goes live at
 * B6.7): with no rows configured it serves a small built-in dataset shaped
 * to exercise the horizon math end-to-end on an empty dev checkout — one
 * clear horizon opportunity, one already-ranking query, one flat tail
 * query. Rows are returned as-is in configured order; the poll window is
 * accepted but not interpreted (a fake has no history beyond what it is
 * given).
 */

/** Two-sweep-friendly demo rows: poll once for the baseline, once for the risen week. */
const DEMO_ROWS: SearchIntelRow[] = [
  {
    query: "what is content automation",
    metrics: { clicks: 1, impressions: 180, ctr: 0.005, position: 9 },
  },
  {
    query: "acme motion studio",
    metrics: { clicks: 40, impressions: 220, ctr: 0.18, position: 1.4 },
  },
  {
    query: "diy video editing",
    metrics: { clicks: 0, impressions: 15, ctr: 0, position: 46 },
  },
];

export function createFakeSearchIntelSource(
  rows: readonly SearchIntelRow[] = DEMO_ROWS,
): SearchIntelSource {
  return {
    name: "fake",
    async poll(_request: SearchPollRequest): Promise<SearchIntelRow[]> {
      return rows.map((row) => ({ ...row, metrics: { ...row.metrics } }));
    },
  };
}
