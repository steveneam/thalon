import { readEnv } from "@thalon/platform";
import { z } from "zod";
import type { TrendItem, TrendSource } from "./trend-source";
import type { Watchlist } from "./watchlist";

/**
 * B6.5 Bluesky driver — the first LIVE TrendSource (ADR 0005; charter row
 * B6.5 "official APIs, per-driver quota budgets as config"). Speaks the
 * official AT Protocol AppView API. Access is split exactly as the platform
 * splits it (probed live 2026-07-07):
 *
 *   accounts → app.bsky.feed.getAuthorFeed on the PUBLIC AppView
 *              (public.api.bsky.app) — genuinely keyless, works today.
 *              Reposts are skipped: watching an account means watching what
 *              IT publishes; a repost's engagement belongs to the original.
 *   queries  → app.bsky.feed.searchPosts now returns 403 unauthenticated,
 *              so query search runs over a FREE app-password session
 *              (com.atproto.server.createSession on bsky.social →
 *              accessJwt). No credentials + queries in the watchlist =
 *              refuse LOUDLY naming the env knobs — never silently skip.
 *
 * Read-only like every seam driver: polls, maps, returns — only intake.ts
 * writes. Metrics keep Bluesky's own counter names (likes/reposts/replies/
 * quotes — SPINE §4.1: metric names are data; the tenant's outlier config
 * maps them). The request budget is a per-sweep backstop AS CONFIG: a
 * watchlist that would exceed it fails LOUD naming both knobs (the gsc
 * quota-refusal shape) — the area-expansion ration is the primary faucet,
 * this is the never-silently-truncate guarantee.
 */

export const blueskyConfigSchema = z.object({
  /** The public AppView host (keyless reads) — swappable for a self-hosted AppView or test double. */
  serviceUrl: z.string().min(1).default("https://public.api.bsky.app"),
  /** The PDS host that mints sessions and proxies authed reads (searchPosts). */
  authServiceUrl: z.string().min(1).default("https://bsky.social"),
  /** Account handle/DID for the app-password session — absent = query search refuses (defaults from BLUESKY_IDENTIFIER). */
  identifier: z.string().optional(),
  /** App password (never the main password — Bluesky mints these per app; defaults from BLUESKY_APP_PASSWORD). */
  appPassword: z.string().optional(),
  /** searchPosts ranking: "top" (engagement-ranked — the trend-intel default) or "latest". */
  sort: z.enum(["top", "latest"]).default("top"),
  /** Posts requested per query (API max 100). */
  perQueryLimit: z.number().int().positive().max(100).default(25),
  /** Posts requested per watched account (API max 100). */
  perAccountLimit: z.number().int().positive().max(100).default(25),
  /** Hard per-sweep request budget — one query or one account = one request (the session mint rides free). */
  maxRequestsPerSweep: z.number().int().positive().default(24),
});
export type BlueskyConfigInput = z.input<typeof blueskyConfigSchema>;
export type BlueskyConfig = z.infer<typeof blueskyConfigSchema>;

