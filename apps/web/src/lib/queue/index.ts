import { resolveSeams } from "@/lib/env";

export interface Job<T = unknown> {
  type: string;
  payload: T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JobHandler<T = any> = (payload: T) => void | Promise<void>;

export interface JobQueue {
  register(type: string, handler: JobHandler): void;
  enqueue<T>(job: Job<T>): Promise<void>;
}

/** Executes jobs synchronously in-process; the SQS driver replaces it behind the same interface. */
export class InlineQueue implements JobQueue {
  private readonly handlers = new Map<string, JobHandler>();

  register(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) {
      throw new Error(`a handler is already registered for job type "${type}"`);
    }
    this.handlers.set(type, handler);
  }

  async enqueue<T>(job: Job<T>): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      throw new Error(`no handler registered for job type "${job.type}"`);
    }
    await handler(job.payload);
  }
}

let cached: InlineQueue | null = null;

/**
 * Queue seam: inline (dev, synchronous in-process) → sqs (prod, async). The SQS
 * driver lands with the async rig (Sprint 3+); until then QUEUE_DRIVER=sqs fails loud.
 */
export function getQueue(): JobQueue {
  const seams = resolveSeams();
  if (seams.queue === "sqs") {
    throw new Error(
      "QUEUE_DRIVER=sqs but the SQS driver is not wired yet (lands Sprint 3+). Set QUEUE_DRIVER=inline.",
    );
  }
  cached ??= new InlineQueue();
  return cached;
}
