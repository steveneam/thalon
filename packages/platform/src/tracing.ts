import { resolveSeams, type EnvSource } from "./env";

export interface TraceSpan {
  end(meta?: Record<string, unknown>): void;
}

export interface Tracer {
  startSpan(name: string, meta?: Record<string, unknown>): TraceSpan;
}

const noopSpan: TraceSpan = { end() {} };
const noopTracer: Tracer = { startSpan: () => noopSpan };

/**
 * Tracing seam (SPINE §4.4: Langfuse traces every shell call — cost,
 * latency, verdicts). The gateway choke point (gateway-guard.ts) calls this
 * for every shell call. No-op until the Langfuse client is wired in (self-host,
 * MIT); unlike the db/object-store/queue seams, a missing tracing driver must
 * never fail loud — losing a trace is not losing generation.
 */
export function getTracer(env?: EnvSource): Tracer {
  resolveSeams(env); // resolves the `tracing` seam; the real driver swaps in here once wired.
  return noopTracer;
}
