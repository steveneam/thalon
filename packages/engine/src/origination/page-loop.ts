import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import type { ObjectStore } from "@thalon/platform";
import { z } from "zod";
import { ingestSource } from "../ingest";
import type { EmbeddingDriver } from "../ingest/shell/embedder";
import { runWebPageGeneration, type WebPageResult } from "../webpage/webpage";
import type { WebPageDriver } from "../webpage/shell/generator";
import { readPromptFile } from "./shell/prompt-file";

/**
 * B6.6 page-loop entry (CHARTER B6.6; workspace-ux-v2 §9): the intel→page
 * half of the origination live loop. Takes the wave-3 intel context object
 * (the shape behind the dossier card's →Page exit — mirrored here as a
 * contract of KEYS; apps/web is never imported), composes the page brief
 * DETERMINISTICALLY from it, ingests the brief as a `prompt` source, and
 * drives the EXISTING B3.15 web-page generation. Nothing downstream is
 * forked: the draft lands in "generated", the shared judge harness is the
 * only path onward, approval is the operator's, and the own-site publish
 * door (../webpage/publish.ts) ships it.
 *
 * Idempotent end to end by composition: an identical context renders an
 * identical brief (same content hash ⇒ same prompt source), and identical
 * prompt+grounding+profile inputs replay the same generation key.
 */

const PROMPT_FILE = "page-loop-brief.v1.md";

/** `briefVersion` recorded on the ingested prompt source's meta (SPINE §3.2 — versioned stems). */
export function pageLoopBriefVersion(): string {
  return PROMPT_FILE.replace(/\.md$/, "");
}

/**
 * Engine-side mirror of the wave-3 `CreateContext` keys (apps/web
 * `lib/intel/types.ts`) — the mini-contract both sides build against.
 * `family` is pinned to "page": mis-routed video/post contexts refuse
 * loudly instead of silently becoming a page. Unknown keys (e.g. the
 * web-side `captureId`) are stripped, so one topic promoted twice composes
 * the same brief and replays instead of duplicating.
 */
export const pageLoopContextSchema = z.object({
  kind: z.enum(["trend_promote", "search_target_this"]),
  family: z.literal("page"),
  title: z.string().min(1).optional(),
  angle: z.string().min(1).optional(),
  hook: z.string().min(1).optional(),
  sourceUrl: z.string().min(1).optional(),
  areaName: z.string().min(1).optional(),
  keyword: z.string().min(1).optional(),
  score: z.number().optional(),
  text: z.string().min(1).optional(),
});
export type PageLoopContextInput = z.input<typeof pageLoopContextSchema>;
export type PageLoopContext = z.infer<typeof pageLoopContextSchema>;

/** Human wording for the brief's first line — deterministic, data-shaped. */
const KIND_LABELS: Record<PageLoopContext["kind"], string> = {
  trend_promote: "a promoted trend card",
  search_target_this: "a targeted search opportunity",
};

const TOKEN_RE = /\{\{([a-zA-Z]+)\}\}/g;

/**
 * Deterministic brief composition from the versioned template
 * (proprietary/prompts/page-loop-brief.v1.md). Render rules, pinned by
 * tests: `<!-- … -->` comment lines are stripped; every remaining line has
 * its `{{token}}` occurrences substituted; a line naming a token whose
 * value is ABSENT is dropped whole (optional context never leaves empty
 * labels behind); the result is trimmed with single blank lines preserved.
 */
export function composePageBrief(context: PageLoopContext): string {
  const values: Record<string, string | undefined> = {
    kindLabel: KIND_LABELS[context.kind],
    title: context.title,
    angle: context.angle,
    hook: context.hook,
    sourceUrl: context.sourceUrl,
    areaName: context.areaName,
    keyword: context.keyword,
    score: context.score === undefined ? undefined : String(context.score),
    text: context.text,
  };

  const template = readPromptFile(PROMPT_FILE).replace(/<!--[\s\S]*?-->\r?\n?/g, "");
  const lines: string[] = [];
  for (const line of template.split(/\r?\n/)) {
    let dropped = false;
    const rendered = line.replace(TOKEN_RE, (match, token: string) => {
      const value = values[token];
      if (value === undefined) {
        dropped = true;
        return match;
      }
      return value;
    });
    if (!dropped) lines.push(rendered);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export interface PageLoopRequest {
  /** The intel context behind the →Page exit — validated against pageLoopContextSchema. */
  context: PageLoopContextInput;
  /** Extra pre-ingested grounding sources the page may draw claims from (operator site crawl, docs — see ../ingest/ingest-web-url.ts). */
  groundingSourceIds?: string[];
  /** Overrides the draft's platform label (default "web") — data, not code. */
  platform?: string;
}

export interface PageLoopDeps {
  driver?: WebPageDriver;
  embedder?: EmbeddingDriver;
  objectStore?: ObjectStore;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface PageLoopResult extends WebPageResult {
  /** The ingested brief's `sources.id` — the generation run's prompt source. */
  promptSourceId: string;
  /** The composed brief text, exactly as ingested. */
  brief: string;
  briefVersion: string;
}

export async function runPageLoop(
  ctx: TenantCtx,
  repos: Repos,
  request: PageLoopRequest,
  deps: PageLoopDeps = {},
): Promise<PageLoopResult> {
  const context = pageLoopContextSchema.parse(request.context);
  const brief = composePageBrief(context);
  const briefVersion = pageLoopBriefVersion();

  const ingest = await ingestSource(
    ctx,
    repos,
    {
      kind: "prompt",
      prompt: brief,
      // Provenance only — the brief's identity is its content hash; the
      // context keys ride along so the operator can see where a brief came
      // from without re-deriving it.
      meta: { briefVersion, intelKind: context.kind, intelFamily: context.family },
    },
    { embedder: deps.embedder, objectStore: deps.objectStore, capTokens: deps.capTokens },
  );

  const generation = await runWebPageGeneration(
    ctx,
    repos,
    {
      promptSourceId: ingest.sourceId,
      groundingSourceIds: request.groundingSourceIds,
      platform: request.platform,
    },
    { driver: deps.driver, objectStore: deps.objectStore, capTokens: deps.capTokens },
  );

  return { ...generation, promptSourceId: ingest.sourceId, brief, briefVersion };
}
