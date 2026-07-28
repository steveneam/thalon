import {
  InvalidPublishQueueTransitionError,
  InvalidTransitionError,
  InvalidVideoCutTransitionError,
} from "@thalon/contracts";
import { InvalidStateError, InvariantViolationError, NotFoundError } from "@thalon/db";
import {
  PublishRefusedError,
  VaultKeyInvalidError,
  VaultKeyMissingError,
  VaultNotConnectedError,
  VaultOpenError,
  VaultShapeError,
} from "@thalon/engine";
import { NextResponse } from "next/server";

/** Thin routes map repo/domain errors to contract-typed JSON — no business logic, just status codes. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof NotFoundError || err instanceof VaultNotConnectedError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  // The vault's box-level refusals: a missing/invalid master key (or an
  // envelope that will not open under it) is operator misconfiguration —
  // service-unavailable, never a caller problem. Shape errors ARE caller
  // problems (issue paths only; nothing pasted ever rides the message).
  if (
    err instanceof VaultKeyMissingError ||
    err instanceof VaultKeyInvalidError ||
    err instanceof VaultOpenError
  ) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
  if (err instanceof VaultShapeError) {
    return NextResponse.json({ error: err.message, fields: err.issuePaths }, { status: 400 });
  }
  if (
    err instanceof InvalidTransitionError ||
    err instanceof InvalidVideoCutTransitionError ||
    // s82: the publish queue's rulebook, and the repos' state refusals. Both
    // were missing while their `InvalidTransitionError` sibling was already
    // here, so a row refusing on its STATE ("this cut is approved", "that row
    // is already published") fell through to the 400 below and told the caller
    // it had sent a bad request. Every s82 route that could hit these caught
    // them locally; this is the fold-in, so the next one need not remember.
    err instanceof InvalidPublishQueueTransitionError ||
    err instanceof InvalidStateError ||
    err instanceof InvariantViolationError ||
    // The social publish door's typed refusal ladder — a state conflict
    // (disarmed / unconfigured / capped / duplicate), never a bad request.
    err instanceof PublishRefusedError
  ) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof Error) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  return NextResponse.json({ error: "unknown error" }, { status: 500 });
}
