export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} "${id}" not found for this tenant`);
    this.name = "NotFoundError";
  }
}

/** A SPINE §1.1 invariant (I1–I4) would be broken; the transaction rolls back. */
export class InvariantViolationError extends Error {
  constructor(
    public readonly invariant: "I1" | "I2" | "I3" | "I4",
    message: string,
  ) {
    super(`[${invariant}] ${message}`);
    this.name = "InvariantViolationError";
  }
}

/**
 * Optimistic-concurrency guard (B2.5's `drafts.updateMeta`): the row changed
 * between the caller's read and its write. Losing a race must be a loud
 * error, never a silent last-write-wins overwrite of a concurrent update.
 */
export class ConcurrentUpdateError extends Error {
  constructor(
    public readonly entity: string,
    public readonly id: string,
  ) {
    super(`${entity} "${id}" was modified concurrently — retry with a fresh read`);
    this.name = "ConcurrentUpdateError";
  }
}

/**
 * B4.5: a stage was invoked against an entity in the wrong state (wrong
 * format, not approved, not re-judgeable) — the caller's sequencing bug.
 * Loud-failure convention: state gates throw this BEFORE any read beyond
 * the gated row and are never recorded as a stage "failure" (a failure
 * describes the stage's work; this says the stage should not have run).
 */
export class InvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
  }
}

/**
 * B4.5: a content-addressed artifact the meta contract says must exist is
 * absent from the object store — an invariant break (generation paths
 * persist artifacts BEFORE the rows that reference them). Loud-failure
 * convention: thrown, never recorded as a mere stage failure — recording
 * "failed" would misattribute a corruption to the stage that found it.
 */
export class ArtifactMissingError extends Error {
  constructor(
    public readonly ref: string,
    message: string,
  ) {
    super(message);
    this.name = "ArtifactMissingError";
  }
}

/**
 * B4.5: every bounded repair attempt was exhausted without a valid
 * candidate (the shared repair loop). `lastError` is the LAST attempt's
 * failure, verbatim — operational failures and bad model output look
 * identical to the loop; this is how an operator tells them apart (B1.5
 * lesson).
 */
export class IrrecoverableGenerationError extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError?: string,
  ) {
    super(message);
    this.name = "IrrecoverableGenerationError";
  }
}

/** Per-tenant daily cap reached: hard stop, fail loud, never silently degrade (amendment A2). */
export class BudgetExceededError extends Error {
  constructor(
    public readonly tenantId: string,
    public readonly day: string,
    public readonly totalTokens: number,
    public readonly capTokens: number,
  ) {
    super(
      `tenant ${tenantId} is over its daily token budget for ${day}: ${totalTokens} >= ${capTokens}`,
    );
    this.name = "BudgetExceededError";
  }
}
