import { seoMetaSchema } from "@thalon/contracts";
import {
  checkSeoMeta,
  seoLensConfigSchema,
  type SeoFinding,
  type SeoLensConfigInput,
} from "@thalon/judge";
import { z } from "zod";
import { extractVisibleText } from "../webpage/html";

/**
 * B6.8 on-page optimization pack (ADR 0006 decision 2) — DETERMINISTIC
 * core checks, zero LLM spend: AEO/GEO is mostly checkable properties.
 * The meta-side windows (title/description lengths, one-target-per-page,
 * target-in-title/body, question shape) are defined ONCE in the judge's
 * SEO/AEO lens (`checkSeoMeta`, @thalon/judge) and composed here; this
 * module adds the ARTIFACT-side checks a lens never sees — the stored
 * `web_page` HTML: question-shaped H2s with answer-first paragraphs, and
 * JSON-LD presence/type honesty (`Organization`/`FAQPage`/`Product`/
 * `VideoObject` — type names are data on `seo.jsonLdTypes`, never code).
 * Everything is advisory findings with reason strings; the subjective
 * residue stays with the judge lens, and the honest-claims rule is the
 * grounding gate's job.
 *
 * Extraction here is deliberately light-touch regex over generated markup:
 * these are advisory QUALITY findings — the invariant-grade surfaces
 * (claim text, self-containment) already go through ../webpage/html.ts's
 * quote-aware walker.
 */

export const onPageHtmlConfigSchema = z.object({
  /** How many question-shaped H2s a page should carry (AEO: ask the question you answer). */
  minQuestionH2s: z.number().int().positive().default(1),
  /** Answer-first: the paragraph under a question H2 must open with a sentence at most this long. */
  answerFirstMaxChars: z.number().int().positive().default(300),
  /** A heading is question-shaped when it ends in "?" OR starts with one of these words (data, never code). */
  questionWords: z
    .array(z.string().min(1))
    .default(["what", "how", "why", "when", "where", "which", "who", "can", "should", "does", "do", "is", "are"]),
});
export type OnPageHtmlConfigInput = z.input<typeof onPageHtmlConfigSchema>;
export type OnPageHtmlConfig = z.infer<typeof onPageHtmlConfigSchema>;

export interface OnPageInput {
  /** The draft's `meta.seo` block (validated here); absent = meta-side checks don't run. */
  seo?: unknown;
  /** The stored HTML artifact (web_page); absent = artifact-side checks don't run. */
  html?: string;
  /** The judged body; defaults to the html's extracted visible text. */
  body?: string;
  /** "video" adds the tags/chapters checks in the lens core. */
  surface?: "page" | "video";
}

export interface OnPageConfigInput {
  lens?: SeoLensConfigInput;
  html?: OnPageHtmlConfigInput;
}

function stripTags(fragment: string): string {
  return fragment.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

interface H2Section {
  heading: string;
  /** Markup between this H2's close and the next heading (any level) or end of document. */
  sectionHtml: string;
}

function extractH2Sections(html: string): H2Section[] {
  const sections: H2Section[] = [];
  const h2Re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let match: RegExpExecArray | null;
  while ((match = h2Re.exec(html)) !== null) {
    const rest = html.slice(match.index + match[0].length);
    const nextHeading = rest.search(/<h[1-6]\b/i);
    sections.push({
      heading: stripTags(match[1]),
      sectionHtml: nextHeading === -1 ? rest : rest.slice(0, nextHeading),
    });
  }
  return sections;
}

function isQuestionShaped(heading: string, config: OnPageHtmlConfig): boolean {
  if (heading.trimEnd().endsWith("?")) return true;
  const firstWord = heading.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return config.questionWords.includes(firstWord);
}

/** First sentence = up to the first ./!/? (inclusive), else the whole paragraph. */
function firstSentence(text: string): string {
  const match = /^[\s\S]*?[.!?](?=\s|$)/.exec(text);
  return (match ? match[0] : text).trim();
}

/** Collects every `@type` value (string or string[]) anywhere in a parsed JSON-LD document. */
function collectJsonLdTypes(node: unknown, into: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdTypes(item, into);
    return;
  }
  if (node === null || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "@type") {
      for (const t of Array.isArray(value) ? value : [value]) {
        if (typeof t === "string") into.add(t);
      }
    } else {
      collectJsonLdTypes(value, into);
    }
  }
}

