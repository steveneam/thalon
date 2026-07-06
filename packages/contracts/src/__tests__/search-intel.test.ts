import { describe, expect, it } from "vitest";
import { DRAFT_FORMAT_REGISTRY } from "../format-registry";
import { searchTargetSchema, seoMetaSchema } from "../search-intel";

describe("search-target schema (B6.8)", () => {
  it("validates keyword + origin; meta defaults open", () => {
    const target = searchTargetSchema.parse({
      keyword: "ai content engine",
      origin: "profile_seed",
    });
    expect(target.meta).toEqual({});
    expect(searchTargetSchema.safeParse({ keyword: "", origin: "operator" }).success).toBe(false);
    expect(searchTargetSchema.safeParse({ keyword: "x", origin: "scraped" }).success).toBe(false);
  });
});

describe("seo meta schema (B6.8)", () => {
  it("everything defaults empty/absent — a bare {} is a valid seo block", () => {
    expect(seoMetaSchema.parse({})).toEqual({
      targetKeywords: [],
      jsonLdTypes: [],
      tags: [],
      chapters: [],
    });
  });

  it("chapters need a title and a non-negative startMs", () => {
    const parsed = seoMetaSchema.parse({
      chapters: [{ title: "Intro", startMs: 0 }],
      jsonLdTypes: ["VideoObject"],
    });
    expect(parsed.chapters).toHaveLength(1);
    expect(seoMetaSchema.safeParse({ chapters: [{ title: "", startMs: 0 }] }).success).toBe(false);
    expect(seoMetaSchema.safeParse({ chapters: [{ title: "x", startMs: -1 }] }).success).toBe(
      false,
    );
  });
});

describe("format-registry seoMeta capability (B6.8, additive-only)", () => {
  it("exactly web_page + the video direction formats carry the capability", () => {
    const carriers = Object.values(DRAFT_FORMAT_REGISTRY)
      .filter((spec) => spec.capabilities.seoMeta)
      .map((spec) => spec.format)
      .sort();
    expect(carriers).toEqual(["direction_doc", "pillar_script", "web_page"]);
  });

  it("a pre-B6.8 web_page meta (no seo block) still parses — the additivity proof", () => {
    const preWindow = {
      title: "Thalon",
      description: "Content engine",
      htmlRef: "pages/x/index.html",
      groundingSourceIds: ["src-1"],
      promptVersion: "webpage.v1",
      brandProfileVersion: 1,
      platformProfileVersion: "web.v1",
    };
    const spec = DRAFT_FORMAT_REGISTRY.web_page;
    expect(spec.meta.safeParse(preWindow).success).toBe(true);

    const withSeo = spec.meta.parse({
      ...preWindow,
      seo: { targetKeywords: ["ai content engine"], jsonLdTypes: ["Organization", "FAQPage"] },
    }) as { seo?: { targetKeywords: string[] } };
    expect(withSeo.seo?.targetKeywords).toEqual(["ai content engine"]);
  });

  it("a pre-B6.8 pillar_script meta still parses with seo absent", () => {
    const spec = DRAFT_FORMAT_REGISTRY.pillar_script;
    const parsed = spec.meta.parse({
      title: "Pillar",
      hook: "Hook",
      beats: [{ beatIndex: 0, narration: "One." }],
      cta: null,
      groundingSourceIds: ["src-1"],
      promptVersion: "pillar.v1",
      brandProfileVersion: 1,
      platformProfileVersion: "video.v1",
    }) as { seo?: unknown };
    expect(parsed.seo).toBeUndefined();
  });
});
