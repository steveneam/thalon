import { z } from "zod";

export type DbDriver = "pglite" | "postgres";
export type ObjectStoreDriver = "local" | "s3";
export type QueueDriver = "inline" | "sqs";
export type AuthDriver = "dev" | "clerk";

/**
 * The one Zod-validated config module (SPINE §3.2) — the ONLY place
 * process.env is read (ratchet-tested in tests/boundary.test.ts). Empty
 * strings are treated as unset so a blank line in .env never silently flips a
 * seam.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  OBJECT_STORE: z.enum(["local", "s3"]).default("local"),
  QUEUE_DRIVER: z.enum(["inline", "sqs"]).default("inline"),
  AI_GATEWAY_API_KEY: z.string().optional(),
  AI_GATEWAY_BASE_URL: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_HOST: z.string().optional(),
  THALON_DATA_DIR: z.string().default(".data"),
  MODEL_DRAFT: z.string().default("meta/llama-3.3-70b"),
  MODEL_JUDGE_SCREEN: z.string().default("meta/llama-3.3-70b"),
  MODEL_JUDGE_FINAL: z.string().default("anthropic/claude-sonnet-4.5"),
  TENANT_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(2_000_000),
});

export type ThalonEnv = z.infer<typeof envSchema>;

/** Structural env type: process.env satisfies it, and test fixtures need no NODE_ENV boilerplate. */
export type EnvSource = Record<string, string | undefined>;

export function readEnv(env: EnvSource = process.env): ThalonEnv {
  const present = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v !== ""),
  );
  const parsed = envSchema.safeParse(present);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`invalid environment: ${issues}`);
  }
  return parsed.data;
}

export interface SeamConfig {
  db: DbDriver;
  objectStore: ObjectStoreDriver;
  queue: QueueDriver;
  auth: AuthDriver;
  gateway: "configured" | "unconfigured";
  /** Langfuse (self-host) — traces attach at the gateway wrapper from B1.1. */
  tracing: "configured" | "unconfigured";
  dataDir: string;
}

/**
 * Resolves the dev→prod seams from the environment. Dev needs zero cloud
 * services: embedded Postgres (PGlite) + local object store + inline queue +
 * dev auth. Each seam flips to its cloud driver purely via env, never via
 * code changes.
 */
export function resolveSeams(env: EnvSource = process.env): SeamConfig {
  const e = readEnv(env);
  return {
    db: e.DATABASE_URL ? "postgres" : "pglite",
    objectStore: e.OBJECT_STORE,
    queue: e.QUEUE_DRIVER,
    auth:
      e.CLERK_SECRET_KEY && e.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "clerk" : "dev",
    gateway: e.AI_GATEWAY_API_KEY ? "configured" : "unconfigured",
    tracing:
      e.LANGFUSE_PUBLIC_KEY && e.LANGFUSE_SECRET_KEY ? "configured" : "unconfigured",
    dataDir: e.THALON_DATA_DIR,
  };
}
