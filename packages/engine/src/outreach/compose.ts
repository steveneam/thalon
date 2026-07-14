import {
  brandIdentitySchema,
  outreachEmailDraftMetaSchema,
  renderBrandIdentity,
  type TenantCtx,
} from "@thalon/contracts";
import type { Draft, Repos } from "@thalon/db";
import { modelTiers, readEnv, withGatewayGuard } from "@thalon/platform";
import { runSingleDraftPipeline } from "../pipeline/single-draft";
import {
  gatewayOutreachEmailDriver,
  outreachEmailPromptVersion,
  type OutreachEmailDriver,
} from "./shell/generator";
import { generateValidatedOutreachEmail } from "./validate-shell-output";

/**
 * The draft's platform label: "email" — a real routing/cadence vocabulary
 * word, not provenance filler. A tenant cadence rule on `cadence.email`
 * (frozen w1 schema) arms the judge's B7.a gate for outreach exactly like
 * any social platform. Overridable per request: data, not code.
 */
const OUTREACH_PLATFORM = "email";
/** No per-tenant/shipped platform-profile file applies (an outreach email isn't platform social copy) — provenance filler, mirrors pillar.v1. */
const OUTREACH_PLATFORM_PROFILE_VERSION = "outreach-email.v1";

export interface OutreachEmailRequest {
  /**
   * `sources.id` of the ingested lead brief (kind "prompt") — the
   * operator-pruned lead DNA + direction, assembled by the caller and
   * ingested through the one ingest door. It is BOTH the generation brief
   * and the draft's grounding source: the judge verifies every claim in the
   * email against exactly this text (+ the active profile identity, appended
   * inside the pipeline). This is what kills spam-cannon copy.
   */
  briefSourceId: string;
  /** Who the email addresses — resolved by the caller from the leads repo (never invented by the model). */
  recipient: { leadId: string; email: string; name: string | null };
  /** Overrides the draft's platform label (default "email") — data, not code. */
  platform?: string;
}

export interface OutreachEmailDeps {
  driver?: OutreachEmailDriver;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export interface OutreachEmailResult {
  runId: string;
  /** false whenever the run row itself already existed (mirrors OriginationResult.created). */
  created: boolean;
  draft: Draft;
}

/**
 * B-crm.4 FRONT HALF (session-29 draft-only slice): lead brief (+ active
 * profile identity) -> ONE judged-format `outreach_email` draft. The draft
 * lands in status "generated" only — the judge harness (denylist · cadence
 * on the "email" platform · grounding) is the only path onward, and the
 * approve queue is where it parks. There is NO send path anywhere in this
 * module or this sprint: the operator copies an APPROVED draft into their
 * own mail client ("no ungated contact, ever"). When the send half is
 * chartered it attaches behind the same approve door.
 *
 * Idempotency/backfill semantics live in the shared single-draft spine
 * (../pipeline/single-draft.ts, B4.1): an identical brief for the same lead
 * under the same profile version returns the SAME draft with zero shell
 * calls.
 */
export async function runOutreachEmail(
  ctx: TenantCtx,
  repos: Repos,
  request: OutreachEmailRequest,
  deps: OutreachEmailDeps = {},
): Promise<OutreachEmailResult> {
  const briefSource = await repos.sources.get(ctx, request.briefSourceId);
  if (!briefSource) {
    throw new Error(`source "${request.briefSourceId}" not found for this tenant`);
  }
  if (briefSource.kind !== "prompt") {
    throw new Error(
      `source "${request.briefSourceId}" is kind "${briefSource.kind}", expected "prompt" — the lead brief must be a prompt source (ingest it first)`,
    );
  }

  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new Error(`tenant ${ctx.tenantId} has no active brand profile — create one first`);
  }

  const platform = request.platform?.trim() || OUTREACH_PLATFORM;
  const model = modelTiers().draft;
  const promptVersion = outreachEmailPromptVersion();

  return runSingleDraftPipeline(ctx, repos, {
    format: "outreach_email",
    keyMaterial: {
      tenantId: ctx.tenantId,
      briefSourceId: briefSource.id,
      leadId: request.recipient.leadId,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platform,
      promptVersion,
      model,
    },
    run: {
      sourceId: briefSource.id,
      brandProfileId: profile.id,
      brandProfileVersion: profile.version,
      platforms: [platform],
      promptVersion,
      model,
      params: { leadId: request.recipient.leadId },
    },
    irrecoverableLabel: "outreach-email generation",
    generate: async () => {
      const briefChunks = await repos.sourceChunks.listBySource(ctx, briefSource.id);
      const leadBrief = briefChunks.map((chunk) => chunk.text).join("\n\n");

      const voice = (profile.voice as Record<string, unknown> | null) ?? {};
      // B3.8: identity rides along automatically — rendered with the SAME
      // contracts function the judge grounds against; empty identity ⇒ absent.
      const identityBlock =
        renderBrandIdentity(brandIdentitySchema.parse(profile.identity ?? {})) || undefined;
      const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
      const rawDriver = deps.driver ?? gatewayOutreachEmailDriver();

      // Core meters the shell: EVERY attempt (including repair retries) routes
      // through the one gateway choke point — budget asserted before, usage
      // recorded after, span traced (SPINE §1; amendment A2). The shell driver
      // itself stays read-only.
      const guardedDriver: OutreachEmailDriver = (req) =>
        withGatewayGuard({
          usage: {
            assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
            recordUsage: (o) => repos.usageLedger.record(ctx, o),
          },
          capTokens,
          model,
          operation: "outreach.compose_email",
          call: async () => {
            const out = await rawDriver(req);
            return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
          },
        });

      return generateValidatedOutreachEmail(guardedDriver, {
        leadBrief,
        recipient: { email: request.recipient.email, name: request.recipient.name },
        voice,
        identityBlock,
      });
    },
    toDraft: async (output) => {
      const meta = outreachEmailDraftMetaSchema.parse({
        subject: output.subject,
        emailBody: output.body,
        recipient: {
          leadId: request.recipient.leadId,
          email: request.recipient.email,
          name: request.recipient.name,
        },
        groundingSourceIds: [briefSource.id],
        promptVersion,
        brandProfileVersion: profile.version,
        platformProfileVersion: OUTREACH_PLATFORM_PROFILE_VERSION,
      });
      // The body is the claim surface the judge reads: subject + email body
      // (the registry's expectedBody derivation, I1 body_hash convention).
      const body = [output.subject, output.body].join("\n\n");
      return { platform, body, meta };
    },
  });
}
