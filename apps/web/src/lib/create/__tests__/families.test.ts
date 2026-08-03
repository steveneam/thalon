import { describe, expect, it } from "vitest";
import { createDoor, isGenerable, leadingExit } from "@/lib/create/families";
import type { CreateFamily } from "@/lib/intel/types";

const EXITS: CreateFamily[] = ["video", "post", "page"];

/**
 * The seam behind the s77 blocker: Intel's dossier led with a PRIMARY
 * "Create post · suggested" that landed on a disabled Generate, because the
 * door and the destination each knew half the answer. These pin the shared
 * half — the surfaces' own tests pin that they read it.
 */
describe("Create's generation doors", () => {
  it("arms video unconditionally — the one-prompt run door exists", () => {
    expect(createDoor("video", { hasLead: false })).toEqual({ armed: true, reason: null });
  });

  it("arms email only with a lead's context, and says why not without one", () => {
    expect(createDoor("email", { hasLead: true }).armed).toBe(true);
    const shut = createDoor("email", { hasLead: false });
    expect(shut.armed).toBe(false);
    expect(shut.reason).toContain("lead");
  });

  it("arms post unconditionally — the founder's s98 dogfood GO flipped the seam", () => {
    expect(createDoor("post", { hasLead: false })).toEqual({ armed: true, reason: null });
  });

  it("refuses page in the operator's own words, never silently", () => {
    const door = createDoor("page", { hasLead: false });
    expect(door.armed).toBe(false);
    expect(door.reason).toBeTruthy();
    expect(door.reason).toContain("page");
  });

  it("a shut family is never generable from an upstream door", () => {
    expect(isGenerable("video")).toBe(true);
    expect(isGenerable("post")).toBe(true);
    expect(isGenerable("page")).toBe(false);
    // email carries no lead context from a trend card, so it cannot lead one.
    expect(isGenerable("email")).toBe(false);
  });
});

describe("leadingExit — a primary button is a recommendation", () => {
  it("keeps the suggestion when its destination can run", () => {
    expect(leadingExit("video", EXITS)).toBe("video");
  });

  it("hands the primary slot to a family that CAN run when the suggestion cannot", () => {
    // Since the s98 post arming the live shut suggestion is `page` alone.
    expect(leadingExit("page", EXITS)).toBe("video");
  });

  it("keeps the armed suggestion now that its door opens — the s77 dead-primary case, healed", () => {
    // The original live case: every demo trend card is Bluesky-sourced, so
    // the heuristic suggests `post` on all of them. That door now runs.
    expect(leadingExit("post", EXITS)).toBe("post");
  });

  it("falls back to the suggestion rather than inventing a second shut exit", () => {
    expect(leadingExit("page", ["page"])).toBe("page");
  });
});
