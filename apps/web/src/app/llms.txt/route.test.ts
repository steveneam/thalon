import { describe, expect, it } from "vitest";
import { FAQ } from "@/lib/landing/copy";
import { GET } from "./route";

describe("GET /llms.txt (A13 AEO/GEO pack)", () => {
  it("serves the answer-engine summary from the shared copy module", async () => {
    const res = GET();
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
});
