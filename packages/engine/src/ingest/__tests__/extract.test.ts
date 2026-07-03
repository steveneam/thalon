import { describe, expect, it } from "vitest";
import { extractDoc, extractHtml, extractPrompt } from "../extract";

describe("extract (deterministic core — no LLM extraction in B1.1)", () => {
  it("prompt passes through as-is, trimmed", () => {
    expect(extractPrompt("  a launch announcement  ")).toEqual({
      text: "a launch announcement",
    });
  });

  it("doc text passes through, trimmed", () => {
    expect(extractDoc("  release notes for v2  ")).toEqual({
      text: "release notes for v2",
    });
  });

  it("strips tags, scripts, and styles from fetched HTML, decodes entities, and collapses whitespace", () => {
    const html = `
      <html><head><style>body{color:red}</style></head>
      <body>
        <script>trackEvent();</script>
        <h1>Launch Day</h1>
        <p>We shipped &amp; it works.</p>
      </body></html>`;
    expect(extractHtml(html)).toEqual({ text: "Launch Day We shipped & it works." });
  });
});
