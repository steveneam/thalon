import { describe, expect, it } from "vitest";
import { runG1Denylist } from "../g1-denylist";

describe("G1 denylist (pure core fn)", () => {
  it("passes when the denylist is empty", () => {
    const result = runG1Denylist({ body: "anything goes here", denylist: [] });
    expect(result.verdict).toBe("pass");
    expect(result.evidence.claims).toEqual([]);
  });

  it("passes when no term appears in the body", () => {
    const result = runG1Denylist({
      body: "We shipped a thing today.",
      denylist: ["guaranteed returns"],
    });
    expect(result.verdict).toBe("pass");
  });

  it("is case-insensitive", () => {
    const result = runG1Denylist({
      body: "GUARANTEED RETURNS on every trade.",
      denylist: ["guaranteed returns"],
    });
    expect(result.verdict).toBe("fail");
    expect(result.evidence.claims[0]).toMatchObject({ claim: "guaranteed returns" });
  });

  it("is word-boundary aware: a substring inside a larger word does not match", () => {
    const result = runG1Denylist({
      body: "Sign up for our new classroom series.",
      denylist: ["class"],
    });
    expect(result.verdict).toBe("pass");
  });

  it("matches a multi-word term across its internal space", () => {
    const result = runG1Denylist({
      body: "This is not investment advice, but guaranteed returns await.",
      denylist: ["guaranteed returns"],
    });
    expect(result.verdict).toBe("fail");
  });

  it("records every occurrence of every matched term, with positions", () => {
    const body = "risk-free risk-free";
    const result = runG1Denylist({ body, denylist: ["risk-free"] });
    expect(result.verdict).toBe("fail");
    expect(result.evidence.claims).toHaveLength(2);
    expect(result.evidence.claims[0].evidence).toContain("index 0");
    expect(result.evidence.claims[1].evidence).toContain(`index ${"risk-free ".length}`);
  });

  it("multi-term: any one of several denylisted terms fails the gate", () => {
    const result = runG1Denylist({
      body: "Act now — limited time, guaranteed win.",
      denylist: ["act now", "guaranteed win", "some other term"],
    });
    expect(result.verdict).toBe("fail");
    expect(result.evidence.claims.map((c) => c.claim).sort()).toEqual(
      ["act now", "guaranteed win"].sort(),
    );
  });

  it("per-tenant isolation: the same body is judged only against ITS OWN denylist array", () => {
    const body = "guaranteed returns, always.";
    const tenantA = runG1Denylist({ body, denylist: ["guaranteed returns"] });
    const tenantB = runG1Denylist({ body, denylist: ["some other tenant's term"] });
    expect(tenantA.verdict).toBe("fail");
    expect(tenantB.verdict).toBe("pass");
  });
});
