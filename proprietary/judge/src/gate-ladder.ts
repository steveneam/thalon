import {
  FINAL_JUDGE_GATE,
  brandIdentitySchema,
  cadenceConfigSchema,
  renderBrandIdentity,
  resolveDraftFormatSpec,
  seoMetaSchema,
  type CadenceRule,
  type JudgeEvidence,
  type TenantCtx,
  type Verdict,
} from "@thalon/contracts";
import type { Draft, Repos } from "@thalon/db";
import { modelTiers, withGatewayGuard } from "@thalon/platform";
import { z } from "zod";
import {
  CADENCE_GATE,
  cadenceFetchHorizonMs,
  hasCadenceConstraint,
  runCadenceGate,
  type QueueAdmission,
} from "./cadence";
import { DISCOVERABILITY_GATE, runDiscoverabilityLens } from "./discoverability";
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

/**
 * THE gate ladder — the ONE sequence of judge gates, extracted from
 * `runJudgePipeline` so a second entry point (`judgeCandidate`, candidate.ts)
 * can grade a body that is not on any draft WITHOUT copying the ladder. A
 * copied ladder drifts, and a drifted judge is a safety divergence no test
 * announces — that risk is the entire reason this module exists, so:
 *
 *  - `runGateLadder` itself NEVER touches `repos`. It receives evidence as
 *    data, drivers already metered, and emits each rung's result through
 *    `onGate` — the pipeline persists there (`judgeResults.append`), a
 *    candidate judge merely collects. What a gate DECIDES lives here, once.
 *  - `assembleLadderEvidence` is the ONE evidence assembly for both entry
 *    points: denylist, grounding chunks + the B3.8 identity append, and the
 *    cadence context. Grounding parity between the candidate judge and the
 *    landing judge is decided HERE — a candidate judged against different
 *    grounding than the landing judge would be a false gate.
 *  - `meteredTierDriver` is the ONE metering shim: every tier attempt from
 *    either entry point routes through `withGatewayGuard` (SPINE §1;
 *    amendment A2) — budget asserted before, usage recorded after.
 */

/** Maps a judge tier to the gate name its verdict is recorded under. */
export const GATE_FOR_TIER: Record<JudgeTier, string> = {
  screen: "g3_screen",
  final: FINAL_JUDGE_GATE,
};

/**
 * One rung's result, exactly what a `judge_results` row carries minus the
 * draft/hash binding — because for a candidate body there IS no honest hash
 * to bind (`judgeResults.append` defaults `bodyHash` to the draft's current
 * one, which is I1's whole trust anchor). The pipeline adds the binding by
 * appending; a candidate judge never does.
 */
export interface GateLadderRow {
  gate: string;
  verdict: Verdict;
  evidence: JudgeEvidence;
  model?: string;
  promptVersion?: string;
  latencyMs?: number;
}

/**
 * Cadence context, pre-armed by `assembleLadderEvidence`. Admissions are
 * fetched LAZILY so a g1 refusal costs zero reads — the exact order the
 * pipeline always had (the fetch happened after g1 passed). The closure is a
 * caller-injected read, like `onGate`; the ladder still holds no repos.
 */
export interface LadderCadenceContext {
  rule: CadenceRule;
  fetchAdmissions: () => Promise<readonly QueueAdmission[]>;
  now: Date;
}

export interface GateLadderInput {
  /** The body UNDER JUDGMENT — the persisted body for the pipeline, the candidate's for `judgeCandidate`. */
  body: string;
  /** The judged draft's context: platform (cadence + lens), format (seo lens), meta (both lenses). */
  platform: string;
  format: string | null;
  meta: unknown;
  denylist: string[];
  chunks: SourceChunkInput[];
  /** Absent = the cadence gate is disarmed (no rule with constraints) — no read, no row, the standing convention. */
  cadence?: LadderCadenceContext;
  /** ALREADY METERED by the entry point (`meteredTierDriver`) — the ladder never reaches the ledger itself. */
  screenDriver: JudgeModelDriver;
  finalDriver: JudgeModelDriver;
  /**
   * Emitted once per rung, in rung order, at exactly the point the pipeline
   * historically appended — so a mid-ladder halt (a blown budget) leaves the
   * same partial record it always did.
   */
  onGate: (row: GateLadderRow) => Promise<void>;
}

