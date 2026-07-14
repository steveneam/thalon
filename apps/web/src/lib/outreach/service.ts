import type { TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import {
  ingestSource,
  runOutreachEmail,
  type IngestDeps,
  type OutreachEmailDeps,
} from "@thalon/engine";
import { runJudgeOnDraft, type JudgeRunnerDeps } from "@/lib/approve-queue/judge-runner";
import type { ComposeEmailInput, ComposeEmailResult } from "./types";

/**
 * The →Email draft-only slice (B-crm.4 front half, session 29; leads
 * proposal §Session-28 addendum item 1). One door, whole walk: the
 * operator-PRUNED lead context (what survived the Create chips — never the
 * raw lead row resurrected) becomes the brief; the brief ingests as a
 * prompt source through the one ingest door; the composer generates ONE
 * `outreach_email` draft grounded on exactly that brief; the FULL judge
 * gate runs (denylist · cadence on the "email" platform · grounding); and
 * the draft parks queued (or blocked, honestly) in the approve queue. NO
 * send path exists — the operator copies an APPROVED draft into their own
 * mail client. Deps injectable so tests stay keyless (the sweep-runner
 * pattern, SPINE §80); the clock never enters — compose is deterministic.
 */

export interface ComposeEmailDeps {
  ingest?: IngestDeps;
  compose?: OutreachEmailDeps;
  judge?: JudgeRunnerDeps;
}

/**
 * Renders the operator-approved context into the ONE brief text that is both
 * the generation prompt and the grounding source. Deterministic and readable
 * on purpose — the judge's claim table cites lines of this text back at the
 * operator, so it must read like the facts it carries.
 */
export function renderOutreachBrief(input: ComposeEmailInput): string {
  const c = input.context ?? {};
  const lines = [
    ...(c.contact ? [`Contact: ${c.contact}`] : []),
    ...(c.company ? [`Company: ${c.company}`] : []),
    ...(c.role ? [`Role: ${c.role}`] : []),
    ...(c.painPoint ? [`Pain point (in the lead's words): ${c.painPoint}`] : []),
    ...(c.sourceUrl ? [`Website: ${c.sourceUrl}`] : []),
    ...(c.notes ? [`Notes: ${c.notes}`] : []),
    ...(input.prompt?.trim() ? [`Operator direction: ${input.prompt.trim()}`] : []),
  ];
  if (lines.length === 0) {
    throw new ComposeEmailError(
      "Nothing to compose from — keep at least one context chip or write a direction.",
      400,
    );
  }
  return lines.join("\n");
}

export class ComposeEmailError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: 400 | 404 | 409 = 400,
  ) {
    super(message);
    this.name = "ComposeEmailError";
  }
}

export async function composeEmailDraft(
  ctx: TenantCtx,
  repos: Repos,
  input: ComposeEmailInput,
  deps: ComposeEmailDeps = {},
): Promise<ComposeEmailResult> {
  const lead = await repos.leads.get(ctx, input.leadId);
  if (!lead) throw new ComposeEmailError(`lead "${input.leadId}" not found`, 404);

  const brief = renderOutreachBrief(input);
  const { sourceId } = await ingestSource(
    ctx,
    repos,
    { kind: "prompt", prompt: brief, meta: { origin: "outreach_brief", leadId: lead.id } },
    deps.ingest,
  );

  const composed = await runOutreachEmail(
    ctx,
    repos,
    {
      briefSourceId: sourceId,
      recipient: { leadId: lead.id, email: lead.email, name: lead.name },
    },
    deps.compose,
  );

  // Idempotent re-compose returns a draft that may already be past the judge
  // (queued/blocked/approved/…). Judge ONLY a fresh "generated" draft — never
  // re-spend or fight the state machine over a draft the operator already has.
  if (composed.draft.status !== "generated") {
    return {
      draftId: composed.draft.id,
      runId: composed.runId,
      status: composed.draft.status,
      alreadyComposed: true,
    };
  }

  const outcome = await runJudgeOnDraft(repos, ctx, composed.draft, deps.judge);
  return {
    draftId: outcome.draft.id,
    runId: composed.runId,
    status: outcome.draft.status,
    alreadyComposed: false,
    ...(outcome.status === "blocked" ? { blockedReason: outcome.reason } : {}),
  };
}
