import { readEnv } from "@thalon/platform";
import { z } from "zod";
import type { TrendItem, TrendSource } from "./trend-source";
import type { Watchlist } from "./watchlist";

/**
 * B6.5 YouTube driver — official Data API v3, keyed (YOUTUBE_API_KEY via the
 * platform env choke point, or injected config). Two-step poll per query:
 * search.list (the EXPENSIVE call — its own ~100-unit/day bucket under the
 * June-2026 granular quota, per the A12 re-charter research) finds video
 * ids, then one videos.list batch (cheap) fetches statistics. Quota budgets
 * are CONFIG (ADR 0005): maxSearchesPerSweep defaults to 1 — a sweep that
 * needs more fails LOUD naming the knobs, never silently truncating.
 *
 * Extraction tier is what the official API hands over for video platforms:
 * title + description as `text` (TrendItem's documented bound — spoken-hook
 * transcripts arrive only via the B3.13/B4.8 transcript paths, never here).
 * `account` is the channelId — the stable velocity-baseline group.
 *
 * Account polling (channel uploads) is a NAMED follow-up, refused loudly
 * below: it costs 3 requests per account per sweep (channels→playlistItems→
 * videos) and the keyless Bluesky driver covers account watching today.
 */

export const youtubeConfigSchema = z.object({
  /** Data API key — absent = the driver refuses to poll (the gsc-source pattern). */
  apiKey: z.string().optional(),
  serviceUrl: z.string().min(1).default("https://www.googleapis.com/youtube/v3"),
  /** search.list ordering — "relevance" (default), "date" (freshest), or "viewCount". */
  order: z.enum(["relevance", "date", "viewCount"]).default("relevance"),
  /** Videos requested per query (search.list caps at 50). */
  perQueryLimit: z.number().int().positive().max(50).default(25),
  /** Per-sweep search.list budget — the expensive bucket, spent deliberately. */
  maxSearchesPerSweep: z.number().int().positive().default(1),
});
export type YoutubeConfigInput = z.input<typeof youtubeConfigSchema>;
export type YoutubeConfig = z.infer<typeof youtubeConfigSchema>;

export interface YoutubeSourceDeps {
  /** Injectable fetch (tests) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Keyed runtime config — apiKey defaults to the YOUTUBE_API_KEY env. */
  config?: YoutubeConfigInput;
}

const searchResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.object({ videoId: z.string().min(1) }).loose(),
    }),
  ),
});

const videosResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      snippet: z
        .object({
          title: z.string().default(""),
          description: z.string().default(""),
          channelId: z.string().min(1),
          publishedAt: z.string(),
        })
        .loose(),
      /** The API reports counters as STRINGS; coerce at the boundary. */
      statistics: z
        .object({
          viewCount: z.coerce.number().optional(),
          likeCount: z.coerce.number().optional(),
          commentCount: z.coerce.number().optional(),
        })
        .loose()
        .default({}),
    }),
  ),
});

/**
 * The API's own words for WHY a call failed, formatted as a suffix.
 *
 * This runs on a path that is already failing, so it may never throw itself:
 * every read is guarded and an unreadable body degrades to the empty string,
 * leaving the caller's message exactly as loud as it was before.
 */
async function failureReason(response: { text(): Promise<string> }): Promise<string> {
  let body = "";
  try {
    body = await response.text();
  } catch {
    return "";
  }
  if (!body.trim()) return "";
  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: unknown; errors?: Array<{ reason?: unknown; message?: unknown }> };
    };
    const first = parsed.error?.errors?.[0];
    const reason = typeof first?.reason === "string" ? first.reason : undefined;
    const message =
      typeof parsed.error?.message === "string"
        ? parsed.error.message
        : typeof first?.message === "string"
          ? first.message
          : undefined;
    if (reason && message) return ` — ${reason}: ${message}`;
    if (reason) return ` — ${reason}`;
    if (message) return ` — ${message}`;
  } catch {
    // Not JSON; fall through to the raw slice below.
  }
  return ` — ${body.replace(/\s+/g, " ").trim().slice(0, 200)}`;
}

