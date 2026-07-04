import { describe, expect, it } from "vitest";
import { extractVisibleText, selfContainmentViolations } from "../html";

const SELF_CONTAINED = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Acme &amp; Co</title>
<style>body{font-family:system-ui;background:url(data:image/png;base64,AAAA)}</style>
</head><body>
<header><h1>Ship faster</h1></header>
<main><section><p>One source in, judged drafts out.</p>
<img src="data:image/svg+xml,<svg/>" alt="Pipeline diagram">
<p><a href="https://acme.test/docs">Read the docs</a> or <a href="#contact">contact us</a>.</p>
</section></main>
</body></html>`;

describe("selfContainmentViolations (B3.15 structural ratchet)", () => {
  it("accepts a full self-contained page — inline styles, data: URIs, anchor links to anywhere", () => {
    expect(selfContainmentViolations(SELF_CONTAINED)).toEqual([]);
  });

  it("rejects a fragment that is not a full document", () => {
    expect(selfContainmentViolations("<div>hello</div>")).toContainEqual(
      expect.stringMatching(/not a full HTML document/),
    );
  });

  it("rejects every scriptable element", () => {
    for (const tag of ["script", "iframe", "object", "embed"]) {
      const html = SELF_CONTAINED.replace("<main>", `<main><${tag} src="x"></${tag}>`);
      expect(selfContainmentViolations(html)).toContainEqual(
        expect.stringMatching(new RegExp(`no <${tag}>`)),
      );
    }
  });

  it("rejects external resource loads via src/srcset/href on non-anchor elements", () => {
    const img = SELF_CONTAINED.replace("<main>", '<main><img src="https://cdn.test/x.png" alt="">');
    expect(selfContainmentViolations(img)).toContainEqual(expect.stringMatching(/<img> loads an external URL/));
    const link = SELF_CONTAINED.replace("</head>", '<link rel="stylesheet" href="//cdn.test/a.css"></head>');
    expect(selfContainmentViolations(link)).toContainEqual(expect.stringMatching(/<link> loads an external URL/));
    const srcset = SELF_CONTAINED.replace("<main>", '<main><img srcset="https://cdn.test/x.png 2x" alt="">');
    expect(selfContainmentViolations(srcset)).toContainEqual(expect.stringMatching(/srcset/));
  });

  it('cannot be blinded by a ">" inside a quoted attribute before the external URL', () => {
    const html = SELF_CONTAINED.replace(
      "<main>",
      '<main><img alt="a>b" src="https://evil.test/x.png">',
    );
    expect(selfContainmentViolations(html)).toContainEqual(
      expect.stringMatching(/<img> loads an external URL via src/),
    );
  });

  it("rejects external CSS url(...) loads", () => {
    const html = SELF_CONTAINED.replace(
      "background:url(data:image/png;base64,AAAA)",
      "background:url(https://cdn.test/bg.png)",
    );
    expect(selfContainmentViolations(html)).toContainEqual(expect.stringMatching(/CSS loads an external URL/));
  });
});

describe("extractVisibleText (the derived claim surface)", () => {
  it("keeps everything a visitor can read — title, headings, copy, alt text — and drops markup/script/style", () => {
    const text = extractVisibleText(SELF_CONTAINED);
    expect(text).toContain("Acme & Co"); // title, entity-decoded
    expect(text).toContain("Ship faster");
    expect(text).toContain("One source in, judged drafts out.");
    expect(text).toContain("Pipeline diagram"); // img alt
    expect(text).toContain("Read the docs");
    expect(text).not.toMatch(/font-family|<|>/);
  });

  it("keeps reading order across block boundaries as separate lines", () => {
    const text = extractVisibleText(SELF_CONTAINED);
    const lines = text.split("\n");
    expect(lines.indexOf("Ship faster")).toBeLessThan(
      lines.findIndex((l) => l.includes("One source in")),
    );
  });

  it("returns empty for a page with no visible text", () => {
    expect(extractVisibleText('<html><head><style>p{}</style></head><body><img src="data:x"></body></html>')).toBe("");
  });

  it("decodes numeric and named entities", () => {
    expect(extractVisibleText("<html><body><p>caf&#233; &quot;A&quot; &amp; B&nbsp;&#x21;</p></body></html>")).toBe(
      'café "A" & B !',
    );
  });
});
