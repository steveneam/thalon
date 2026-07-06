import type { JudgeEvidence, SeoMeta, Verdict } from "@thalon/contracts";
import { z } from "zod";

/**
 * B6.8 SEO/AEO quality lens (ADR 0006 decision 2) — the ADVISORY lens that
 * joins the judge for search-optimization quality on seoMeta-capable
 * formats. Pure and deterministic like G1 (zero model calls): every check
 * is a checkable property of the draft's `meta.seo` block + judged body,
 * each with a reason string. ADVISORY means structurally advisory: the
 * pipeline appends the verdict as a `seo_aeo` judge row for operator
 * triage, and the queued/blocked outcome NEVER reads it — invariant I1
 * only ever requires g3_final. The honest-claims rule (rankings outcomes
 * are never claimed) needs nothing here: claims live in the body, and the
 * grounding gate already fails an unsupported claim like any other.
 *
 * The artifact-side checks (question-shaped H2s in stored HTML, JSON-LD,
 * llms.txt) live in the engine's on-page pack — this lens sees exactly
 * what the judge sees: meta + body.
 */

/** The advisory gate label on `judge_results` rows (gate is open-ended text by design — contracts KNOWN_JUDGE_GATES note). */
export const SEO_LENS_GATE = "seo_aeo";

export const seoLensConfigSchema = z.object({
  /** SERP `<title>` display window, chars. */
  titleMin: z.number().int().positive().default(30),
  titleMax: z.number().int().positive().default(60),
  /** Meta-description display window, chars. */
  descriptionMin: z.number().int().positive().default(70),
  descriptionMax: z.number().int().positive().default(160),
  /** One target per page (ADR 0006): more declared targets than this warns. */
  maxTargets: z.number().int().positive().default(1),
});
export type SeoLensConfigInput = z.input<typeof seoLensConfigSchema>;
export type SeoLensConfig = z.infer<typeof seoLensConfigSchema>;

export interface SeoFinding {
  /** Stable check id — UI/eval rows key on it. */
  check: string;
  status: "pass" | "warn" | "skipped";
  /** Always a human-readable reason — the operator sees WHY, pass or warn. */
  reason: string;
}

export interface SeoLensInput {
  seo: SeoMeta;
  /** The judged body — the same claim surface G1/G3 read. */
  body: string;
  /** "video" = renderable formats (tags/chapters are GEO assets); "page" = everything else. */
  surface: "page" | "video";
}

export interface SeoLensResult {
  /** "fail" = at least one warn — ADVISORY, the pipeline never blocks on it. */
  verdict: Verdict;
  findings: SeoFinding[];
  evidence: JudgeEvidence;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** The deterministic check core — importable by the engine's on-page pack so the windows are defined ONCE. */
export function checkSeoMeta(input: SeoLensInput, config: SeoLensConfig): SeoFinding[] {
  const { seo, body, surface } = input;
  const findings: SeoFinding[] = [];

  if (seo.metaTitle === undefined) {
    findings.push({
      check: "meta_title_length",
      status: "warn",
      reason: "no metaTitle declared — the <title>/SERP headline is unset",
    });
  } else {
    const len = seo.metaTitle.length;
    const ok = len >= config.titleMin && len <= config.titleMax;
    findings.push({
      check: "meta_title_length",
      status: ok ? "pass" : "warn",
      reason: `metaTitle is ${len} chars (window ${config.titleMin}–${config.titleMax})`,
    });
  }

  if (seo.metaDescription === undefined) {
    findings.push({
      check: "meta_description_length",
      status: "warn",
      reason: "no metaDescription declared — the SERP/preview line is unset",
    });
  } else {
    const len = seo.metaDescription.length;
    const ok = len >= config.descriptionMin && len <= config.descriptionMax;
    findings.push({
      check: "meta_description_length",
      status: ok ? "pass" : "warn",
      reason: `metaDescription is ${len} chars (window ${config.descriptionMin}–${config.descriptionMax})`,
    });
  }

  const targets = seo.targetKeywords;
  const primary = targets[0];
  if (targets.length === 0) {
    findings.push({
      check: "target_declared",
      status: "warn",
      reason: "no target keywords declared — every page/artifact deliberately targets one query (ADR 0006)",
    });
  } else if (targets.length > config.maxTargets) {
    findings.push({
      check: "target_declared",
      status: "warn",
      reason: `${targets.length} target keywords declared (max ${config.maxTargets}) — one target per page; split the rest onto their own pages`,
    });
  } else {
    findings.push({
      check: "target_declared",
      status: "pass",
      reason: `targets "${primary}"`,
    });
  }

  if (primary === undefined || seo.metaTitle === undefined) {
    findings.push({
      check: "target_in_title",
      status: "skipped",
      reason: "needs both a primary target and a metaTitle",
    });
  } else {
    const hit = normalize(seo.metaTitle).includes(normalize(primary));
    findings.push({
      check: "target_in_title",
      status: hit ? "pass" : "warn",
      reason: hit
        ? `metaTitle carries the primary target "${primary}"`
        : `metaTitle does not carry the primary target "${primary}"`,
    });
  }

  if (primary === undefined) {
    findings.push({
      check: "target_in_body",
      status: "skipped",
      reason: "needs a primary target",
    });
  } else {
    const hit = normalize(body).includes(normalize(primary));
    findings.push({
      check: "target_in_body",
      status: hit ? "pass" : "warn",
      reason: hit
        ? `the judged body carries the primary target "${primary}"`
        : `the judged body never says the primary target "${primary}" — the page can't rank for words it doesn't use`,
    });
  }

  const hasQuestionLine = body
    .split(/\n/)
    .some((line) => line.trim().endsWith("?"));
  findings.push({
    check: "question_answer_shape",
    status: hasQuestionLine ? "pass" : "warn",
    reason: hasQuestionLine
      ? "the body carries a question-shaped line — answer engines quote question-then-answer structure"
      : "no question-shaped line in the body — answer engines favor content that asks the question it answers (AEO)",
  });

  if (surface === "video") {
    findings.push({
      check: "video_tags",
      status: seo.tags.length > 0 ? "pass" : "warn",
      reason:
        seo.tags.length > 0
          ? `${seo.tags.length} platform tag(s) declared`
          : "no platform tags declared for a video surface",
    });
    findings.push({
      check: "video_chapters",
      status: seo.chapters.length > 0 ? "pass" : "warn",
      reason:
        seo.chapters.length > 0
          ? `${seo.chapters.length} chapter marker(s) declared`
          : "no chapter markers declared — chapters are a GEO asset beside the deterministic SRT",
    });
  }

  return findings;
}

/** Pure lens entry point: findings → advisory verdict + judge evidence. */
export function runSeoAeoLens(
  input: SeoLensInput,
  configInput: SeoLensConfigInput = {},
): SeoLensResult {
  const config = seoLensConfigSchema.parse(configInput);
  const findings = checkSeoMeta(input, config);
  const warns = findings.filter((f) => f.status === "warn");
  const skipped = findings.filter((f) => f.status === "skipped");
  return {
    verdict: warns.length === 0 ? "pass" : "fail",
    findings,
    evidence: {
      claims: findings
        .filter((f) => f.status !== "skipped")
        .map((f) => ({
          claim: f.check,
          verdict: f.status === "pass" ? ("pass" as const) : ("fail" as const),
          evidence: f.reason,
        })),
      notes: `advisory SEO/AEO lens (ADR 0006) — never blocks; ${warns.length} warning(s), ${skipped.length} skipped`,
    },
  };
}
