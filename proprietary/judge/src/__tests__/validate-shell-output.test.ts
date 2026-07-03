import { describe, expect, it } from "vitest";
import { callTierJudge } from "../validate-shell-output";
import { scriptedDriver, withCallCount } from "./fake-drivers";

const VALID_PASS = { verdict: "pass", claims: [{ claim: "x", supported: true }] };
const VALID_FAIL = { verdict: "fail", claims: [{ claim: "x", supported: false }] };

describe("shell/core boundary — validate-shell-output", () => {
  it("accepts a schema-valid candidate on the first attempt", async () => {
    const counting = withCallCount(scriptedDriver([VALID_PASS]));
    const result = await callTierJudge(counting.driver, { tier: "screen", body: "b", chunks: [] });
    expect(result).toMatchObject({ verdict: "pass", irrecoverable: false, attempts: 1 });
    expect(counting.count).toBe(1);
  });

  it("retries on a malformed candidate and succeeds within the bound", async () => {
    const counting = withCallCount(scriptedDriver([{ nonsense: true }, VALID_FAIL]));
    const result = await callTierJudge(counting.driver, { tier: "final", body: "b", chunks: [] });
    expect(result).toMatchObject({ verdict: "fail", irrecoverable: false, attempts: 2 });
    expect(counting.count).toBe(2);
  });

  it("retries on a thrown error the same as a malformed candidate", async () => {
    const counting = withCallCount(
      scriptedDriver([new Error("network blip"), VALID_PASS]),
    );
    const result = await callTierJudge(counting.driver, { tier: "screen", body: "b", chunks: [] });
    expect(result.verdict).toBe("pass");
    expect(counting.count).toBe(2);
  });

  it("exhausts bounded retries and treats an irrecoverable output as FAIL — never a silent pass", async () => {
    const counting = withCallCount(
      scriptedDriver([{ bad: 1 }, { bad: 2 }, { bad: 3 }, VALID_PASS]),
    );
    const result = await callTierJudge(
      counting.driver,
      { tier: "screen", body: "b", chunks: [] },
      { maxAttempts: 3 },
    );
    expect(result).toMatchObject({ verdict: "fail", irrecoverable: true, attempts: 3 });
    // The 4th (valid) script entry is never reached — retries are BOUNDED.
    expect(counting.count).toBe(3);
  });
});
