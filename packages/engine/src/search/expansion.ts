import {
  brandIdentitySchema,
  renderBrandIdentity,
  type TenantCtx,
} from "@thalon/contracts";
import { IrrecoverableGenerationError, type Repos } from "@thalon/db";
import { runG1Denylist } from "@thalon/judge";
import { modelTiers, readEnv, withGatewayGuard } from "@thalon/platform";
import { z } from "zod";
import { generateValidatedCandidate } from "../pipeline/repair-loop";
import { normalizeQuery } from "./seed-compiler";
import { keywordExpansionShellOutputSchema } from "./schemas";
import {
  gatewayKeywordExpansionDriver,
  keywordExpansionPromptVersion,
  type KeywordExpansionDriver,
} from "./shell/expander";

/**
 * B6.8 judged AI keyword expansion (ADR 0006 decision 4a) — the fluent
 * second half of search-target compilation. The shell proposes; core
 * DISPOSES, with the judge harness's own gates run deterministically over
 * every candidate BEFORE anything persists:
 *
 *  1. G1 denylist (the same pure gate the judge and trend intake run,
 *     same per-tenant data) over keyword + rationale;
 *  2. grounding-to-the-profile: keywords are queries, not prose claims,
 *     so grounding is deterministic — a candidate's content words must
 *     actually appear in the rendered identity (ratio ≥ config). The
 *     shell was given ONLY the identity as subject matter; a keyword that
 *     imports outside vocabulary is ungrounded by construction and is
 *     rejected with the ratio in its reason. (Prose claims keep going
 *     through the model-graded G3 gates — this deliberately isn't that.)
 *
 * Survivors persist via `searchTargets.add` (`origin: "ai_expansion"`,
 * first origin wins) with rationale + promptVersion + profile version as
 * provenance. Rejections are RETURNED with reasons, never silently
 * dropped. Every shell attempt (including repair retries) meters through
 * the one gateway choke point as `search.keyword_expand` — pinned in the
 * B5.3 shell inventory.
 */

export const expansionGateConfigSchema = z.object({
  /** Minimum fraction of a keyword's content words that must appear in the rendered identity. */
  minOverlapRatio: z.number().min(0).max(1).default(0.5),
  /**
   * Query-scaffold and function words excluded from grounding on BOTH
   * sides (data, never code): "best x for y" grounds on x and y, not on
   * "best"/"for".
   */
  stopwords: z
    .array(z.string().min(1))
    .default([
      "a", "an", "the", "and", "or", "of", "in", "on", "for", "to", "with", "without",
      "your", "my", "our", "you", "it", "its",
      "is", "are", "was", "does", "do", "did", "can", "could", "should", "will",
      "what", "how", "why", "when", "which", "who", "where",
      "best", "top", "vs", "versus", "alternatives", "alternative", "pricing", "cost",
      "guide", "tips", "examples", "tutorial", "start", "work", "works", "working",
    ]),
});
export type ExpansionGateConfigInput = z.input<typeof expansionGateConfigSchema>;
export type ExpansionGateConfig = z.infer<typeof expansionGateConfigSchema>;

function contentTokens(text: string, stopwords: ReadonlySet<string>): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !stopwords.has(token));
}

export interface KeywordExpansionRequest {
  /** How many keywords the shell is asked for. */
  count?: number;
  gate?: ExpansionGateConfigInput;
}

export interface KeywordExpansionDeps {
  driver?: KeywordExpansionDriver;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface KeywordExpansionResult {
  /** Distinct candidates the shell proposed (after normalization/in-batch dedupe). */
  proposed: number;
  /** Gate survivors, persisted — `created: false` = the keyword already existed (first origin wins). */
  persisted: Array<{ keyword: string; created: boolean }>;
  /** Every gated-out candidate WITH its reason — rejections are signal, never silent. */
  rejected: Array<{ keyword: string; reason: string }>;
  attempts: number;
  promptVersion: string;
}

const DEFAULT_COUNT = 10;

export async function runKeywordExpansion(
  ctx: TenantCtx,
  repos: Repos,
  request: KeywordExpansionRequest = {},
  deps: KeywordExpansionDeps = {},
): Promise<KeywordExpansionResult> {
  const gate = expansionGateConfigSchema.parse(request.gate ?? {});
  const count = request.count ?? DEFAULT_COUNT;

  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(
      `tenant ${ctx.tenantId} has no active brand profile — the expansion grounds to its identity; create one first`,
    );
  }
  const identity = brandIdentitySchema.parse(profile.identity ?? {});
  const identityBlock = renderBrandIdentity(identity);
  if (!identityBlock) {
    throw new Error(
      `tenant ${ctx.tenantId}'s active profile has an empty identity — the expansion has nothing to ground to; fill topics/offers/audience first (the deterministic seed compiler needs them too)`,
    );
  }
  const denylist = (profile.denylist as string[] | null) ?? [];

