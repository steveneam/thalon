import { seoMetaSchema } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { runJudgePipeline } from "../pipeline";
import { runSeoAeoLens, SEO_LENS_GATE } from "../seo-lens";
import { fixedDriver } from "./fake-drivers";
import { judgeFixture, type JudgeFixture } from "./fixtures";

const PASS = { verdict: "pass" as const, claims: [{ claim: "ok", supported: true, chunkRef: "c1" }] };

/** A body that satisfies every page-surface check for the GOOD seo block below. */
const GOOD_BODY = [
  "What is content automation?",
  "Content automation is the practice of generating and scheduling content from one profile.",
].join("\n\n");

const GOOD_SEO = seoMetaSchema.parse({
  targetKeywords: ["content automation"],
  metaTitle: "What Is Content Automation? A Plain Guide", // 41 chars — inside 30–60
  metaDescription:
    "Content automation explained in plain terms: what it is, how it works, and when a small team should reach for it.", // 113 — inside 70–160
});

describe("runSeoAeoLens (B6.8 — deterministic advisory lens, zero model calls)", () => {
  it("a well-formed page passes every check with a reason each", () => {
    const result = runSeoAeoLens({ seo: GOOD_SEO, body: GOOD_BODY, surface: "page" });
    expect(result.verdict).toBe("pass");
    expect(result.findings.every((f) => f.reason.length > 0)).toBe(true);
    expect(result.findings.map((f) => [f.check, f.status])).toEqual([
      ["meta_title_length", "pass"],
      ["meta_description_length", "pass"],
      ["target_declared", "pass"],
      ["target_in_title", "pass"],
      ["target_in_body", "pass"],
      ["question_answer_shape", "pass"],
    ]);
  });

  it("length windows warn outside 30–60 / 70–160 and on absent fields", () => {
    const short = runSeoAeoLens({
      seo: seoMetaSchema.parse({ metaTitle: "Too short", targetKeywords: ["x"] }),
      body: "x?",
      surface: "page",
    });
    expect(short.verdict).toBe("fail");
    const title = short.findings.find((f) => f.check === "meta_title_length")!;
    expect(title.status).toBe("warn");
    expect(title.reason).toMatch(/9 chars \(window 30–60\)/);
    const description = short.findings.find((f) => f.check === "meta_description_length")!;
    expect(description).toMatchObject({ status: "warn", reason: expect.stringMatching(/unset/) });
  });

  it("one target per page: zero targets and too many targets both warn (ADR 0006)", () => {
    const none = runSeoAeoLens({ seo: seoMetaSchema.parse({}), body: "?", surface: "page" });
    expect(none.findings.find((f) => f.check === "target_declared")).toMatchObject({
      status: "warn",
      reason: expect.stringMatching(/no target keywords/),
    });
    // With no primary target, the dependent checks skip honestly instead of guessing.
    expect(none.findings.find((f) => f.check === "target_in_body")!.status).toBe("skipped");

    const many = runSeoAeoLens({
      seo: seoMetaSchema.parse({ targetKeywords: ["a", "b", "c"] }),
      body: "a?",
      surface: "page",
    });
    expect(many.findings.find((f) => f.check === "target_declared")).toMatchObject({
      status: "warn",
      reason: expect.stringMatching(/3 target keywords declared \(max 1\)/),
    });
  });

  it("a body that never says its primary target warns — with the keyword named", () => {
    const result = runSeoAeoLens({
      seo: GOOD_SEO,
      body: "We make videos.\n\nWhy us?",
      surface: "page",
    });
    expect(result.findings.find((f) => f.check === "target_in_body")).toMatchObject({
      status: "warn",
      reason: expect.stringMatching(/never says the primary target "content automation"/),
    });
  });

  it("AEO: a body with no question-shaped line warns", () => {
    const result = runSeoAeoLens({
      seo: GOOD_SEO,
      body: "Content automation is great. We promise.",
      surface: "page",
    });
    expect(result.findings.find((f) => f.check === "question_answer_shape")!.status).toBe("warn");
  });

  it("video surface additionally checks tags and chapters (GEO assets); page surface omits them", () => {
    const bare = runSeoAeoLens({ seo: GOOD_SEO, body: GOOD_BODY, surface: "video" });
    expect(bare.findings.find((f) => f.check === "video_tags")!.status).toBe("warn");
    expect(bare.findings.find((f) => f.check === "video_chapters")!.status).toBe("warn");

    const tagged = runSeoAeoLens({
      seo: seoMetaSchema.parse({
        ...GOOD_SEO,
        tags: ["automation"],
        chapters: [{ title: "Intro", startMs: 0 }],
      }),
      body: GOOD_BODY,
      surface: "video",
    });
    expect(tagged.findings.find((f) => f.check === "video_tags")!.status).toBe("pass");
    expect(tagged.findings.find((f) => f.check === "video_chapters")!.status).toBe("pass");

    const page = runSeoAeoLens({ seo: GOOD_SEO, body: GOOD_BODY, surface: "page" });
    expect(page.findings.some((f) => f.check.startsWith("video_"))).toBe(false);
  });

  it("evidence maps every non-skipped finding to a claim; skipped checks are counted in the notes", () => {
    const result = runSeoAeoLens({ seo: seoMetaSchema.parse({}), body: "no questions here", surface: "page" });
    expect(result.evidence.claims.map((c) => c.claim)).toEqual([
      "meta_title_length",
      "meta_description_length",
      "target_declared",
      "question_answer_shape",
    ]);
    expect(result.evidence.notes).toMatch(/advisory SEO\/AEO lens .* 4 warning\(s\), 2 skipped/);
  });

  it("windows are config, defaults documented (30–60 / 70–160 / max 1 target)", () => {
    const custom = runSeoAeoLens(
      { seo: GOOD_SEO, body: GOOD_BODY, surface: "page" },
      { titleMax: 35 },
    );
    expect(custom.findings.find((f) => f.check === "meta_title_length")!.status).toBe("warn");
  });
});

