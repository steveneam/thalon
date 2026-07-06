import { describe, expect, it } from "vitest";
import { checkLlmsTxt, renderLlmsTxt } from "../llms-txt";
import { runOnPageChecks } from "../onpage";

const GOOD_SEO = {
  targetKeywords: ["content automation"],
  metaTitle: "What Is Content Automation? A Plain Guide",
  metaDescription:
    "Content automation explained in plain terms: what it is, how it works, and when a small team should reach for it.",
  jsonLdTypes: ["Organization", "FAQPage"],
};

const GOOD_HTML = `<!doctype html>
<html lang="en"><head>
<title>What Is Content Automation? A Plain Guide</title>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Acme"},{"@type":"FAQPage"}]}</script>
</head><body><main>
<h1>Content automation, explained</h1>
<h2>What is content automation?</h2>
<p>Content automation is generating and scheduling content from one profile. The rest of this section goes deeper into the moving parts and where the judge fits.</p>
<h2>How does it work?</h2>
<p>A pipeline turns one source into judged drafts. Everything else is detail.</p>
<h2>Pricing</h2>
<p>Plans are simple.</p>
</main></body></html>`;

describe("runOnPageChecks (B6.8 on-page pack — deterministic core, zero LLM)", () => {
  it("a well-formed page passes the full pack: meta windows + question H2s + answer-first + honest JSON-LD", () => {
    const findings = runOnPageChecks({ seo: GOOD_SEO, html: GOOD_HTML });
    const byCheck = Object.fromEntries(findings.map((f) => [f.check, f.status]));
    expect(byCheck).toEqual({
      meta_title_length: "pass",
      meta_description_length: "pass",
      target_declared: "pass",
      target_in_title: "pass",
      target_in_body: "pass", // body derived from the html's extracted visible text
      question_answer_shape: "pass",
      question_h2s: "pass",
      answer_first: "pass",
      json_ld_present: "pass",
      json_ld_types_declared: "pass",
    });
    expect(findings.every((f) => f.reason.length > 0)).toBe(true);
  });

  it("question-shaped H2 counting: names the ratio and warns below the minimum", () => {
    const html = `<html><body><h2>Pricing</h2><p>Plans.</p></body></html>`;
    const findings = runOnPageChecks({ html });
    expect(findings.find((f) => f.check === "question_h2s")).toMatchObject({
      status: "warn",
      reason: "0 of 1 <h2> heading(s) are question-shaped (want ≥ 1)",
    });
    expect(findings.find((f) => f.check === "answer_first")!.status).toBe("skipped");
  });

  it("answer-first warns on a question H2 with no paragraph and on a rambling opener", () => {
    const longSentence = `${"very ".repeat(70)}long opener that never gets to the point`;
    const html = `<html><body>
<h2>What is it?</h2>
<h2>How does it work?</h2><p>${longSentence}.</p>
</body></html>`;
    const findings = runOnPageChecks({ html });
    const answerFirst = findings.find((f) => f.check === "answer_first")!;
    expect(answerFirst.status).toBe("warn");
    expect(answerFirst.reason).toMatch(/"What is it\?" has no paragraph under it/);
    expect(answerFirst.reason).toMatch(/opens with a \d+-char sentence \(max 300\)/);
  });

  it("JSON-LD: absence warns; a declared-but-not-embedded type warns by name (declaration honesty)", () => {
    const noLd = runOnPageChecks({
      seo: { ...GOOD_SEO, jsonLdTypes: ["VideoObject"] },
      html: `<html><body><h2>What?</h2><p>Yes.</p></body></html>`,
    });
    expect(noLd.find((f) => f.check === "json_ld_present")!.status).toBe("warn");
    expect(noLd.find((f) => f.check === "json_ld_types_declared")).toMatchObject({
      status: "warn",
      reason: expect.stringMatching(/declared but not embedded: VideoObject/),
    });

    const badJson = runOnPageChecks({
      html: `<html><body><script type="application/ld+json">{nope</script><h2>What?</h2><p>Yes.</p></body></html>`,
    });
    expect(badJson.find((f) => f.check === "json_ld_present")).toMatchObject({
      status: "warn",
      reason: expect.stringMatching(/block 1 is not valid JSON/),
    });
  });

  it("meta-only and html-only inputs run their halves; nothing to check throws loudly", () => {
    const metaOnly = runOnPageChecks({ seo: GOOD_SEO, body: "What is content automation?\n\nAn answer." });
    expect(metaOnly.some((f) => f.check === "question_h2s")).toBe(false);
    expect(metaOnly.some((f) => f.check === "meta_title_length")).toBe(true);

    const htmlOnly = runOnPageChecks({ html: GOOD_HTML });
    expect(htmlOnly.some((f) => f.check === "meta_title_length")).toBe(false);
    expect(htmlOnly.find((f) => f.check === "json_ld_types_declared")!.status).toBe("skipped");

    expect(() => runOnPageChecks({})).toThrow(/nothing to check/);
  });

  it("thresholds are config: a stricter answer-first window flips the finding", () => {
    const findings = runOnPageChecks(
      { html: GOOD_HTML },
      { html: { answerFirstMaxChars: 20 } },
    );
    expect(findings.find((f) => f.check === "answer_first")!.status).toBe("warn");
  });
});

describe("llms.txt (deterministic GEO asset + shape check)", () => {
  const IDENTITY = {
    company: "Acme Motion",
    oneLiner: "Content automation for solo founders.",
    philosophy: "Judged before published.",
    audience: undefined,
    offers: [],
    facts: [],
    topics: [],
    links: { site: "https://acme.test", github: "https://github.test/acme" },
  };

  it("renders the llmstxt.org shape from the identity, byte-stable", () => {
    const content = renderLlmsTxt(IDENTITY, [
      { section: "Docs", label: "Guide", url: "https://acme.test/guide", note: "the plain guide" },
    ]);
    expect(content).toBe(
      [
        "# Acme Motion",
        "",
        "> Content automation for solo founders.",
        "",
        "Judged before published.",
        "",
        "## Links",
        "",
        "- [site](https://acme.test)",
        "- [github](https://github.test/acme)",
        "",
        "## Docs",
        "",
        "- [Guide](https://acme.test/guide): the plain guide",
        "",
      ].join("\n"),
    );
    expect(renderLlmsTxt(IDENTITY, [])).toBe(renderLlmsTxt(IDENTITY, []));
    expect(checkLlmsTxt(content).every((f) => f.status === "pass")).toBe(true);
  });

  it("shape check warns on a bare file, with a reason per element", () => {
    const findings = checkLlmsTxt("just some prose\n");
    expect(findings.map((f) => [f.check, f.status])).toEqual([
      ["llms_txt_h1", "warn"],
      ["llms_txt_summary", "warn"],
      ["llms_txt_links", "warn"],
    ]);
  });
});
