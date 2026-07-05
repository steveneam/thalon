import { StagedFlowError } from "./store";
import { stagedEditRequestSchema, stagedPickRequestSchema, type StagedEditRequest, type StagedPickRequest } from "./types";

/**
 * The one place staged-flow store calls become HTTP shapes, shared by the
 * Next route handlers (dev) and the MSW handlers (tests) so both seams
 * behave identically. Body: the flow state on 200, `{ error }` on 4xx —
 * the same loud-failure convention the classic queue's routes use.
 */
export interface StagedHttpResult<T> {
  status: number;
  body: T | { error: string };
}

export function runStaged<T>(fn: () => T): StagedHttpResult<T> {
  try {
    return { status: 200, body: fn() };
  } catch (err) {
    if (err instanceof StagedFlowError) {
      return { status: err.httpStatus, body: { error: err.message } };
    }
    // Patch/schema violations are operator-visible edit failures, not crashes.
    return {
      status: 400,
      body: { error: err instanceof Error ? err.message : "staged flow request failed" },
    };
  }
}

/** Parses an edit request body; null (never a throw) when it isn't one — callers 400 with the issue list. */
export function parseStagedEditRequest(body: unknown): { request: StagedEditRequest } | { error: string } {
  const parsed = stagedEditRequestSchema.safeParse(body);
  if (!parsed.success) {
    return { error: `invalid staged edit request: ${parsed.error.issues.map((i) => i.message).join("; ")}` };
  }
  return { request: parsed.data as StagedEditRequest };
}

export function parseStagedPickRequest(body: unknown): { request: StagedPickRequest } | { error: string } {
  const parsed = stagedPickRequestSchema.safeParse(body);
  if (!parsed.success) return { error: "candidateId is required" };
  return { request: parsed.data };
}
