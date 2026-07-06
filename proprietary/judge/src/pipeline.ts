import {
  FINAL_JUDGE_GATE,
  brandIdentitySchema,
  renderBrandIdentity,
  resolveDraftFormatSpec,
  seoMetaSchema,
  type TenantCtx,
} from "@thalon/contracts";
import type { Draft, Repos } from "@thalon/db";
import { modelTiers, readEnv, withGatewayGuard } from "@thalon/platform";
import { runG1Denylist } from "./g1-denylist";
import { collectGroundingChunks } from "./grounding";
import { runSeoAeoLens, SEO_LENS_GATE } from "./seo-lens";
import {
  promptVersionFor,
  type JudgeModelDriver,
  type JudgeTier,
  type SourceChunkInput,
} from "./shell/driver";
import { callTierJudge, type TierCallResult } from "./validate-shell-output";

const GATE_FOR_TIER: Record<JudgeTier, string> = {
  screen: "g3_screen",
  final: FINAL_JUDGE_GATE,
};

export interface RunJudgePipelineInput {
  ctx: TenantCtx;
  draftId: string;
  /**
   * Grounding-evidence OVERRIDE (tests / callers with pre-assembled
   * evidence). Omitted — the production default — the pipeline assembles it
   * itself via `collectGroundingChunks`: every source in the draft's
   * `meta.groundingSourceIds` (B3.9 multi-source drafts), else the draft's
   * own source. Assembling inside the pipeline means no caller can
   * under-ground a multi-source draft.
   */
  chunks?: SourceChunkInput[];
  screenDriver: JudgeModelDriver;
  finalDriver: JudgeModelDriver;
  /** Overrides the tenant daily token budget cap for this run (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export type PipelineOutcome =
  | { status: "queued"; draft: Draft }
  | { status: "blocked"; draft: Draft; reason: string };

/**
 * Deterministic core orchestration (SPINE §2.3 workflow 2; §1.1 state
 * machine). g1 fail ⇒ blocked, zero model calls. g1 pass ⇒ BOTH g3 tiers
 * always run — so a tier disagreement is observable rather than
 * short-circuited on the cheap tier — ⇒ pass/pass ⇒ queued; anything else
 * ⇒ blocked for operator triage (I3, ratified decision 2: a screen pass
 * never overrides a final fail, and vice versa — any disagreement blocks).
 * The `→ queued` transition below re-checks for itself that a passing
 * g3_final row exists for the CURRENT body hash (I1, enforced in
 * `@thalon/db` `repos/drafts.ts`) — this orchestration cannot bypass that
 * gate even if it tried to.
 */
export async function runJudgePipeline(
  repos: Repos,
  input: RunJudgePipelineInput,
): Promise<PipelineOutcome> {
  const draft = await repos.drafts.get(input.ctx, input.draftId);
  const judging =
    draft.status === "judging"
      ? draft
      : await repos.drafts.transition(input.ctx, draft.id, "judging");

  const profile = await repos.brandProfiles.getActive(input.ctx);
  // Per-tenant denylist is DATA from brand_profiles — never hard-coded here.
  const denylist = (profile?.denylist as string[] | undefined) ?? [];

  // B3.8: the ACTIVE profile's identity is appended as grounding evidence for
  // every judged draft, inside the pipeline so no caller can forget it —
  // generation was allowed to draw claims from the same rendered block
  // (contracts renderBrandIdentity, one canonical rendering for both sides).
  // Deliberately the CURRENT active identity, not the version the draft was
  // generated under: a claim the tenant no longer asserts must fail grounding
  // on re-judge, not pass on stale facts. Empty identity appends nothing.
  const baseChunks =
    input.chunks ?? (await collectGroundingChunks(input.ctx, repos, judging));
  const identityText = profile
    ? renderBrandIdentity(brandIdentitySchema.parse(profile.identity ?? {}))
    : "";
  const chunks: SourceChunkInput[] = identityText
    ? [
        ...baseChunks,
        {
          ref: `profile:v${profile!.version}:identity`,
          text: `TENANT IDENTITY (operator-asserted):\n${identityText}`,
        },
      ]
    : baseChunks;
  const g1 = runG1Denylist({ body: judging.body, denylist });
  await repos.judgeResults.append(input.ctx, {
    draftId: judging.id,
    gate: "g1",
    verdict: g1.verdict,
    evidence: g1.evidence,
  });
  if (g1.verdict === "fail") {
    const blocked = await repos.drafts.transition(input.ctx, judging.id, "blocked", {
      reason: "g1 denylist fail",
    });
    return { status: "blocked", draft: blocked, reason: "g1 denylist fail" };
  }

  // B6.8 (ADR 0006 decision 2): the ADVISORY SEO/AEO lens — deterministic,
  // zero model calls, appended for operator triage only. Opt-in by DATA: it
  // runs only when a seoMeta-capable format actually carries a `meta.seo`
  // block, so every pre-B6.8 draft (and every test built before it) judges
  // byte-identically. The queued/blocked outcome below never reads this row
  // (I1 stays g3_final-only) — advisory is structural, not a promise.
  const spec = resolveDraftFormatSpec(judging.format);
  const seoRaw = (judging.meta as Record<string, unknown> | null)?.seo;
  if (spec.capabilities.seoMeta && seoRaw !== undefined) {
    const parsedSeo = seoMetaSchema.safeParse(seoRaw);
    const lens = parsedSeo.success
      ? runSeoAeoLens({
          seo: parsedSeo.data,
          body: judging.body,
          surface: spec.capabilities.renderable ? "video" : "page",
        })
      : {
          verdict: "fail" as const,
          evidence: {
            claims: [],
            notes: `advisory SEO/AEO lens: meta.seo does not parse against seoMetaSchema — ${parsedSeo.error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")}`,
          },
        };
    await repos.judgeResults.append(input.ctx, {
      draftId: judging.id,
      gate: SEO_LENS_GATE,
      verdict: lens.verdict,
      evidence: lens.evidence,
    });
  }

  const screen = await runTier(repos, input, chunks, judging, "screen", input.screenDriver);
  const final = await runTier(repos, input, chunks, judging, "final", input.finalDriver);

  if (screen.verdict === "pass" && final.verdict === "pass") {
    const queued = await repos.drafts.transition(input.ctx, judging.id, "queued");
    return { status: "queued", draft: queued };
  }
  const reason =
    screen.verdict === final.verdict
      ? "both g3 tiers failed"
      : `g3 tier disagreement (screen=${screen.verdict}, final=${final.verdict})`;
  const blocked = await repos.drafts.transition(input.ctx, judging.id, "blocked", { reason });
  return { status: "blocked", draft: blocked, reason };
}

async function runTier(
  repos: Repos,
  input: RunJudgePipelineInput,
  chunks: SourceChunkInput[],
  draft: Draft,
  tier: JudgeTier,
  driver: JudgeModelDriver,
): Promise<TierCallResult> {
  const tiers = modelTiers();
  const model = tier === "screen" ? tiers.judgeScreen : tiers.judgeFinal;
  const promptVersion = promptVersionFor(tier);
  // Core meters the shell: EVERY attempt (including repair retries) routes
  // through the one gateway choke point — budget asserted before, usage
  // recorded after, span traced (SPINE §1; amendment A2). The shell driver
  // itself stays read-only.
  const capTokens = input.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const guarded: JudgeModelDriver = (req) =>
    withGatewayGuard({
      usage: {
        assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(input.ctx, o),
        recordUsage: (o) => repos.usageLedger.record(input.ctx, o),
      },
      capTokens,
      model,
      operation: `judge.${GATE_FOR_TIER[tier]}`,
      call: async () => {
        const out = await driver(req);
        return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
      },
    });
  const startedAt = Date.now();
  const result = await callTierJudge(guarded, { tier, body: draft.body, chunks });
  const latencyMs = Date.now() - startedAt;
  await repos.judgeResults.append(input.ctx, {
    draftId: draft.id,
    gate: GATE_FOR_TIER[tier],
    verdict: result.verdict,
    evidence: result.output
      ? {
          claims: result.output.claims.map((c) => ({
            claim: c.claim,
            verdict: c.supported ? ("pass" as const) : ("fail" as const),
            sourceRef: c.chunkRef,
          })),
          notes: result.output.notes,
        }
      : {
          claims: [],
          notes: `irrecoverable after ${result.attempts} attempt(s): ${result.lastError ?? "malformed shell output"}`,
        },
    model,
    promptVersion,
    latencyMs,
  });
  return result;
}
