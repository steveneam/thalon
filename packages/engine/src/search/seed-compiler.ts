import { brandIdentitySchema, type BrandIdentity, type TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { z } from "zod";

/**
 * B6.8 profile-seeded keyword compilation (ADR 0006 decision 4a) — the
 * DETERMINISTIC half of search-target compilation: the active brand
 * profile's identity expands to candidate queries in pure core, zero LLM
 * spend. Subjects are the identity's `topics` and `offers`; `audience`
 * qualifies the audience-shaped forms; the forms themselves are CONFIG
 * (data, never code — a tenant can reshape the expansion without touching
 * the engine). The judged AI expansion pass (./expansion.ts) is the fluent
 * second half; the operator's own additions are the third origin. First
 * origin wins at the repo, so recompiles replay cleanly and never rewrite
 * an operator-added or dismissed target.
 */

export const seedCompilerConfigSchema = z.object({
  /**
   * Expansion templates: `{subject}` is each topic/offer, `{audience}` the
   * identity's audience. A form using `{audience}` is inapplicable (and
   * reported, never silently dropped) when the identity has no audience.
   */
  forms: z
    .array(z.string().min(1))
    .default([
      "{subject}",
      "what is {subject}",
      "how does {subject} work",
      "best {subject}",
      "{subject} for {audience}",
    ]),
  /** Subjects longer than this are skipped with a reason — a paragraph-length offer is a statement, not a query. */
  maxSubjectChars: z.number().int().positive().default(80),
  /** Hard cap on compiled keywords; the overflow is COUNTED in the result, never silently dropped. */
  maxKeywords: z.number().int().positive().default(200),
});

export type SeedCompilerConfigInput = z.input<typeof seedCompilerConfigSchema>;
export type SeedCompilerConfig = z.infer<typeof seedCompilerConfigSchema>;

export interface CompiledSeedKeyword {
  keyword: string;
  /** Compiler provenance persisted into `search_targets.meta` — which identity field seeded it, under which form. */
  meta: {
    seededFrom: { field: "topics" | "offers"; value: string };
    form: string;
  };
}

export interface SeedCompilation {
  /** Deduped (first form wins provenance), in deterministic subject-order × form-order. */
  keywords: CompiledSeedKeyword[];
  /** Everything that did NOT expand, each with a reason — no silent caps. */
  skipped: Array<{ subject?: string; form?: string; reason: string }>;
  /** Keywords dropped by `maxKeywords` — counted so a capped compile is visible. */
  truncated: number;
}

/** Queries are matched case-insensitively by every search surface — normalize so recompiles are byte-stable (shared with ./expansion.ts). */
export function normalizeQuery(text: string): string {
  return text.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "").toLowerCase();
}

/**
 * Pure deterministic expansion: identity in, candidate keywords out. No
 * clock, no db, no model — the same identity and config always compile to
 * the byte-identical list (recompiles are idempotent all the way down to
 * `searchTargets.add`).
 */
export function compileSeedKeywords(
  identity: BrandIdentity,
  configInput: SeedCompilerConfigInput = {},
): SeedCompilation {
  const config = seedCompilerConfigSchema.parse(configInput);
  const audience = normalizeQuery(identity.audience ?? "");
  const skipped: SeedCompilation["skipped"] = [];

  const subjects: Array<{ field: "topics" | "offers"; value: string }> = [];
  for (const field of ["topics", "offers"] as const) {
    for (const raw of identity[field]) {
      const value = normalizeQuery(raw);
      if (!value) continue;
      if (value.length > config.maxSubjectChars) {
        skipped.push({
          subject: value,
          reason: `subject exceeds ${config.maxSubjectChars} chars — a statement, not a query`,
        });
        continue;
      }
      subjects.push({ field, value });
    }
  }

  const applicableForms: string[] = [];
  for (const form of config.forms) {
    if (form.includes("{audience}") && !audience) {
      skipped.push({ form, reason: `form needs {audience} but the identity has none` });
      continue;
    }
    applicableForms.push(form);
  }

  const byKeyword = new Map<string, CompiledSeedKeyword>();
  for (const subject of subjects) {
    for (const form of applicableForms) {
      const keyword = normalizeQuery(
        form.replaceAll("{subject}", subject.value).replaceAll("{audience}", audience),
      );
      if (!keyword || byKeyword.has(keyword)) continue;
      byKeyword.set(keyword, {
        keyword,
        meta: { seededFrom: { field: subject.field, value: subject.value }, form },
      });
    }
  }

  const all = [...byKeyword.values()];
  const keywords = all.slice(0, config.maxKeywords);
  return { keywords, skipped, truncated: all.length - keywords.length };
}

export interface CompileSearchTargetsResult extends SeedCompilation {
  /** New `search_targets` rows this compile created. */
  created: number;
  /** Keywords that already existed (any origin/status) — first origin wins, dismissals survive. */
  existing: number;
}

/**
 * The persisting orchestrator: active profile identity → deterministic
 * expansion → `searchTargets.add` per keyword (`origin: "profile_seed"`).
 * Idempotent by construction: the repo's structural key (tenant, keyword)
 * makes a recompile replay cleanly — existing rows (including operator
 * additions and durable dismissals) come back UNCHANGED as `existing`.
 */
export async function compileSearchTargets(
  ctx: TenantCtx,
  repos: Repos,
  opts: { config?: SeedCompilerConfigInput } = {},
): Promise<CompileSearchTargetsResult> {
  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(
      `tenant ${ctx.tenantId} has no active brand profile — the seed compiler expands its identity; create one first`,
    );
  }
  const identity = brandIdentitySchema.parse(profile.identity ?? {});
  const compilation = compileSeedKeywords(identity, opts.config);

  let created = 0;
  let existing = 0;
  for (const compiled of compilation.keywords) {
    const result = await repos.searchTargets.add(ctx, {
      keyword: compiled.keyword,
      origin: "profile_seed",
      meta: compiled.meta,
    });
    if (result.created) created++;
    else existing++;
  }
  return { ...compilation, created, existing };
}
