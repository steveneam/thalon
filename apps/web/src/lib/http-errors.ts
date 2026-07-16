import { InvalidTransitionError, InvalidVideoCutTransitionError } from "@thalon/contracts";
import { InvariantViolationError, NotFoundError } from "@thalon/db";
import { NextResponse } from "next/server";

/** Thin routes map repo/domain errors to contract-typed JSON — no business logic, just status codes. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof NotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (
    err instanceof InvalidTransitionError ||
    err instanceof InvalidVideoCutTransitionError ||
    err instanceof InvariantViolationError
  ) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof Error) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  return NextResponse.json({ error: "unknown error" }, { status: 500 });
}
