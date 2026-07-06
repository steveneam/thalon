import type { BrandIdentity } from "@thalon/contracts";
import type { SeoFinding } from "@thalon/judge";

/**
 * B6.8 llms.txt (ADR 0006 decision 2 — a GEO asset in the on-page pack):
 * the llmstxt.org convention is an H1 name, a one-line `>` summary, then
 * `##` sections of `- [label](url): note` links, served at /llms.txt so
 * generative engines get a curated map instead of crawling guesswork.
 * Rendering is DETERMINISTIC from the tenant's operator-asserted identity
 * — the same honest-claims posture as everything else: the file states
 * what the identity states, nothing more. Deploy wiring (actually serving
 * it) rides the web_page deploy path in a later bucket; the pack ships
 * the bytes and the shape check.
 */

export interface LlmsTxtEntry {
  /** `##` section this link lives under (entries group in first-appearance order). */
  section: string;
  label: string;
  url: string;
  /** Optional one-line description after the link. */
  note?: string;
}

/** Deterministic llms.txt content from the identity (+ extra curated entries, e.g. key pages). */
export function renderLlmsTxt(identity: BrandIdentity, entries: readonly LlmsTxtEntry[] = []): string {
  const name = identity.company?.trim() || "This site";
  const lines: string[] = [`# ${name}`];
  if (identity.oneLiner?.trim()) lines.push("", `> ${identity.oneLiner.trim()}`);
  if (identity.philosophy?.trim()) lines.push("", identity.philosophy.trim());

  const sections = new Map<string, string[]>();
  const push = (section: string, line: string) => {
    const bucket = sections.get(section) ?? [];
    bucket.push(line);
    sections.set(section, bucket);
  };
  for (const [label, url] of Object.entries(identity.links)) {
    if (url.trim()) push("Links", `- [${label}](${url.trim()})`);
  }
  for (const entry of entries) {
    push(entry.section, `- [${entry.label}](${entry.url})${entry.note ? `: ${entry.note}` : ""}`);
  }
  for (const [section, sectionLines] of sections) {
    lines.push("", `## ${section}`, "", ...sectionLines);
  }
  return `${lines.join("\n")}\n`;
}

/** Deterministic shape check against the llmstxt.org convention — advisory findings, reason strings. */
export function checkLlmsTxt(content: string): SeoFinding[] {
  const lines = content.split(/\r?\n/);
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const findings: SeoFinding[] = [];

  const h1First = nonEmpty[0]?.startsWith("# ") ?? false;
  findings.push({
    check: "llms_txt_h1",
    status: h1First ? "pass" : "warn",
    reason: h1First
      ? `opens with the H1 name ${JSON.stringify(nonEmpty[0])}`
      : "must open with an H1 name line (`# Name`) — the llms.txt convention's one required element",
  });

  const hasSummary = nonEmpty.some((l) => l.startsWith("> "));
  findings.push({
    check: "llms_txt_summary",
    status: hasSummary ? "pass" : "warn",
    reason: hasSummary
      ? "carries a `>` one-line summary"
      : "no `>` summary blockquote — the one-liner is what engines quote",
  });

  const sectionCount = nonEmpty.filter((l) => l.startsWith("## ")).length;
  const linkCount = nonEmpty.filter((l) => /^-\s*\[.+\]\(.+\)/.test(l)).length;
  findings.push({
    check: "llms_txt_links",
    status: sectionCount > 0 && linkCount > 0 ? "pass" : "warn",
    reason:
      sectionCount > 0 && linkCount > 0
        ? `${linkCount} curated link(s) across ${sectionCount} section(s)`
        : "no `##` link sections — llms.txt exists to hand engines a curated map",
  });

  return findings;
}
