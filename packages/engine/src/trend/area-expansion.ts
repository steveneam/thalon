import {
  MONITORED_AREA_STATUSES,
  monitoredAreaConfigSchema,
} from "@thalon/contracts";
import { z } from "zod";

/**
 * B6.4 area→query expansion — the candidate-generation half of intel v2
 * (ADR 0005 decision 3). A monitored area's name + free-text description
 * expand DETERMINISTICALLY into search queries that feed the existing
 * watchlist/poll shape (./watchlist.ts `queries`); accounts polling stays
 * untouched. No LLM anywhere: expansion is priority-ordered extraction —
 * the area name first, then operator-quoted phrases verbatim, then clause
 * keywords — because discovery searches are scarce (YouTube `search.list`
 * ≈100/day is its own quota bucket since June 2026) and a rationed list
 * must put the operator's most explicit intent first.
 *
 * The ration itself is CONFIG, never code: per-area
 * `config.maxQueriesPerSweep` overrides the tenant-level default carried by
 * `areaExpansionConfigSchema`. Candidates cut by the ration are counted in
 * `droppedQueries` — quota pressure is reported, never silent.
 */

/**
 * One area as the sweep consumes it — exactly the shape of a
 * `monitored_areas` row (packages/db), so `repos.monitoredAreas.list(ctx)`
 * rows parse directly. Paused areas stop expanding into queries but keep
 * their history (contract lifecycle); expansion simply skips them.
 */
export const sweepAreaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Free text: the query-expansion seed AND the ranker's relevance-embedding anchor. */
  description: z.string().min(1),
  /** String in, enum out: drizzle types the row column as `string` (the DB check owns the constraint), so rows must pass the TYPE door too — the pipe re-validates at runtime. */
  status: z.string().default("active").pipe(z.enum(MONITORED_AREA_STATUSES)),
  config: monitoredAreaConfigSchema.default({}),
});
export type SweepAreaInput = z.input<typeof sweepAreaSchema>;
export type SweepArea = z.infer<typeof sweepAreaSchema>;

/** Tenant-level expansion defaults — per-area config overrides field-by-field. */
export const areaExpansionConfigSchema = z.object({
  /** Default per-area query ration when the area's own config doesn't set one. */
  maxQueriesPerSweep: z.number().int().positive().default(4),
});
export type AreaExpansionConfigInput = z.input<typeof areaExpansionConfigSchema>;
export type AreaExpansionConfig = z.infer<typeof areaExpansionConfigSchema>;

export interface AreaQueryExpansion {
  areaId: string;
  areaName: string;
  /** Rationed, case-insensitively deduped queries in priority order (name → quoted phrases → clause keywords). */
  queries: string[];
  /** Candidates the ration cut — reported, never silent (the quota is scarce; visibility is owed). */
  droppedQueries: number;
}

/** Queries longer than this collapse to their first significant words — search APIs match phrases, not paragraphs. */
const MAX_QUERY_WORDS = 6;

/** Linguistic mechanics (not a budget — budgets are config): filler that carries no search intent on its own. */
const STOPWORDS = new Set([
  "a", "about", "all", "also", "an", "and", "any", "are", "as", "at", "be",
  "but", "by", "can", "do", "for", "from", "has", "have", "how", "if", "in",
  "into", "is", "it", "its", "more", "new", "not", "of", "on", "or", "other",
  "our", "so", "some", "that", "the", "their", "them", "then", "these",
  "they", "this", "to", "up", "we", "what", "when", "where", "which", "who",
  "why", "will", "with", "you", "your",
]);

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isStopword(word: string): boolean {
  const bare = word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return bare.length === 0 || STOPWORDS.has(bare);
}

/**
 * One description clause → at most one query: trimmed of surrounding
 * punctuation, kept verbatim when short, collapsed to its first
 * MAX_QUERY_WORDS significant words when long, dropped entirely when it
 * carries no significant word at all.
 */
function clauseToQuery(clause: string): string | null {
  const cleaned = normalize(clause).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  if (!cleaned) return null;
  const words = cleaned.split(/\s+/);
  const significant = words.filter((w) => !isStopword(w));
  if (significant.length === 0) return null;
  if (words.length <= MAX_QUERY_WORDS) return cleaned;
  return significant.slice(0, MAX_QUERY_WORDS).join(" ");
}

/** First-occurrence-wins, case-insensitive dedup — pure and order-preserving. */
export function mergeQueries(queries: readonly string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const query of queries) {
    const key = query.toLowerCase();
    if (!query || seen.has(key)) continue;
    seen.add(key);
    merged.push(query);
  }
  return merged;
}

/**
 * Expands ONE area. Pure and deterministic: same area + config, same
 * queries, always. Priority order inside the ration:
 *
 *  1. the area name — the operator's most compact statement of intent;
 *  2. double-quoted phrases from the description, verbatim, in order —
 *     explicit "search exactly this" markers;
 *  3. description clauses (sentence/comma/bullet boundaries) as keyword
 *     queries — stopword-only clauses drop, long clauses collapse to their
 *     significant words.
 */
export function expandArea(
  areaInput: SweepAreaInput,
  configInput: AreaExpansionConfigInput = {},
): AreaQueryExpansion {
  const area = sweepAreaSchema.parse(areaInput);
  const config = areaExpansionConfigSchema.parse(configInput);

  const description = normalize(area.description);
  const candidates: Array<string | null> = [normalize(area.name)];

  const quotePattern = /"([^"]+)"|“([^”]+)”/gu;
  for (const match of description.matchAll(quotePattern)) {
    candidates.push(normalize(match[1] ?? match[2] ?? ""));
  }

  const remainder = description.replace(quotePattern, " ");
  for (const clause of remainder.split(/[.!?;:,\n•·]+/)) {
    candidates.push(clauseToQuery(clause));
  }

  const unique = mergeQueries(candidates.filter((c): c is string => c !== null && c.length > 0));
  const ration = area.config.maxQueriesPerSweep ?? config.maxQueriesPerSweep;
  return {
    areaId: area.id,
    areaName: area.name,
    queries: unique.slice(0, ration),
    droppedQueries: Math.max(0, unique.length - ration),
  };
}

export interface AreasExpansion {
  /** One record per ACTIVE area, input order — paused areas leave no residue. */
  expansions: AreaQueryExpansion[];
  /** Every active area's queries merged (first-occurrence order, case-insensitive dedup) — ready for `watchlist.queries`. */
  queries: string[];
}

/** Expands every ACTIVE area under one tenant-level config; paused areas are skipped entirely. */
export function expandAreas(
  areas: readonly SweepAreaInput[],
  config: AreaExpansionConfigInput = {},
): AreasExpansion {
  const expansions: AreaQueryExpansion[] = [];
  for (const input of areas) {
    const area = sweepAreaSchema.parse(input);
    if (area.status !== "active") continue;
    expansions.push(expandArea(area, config));
  }
  return {
    expansions,
    queries: mergeQueries(expansions.flatMap((e) => e.queries)),
  };
}