function checkHtml(
  html: string,
  declaredJsonLdTypes: readonly string[] | undefined,
  config: OnPageHtmlConfig,
): SeoFinding[] {
  const findings: SeoFinding[] = [];

  const sections = extractH2Sections(html);
  const questionSections = sections.filter((s) => isQuestionShaped(s.heading, config));
  if (sections.length === 0) {
    findings.push({
      check: "question_h2s",
      status: "warn",
      reason: "no <h2> headings — answer engines lift question-shaped sections",
    });
  } else {
    const ok = questionSections.length >= config.minQuestionH2s;
    findings.push({
      check: "question_h2s",
      status: ok ? "pass" : "warn",
      reason: `${questionSections.length} of ${sections.length} <h2> heading(s) are question-shaped (want ≥ ${config.minQuestionH2s})`,
    });
  }

  if (questionSections.length === 0) {
    findings.push({
      check: "answer_first",
      status: "skipped",
      reason: "no question-shaped <h2> to check an answer under",
    });
  } else {
    const offenders: string[] = [];
    for (const section of questionSections) {
      const p = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(section.sectionHtml);
      const paragraph = p ? stripTags(p[1]) : "";
      if (!paragraph) {
        offenders.push(`"${section.heading}" has no paragraph under it`);
        continue;
      }
      const sentence = firstSentence(paragraph);
      if (sentence.length > config.answerFirstMaxChars) {
        offenders.push(
          `"${section.heading}" opens with a ${sentence.length}-char sentence (max ${config.answerFirstMaxChars}) — answer first, elaborate after`,
        );
      }
    }
    findings.push({
      check: "answer_first",
      status: offenders.length === 0 ? "pass" : "warn",
      reason:
        offenders.length === 0
          ? `every question H2 opens with a direct answer (≤ ${config.answerFirstMaxChars} chars)`
          : offenders.join("; "),
    });
  }

  const embeddedTypes = new Set<string>();
  const parseErrors: string[] = [];
  let blocks = 0;
  // Fresh regex per call — a shared /g regex would carry lastIndex across invocations.
  const jsonLdRe = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLdRe.exec(html)) !== null) {
    blocks++;
    try {
      collectJsonLdTypes(JSON.parse(match[1]), embeddedTypes);
    } catch {
      parseErrors.push(`JSON-LD block ${blocks} is not valid JSON`);
    }
  }
  if (blocks === 0) {
    findings.push({
      check: "json_ld_present",
      status: "warn",
      reason: "no JSON-LD structured data — answer/generative engines read it first",
    });
  } else {
    findings.push({
      check: "json_ld_present",
      status: parseErrors.length === 0 ? "pass" : "warn",
      reason:
        parseErrors.length === 0
          ? `${blocks} JSON-LD block(s), types: ${[...embeddedTypes].sort().join(", ") || "(none)"}`
          : parseErrors.join("; "),
    });
  }

  if (!declaredJsonLdTypes || declaredJsonLdTypes.length === 0) {
    findings.push({
      check: "json_ld_types_declared",
      status: "skipped",
      reason: "no jsonLdTypes declared on meta.seo",
    });
  } else {
    const missing = declaredJsonLdTypes.filter((t) => !embeddedTypes.has(t));
    findings.push({
      check: "json_ld_types_declared",
      status: missing.length === 0 ? "pass" : "warn",
      reason:
        missing.length === 0
          ? `every declared type is embedded: ${declaredJsonLdTypes.join(", ")}`
          : `declared but not embedded: ${missing.join(", ")} — the meta.seo declaration must stay honest`,
    });
  }

  return findings;
}

/**
 * The pack entry point: meta-side lens checks (when `seo` is present) +
 * artifact-side HTML checks (when `html` is present), one flat advisory
 * findings list. Throws when given nothing to check — silence is never a
 * verdict.
 */
export function runOnPageChecks(input: OnPageInput, config: OnPageConfigInput = {}): SeoFinding[] {
  if (input.seo === undefined && input.html === undefined) {
    throw new Error("runOnPageChecks needs a meta.seo block and/or stored HTML — nothing to check");
  }
  const findings: SeoFinding[] = [];
  const seo = input.seo === undefined ? undefined : seoMetaSchema.parse(input.seo);
  const body = input.body ?? (input.html !== undefined ? extractVisibleText(input.html) : "");

  if (seo) {
    findings.push(
      ...checkSeoMeta(
        { seo, body, surface: input.surface ?? "page" },
        seoLensConfigSchema.parse(config.lens ?? {}),
      ),
    );
  }
  if (input.html !== undefined) {
    findings.push(
      ...checkHtml(input.html, seo?.jsonLdTypes, onPageHtmlConfigSchema.parse(config.html ?? {})),
    );
  }
  return findings;
}
