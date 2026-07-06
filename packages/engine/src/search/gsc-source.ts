import { z } from "zod";
import type { SearchIntelRow, SearchIntelSource, SearchPollRequest } from "./search-source";

/**
 * B6.8 Google Search Console driver SKELETON (ADR 0006: GSC is the one
 * live driver this seam will ever get — a free official API behind
 * operator OAuth on a verified property; ≈50k rows/day/site quota). The
 * shape is the official Search Analytics API: POST
 * `sites/{siteUrl}/searchAnalytics/query` with a date window + dimensions,
 * rows back as `keys` (per requested dimension) + clicks/impressions/ctr/
 * position. Live wiring is DEPLOY-GATED (B6.7 — a site with zero deploys
 * has zero GSC data): this skeleton REFUSES to run without explicit
 * config, and the operator-OAuth flow that mints `accessToken` is B6.7's
 * work. No env key exists for it yet, on purpose — config arrives
 * injected, exactly like the hosted transcript vendor's keyed config.
 * Tests inject `fetchImpl` and never go live.
 */

const gscRowSchema = z.object({
  keys: z.array(z.string()).min(1),
  clicks: z.number(),
  impressions: z.number(),
  ctr: z.number(),
  position: z.number(),
});

const gscResponseSchema = z.object({
  /** GSC omits `rows` entirely when the window has no data. */
  rows: z.array(gscRowSchema).optional(),
});

export const gscConfigSchema = z.object({
  /** The verified property, e.g. "sc-domain:example.com" or "https://example.com/". */
  siteUrl: z.string().min(1),
  /** Operator-OAuth access token PLACEHOLDER — B6.7 wires the real flow (offline refresh, scope webmasters.readonly). */
  accessToken: z.string().min(1),
  /** Search Analytics dimensions, key order = `keys` order. query-only = site aggregates; +page = per-URL series. */
  dimensions: z
    .array(z.enum(["query", "page"]))
    .min(1)
    .default(["query", "page"])
    .refine((d) => d.includes("query"), {
      message: 'dimensions must include "query" — snapshots are keyed per query',
    }),
  /** Per-poll row cap (the API caps a single request at 25k). */
  rowLimit: z.number().int().positive().max(25_000).default(1_000),
  /**
   * The documented free quota, AS CONFIG (ADR 0005: quota budgets are
   * config, not code) — a single poll may never request more than this;
   * cross-poll daily budgeting is B6.7 wiring.
   */
  dailyRowQuota: z.number().int().positive().default(50_000),
});
export type GscConfigInput = z.input<typeof gscConfigSchema>;
export type GscConfig = z.infer<typeof gscConfigSchema>;

export interface GscSourceDeps {
  /** Injectable fetch (tests) — defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected runtime config; ABSENT = unconfigured, and the driver refuses to poll. */
  config?: GscConfigInput;
}

const API_BASE = "https://searchconsole.googleapis.com/webmasters/v3/sites";

export function gscSearchIntelSource(deps: GscSourceDeps = {}): SearchIntelSource {
  const fetchImpl = deps.fetchImpl ?? fetch;
  return {
    name: "gsc",
    async poll(request: SearchPollRequest): Promise<SearchIntelRow[]> {
      if (!deps.config) {
        throw new Error(
          'search intel source "gsc" is not configured — it needs a verified property + operator OAuth (siteUrl, accessToken), which B6.7 wires at deploy; nothing polls before the site exists (ADR 0006)',
        );
      }
      const config = gscConfigSchema.parse(deps.config);
      const rowLimit = Math.min(request.rowLimit ?? config.rowLimit, config.rowLimit);
      if (rowLimit > config.dailyRowQuota) {
        throw new Error(
          `gsc poll would request ${rowLimit} rows — over the configured daily quota of ${config.dailyRowQuota} (quota budgets are config; raise dailyRowQuota deliberately, never silently)`,
        );
      }

      const response = await fetchImpl(
        `${API_BASE}/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.accessToken}`,
          },
          body: JSON.stringify({
            startDate: request.startDate,
            endDate: request.endDate,
            dimensions: config.dimensions,
            rowLimit,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(
          `gsc responded ${response.status} for "${config.siteUrl}" (${request.startDate}..${request.endDate})`,
        );
      }
      const body = await response.text();
      let candidate: unknown;
      try {
        candidate = JSON.parse(body);
      } catch {
        throw new Error(`gsc returned non-JSON for "${config.siteUrl}" (${body.slice(0, 120)}…)`);
      }
      const parsed = gscResponseSchema.parse(candidate);

      const queryIdx = config.dimensions.indexOf("query");
      const pageIdx = config.dimensions.indexOf("page");
      return (parsed.rows ?? []).map((row) => ({
        query: row.keys[queryIdx] ?? "",
        ...(pageIdx >= 0 && row.keys[pageIdx] !== undefined ? { page: row.keys[pageIdx] } : {}),
        metrics: {
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        },
      }));
    },
  };
}
