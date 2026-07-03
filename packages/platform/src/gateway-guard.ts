import { getTracer, type Tracer } from "./tracing";

/**
 * Adapts @thalon/db's usageLedgerRepo. Platform cannot depend on db (db
 * already depends on platform), so callers inject this — see
 * packages/engine/src/ingest/embed.ts for the reference wiring against
 * repos.usageLedger.
 */
export interface UsageGuard {
  assertWithinBudget(input: { capTokens: number }): Promise<unknown>;
  recordUsage(input: {
    model: string;
    tokensIn: number;
    tokensOut: number;
    costEstimate?: number;
  }): Promise<void>;
}

export interface GuardedCallResult<T> {
  result: T;
  tokensIn: number;
  tokensOut: number;
  costEstimate?: number;
}

export interface GuardedGatewayCallInput<T> {
  usage: UsageGuard;
  tracer?: Tracer;
  capTokens: number;
  model: string;
  /** Trace/operation name, e.g. "ingest.embed" or (judge lane, later) "judge.g3_final". */
  operation: string;
  call: () => Promise<GuardedCallResult<T>>;
}

/**
 * THE gateway choke point (SPINE §1: hard budgets and timeouts on the
 * shell; amendment A2's per-tenant daily cap). Generic over the call's
 * result type on purpose — B1.1's embedding calls are the first caller, but
 * the judge lane's generateObject-style verdicts (B1.3) route through this
 * exact same function: assert budget -> start a trace span -> run the call
 * -> record usage -> end the span. Over budget fails loud (never silently
 * degrades); a call error still ends the span before rethrowing.
 */
export async function withGatewayGuard<T>(input: GuardedGatewayCallInput<T>): Promise<T> {
  await input.usage.assertWithinBudget({ capTokens: input.capTokens });
  const tracer = input.tracer ?? getTracer();
  const span = tracer.startSpan(input.operation, { model: input.model });
  try {
    const { result, tokensIn, tokensOut, costEstimate } = await input.call();
    await input.usage.recordUsage({ model: input.model, tokensIn, tokensOut, costEstimate });
    span.end({ tokensIn, tokensOut });
    return result;
  } catch (err) {
    span.end({ error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}
