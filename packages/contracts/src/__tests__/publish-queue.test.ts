import { describe, expect, it } from "vitest";
import {
  assertPublishQueueTransition,
  InvalidPublishQueueTransitionError,
  PUBLISH_QUEUE_STATUSES,
  PUBLISH_QUEUE_TRANSITIONS,
  publishQueueEnqueueSchema,
  type PublishQueueStatus,
} from "../publish-queue";

/**
 * s82 window (W1): the queue's rulebook. These pin the two decisions the
 * contract makes — `failed` is terminal, and `processing → pending` is the
 * only backwards edge — so neither can be loosened by accident.
 */

const UUID = "3f1a6d7e-9c4b-4a2e-8f10-5b6c7d8e9f01";

describe("publish queue transitions (s82 W1)", () => {
  it("names a transition map for every status, over the status vocabulary only", () => {
    expect(Object.keys(PUBLISH_QUEUE_TRANSITIONS).sort()).toEqual([...PUBLISH_QUEUE_STATUSES].sort());
    for (const status of PUBLISH_QUEUE_STATUSES) {
      for (const target of PUBLISH_QUEUE_TRANSITIONS[status]) {
        expect(PUBLISH_QUEUE_STATUSES).toContain(target);
      }
    }
  });

  it("lets a pending row be claimed or withdrawn, and nothing else", () => {
    expect([...PUBLISH_QUEUE_TRANSITIONS.pending].sort()).toEqual(["cancelled", "processing"]);
    expect(() => assertPublishQueueTransition("pending", "processing")).not.toThrow();
    expect(() => assertPublishQueueTransition("pending", "cancelled")).not.toThrow();
    expect(() => assertPublishQueueTransition("pending", "published")).toThrow(
      InvalidPublishQueueTransitionError,
    );
  });

  it("keeps failure terminal — a queue that retries itself is what nobody authorised", () => {
    expect(PUBLISH_QUEUE_TRANSITIONS.failed).toEqual([]);
    for (const target of PUBLISH_QUEUE_STATUSES) {
      expect(() => assertPublishQueueTransition("failed", target)).toThrow(
        InvalidPublishQueueTransitionError,
      );
    }
  });

  it("keeps published and cancelled terminal too", () => {
    expect(PUBLISH_QUEUE_TRANSITIONS.published).toEqual([]);
    expect(PUBLISH_QUEUE_TRANSITIONS.cancelled).toEqual([]);
  });

  it("allows exactly one backwards edge: the stale-claim release", () => {
    const backwards: Array<[PublishQueueStatus, PublishQueueStatus]> = [];
    for (const from of PUBLISH_QUEUE_STATUSES) {
      for (const to of PUBLISH_QUEUE_TRANSITIONS[from]) {
        if (to === "pending") backwards.push([from, to]);
      }
    }
    expect(backwards).toEqual([["processing", "pending"]]);
  });

  it("a claimed row cannot be cancelled — mid-flight is past the operator's decision", () => {
    expect(() => assertPublishQueueTransition("processing", "cancelled")).toThrow(
      InvalidPublishQueueTransitionError,
    );
  });

  it("names the allowed set in the error, so a caller reads the way out", () => {
    try {
      assertPublishQueueTransition("published", "pending");
      throw new Error("expected a refusal");
    } catch (error) {
      expect((error as Error).message).toContain("none — terminal state");
    }
  });
});

describe("publish queue enqueue input (s82 W1)", () => {
  it("demands a time, even though the column stays nullable", () => {
    expect(() =>
      publishQueueEnqueueSchema.parse({ draftId: UUID, platform: "linkedin" }),
    ).toThrow();
    const parsed = publishQueueEnqueueSchema.parse({
      draftId: UUID,
      platform: "linkedin",
      scheduledAt: "2026-08-01T09:30:00+10:00",
    });
    expect(parsed.scheduledAt).toBe("2026-08-01T09:30:00+10:00");
  });

  it("demands an offset-bearing timestamp — a wall-clock string has no single moment behind it", () => {
    expect(() =>
      publishQueueEnqueueSchema.parse({
        draftId: UUID,
        platform: "x",
        scheduledAt: "2026-08-01T09:30:00",
      }),
    ).toThrow();
  });

  it("refuses a platform outside the enum and a draft id that is not a uuid", () => {
    expect(() =>
      publishQueueEnqueueSchema.parse({
        draftId: UUID,
        platform: "mastodon",
        scheduledAt: "2026-08-01T09:30:00Z",
      }),
    ).toThrow();
    expect(() =>
      publishQueueEnqueueSchema.parse({
        draftId: "not-a-uuid",
        platform: "x",
        scheduledAt: "2026-08-01T09:30:00Z",
      }),
    ).toThrow();
  });
});
