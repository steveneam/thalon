import {
  InvalidPublishQueueTransitionError,
  InvalidTransitionError,
  InvalidVideoCutTransitionError,
} from "@thalon/contracts";
import { InvalidStateError, InvariantViolationError, NotFoundError } from "@thalon/db";
import { describe, expect, it } from "vitest";
import { toErrorResponse } from "@/lib/http-errors";

/**
 * s82: the shared error→status mapping had no test, and it drifted — two typed
 * STATE refusals (`InvalidPublishQueueTransitionError`, shipped in the s82 W1
 * window, and `InvalidStateError`) were missing while their
 * `InvalidTransitionError` sibling was already mapped. Both fell through to the
 * catch-all 400, telling a caller it had sent a bad request when what actually
 * happened was "the row is not in a state where that verb applies".
 *
 * Every s82 route that could hit them caught them locally, so nothing shipped
 * wrong — but that is precisely the shape of a trap: the next route to forget
 * pays for it. This pins the mapping so the drift cannot recur silently.
 *
 * The rule the table encodes: **404 is "no such thing", 409 is "the thing
 * exists and refuses", 400 is "your request was malformed".** A state refusal
 * is never a malformed request.
 */

const STATE_CONFLICTS: Array<[string, Error]> = [
  ["InvalidTransitionError", new InvalidTransitionError("generated", "published")],
  ["InvalidVideoCutTransitionError", new InvalidVideoCutTransitionError("approved", "rendered")],
  [
    "InvalidPublishQueueTransitionError",
    new InvalidPublishQueueTransitionError("published", "pending"),
  ],
  ["InvalidStateError", new InvalidStateError("this cut is approved and cannot be deleted")],
  ["InvariantViolationError", new InvariantViolationError("I4", "an event was not appended")],
];

describe("toErrorResponse — a state refusal is a conflict, never a bad request", () => {
  for (const [name, error] of STATE_CONFLICTS) {
    it(`maps ${name} to 409`, async () => {
      const res = toErrorResponse(error);
      expect(res.status, `${name} must be a 409 conflict, not a 400`).toBe(409);
      // The refusal's own sentence survives — an operator reads the actual
      // reason, never a generic status word.
      expect(await res.json()).toEqual({ error: error.message });
    });
  }

  it("maps NotFoundError to 404 — no such thing, as opposed to it refusing", async () => {
    const res = toErrorResponse(new NotFoundError("video_cut", "abc"));
    expect(res.status).toBe(404);
  });

  it("keeps 400 for a genuinely malformed request", async () => {
    const res = toErrorResponse(new Error("missing ?ref"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "missing ?ref" });
  });

  it("does not leak a non-Error throw as a caller mistake", async () => {
    const res = toErrorResponse("something threw a string");
    expect(res.status).toBe(500);
  });
});