export type GateLadderOutcome = { verdict: "pass" } | { verdict: "fail"; reason: string };

/**
 * Deterministic core orchestration (SPINE §2.3 workflow 2; §1.1 state
 * machine). g1 fail ⇒ fail, zero model calls. g1 pass ⇒ cadence (when
 * armed) ⇒ advisory lenses ⇒ BOTH g3 tiers always run — so a tier
 * disagreement is observable rather than short-circuited on the cheap tier
 * — ⇒ pass/pass ⇒ pass; anything else ⇒ fail with the reason for operator
 * triage (I3, ratified decision 2: a screen pass never overrides a final
 * fail, and vice versa — any disagreement fails).
 */
export async function runGateLadder(input: GateLadderInput): Promise<GateLadderOutcome> {
  const g1 = runG1Denylist({ body: input.body, denylist: input.denylist });
  await input.onGate({ gate: "g1", verdict: g1.verdict, evidence: g1.evidence });
  if (g1.verdict === "fail") {
    return { verdict: "fail", reason: "g1 denylist fail" };
  }

  // B7.a: the cadence gate — deterministic, zero model calls, armed by DATA
  // exactly like g1's denylist (`brand_profiles.cadence`, validated at the
  // profile write door). A tenant or platform without a rule (or a rule with
  // no fields set) judges byte-identically to pre-B7.a: no read, no row.
  // Runs before any model spend — a cadence-blocked draft costs one db read.
  if (input.cadence) {
    const cadence = runCadenceGate({
      platform: input.platform,
      rule: input.cadence.rule,
      admissions: await input.cadence.fetchAdmissions(),
      now: input.cadence.now,
    });
    await input.onGate({ gate: CADENCE_GATE, verdict: cadence.verdict, evidence: cadence.evidence });
    if (cadence.verdict === "fail") {
      return { verdict: "fail", reason: `cadence limit for "${input.platform}"` };
    }
  }

  // B6.8 (ADR 0006 decision 2): the ADVISORY SEO/AEO lens — deterministic,
  // zero model calls, appended for operator triage only. Opt-in by DATA: it
  // runs only when a seoMeta-capable format actually carries a `meta.seo`
  // block, so every pre-B6.8 draft (and every test built before it) judges
  // byte-identically. The pass/fail outcome below never reads this row
  // (I1 stays g3_final-only) — advisory is structural, not a promise.
  const spec = resolveDraftFormatSpec(input.format);
  const seoRaw = (input.meta as Record<string, unknown> | null)?.seo;
  if (spec.capabilities.seoMeta && seoRaw !== undefined) {
    const parsedSeo = seoMetaSchema.safeParse(seoRaw);
    const lens = parsedSeo.success
      ? runSeoAeoLens({
          seo: parsedSeo.data,
          body: input.body,
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
    await input.onGate({ gate: SEO_LENS_GATE, verdict: lens.verdict, evidence: lens.evidence });
  }

  // Phase 2c (founder catch, s70c): the ADVISORY discoverability lens — the
  // social path's SEO/AEO/GEO dimension. Same discipline as the seo lens:
  // deterministic, zero model calls, opt-in BY DATA (runs only when the
  // draft's meta declares `targetTerms` — generation starts declaring them
  // with this phase), appended for operator triage; the pass/fail outcome
  // never reads it (I1 stays g3_final-only).
  const targetTermsRaw = (input.meta as Record<string, unknown> | null)?.targetTerms;
  const parsedTargets = z.array(z.string()).nonempty().safeParse(targetTermsRaw);
  if (targetTermsRaw !== undefined) {
    const lens = parsedTargets.success
      ? runDiscoverabilityLens({
          platform: input.platform,
          targetTerms: parsedTargets.data,
          body: input.body,
        })
      : {
          verdict: "fail" as const,
          evidence: {
            claims: [],
            notes: "advisory discoverability lens: meta.targetTerms is not a non-empty string array",
          },
        };
    await input.onGate({ gate: DISCOVERABILITY_GATE, verdict: lens.verdict, evidence: lens.evidence });
  }

  const screen = await runTier(input, "screen", input.screenDriver);
  const final = await runTier(input, "final", input.finalDriver);

  if (screen.verdict === "pass" && final.verdict === "pass") {
    return { verdict: "pass" };
  }
  const reason =
    screen.verdict === final.verdict
      ? "both g3 tiers failed"
      : `g3 tier disagreement (screen=${screen.verdict}, final=${final.verdict})`;
  return { verdict: "fail", reason };
}

async function runTier(
  input: GateLadderInput,
  tier: JudgeTier,
  driver: JudgeModelDriver,
): Promise<TierCallResult> {
  const tiers = modelTiers();
  const model = tier === "screen" ? tiers.judgeScreen : tiers.judgeFinal;
  const promptVersion = promptVersionFor(tier);
  const startedAt = Date.now();
  const result = await callTierJudge(driver, { tier, body: input.body, chunks: input.chunks });
  const latencyMs = Date.now() - startedAt;
  await input.onGate({
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

/* ------------------------------------------------------------------ */
/* Shared evidence assembly — reads repos, never writes.                */
/* ------------------------------------------------------------------ */

export interface LadderEvidence {
  denylist: string[];
  chunks: SourceChunkInput[];
  cadence?: LadderCadenceContext;
}

/**
 * The ONE evidence assembly, for both entry points. Reads only.
 *
 * B3.8: the ACTIVE profile's identity is appended as grounding evidence for
 * every judged body, inside this shared assembly so no caller can forget it —
 * generation was allowed to draw claims from the same rendered block
 * (contracts renderBrandIdentity, one canonical rendering for both sides).
 * Deliberately the CURRENT active identity, not the version the draft was
 * generated under: a claim the tenant no longer asserts must fail grounding
 * on re-judge, not pass on stale facts. Empty identity appends nothing.
 * `chunksOverride` (tests / callers with pre-assembled evidence) replaces the
 * collected source chunks but still gets the identity append.
 */
export async function assembleLadderEvidence(
  ctx: TenantCtx,
  repos: Repos,
  draft: Draft,
  chunksOverride?: SourceChunkInput[],
): Promise<LadderEvidence> {
  const profile = await repos.brandProfiles.getActive(ctx);
  // Per-tenant denylist is DATA from brand_profiles — never hard-coded here.
  const denylist = (profile?.denylist as string[] | undefined) ?? [];

  const baseChunks = chunksOverride ?? (await collectGroundingChunks(ctx, repos, draft));
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

  const cadenceConfig = profile?.cadence ? cadenceConfigSchema.parse(profile.cadence) : undefined;
  const cadenceRule = cadenceConfig?.[draft.platform];
  if (!cadenceRule || !hasCadenceConstraint(cadenceRule)) {
    return { denylist, chunks };
  }
  const now = new Date();
  return {
    denylist,
    chunks,
    cadence: {
      rule: cadenceRule,
      now,
      fetchAdmissions: () =>
        repos.drafts.listQueueAdmissions(ctx, {
          platform: draft.platform,
          since: new Date(now.getTime() - cadenceFetchHorizonMs(cadenceRule)),
        }),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Shared metering — the one write both entry points make.              */
/* ------------------------------------------------------------------ */

/**
 * Core meters the shell: EVERY tier attempt (including repair retries), from
 * EITHER entry point, routes through the one gateway choke point — budget
 * asserted before, usage recorded after, span traced (SPINE §1; amendment
 * A2). The shell driver itself stays read-only. This is deliberately the one
 * repos WRITE a candidate judge still makes: an unmetered model call would be
 * a tenant-budget bypass, which is its own safety hole. `operation` labels
 * the span/ledger honestly — `judge.g3_*` for the pipeline,
 * `judge.candidate.g3_*` for a candidate judge — so spend is never ambiguous
 * about what it bought.
 */
export function meteredTierDriver(opts: {
  ctx: TenantCtx;
  repos: Repos;
  capTokens: number;
  tier: JudgeTier;
  operation: string;
  driver: JudgeModelDriver;
}): JudgeModelDriver {
  const tiers = modelTiers();
  const model = opts.tier === "screen" ? tiers.judgeScreen : tiers.judgeFinal;
  return (req) =>
    withGatewayGuard({
      usage: {
        assertWithinBudget: (o) => opts.repos.usageLedger.assertWithinBudget(opts.ctx, o),
        recordUsage: (o) => opts.repos.usageLedger.record(opts.ctx, o),
      },
      capTokens: opts.capTokens,
      model,
      operation: opts.operation,
      call: async () => {
        const out = await opts.driver(req);
        return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
      },
    });
}