export function youtubeTrendSource(deps: YoutubeSourceDeps = {}): TrendSource {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const config = youtubeConfigSchema.parse(deps.config ?? {});
  // The hosted-vendor rule: an injected config opts out of env defaults
  // entirely (tests stay hermetic; the registry path passes no config).
  const apiKey = config.apiKey ?? (deps.config ? undefined : readEnv().YOUTUBE_API_KEY);

  async function call(resource: string, params: Record<string, string>): Promise<unknown> {
    const url = new URL(`${config.serviceUrl}/${resource}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("key", apiKey ?? "");
    const response = await fetchImpl(url.toString());
    if (!response.ok) {
      // The status alone is ambiguous where it matters most: a 403/429 is
      // `quotaExceeded` (daily units gone — resets at Pacific midnight),
      // `rateLimitExceeded` (slow down, retry works) or `keyInvalid` (the key
      // is wrong and no amount of waiting fixes it). Those are three different
      // remedies, and the API states which one in the body — so carry it.
      throw new Error(`youtube ${resource} responded ${response.status}${await failureReason(response)}`);
    }
    const body = await response.text();
    try {
      return JSON.parse(body);
    } catch {
      throw new Error(`youtube ${resource} returned non-JSON (${body.slice(0, 120)}…)`);
    }
  }

  return {
    name: "youtube",
    async poll(watchlist: Watchlist): Promise<TrendItem[]> {
      if (!apiKey) {
        throw new Error(
          'trend source "youtube" is not configured — connect "YouTube intel" in Settings → Integrations (tenant vault, B-int.3), or set YOUTUBE_API_KEY (the env override; a free Data API v3 key — quota budgets stay config)',
        );
      }
      if (watchlist.accounts.length > 0) {
        throw new Error(
          "youtube account polling is a recorded follow-up (3 requests per account per sweep) — watch accounts on the keyless bluesky driver, or use queries here",
        );
      }
      if (watchlist.queries.length > config.maxSearchesPerSweep) {
        throw new Error(
          `youtube sweep needs ${watchlist.queries.length} search.list calls — over maxSearchesPerSweep=${config.maxSearchesPerSweep} (each spends ~100 units of its own daily bucket). Raise the budget deliberately or lower the area query rations (maxQueriesPerSweep); nothing truncates silently.`,
        );
      }

      const videoIds = new Set<string>();
      for (const query of watchlist.queries) {
        const raw = await call("search", {
          part: "snippet",
          type: "video",
          q: query,
          order: config.order,
          maxResults: String(config.perQueryLimit),
        });
        for (const item of searchResponseSchema.parse(raw).items) videoIds.add(item.id.videoId);
      }
      if (videoIds.size === 0) return [];

      // videos.list caps `id` at 50 per call — chunk, never one giant 400.
      // Latent while maxSearchesPerSweep=1 bounded a sweep to 25 ids; the s72
      // ration raise let one sweep collect hundreds. videos.list is the cheap
      // bucket (1 unit/call), so chunking costs quota-nothing.
      const ids = [...videoIds];
      const videos: z.infer<typeof videosResponseSchema>["items"] = [];
      for (let i = 0; i < ids.length; i += 50) {
        const raw = await call("videos", {
          part: "snippet,statistics",
          id: ids.slice(i, i + 50).join(","),
          maxResults: "50",
        });
        videos.push(...videosResponseSchema.parse(raw).items);
      }
      return videos.map((video) => ({
        externalId: video.id,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        text: [video.snippet.title, video.snippet.description].filter(Boolean).join("\n"),
        account: video.snippet.channelId,
        publishedAt: Date.parse(video.snippet.publishedAt),
        metrics: {
          views: video.statistics.viewCount ?? 0,
          likes: video.statistics.likeCount ?? 0,
          comments: video.statistics.commentCount ?? 0,
        },
      }));
    },
  };
}
