import { edlDiffSchema, type Edl, type EdlDiff, type TenantCtx } from "@thalon/contracts";
import { sha256Hex, type Repos } from "@thalon/db";
import { modelTiers, readEnv, withGatewayGuard } from "@thalon/platform";
import { applyEdlDiff } from "./diff";
import {
  edlDiffPromptText,
  edlDiffPromptVersion,
  gatewayEdlDiffDriver,
  type EdlDiffDriver,
} from "./shell/generator";

/**
 * B-ve.4 propose core (ADR 0010): shell proposes, core validates AND meters.
 * The candidate diff is (1) parsed against edlDiffSchema — garbage never
 * leaves this module — and (2) DRY-APPLIED to the target EDL, so an op
 * pointing at a caption line or cue that does not exist is refused here,
 * not in the operator's face. Every driver attempt routes through
 * `withGatewayGuard` (budget asserted before, usage recorded after, span
 * traced — the one gateway choke point, SPINE §1/A2). What returns is ready
 * for the diff view, carrying the full attribution pin (model + prompt
 * name/hash) the save door will demand if the operator applies it. Zero
 * vendor-metered calls: the only spend is the LLM proposal itself (gateway
 * or the claude-cli dev transport) — the A17 edit-path invariant binds to
 * APPLYING, which stays local.
 */

export class EdlProposeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EdlProposeError";
  }
}

export interface ValidatedEdlDiff {
  diff: EdlDiff;
  /** The EDL with the full diff applied — the preview the diff view renders. */
  preview: Edl;
}

/** The pure half: candidate → validated diff + applied preview, or a refusal. */
export function validateEdlDiffCandidate(edl: Edl, candidate: unknown): ValidatedEdlDiff {
  // "No change warranted" is an honest outcome the prompt invites — surface
  // the agent's own summary, not a schema error about a too-small array.
  if (
    candidate !== null &&
    typeof candidate === "object" &&
    Array.isArray((candidate as { ops?: unknown }).ops) &&
    (candidate as { ops: unknown[] }).ops.length === 0
  ) {
    const summary = (candidate as { summary?: unknown }).summary;
    throw new EdlProposeError(
      `the agent proposes no changes${typeof summary === "string" && summary ? `: ${summary}` : ""}`,
    );
  }
  const parsed = edlDiffSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new EdlProposeError(
      `proposer returned an invalid diff: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  try {
    return { diff: parsed.data, preview: applyEdlDiff(edl, parsed.data) };
  } catch (err) {
    throw new EdlProposeError(
      `proposed diff does not apply to this cut: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export interface ProposeEdlDiffInput {
  edl: Edl;
  ask?: string;
}

export interface EdlDiffProposal extends ValidatedEdlDiff {
  /** Attribution pins for the save door (videoCutAttributionSchema.proposal). */
  model: string;
  promptName: string;
  promptHash: string;
  tokensIn: number;
  tokensOut: number;
}

export interface ProposeEdlDiffDeps {
  driver?: EdlDiffDriver;
  /** Overrides the tenant daily token budget cap for this call (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
}

export async function proposeEdlDiff(
  ctx: TenantCtx,
  repos: Repos,
  input: ProposeEdlDiffInput,
  deps: ProposeEdlDiffDeps = {},
): Promise<EdlDiffProposal> {
  const rawDriver = deps.driver ?? gatewayEdlDiffDriver();
  const model = modelTiers().draft;
  const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;

  // Core meters the shell (B4.4 boundary): the driver call rides the one
  // gateway choke point even when the dev transport serves it.
  const call = await withGatewayGuard({
    usage: {
      assertWithinBudget: (o) => repos.usageLedger.assertWithinBudget(ctx, o),
      recordUsage: (o) => repos.usageLedger.record(ctx, o),
    },
    capTokens,
    model,
    operation: "video.propose_edl_diff",
    call: async () => {
      const out = await rawDriver({ edl: input.edl, ask: input.ask });
      return { result: out, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
    },
  });

  const validated = validateEdlDiffCandidate(input.edl, call.candidate);
  return {
    ...validated,
    model,
    promptName: edlDiffPromptVersion(),
    promptHash: sha256Hex(edlDiffPromptText()),
    tokensIn: call.tokensIn,
    tokensOut: call.tokensOut,
  };
}
