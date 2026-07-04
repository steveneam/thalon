import { describe, expect, it } from "vitest";
import { stripPii } from "../pii-strip";

describe("stripPii (B2.4 invariant: PII stripped before anything is stored, ADR 0002 decision 4)", () => {
  it("redacts an email address with a coherent placeholder", () => {
    const { text, stats } = stripPii("Reach out to jane.doe@example.com for details.");
    expect(text).toBe("Reach out to [EMAIL] for details.");
    expect(stats).toEqual({ emails: 1, phones: 0, handles: 0 });
  });

  it("redacts a national phone number", () => {
    const { text, stats } = stripPii("Call us at 555-123-4567 any weekday.");
    expect(text).toBe("Call us at [PHONE] any weekday.");
    expect(stats.phones).toBe(1);
  });

  it("redacts an international phone number with a leading +", () => {
    const { text, stats } = stripPii("Ring +61 412 345 678 for support.");
    expect(text).toBe("Ring [PHONE] for support.");
    expect(stats.phones).toBe(1);
  });

  it("redacts an @handle", () => {
    const { text, stats } = stripPii("Great tip from @janedoe_official this week.");
    expect(text).toBe("Great tip from [HANDLE] this week.");
    expect(stats.handles).toBe(1);
  });

  it("redacts an email's @ without also emitting a spurious handle", () => {
    const { text, stats } = stripPii("Email jane@example.com anytime.");
    expect(text).toBe("Email [EMAIL] anytime.");
    expect(stats).toEqual({ emails: 1, phones: 0, handles: 0 });
  });

  it("redacts multiple distinct PII types in one pass", () => {
    const { text, stats } = stripPii(
      "Contact jane@example.com or call 555-123-4567, or find @janedoe online.",
    );
    expect(text).toBe("Contact [EMAIL] or call [PHONE], or find [HANDLE] online.");
    expect(stats).toEqual({ emails: 1, phones: 1, handles: 1 });
  });

  it("leaves clean text — including dates, prices, and version numbers — completely unchanged", () => {
    const clean =
      "Last year's pilot repaired 140 items. Today is 2026-07-04. It costs $50.00 and ships v1.2.3.";
    const { text, stats } = stripPii(clean);
    expect(text).toBe(clean);
    expect(stats).toEqual({ emails: 0, phones: 0, handles: 0 });
  });

  it("is deterministic: identical input always yields identical output", () => {
    const input = "Contact jane@example.com or call 555-123-4567.";
    expect(stripPii(input)).toEqual(stripPii(input));
  });

  it("is idempotent on already-redacted text: running it twice is a no-op the second time", () => {
    const once = stripPii("Contact jane@example.com or call 555-123-4567 or @janedoe.");
    const twice = stripPii(once.text);
    expect(twice.text).toBe(once.text);
    expect(twice.stats).toEqual({ emails: 0, phones: 0, handles: 0 });
  });
});
