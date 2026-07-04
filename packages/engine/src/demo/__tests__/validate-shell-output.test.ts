import { BudgetExceededError } from "@thalon/db";
import { describe, expect, it } from "vitest";
import { deriveFlowMap, type FlowMap } from "../flow-map";
import type { StoryboardDriver, StoryboardRequest } from "../shell/generator";
import { generateValidatedStoryboard } from "../validate-shell-output";

const flowMap: FlowMap = deriveFlowMap([
  {
    url: "https://example.test/",
    html: `<a id="docs-link" href="/docs">Docs</a>`,
  },
  {
    url: "https://example.test/docs",
    html: `<input type="search" name="q" placeholder="Search" />`,
  },
]);

const REQ: StoryboardRequest = {
  flowName: "open the docs",
  voice: {},
  flowMap,
  crawlContext: "",
};

const VALID_CANDIDATE = {
  steps: [
    { action: "goto", target: "https://example.test/", value: "", narration: "Open the homepage." },
    { action: "click", target: "#docs-link", value: "", narration: "Click into the docs." },
  ],
};

describe("generateValidatedStoryboard (B2.5 stage 3, keyless + networkless)", () => {
  it("accepts a schema-valid candidate whose targets all exist in the flow map", async () => {
    const driver: StoryboardDriver = async () => ({ candidate: VALID_CANDIDATE, tokensIn: 1, tokensOut: 1 });
    const result = await generateValidatedStoryboard(driver, REQ, flowMap);
    expect(result.output).toEqual(VALID_CANDIDATE);
    expect(result.attempts).toBe(1);
    expect(result.irrecoverable).toBe(false);
  });

  it("rejects and repairs a goto target that is not a crawled page", async () => {
    let attempts = 0;
    const driver: StoryboardDriver = async () => {
      attempts += 1;
      if (attempts === 1) {
        return {
          candidate: {
            steps: [
              { action: "goto", target: "https://example.test/nonexistent", value: "", narration: "x" },
            ],
          },
          tokensIn: 1,
          tokensOut: 1,
        };
      }
      return { candidate: VALID_CANDIDATE, tokensIn: 1, tokensOut: 1 };
    };
    const result = await generateValidatedStoryboard(driver, REQ, flowMap);
    expect(attempts).toBe(2);
    expect(result.output).toEqual(VALID_CANDIDATE);
  });

  it("rejects a non-goto target that is not a flow-map affordance", async () => {
    const driver: StoryboardDriver = async () => ({
      candidate: {
        steps: [{ action: "click", target: "#does-not-exist", value: "", narration: "x" }],
      },
      tokensIn: 1,
      tokensOut: 1,
    });
    const result = await generateValidatedStoryboard(driver, REQ, flowMap, { maxAttempts: 1 });
    expect(result.output).toBeNull();
    expect(result.irrecoverable).toBe(true);
    expect(result.lastError).toMatch(/not a flow-map affordance/);
  });

  it("rejects a duplicate step (same action+target+value repeated)", async () => {
    const driver: StoryboardDriver = async () => ({
      candidate: {
        steps: [
          { action: "click", target: "#docs-link", value: "", narration: "a" },
          { action: "click", target: "#docs-link", value: "", narration: "b" },
        ],
      },
      tokensIn: 1,
      tokensOut: 1,
    });
    const result = await generateValidatedStoryboard(driver, REQ, flowMap, { maxAttempts: 1 });
    expect(result.output).toBeNull();
    expect(result.lastError).toMatch(/duplicate step/);
  });

  it("rejects contradictory fill steps targeting the same selector with different values", async () => {
    const driver: StoryboardDriver = async () => ({
      candidate: {
        steps: [
          {
            action: "fill",
            target: 'input[name="q"]',
            value: "first search",
            narration: "Search once.",
          },
          {
            action: "fill",
            target: 'input[name="q"]',
            value: "second search",
            narration: "Search again.",
          },
        ],
      },
      tokensIn: 1,
      tokensOut: 1,
    });
    const result = await generateValidatedStoryboard(driver, REQ, flowMap, { maxAttempts: 1 });
    expect(result.output).toBeNull();
    expect(result.lastError).toMatch(/contradictory fill/);
  });

  it("is irrecoverable and persists nothing when every attempt is invalid", async () => {
    let attempts = 0;
    const driver: StoryboardDriver = async () => {
      attempts += 1;
      return { candidate: { steps: [] }, tokensIn: 1, tokensOut: 1 }; // fails schema min(1)
    };
    const result = await generateValidatedStoryboard(driver, REQ, flowMap, { maxAttempts: 3 });
    expect(attempts).toBe(3);
    expect(result.output).toBeNull();
    expect(result.irrecoverable).toBe(true);
    expect(result.lastError).toMatch(/schema-invalid candidate/);
  });

  it("surfaces BudgetExceededError immediately instead of consuming a repair attempt", async () => {
    let attempts = 0;
    const driver: StoryboardDriver = async () => {
      attempts += 1;
      throw new BudgetExceededError("tenant-1", "2026-07-04", 100, 50);
    };
    await expect(generateValidatedStoryboard(driver, REQ, flowMap)).rejects.toThrow(
      BudgetExceededError,
    );
    expect(attempts).toBe(1);
  });
});
