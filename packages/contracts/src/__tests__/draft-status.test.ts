import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  DRAFT_STATUSES,
  InvalidTransitionError,
  isDraftStatus,
  type DraftStatus,
} from "../draft-status";

/**
 * The ratchet: this edge list is written out independently of
 * DRAFT_TRANSITIONS (never derived from it) so any drift from the approved
 * SPINE §1.1 diagram fails loudly. Changing the state machine means changing
 * BOTH files — deliberately.
 */
const EXPECTED_EDGES: ReadonlyArray<readonly [DraftStatus, DraftStatus]> = [
  ["generated", "judging"],
  ["judging", "queued"],
  ["judging", "blocked"],
  ["queued", "approved"],
  ["queued", "rejected"],
  ["queued", "judging"], // approve-with-edit ⇒ edited body re-judges first
  ["blocked", "judging"], // operator triage exit
  ["approved", "scheduled"],
  ["scheduled", "published"],
];

const edgeSet = new Set(EXPECTED_EDGES.map(([f, t]) => `${f}->${t}`));

describe("draft state machine (SPINE §1.1)", () => {
  it("allows exactly the approved edges — exhaustive over all status pairs", () => {
    for (const from of DRAFT_STATUSES) {
      for (const to of DRAFT_STATUSES) {
        const expected = edgeSet.has(`${from}->${to}`);
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(expected);
        if (expected) {
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to)).toThrow(
            InvalidTransitionError,
          );
        }
      }
    }
  });

  it("keeps published and rejected terminal", () => {
    for (const to of DRAFT_STATUSES) {
      expect(canTransition("published", to)).toBe(false);
      expect(canTransition("rejected", to)).toBe(false);
    }
  });

  it("never allows a self-transition or a jump straight to queued/published", () => {
    for (const status of DRAFT_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
    expect(canTransition("generated", "queued")).toBe(false);
    expect(canTransition("generated", "published")).toBe(false);
    expect(canTransition("queued", "published")).toBe(false);
    expect(canTransition("approved", "published")).toBe(false);
  });

  it("guards the status vocabulary", () => {
    expect(isDraftStatus("queued")).toBe(true);
    expect(isDraftStatus("draft")).toBe(false);
    expect(isDraftStatus("")).toBe(false);
  });
});
