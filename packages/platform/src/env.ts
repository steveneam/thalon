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
  /**
   * S3 object-store driver config (OBJECT_STORE=s3). Bucket + region are both
   * REQUIRED once the seam selects s3 — `getObjectStore` fails loud on a
   * missing one, never quietly falls back to local. Credentials ride the
   * STANDARD AWS chain (env / shared profile / instance role) and are never
   * read here, never logged.
   */
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  /** Optional key prefix inside the bucket — lets one bucket host several environments; keys stay engine-relative (the prefix never leaks to callers). */
  S3_PREFIX: z.string().optional(),
  /** Optional S3-compatible endpoint (MinIO / R2 escape hatch); set, it also switches the client to path-style addressing. */
  S3_ENDPOINT: z.string().optional(),
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
  MODEL_EMBEDDING: z.string().default("openai/text-embedding-3-small"),
  TENANT_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(2_000_000),
  /** Which tenant the dev web app operates as (slug). Real operator→tenant resolution (Clerk org mapping) is a later bucket; until then the operated-on tenant is runtime config, never code. */
  DEMO_TENANT_SLUG: z.string().default("self"),
  /** B4.8 transcript seam: which TranscriptProvider the registry selects (caption-file | whisper-local | hosted-vendor). Drivers are config, never new ingest code paths. */
  TRANSCRIPT_PROVIDER: z.string().default("caption-file"),
  /** B5.1 render seam: which RenderTarget the registry selects (hyperframes | fake; remotion = the recorded swap path, ADR-0004). Default per amendment A11. */
  RENDER_DRIVER: z.string().default("hyperframes"),
  /** B6.8 search-intel seam: which SearchIntelSource the registry selects (fake | gsc; paid-vendor = the recorded swap path, ADR 0006). GSC goes live at B6.7 deploy — fake is the honest default until a site exists. */
  SEARCH_INTEL_SOURCE: z.string().default("fake"),
  /** B6.5 trend seam: which TrendSource the registry selects (fake | bluesky | youtube). bluesky is keyless — the honest first live selection; fake stays the zero-network default. */
  TREND_SOURCE: z.string().default("fake"),
  /** B6.5 dossier half-step: how many top-ranked cards per sweep get a generated dossier (gateway spend — arming is an operator decision; 0 = disarmed, cards honestly carry no dossier). */
  TREND_DOSSIER_CARDS: z.coerce.number().int().min(0).default(0),
  /** B6.5 YouTube Data API v3 key (free tier; per-driver quota budgets stay config in the driver, never here). */
  YOUTUBE_API_KEY: z.string().optional(),
  /** B6.5 Bluesky app-password session (free account; searchPosts is 403 unauthenticated — probed 2026-07-07). Account-feed polling stays keyless without these. */
  BLUESKY_IDENTIFIER: z.string().optional(),
  BLUESKY_APP_PASSWORD: z.string().optional(),
  /** B4.8 hosted-vendor adapter (keyed runtime config with a swap path — no vendor named in code; live runs are pass 3). */
  TRANSCRIPT_VENDOR_URL: z.string().optional(),
  TRANSCRIPT_VENDOR_API_KEY: z.string().optional(),
  /** B-ve.3 render binaries (ADR 0010): where ffmpeg/ImageMagick live on THIS box. Unset = ~/.local/bin, then PATH (engine edl/execute.ts). Box-local config, never code. */
  THALON_FFMPEG: z.string().optional(),
  THALON_MAGICK: z.string().optional(),
  /** B-ve.5 source-geometry probe (ADR 0010): ffprobe for measured crop seeding. Same resolution ladder as THALON_FFMPEG. */
  THALON_FFPROBE: z.string().optional(),
  /**
   * B6.7 workspace gate (ADR 0007 decision 4, invariant): `user:password`
   * for the app-level basic-auth proxy over every non-public route. Unset
   * in development = the dev auth stub (open workspace); unset in
   * PRODUCTION = the workspace fails CLOSED (503), never open — the stub
   * must never face the internet.
   */
  WORKSPACE_BASIC_AUTH: z.string().optional(),
  /**
   * B-crm.4 send door (s54): the Resend credential — the KEY half of the
   * two-key arming ratchet (engine `resolveSendTransport`). The key alone
   * must never arm live sending; without OUTREACH_SEND_ARMED the resolved
   * transport refuses every call naming the missing arm. Since B-int.3 the
   * tenant's `newsletter_resend` vault credential fills this seat where env
   * is silent (engine `vaultOutreachEnvView`) — set here, it overrides.
   */
  RESEND_API_KEY: z.string().optional(),
  /**
   * B-crm.4 send door (s54): the founder GO — the FLAG half of the arming
   * ratchet. Exactly the string "true" arms (with the key also present);
   * anything else, including unset, leaves the refusing transport. Live
   * send is a deliberate operator decision, never a side effect of a key
   * landing in the environment.
   */
  OUTREACH_SEND_ARMED: z.string().optional(),
  /**
   * B-pub (Sprint-8 window 2): the per-platform social arming pairs — the
   * RESEND_API_KEY + OUTREACH_SEND_ARMED two-key convention, platform-scoped
   * (engine `socialArmKeys`/`resolveSocialPublisher`). The credential alone
   * never arms. Since B-int.3 these pairs are the EMERGENCY OVERRIDE only:
   * arming is tenant data (the platform present in the tenant's social
   * config block + its vault credential connected), and an env value, when
   * set, wins in both directions — `*_ARMED` exactly "true" force-arms,
   * anything else set force-disarms. Driver-specific extras (page ids etc.)
   * land with their driver at B-pub.2+ as their own reviewed additions.
   */
  SOCIAL_LINKEDIN_ACCESS_TOKEN: z.string().optional(),
  SOCIAL_LINKEDIN_ARMED: z.string().optional(),
  SOCIAL_X_ACCESS_TOKEN: z.string().optional(),
  SOCIAL_X_ARMED: z.string().optional(),
  SOCIAL_FACEBOOK_ACCESS_TOKEN: z.string().optional(),
  SOCIAL_FACEBOOK_ARMED: z.string().optional(),
  SOCIAL_INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  SOCIAL_INSTAGRAM_ARMED: z.string().optional(),
  SOCIAL_TIKTOK_ACCESS_TOKEN: z.string().optional(),
  SOCIAL_TIKTOK_ARMED: z.string().optional(),
  /**
   * B-pub.2 driver extras (the window-2 comment's reserved lane additions).
   * Facebook: the target Page id — the ACCESS_TOKEN slot carries the PAGE
   * token. Instagram: the IG professional-account user id — the config seat
   * for the future media path (the shipped driver is a typed text-only
   * refusal). A platform missing its extra contributes NO driver factory in
   * `productionSocialDrivers`, so the arming ladder names it honestly.
   */
  SOCIAL_FACEBOOK_PAGE_ID: z.string().optional(),
  SOCIAL_INSTAGRAM_USER_ID: z.string().optional(),

  /**
   * B-pub.3: the X OAuth 1.0a seats — the app consumer pair + the
   * account's token SECRET (the token itself rides SOCIAL_X_ACCESS_TOKEN).
   * All three set → the driver signs non-expiring user-context requests
   * (the standing-arm mode; OAuth 2.0 user tokens die in ~2h and refresh
   * is B-int.4). Any missing → Bearer mode, the B-pub.2 behavior.
   */
  SOCIAL_X_API_KEY: z.string().optional(),
  SOCIAL_X_API_KEY_SECRET: z.string().optional(),
  SOCIAL_X_ACCESS_TOKEN_SECRET: z.string().optional(),

  /**
   * B-int.0 (ADR 0011): the box-level master key that wraps every vault
   * row's per-credential data key (envelope crypto, B-int.1 vault core).
   * Absent = the vault's write door refuses — credentials can never store
   * unencrypted. Cloud KMS is the recorded swap path behind the same
   * wrap/unwrap seam (trigger: real traffic/customers).
   */
  THALON_VAULT_MASTER_KEY: z.string().optional(),
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
