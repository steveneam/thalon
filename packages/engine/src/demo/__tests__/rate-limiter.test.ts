import { describe, expect, it } from "vitest";
import { createRateLimiter, msUntilNextRequest } from "../rate-limiter";

describe("msUntilNextRequest (B2.5 stage 1, pure core)", () => {
  it("never waits before the first request", () => {
    expect(msUntilNextRequest(null, 1_000, 250)).toBe(0);
  });

  it("waits the remaining delay when less than minDelayMs has elapsed", () => {
    expect(msUntilNextRequest(1_000, 1_100, 250)).toBe(150);
  });

  it("waits zero once minDelayMs has already elapsed", () => {
    expect(msUntilNextRequest(1_000, 1_250, 250)).toBe(0);
    expect(msUntilNextRequest(1_000, 2_000, 250)).toBe(0);
  });

  it("waits the full window if the clock appears to go backwards", () => {
    expect(msUntilNextRequest(1_000, 900, 250)).toBe(250);
  });
});

describe("createRateLimiter (thin stateful wrapper — only the wait is impure)", () => {
  it("does not sleep before the first request", async () => {
    const sleeps: number[] = [];
    const clock = 0;
    const limiter = createRateLimiter(250, {
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    await limiter.beforeRequest();
    expect(sleeps).toEqual([]);
  });

  it("sleeps exactly the remaining delay on a request that arrives too soon", async () => {
    const sleeps: number[] = [];
    let clock = 0;
    const limiter = createRateLimiter(250, {
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    await limiter.beforeRequest(); // clock=0, no wait
    clock = 100; // only 100ms elapsed
    await limiter.beforeRequest();
    expect(sleeps).toEqual([150]);
  });

  it("does not sleep again once enough time has passed", async () => {
    const sleeps: number[] = [];
    let clock = 0;
    const limiter = createRateLimiter(250, {
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    await limiter.beforeRequest();
    clock = 1_000; // well past minDelayMs
    await limiter.beforeRequest();
    expect(sleeps).toEqual([]);
  });
});
