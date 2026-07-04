import type { TrendItem, TrendSource } from "./trend-source";
import type { Watchlist } from "./watchlist";

/**
 * Deterministic test double for the B3.12 intake seam: no network, no API
 * keys, no quota — keeps every trend test keyless (amendment A9 pass-1
 * discipline). Returns exactly the configured items whose `account` is on
 * the watchlist (or all of them when the watchlist names no accounts), in
 * input order. Real official-API pollers replace it behind the same
 * interface in pass 2.
 */
export function createFakeTrendSource(items: readonly TrendItem[]): TrendSource {
  return {
    name: "fake",
    async poll(watchlist: Watchlist): Promise<TrendItem[]> {
      if (watchlist.accounts.length === 0) return [...items];
      const watched = new Set(watchlist.accounts);
      return items.filter((item) => watched.has(item.account));
    },
  };
}
