import { describe, expect, it } from "vitest";
import { SEED_POSTS } from "@/lib/blog/posts";
import { FAQ } from "@/lib/landing/copy";
import { GET } from "./route";

describe("GET /llms.txt (A13 AEO/GEO pack)", () => {
  it("serves the answer-engine summary from the shared copy module", async () => {
    const res = await GET();
    expect(res.headers.get("content-type")).toContain("text/plain");
    const body = await res.text();
    expect(body).toMatch(/^# Thalon/);
    // The gate is the differentiator — it must be stated for answer engines.
    expect(body).toContain("nothing publishes without explicit human approval");
    // Honest-claims pin (ADR 0006 §5).
    expect(body).toContain("it does not promise rankings");
    // Every visible FAQ answer ships to answer engines verbatim.
    for (const item of FAQ) {
      expect(body).toContain(item.question);
    }
  });

  it("carries the article index from the same content module as /blog (§9)", async () => {
    const body = await (await GET()).text();
    expect(body).toContain("## Articles");
    for (const post of SEED_POSTS) {
      expect(body).toContain(`/blog/${post.slug}): ${post.description}`);
    }
    // Cadence honesty rides along (ADR 0006): "regularly", never daily.
    expect(body).toContain("published regularly");
  });
});
