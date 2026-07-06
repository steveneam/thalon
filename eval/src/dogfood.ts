import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import {
  brandProfileConfigSchema,
  tenantCtx,
  type BrandProfileConfigInput,
} from "@thalon/contracts";
import { openDb, type Draft, type Repos } from "@thalon/db";
import {
  ingestSource,
  runFanout,
  type DraftGeneratorDriver,
  type IngestDeps,
} from "@thalon/engine";
import { gatewayJudgeDriver, runJudgePipeline, type JudgeModelDriver } from "@thalon/judge";
import { assertSoleDbWriter, loadEnvLocal, useWebAppDataDir } from "./env-local";

export interface DogfoodInput {
  tenantSlug: string;
  tenantName: string;
  /** Used only when the tenant has no active brand profile yet — dogfood never clobbers existing runtime config. */
  brandConfig: BrandProfileConfigInput;
  prompt: string;
  platforms: string[];
}

export interface DogfoodDeps {
  embedder?: IngestDeps["embedder"];
  draftDriver?: DraftGeneratorDriver;
  screenDriver: JudgeModelDriver;
  finalDriver: JudgeModelDriver;
  /** Overrides the tenant daily token budget cap (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface DogfoodOutcome {
  platform: string;
  draftId: string;
  status: Draft["status"];
  reason?: string;
}

export interface DogfoodResult {
  tenantId: string;
  sourceId: string;
  runId: string;
  outcomes: DogfoodOutcome[];
}

/**
 * B1.5: the one place that chains the whole Sprint-1 vertical slice —
 * seed tenant (idempotent) → ingest → fan-out → judge — exactly as an
 * operator run would. Every stage is the same library entry point the
 * product uses; this adds NO new pipeline logic, only the wiring. Drivers
 * are injected so the chain is provable keyless in tests; only the CLI
 * below reaches for the live gateway drivers. Idempotent end to end: each
 * stage's own idempotency (content_hash, generation_key, judged-state
 * short-circuit) makes a re-run a cheap replay, not a duplicate.
 */
export async function runDogfoodSlice(
  repos: Repos,
  input: DogfoodInput,
  deps: DogfoodDeps,
): Promise<DogfoodResult> {
  const tenant =
    (await repos.tenants.getBySlug(input.tenantSlug)) ??
    (await repos.tenants.create({ slug: input.tenantSlug, name: input.tenantName }));
  const ctx = tenantCtx(tenant.id);

  const activeProfile = await repos.brandProfiles.getActive(ctx);
  if (!activeProfile) {
    await repos.brandProfiles.create(ctx, { config: input.brandConfig, activate: true });
  }

  const ingest = await ingestSource(
    ctx,
    repos,
    { kind: "prompt", prompt: input.prompt },
    { embedder: deps.embedder, capTokens: deps.capTokens },
  );

  const fanout = await runFanout(
    ctx,
    repos,
    { sourceId: ingest.sourceId, platforms: input.platforms },
    { driver: deps.draftDriver, capTokens: deps.capTokens },
  );

  const outcomes: DogfoodOutcome[] = [];
  for (const draft of fanout.drafts) {
    // Judge fresh drafts AND drafts an operator edit sent back to "judging"
    // (the edit transition swaps the body and demands a re-judge — this run
    // is what re-judges it). Anything else (queued/blocked/approved…) is an
    // already-judged replay: report where it stands, never re-judge — blocked
    // means operator triage, not automatic retry spend.
    if (draft.status !== "generated" && draft.status !== "judging") {
      outcomes.push({
        platform: draft.platform,
        draftId: draft.id,
        status: draft.status,
        reason: "already judged (replay)",
      });
      continue;
    }
    // Grounding assembles INSIDE the pipeline (B3.9): the draft's
    // meta.groundingSourceIds when present, else its own source — plus the
    // B3.8 identity chunk the pipeline appends itself.
    const outcome = await runJudgePipeline(repos, {
      ctx,
      draftId: draft.id,
      screenDriver: deps.screenDriver,
      finalDriver: deps.finalDriver,
      capTokens: deps.capTokens,
    });
    outcomes.push({
      platform: draft.platform,
      draftId: draft.id,
      status: outcome.draft.status,
      reason: outcome.status === "blocked" ? outcome.reason : undefined,
    });
  }

  return { tenantId: tenant.id, sourceId: ingest.sourceId, runId: fanout.runId, outcomes };
}

/**
 * B2.1: a dogfood run is DATA — any tenant lands as a JSON file validated
 * against this schema (brand config reuses the contracts schema verbatim),
 * never as code. `tenantSlug` doubles as the web app's `DEMO_TENANT_SLUG`
 * value for triaging that tenant's queue.
 */
export const dogfoodInputSchema = z.object({
  tenantSlug: z.string().min(1),
  tenantName: z.string().min(1),
  brandConfig: brandProfileConfigSchema,
  prompt: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1),
});

export function loadDogfoodInput(path: string): DogfoodInput {
  return dogfoodInputSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

/**
 * Tenant #0 (ratified decision 3): the engine dogfoods itself. B6.3: the
 * real Thalon deep profile — identity/voice/topics, brand style, and the
 * pillar-#1 prompt (locked to Thalon itself) — is TRACKED DATA in
 * proprietary/profiles/tenants/self.v1.json, loaded through the same
 * loader operators use and validated by the same CI ratchet as every other
 * shipped tenant file, so tenant #0 can never drift back into code. The
 * identity's fact-bearing lines double as judge grounding: each is a short,
 * individually-checkable, TRUE statement about the engine (the ADR-0006
 * honest-claims rule applies to the self tenant's copy too).
 */
export const SELF_TENANT_PATH = fileURLToPath(
  new URL("../../proprietary/profiles/tenants/self.v1.json", import.meta.url),
);
export const TENANT_ZERO: DogfoodInput = loadDogfoodInput(SELF_TENANT_PATH);

async function main(): Promise<void> {
  loadEnvLocal();
  useWebAppDataDir();
  await assertSoleDbWriter();
  // Optional argv: path to a tenant-run JSON (B2.1). No arg = tenant #0.
  const inputPath = process.argv[2];
  const input = inputPath ? loadDogfoodInput(inputPath) : TENANT_ZERO;
  console.error(`dogfood: tenant "${input.tenantSlug}"${inputPath ? ` (from ${inputPath})` : " (built-in tenant #0)"}`);
  const handle = await openDb();
  try {
    const result = await runDogfoodSlice(handle.repos, input, {
      screenDriver: gatewayJudgeDriver(),
      finalDriver: gatewayJudgeDriver(),
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await handle.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
