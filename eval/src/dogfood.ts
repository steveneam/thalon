import { pathToFileURL } from "node:url";
import { tenantCtx, type PlatformProfile } from "@thalon/contracts";
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
  brandConfig: {
    voice: Record<string, unknown>;
    denylist: string[];
    platformProfiles: Record<string, PlatformProfile>;
  };
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

  const chunks = (await repos.sourceChunks.listBySource(ctx, ingest.sourceId)).map((chunk) => ({
    ref: chunk.id,
    text: chunk.text,
  }));

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
    const outcome = await runJudgePipeline(repos, {
      ctx,
      draftId: draft.id,
      chunks,
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
 * Tenant #0 (ratified decision 3): the engine dogfoods itself. All of this
 * is runtime DATA for the generic self tenant — the slug matches the web
 * app's demo-tenant lookup so the approve queue shows this run's drafts.
 */
export const TENANT_ZERO: DogfoodInput = {
  tenantSlug: "self",
  tenantName: "Self (dogfood)",
  brandConfig: {
    voice: {
      register: "plain, direct, no hype",
      persona: "a solo founder shipping a content-automation engine in public",
    },
    denylist: ["guaranteed", "can't lose", "risk-free"],
    platformProfiles: {},
  },
  prompt: [
    "Sprint 1 of the engine is code-complete. What shipped:",
    "a source-ingest step that turns a URL, prompt, or document into chunked, embedded grounding sources;",
    "a fan-out step that turns one source into platform-native drafts for LinkedIn and X, driven entirely by per-tenant runtime config;",
    "a two-tier grounding judge (a cheap screening model plus a stronger final model) that blocks any draft making claims the provided sources don't support, alongside a per-tenant denylist gate;",
    "and an operator approve queue where every draft shows its judge verdicts and every human edit is captured as an eval case.",
    "No publish path exists yet by design - every draft stops at the human approval gate.",
  ].join(" "),
  platforms: ["linkedin", "x"],
};

async function main(): Promise<void> {
  loadEnvLocal();
  useWebAppDataDir();
  await assertSoleDbWriter();
  const handle = await openDb();
  try {
    const result = await runDogfoodSlice(handle.repos, TENANT_ZERO, {
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