export interface BlueskySourceDeps {
  /** Injectable fetch (tests) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  config?: BlueskyConfigInput;
}

/** The slice of an AppView PostView this driver reads — everything else passes through untouched. */
const postViewSchema = z.object({
  uri: z.string().min(1),
  author: z.object({ handle: z.string().min(1) }).loose(),
  record: z.object({ text: z.string().optional(), createdAt: z.string().optional() }).loose(),
  replyCount: z.number().optional(),
  repostCount: z.number().optional(),
  likeCount: z.number().optional(),
  quoteCount: z.number().optional(),
  indexedAt: z.string(),
});
type PostView = z.infer<typeof postViewSchema>;

const searchPostsResponseSchema = z.object({ posts: z.array(postViewSchema) });
const authorFeedResponseSchema = z.object({
  feed: z.array(
    z.object({
      post: postViewSchema,
      /** Present on reposts (reasonRepost) — those are skipped. */
      reason: z.unknown().optional(),
    }),
  ),
});
const sessionResponseSchema = z.object({ accessJwt: z.string().min(1) });

/** at://did:plc:…/app.bsky.feed.post/<rkey> → a human-followable bsky.app URL. */
function postUrl(uri: string, handle: string): string | undefined {
  const rkey = uri.split("/").pop();
  return rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : undefined;
}

function toTrendItem(post: PostView): TrendItem {
  const publishedAtIso = post.record.createdAt ?? post.indexedAt;
  return {
    externalId: post.uri,
    url: postUrl(post.uri, post.author.handle),
    text: post.record.text ?? "",
    account: post.author.handle,
    publishedAt: Date.parse(publishedAtIso),
    metrics: {
      likes: post.likeCount ?? 0,
      reposts: post.repostCount ?? 0,
      replies: post.replyCount ?? 0,
      quotes: post.quoteCount ?? 0,
    },
  };
}

export function blueskyTrendSource(deps: BlueskySourceDeps = {}): TrendSource {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const config = blueskyConfigSchema.parse(deps.config ?? {});
  // The hosted-vendor rule: an injected config opts out of env defaults
  // entirely (tests stay hermetic; the registry path passes no config).
  const env = deps.config ? undefined : readEnv();
  const identifier = config.identifier ?? env?.BLUESKY_IDENTIFIER;
  const appPassword = config.appPassword ?? env?.BLUESKY_APP_PASSWORD;

  async function callXrpc(
    base: string,
    method: string,
    params: Record<string, string>,
    accessJwt?: string,
  ): Promise<unknown> {
    const url = new URL(`/xrpc/${method}`, base);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetchImpl(
      url.toString(),
      accessJwt ? { headers: { authorization: `Bearer ${accessJwt}` } } : undefined,
    );
    if (!response.ok) {
      throw new Error(`bluesky ${method} responded ${response.status} for ${url.search}`);
    }
    const body = await response.text();
    try {
      return JSON.parse(body);
    } catch {
      throw new Error(`bluesky ${method} returned non-JSON (${body.slice(0, 120)}…)`);
    }
  }

  async function createSession(): Promise<string> {
    const response = await fetchImpl(new URL("/xrpc/com.atproto.server.createSession", config.authServiceUrl).toString(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password: appPassword }),
    });
    if (!response.ok) {
      throw new Error(
        `bluesky createSession responded ${response.status} — check BLUESKY_IDENTIFIER / BLUESKY_APP_PASSWORD (an app password, not the account password)`,
      );
    }
    return sessionResponseSchema.parse(JSON.parse(await response.text())).accessJwt;
  }

  return {
    name: "bluesky",
    async poll(watchlist: Watchlist): Promise<TrendItem[]> {
      const requestsNeeded = watchlist.queries.length + watchlist.accounts.length;
      if (requestsNeeded > config.maxRequestsPerSweep) {
        throw new Error(
          `bluesky sweep needs ${requestsNeeded} requests (${watchlist.queries.length} queries + ${watchlist.accounts.length} accounts) — over maxRequestsPerSweep=${config.maxRequestsPerSweep}. Raise the budget deliberately or lower the area query rations (maxQueriesPerSweep); nothing truncates silently.`,
        );
      }
      if (watchlist.queries.length > 0 && (!identifier || !appPassword)) {
        throw new Error(
          "bluesky query search needs a free app-password session (searchPosts is 403 unauthenticated on the public AppView) — set BLUESKY_IDENTIFIER + BLUESKY_APP_PASSWORD, or watch accounts only (keyless)",
        );
      }

      const byExternalId = new Map<string, TrendItem>();

      if (watchlist.queries.length > 0) {
        const accessJwt = await createSession();
        for (const query of watchlist.queries) {
          const raw = await callXrpc(
            config.authServiceUrl,
            "app.bsky.feed.searchPosts",
            { q: query, sort: config.sort, limit: String(config.perQueryLimit) },
            accessJwt,
          );
          for (const post of searchPostsResponseSchema.parse(raw).posts) {
            const item = toTrendItem(post);
            byExternalId.set(item.externalId, item);
          }
        }
      }

      for (const account of watchlist.accounts) {
        const raw = await callXrpc(config.serviceUrl, "app.bsky.feed.getAuthorFeed", {
          actor: account,
          filter: "posts_no_replies",
          limit: String(config.perAccountLimit),
        });
        for (const entry of authorFeedResponseSchema.parse(raw).feed) {
          if (entry.reason !== undefined) continue; // a repost — not this account's own publication
          const item = toTrendItem(entry.post);
          byExternalId.set(item.externalId, item);
        }
      }

      return [...byExternalId.values()];
    },
  };
}
