import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, MAX_JOINS_PER_WINDOW, resetRateLimit, WINDOW_MS } from "../rate-limit";

const T0 = 1_000_000;

beforeEach(() => resetRateLimit());

describe("waitlist per-IP rate limit (B6.1)", () => {
  it("allows up to the window budget, then blocks with a Retry-After", () => {
    for (let i = 0; i < MAX_JOINS_PER_WINDOW; i++) {
      expect(checkRateLimit("1.2.3.4", T0 + i).allowed).toBe(true);
    }
    const blocked = checkRateLimit("1.2.3.4", T0 + 10_000);
    expect(blocked.allowed).toBe(false);
    // 10s into a 60s window → reset in 50s.
    expect(blocked.retryAfterSec).toBe(Math.ceil((WINDOW_MS - 10_000) / 1000));
  });

  it("resets once the window has elapsed", () => {
    for (let i = 0; i <= MAX_JOINS_PER_WINDOW; i++) checkRateLimit("1.2.3.4", T0);
    expect(checkRateLimit("1.2.3.4", T0).allowed).toBe(false);
    expect(checkRateLimit("1.2.3.4", T0 + WINDOW_MS).allowed).toBe(true);
  });

  it("tracks IPs independently", () => {
    for (let i = 0; i <= MAX_JOINS_PER_WINDOW; i++) checkRateLimit("1.2.3.4", T0);
    expect(checkRateLimit("1.2.3.4", T0).allowed).toBe(false);
    expect(checkRateLimit("5.6.7.8", T0).allowed).toBe(true);
  });
});
