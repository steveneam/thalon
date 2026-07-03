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
