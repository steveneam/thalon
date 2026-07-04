import { describe, expect, it } from "vitest";
import { loadExemplarProfile } from "../profile";

describe("loadExemplarProfile (B2.4 exemplar knobs — data, never code)", () => {
  it("loads the shipped default: exemplar retrieval off, top-k 5", () => {
    const loaded = loadExemplarProfile("exemplar");
    expect(loaded).not.toBeNull();
    expect(loaded?.profileVersion).toBe("exemplar.v1");
    expect(loaded?.profile.enabled).toBe(false);
    expect(loaded?.profile.topK).toBe(5);
  });

  it("returns null for a profile name with no shipped default", () => {
    expect(loadExemplarProfile("no-such-profile")).toBeNull();
  });
});
