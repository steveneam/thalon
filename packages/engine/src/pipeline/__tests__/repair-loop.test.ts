import { BudgetExceededError } from "@thalon/db";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { generateValidatedCandidate } from "../repair-loop";

const schema = z.object({ n: z.number() });

function sequenceDriver(candidates: (unknown | Error)[]) {
  let call = 0;
  const driver = async (_req: unknown) => {
    const next = candidates[call++];
    if (next instanceof Error) throw next;
    return { candidate: next };
  };
  return { driver, calls: () => call };
}

describe("generateValidatedCandidate (B4.1 — THE bounded repair loop)", () => {
  it("accepts a valid first candidate: attempts=1, no error", async () => {
    const { driver } = sequenceDriver([{ n: 1 }]);
    const result = await generateValidatedCandidate(driver, {}, schema);
    expect(result).toEqual({ output: { n: 1 }, attempts: 1, irrecoverable: false });
  });

  it("a thrown driver error, a schema-invalid candidate, and a validate-hook rejection each consume ONE attempt", async () => {
    const { driver, calls } = sequenceDriver([new Error("driver blew up"), { n: "not a number" }, { n: 3 }]);
    const result = await generateValidatedCandidate(driver, {}, schema, {
      validate: (out) => (out.n === 3 ? "semantic: three is right out" : null),
    });
    expect(calls()).toBe(3);
    expect(result.output).toBeNull();
    expect(result.irrecoverable).toBe(true);
    expect(result.attempts).toBe(3);
    // lastError is the LAST attempt's failure, verbatim (B1.5 lesson).
    expect(result.lastError).toBe("semantic: three is right out");
  });

  it("recovers on a later attempt and reports the attempt count", async () => {
    const { driver } = sequenceDriver([{ n: "bad" }, { n: 2 }]);
    const result = await generateValidatedCandidate(driver, {}, schema);
    expect(result.output).toEqual({ n: 2 });
    expect(result.attempts).toBe(2);
    expect(result.irrecoverable).toBe(false);
  });

  it("schema failures carry the standard schema-invalid message with Zod issue paths", async () => {
    const { driver } = sequenceDriver([{ n: "bad" }]);
    const result = await generateValidatedCandidate(driver, {}, schema, { maxAttempts: 1 });
    expect(result.lastError).toMatch(/^schema-invalid candidate: n: /);
  });

  it("a blown tenant budget is an operational hard stop, NEVER a consumed repair attempt", async () => {
    const budget = new BudgetExceededError("t", "2026-07-05", 10, 5);
    const { driver, calls } = sequenceDriver([budget, { n: 1 }]);
    await expect(generateValidatedCandidate(driver, {}, schema)).rejects.toBe(budget);
    expect(calls()).toBe(1);
  });

  it("respects maxAttempts and reports it on exhaustion", async () => {
    const { driver, calls } = sequenceDriver([new Error("a"), new Error("b"), new Error("c"), { n: 1 }]);
    const result = await generateValidatedCandidate(driver, {}, schema, { maxAttempts: 2 });
    expect(calls()).toBe(2);
    expect(result.attempts).toBe(2);
    expect(result.lastError).toBe("b");
  });
});
