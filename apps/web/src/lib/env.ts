export type DbDriver = "sqlite" | "postgres";
export type ObjectStoreDriver = "local" | "s3";
export type QueueDriver = "inline" | "sqs";
export type AuthDriver = "dev" | "clerk";

export interface SeamConfig {
  db: DbDriver;
  objectStore: ObjectStoreDriver;
  queue: QueueDriver;
  auth: AuthDriver;
  gateway: "configured" | "unconfigured";
  dataDir: string;
}

const OBJECT_STORES: readonly ObjectStoreDriver[] = ["local", "s3"];
const QUEUES: readonly QueueDriver[] = ["inline", "sqs"];

/**
 * Resolves the dev→prod seams from the environment. Dev needs zero cloud
 * services: sqlite + local object store + inline queue + dev auth. Each seam
 * flips to its cloud driver purely via env, never via code changes.
 */
export function resolveSeams(env: NodeJS.ProcessEnv = process.env): SeamConfig {
  const objectStore = (env.OBJECT_STORE ?? "local") as ObjectStoreDriver;
  if (!OBJECT_STORES.includes(objectStore)) {
    throw new Error(`OBJECT_STORE must be one of ${OBJECT_STORES.join("|")}, got "${objectStore}"`);
  }

  const queue = (env.QUEUE_DRIVER ?? "inline") as QueueDriver;
  if (!QUEUES.includes(queue)) {
    throw new Error(`QUEUE_DRIVER must be one of ${QUEUES.join("|")}, got "${queue}"`);
  }

  return {
    db: env.DATABASE_URL ? "postgres" : "sqlite",
    objectStore,
    queue,
    auth:
      env.CLERK_SECRET_KEY && env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        ? "clerk"
        : "dev",
    gateway: env.AI_GATEWAY_API_KEY ? "configured" : "unconfigured",
    dataDir: env.THALON_DATA_DIR ?? ".data",
  };
}
