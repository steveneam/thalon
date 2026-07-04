import { z } from "zod";

/**
 * B3.12 per-tenant watchlist — RUNTIME CONFIG, never code (CHARTER B3.12:
 * accounts/queries/niches the tenant watches). In pass 1 (amendment A9) a
 * watchlist arrives as a validated config object from gitignored tenant
 * config; durable storage/UI for watchlists lands with the live pollers in
 * pass 2. `source` names the TrendSource driver that serves this watchlist
 * (e.g. "youtube", "bluesky", "fake") — driver selection is data.
 */
export const watchlistSchema = z.object({
  source: z.string().min(1),
  /** Account handles/channel ids to watch (platform-native strings — data). */
  accounts: z.array(z.string().min(1)).default([]),
  /** Search queries / niche terms to watch. */
  queries: z.array(z.string().min(1)).default([]),
});

export type WatchlistInput = z.input<typeof watchlistSchema>;
export type Watchlist = z.infer<typeof watchlistSchema>;