  // Every origin AND status — the shell must not re-propose a dismissal
  // (dismissals are durable operator signal, not a gap to fill back in).
  const existing = await repos.searchTargets.list(ctx);
  const existingKeywords = existing.map((target) => target.keyword).sort();

  const model = modelTiers().draft;
  const promptVersion = keywordExpansionPromptVersion();
  const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const rawDriver = deps.driver ?? gatewayKeywordExpansionDriver();

  // Core meters the shell: EVERY attempt (including repair retries) routes
  // through the one gateway choke point — budget asserted before, usage
  // recorded after, span traced (SPINE §1; amendment A2). The shell driver
  // itself stays read-only.
  const guardedDriver: KeywordExpansionDriver = (req) =>
    withGatewayGuard({
      usage: {
        assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
        recordUsage: (o) => repos.usageLedger.record(ctx, o),
      },
      capTokens,
      model,
      operation: "search.keyword_expand",
      call: async () => {
        const out = await rawDriver(req);
        return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
      },
    });

  const result = await generateValidatedCandidate(
    guardedDriver,
    { identityBlock, existingKeywords, count },
    keywordExpansionShellOutputSchema,
  );
  if (result.output === null) {
    throw new IrrecoverableGenerationError(
      `keyword expansion produced no valid candidate set after ${result.attempts} attempt(s)`,
      result.attempts,
      result.lastError,
    );
  }

  const stopwords = new Set(gate.stopwords);
  const identityTokens = new Set(contentTokens(identityBlock, stopwords));

  // In-batch dedupe on the normalized keyword — first proposal wins.
  const candidates = new Map<string, { keyword: string; rationale: string }>();
  for (const raw of result.output.keywords) {
    const keyword = normalizeQuery(raw.keyword);
    if (keyword && !candidates.has(keyword)) {
      candidates.set(keyword, { keyword, rationale: raw.rationale.trim() });
    }
  }

  const persisted: KeywordExpansionResult["persisted"] = [];
  const rejected: KeywordExpansionResult["rejected"] = [];
  for (const { keyword, rationale } of candidates.values()) {
    const g1 = runG1Denylist({ body: `${keyword}\n${rationale}`, denylist });
    if (g1.verdict === "fail") {
      const terms = [...new Set(g1.evidence.claims.map((claim) => claim.claim))];
      rejected.push({ keyword, reason: `denylist: matched ${terms.join(", ")}` });
      continue;
    }

    const tokens = contentTokens(keyword, stopwords);
    if (tokens.length === 0) {
      rejected.push({ keyword, reason: "ungrounded: only scaffold/function words — no content to ground" });
      continue;
    }
    const grounded = tokens.filter((token) => identityTokens.has(token));
    const overlap = grounded.length / tokens.length;
    if (overlap < gate.minOverlapRatio) {
      rejected.push({
        keyword,
        reason: `ungrounded: ${grounded.length}/${tokens.length} content words appear in the profile identity (need ≥ ${gate.minOverlapRatio})`,
      });
      continue;
    }

    const { created } = await repos.searchTargets.add(ctx, {
      keyword,
      origin: "ai_expansion",
      meta: {
        rationale,
        promptVersion,
        brandProfileVersion: profile.version,
        groundingOverlap: Math.round(overlap * 100) / 100,
      },
    });
    persisted.push({ keyword, created });
  }

  return {
    proposed: candidates.size,
    persisted,
    rejected,
    attempts: result.attempts,
    promptVersion,
  };
}