let fx: JudgeFixture | undefined;
afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

/** Minimal REGISTRY-VALID web_page meta (the B4.2 rule: persisted drafts parse against their format schema). */
function webPageMeta(seo?: Record<string, unknown>): Record<string, unknown> {
  return {
    title: "What Is Content Automation?",
    description: "A plain guide to content automation.",
    htmlRef: "web-pages/test.html",
    groundingSourceIds: ["src-1"],
    promptVersion: "web-page-generate.v1",
    brandProfileVersion: 1,
    platformProfileVersion: "web.v1",
    ...(seo ? { seo } : {}),
  };
}

describe("pipeline wiring — the lens is ADVISORY and opt-in by data (ADR 0006)", () => {
  it("a seoMeta-capable draft carrying meta.seo gets a seo_aeo row; warns NEVER block the queue", async () => {
    fx = await judgeFixture({
      body: GOOD_BODY,
      format: "web_page",
      // metaTitle deliberately absent → the lens warns → advisory verdict "fail".
      meta: webPageMeta({ targetKeywords: ["content automation"] }),
    });
    const outcome = await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [{ ref: "c1", text: "Content automation content." }],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    // Advisory is structural: g3 pass/pass still queues despite lens warns.
    expect(outcome.status).toBe("queued");

    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, fx.draft.id);
    expect(rows.map((r) => r.gate).sort()).toEqual(["g1", "g3_final", "g3_screen", SEO_LENS_GATE]);
    const lensRow = rows.find((r) => r.gate === SEO_LENS_GATE)!;
    expect(lensRow.verdict).toBe("fail");
    expect(JSON.stringify(lensRow.evidence)).toMatch(/advisory SEO\/AEO lens/);
    expect(JSON.stringify(lensRow.evidence)).toMatch(/meta_title_length/);
  });

  it("no meta.seo ⇒ no lens row — every pre-B6.8 draft judges byte-identically", async () => {
    fx = await judgeFixture({ format: "web_page", meta: webPageMeta() });
    await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [{ ref: "c1", text: "We shipped a thing today." }],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, fx.draft.id);
    expect(rows.map((r) => r.gate).sort()).toEqual(["g1", "g3_final", "g3_screen"]);
  });

  it("a non-seoMeta format ignores a stray seo block (capability gate, not duck-typing)", async () => {
    fx = await judgeFixture({ meta: { seo: { targetKeywords: ["x"] } } }); // format null → post
    await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [{ ref: "c1", text: "We shipped a thing today." }],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, fx.draft.id);
    expect(rows.some((r) => r.gate === SEO_LENS_GATE)).toBe(false);
  });

  it("a malformed seo block is recorded honestly as an advisory fail with the parse issues", async () => {
    fx = await judgeFixture({
      format: "web_page",
      meta: webPageMeta({ targetKeywords: [123] }),
    });
    await runJudgePipeline(fx.handle.repos, {
      ctx: fx.ctx,
      draftId: fx.draft.id,
      chunks: [{ ref: "c1", text: "We shipped a thing today." }],
      screenDriver: fixedDriver(PASS),
      finalDriver: fixedDriver(PASS),
    });
    const rows = await fx.handle.repos.judgeResults.listForDraft(fx.ctx, fx.draft.id);
    const lensRow = rows.find((r) => r.gate === SEO_LENS_GATE)!;
    expect(lensRow.verdict).toBe("fail");
    expect(JSON.stringify(lensRow.evidence)).toMatch(/does not parse against seoMetaSchema/);
  });
});
