import {
  DEFAULT_PLATFORM_ROUTING,
  admittedPlatforms,
  createBriefSchema,
  outputEligible,
  platformRoutingSchema,
  type CreateBrief,
  type CreateBriefInput,
  type CreateChildRef,
  type CreatePlan,
  type TenantCtx,
} from "@thalon/contracts";
import { InvalidStateError, sha256Hex, stableStringify, type Repos } from "@thalon/db";
import { ingestSource } from "../ingest/ingest";
import {
  DEFAULT_CREATE_DISPATCH,
  missingLeadError,
  type CreateDispatchTable,
  type CreateGenerationDeps,
  type CreateJudgeDeps,
  type GroundingMode,
} from "./dispatch";
import { deriveCreatePlan, readCreateContext, type CreatePlanContext } from "./plan";
import {
  describeReferences,
  renderReferenceBlock,
  type DescribeReferenceDeps,
  type ReferenceDescription,
} from "./reference";

/**
 * B-create.2, half two: **the run orchestrator**. Charter
 * `docs/create-engine/spec.md` (APPROVED) R1 — one run contract, so every
 * Create path records the same three facts: what was asked (`brief`), what
 * that resolved to (`plan`), and what came back (`children`).
 *
 * `runCreate` adds NO generation code and makes NO gating decision. In
 * order: derive the plan (pure), refuse what cannot be dispatched before
 * anything is written, open the idempotent run row, assemble the brief,
 * dispatch each unit inside its own failure boundary, record. Everything
 * expensive sits behind an injectable driver, and this file constructs none
 * of them — it cannot spend a credit on its own.
 *
 * THREE BEHAVIOURS WORTH KNOWING BEFORE READING:
 *
 *  - **A completed run is never re-run.** A Create run spends, so a
 *    double-clicked Generate returns the first run untouched with zero
 *    generation calls. An INCOMPLETE run (failed, or one that recorded no
 *    children) is re-dispatched instead: every family engine is idempotent
 *    on its own key, so the parts that succeeded cost nothing the second
 *    time, and `recordChildren` replaces the whole set so a retry converges
 *    rather than doubling.
 *  - **A unit that throws costs only itself.** One destination's
 *    irrecoverable generation leaves the others' drafts standing; the reason
 *    rides verbatim on the run's `lastError` (spec Error Behavior).
 *  - **A judge refusal is not a failure.** It is a child with a reason
 *    attached, and the run still says `complete` — the gate spoke, which is
 *    the gate working. Only an exception makes a run `failed`.
 */

/* ------------------------------------------------------------------ */
/* Inputs and outputs.                                                  */
/* ------------------------------------------------------------------ */

export interface CreateRunDeps {
  /**
   * REQUIRED, and required for a structural reason: nothing in this module
   * constructs a gateway driver, so a caller must hand over the judge's
   * drivers explicitly. There is no default that could quietly reach the
   * network — tests pass scripted fakes, `apps/web` passes the same gateway
   * wiring every other judged door uses.
   */
  judge: CreateJudgeDeps;
  /** Per-family generation-driver overrides (fakes in tests; absent = each engine's own default). */
  generation?: CreateGenerationDeps;
  /** The reference-describe seam's vision driver. Absent = references stay honestly undescribed. */
  reference?: DescribeReferenceDeps;
  /** The dispatch table. Overridable so a test can substitute a fake family engine wholesale. */
  dispatch?: CreateDispatchTable;
  /** Plan inputs. Absent = loaded from the tenant's own config and vault (see `loadPlanContext`). */
  planContext?: CreatePlanContext;
  now?: () => Date;
}

/**
 * The `create_runs` row.
 *
 * ⚠ Derived from the repo rather than imported by name because `@thalon/db`
 * does not export `CreateRun` from its barrel — `types.ts` declares it
 * beside `FanoutRun`, but only `FanoutRun` reaches the public surface, so
 * the s87 window's own row type is unnameable outside the package. Reported
 * in the lane wrap with the routing-column gap; when the export lands this
 * alias becomes a one-line import.
 */
export type CreateRunRow = NonNullable<Awaited<ReturnType<Repos["createRuns"]["get"]>>>;

export interface CreateRunResult {
  run: CreateRunRow;
  plan: CreatePlan;
  children: CreateChildRef[];
  /** false when a completed run already existed — nothing was dispatched and nothing spent. */
  dispatched: boolean;
  /** One verbatim line per unit that threw. Empty on a clean run; also written to the run's `lastError`. */
  failures: string[];
  /** What the describe seam found, in attachment order — or the honest reason it did not. */
  references: ReferenceDescription[];
}

/* ------------------------------------------------------------------ */
/* The orchestrator.                                                    */
/* ------------------------------------------------------------------ */

export async function runCreate(
  ctx: TenantCtx,
  repos: Repos,
  briefInput: CreateBriefInput,
  deps: CreateRunDeps,
): Promise<CreateRunResult> {
  const brief = createBriefSchema.parse(briefInput);
  const planContext = deps.planContext ?? (await loadPlanContext(ctx, repos));
  const plan = deriveCreatePlan(brief, planContext);

  // Pre-flight: what cannot be dispatched at all is refused BEFORE the first
  // write, so a brief that was never runnable leaves no half-run behind.
  assertBriefDispatchable(brief);

  const generationKey = createGenerationKey(ctx, brief, plan);
  const existing = await repos.createRuns.getByGenerationKey(ctx, generationKey);
  if (existing && existing.status === "complete") {
    return {
      run: existing,
      plan: existing.plan as CreatePlan,
      children: existing.children as CreateChildRef[],
      dispatched: false,
      failures: [],
      references: [],
    };
  }

  // A re-dispatch re-derives the plan, and the row must show the derivation
  // this attempt actually ran on — the key pins the admitted set, but a
  // refusal's own words can change under it (a channel that was merely
  // unconnected last time now needs re-authorising).
  const run = existing
    ? await repos.createRuns.recordPlan(ctx, existing.id, plan)
    : await repos.createRuns.create(ctx, {
        family: brief.family,
        mode: brief.mode,
        brief,
        plan,
        generationKey,
      });

  // Every destination refused, and this family cannot run without one. The
  // ask is still recorded — an operator who sees nothing happen deserves the
  // row that says why — but nothing generates and nothing spends.
  if (requiresDestination(brief) && admittedPlatforms(plan).length === 0) {
    const reasons = plan.platforms
      .flatMap((p) => (p.refusal ? [`${p.platform}: ${p.refusal.message}`] : []))
      .join("\n");
    const message =
      reasons ||
      `no destination was requested for this ${brief.family} run, and routing had no default to prefill`;
    await repos.createRuns.recordLastError(ctx, run.id, message);
    const failed = await repos.createRuns.setStatus(ctx, run.id, "failed");
    return { run: failed, plan, children: [], dispatched: false, failures: [message], references: [] };
  }

  await repos.createRuns.setStatus(ctx, run.id, "running");

  const references = await describeReferences(brief.media, deps.reference ?? {});
  const assembly = briefAssembly(ctx, repos, brief, references, deps);
  const table = deps.dispatch ?? DEFAULT_CREATE_DISPATCH;
  const units = table[brief.family]({
    ctx,
    repos,
    // THE LICENSING WALL, structurally: the brief the arms see carries no
    // reference-role media at all. `outputEligible` is the one filter
    // (contracts/media.ts) — a future third role cannot quietly land on the
    // publish side of it, and no arm can forward bytes it never received.
    // The references reach generation as TEXT, inside the brief.
    brief: { ...brief, media: outputEligible(brief.media) },
    plan,
    briefText: assembly.text,
    briefSource: assembly.source,
    judge: deps.judge,
    generation: deps.generation ?? {},
    now: deps.now ?? (() => new Date()),
  });

  const children: CreateChildRef[] = [];
  const failures: string[] = [];
  for (const unit of units) {
    try {
      children.push(...(await unit.run()));
    } catch (error) {
      // The others proceed. The reason is verbatim — the family engines name
      // themselves and their platform in their own messages, and rewording
      // one here would cost the operator the only detail that locates it.
      failures.push(`${unit.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await repos.createRuns.recordChildren(ctx, run.id, children);
  // Cleared on a clean run so a retry that succeeds does not keep wearing
  // the previous attempt's failure (the fan-out's B4.5 behaviour).
  await repos.createRuns.recordLastError(ctx, run.id, failures.length > 0 ? failures.join("\n") : null);
  // A partial run is NOT `complete`. The word an operator scans a list for
  // must not say everything shipped when one destination did not; the child
  // set and `lastError` carry the whole truth beneath it.
  const finished = await repos.createRuns.setStatus(
    ctx,
    run.id,
    failures.length > 0 ? "failed" : "complete",
  );

  return { run: finished, plan, children, dispatched: true, failures, references };
}

/* ------------------------------------------------------------------ */
/* Pre-flight.                                                          */
/* ------------------------------------------------------------------ */

/**
 * Only `post` genuinely cannot run without a destination — `runFanout`
 * refuses an empty platform list by construction. A page, a video or an
 * email produces its artifact whatever its destination set is, and the
 * destination is chosen (or corrected) before publish, so refusing those
 * here would be an opinion dressed as physics.
 */
function requiresDestination(brief: CreateBrief): boolean {
  return brief.family === "post";
}

/** What no plan can rescue: a brief with nothing to generate from, or an email with nobody to send to. */
function assertBriefDispatchable(brief: CreateBrief): void {
  if (!briefHasIntent(brief)) {
    throw new InvalidStateError(
      "a Create run needs a brief: this one carries neither a prompt nor any wizard slot values — there is nothing to generate from",
    );
  }
  if (brief.family === "email" && !readCreateContext(brief.context).leadId) {
    throw missingLeadError();
  }
}

function briefHasIntent(brief: CreateBrief): boolean {
  if (brief.prompt?.trim()) return true;
  return renderWizardSlots(brief.wizard) !== undefined;
}

/* ------------------------------------------------------------------ */
/* The brief, assembled once.                                           */
/* ------------------------------------------------------------------ */

interface BriefAssembly {
  text: (grounding: GroundingMode) => Promise<string>;
  source: (grounding: GroundingMode) => Promise<string>;
}

/**
 * ONE brief per run, memoized per grounding mode, so a family arm that asks
 * twice ingests once. `inline` mode folds the picked sources' own text into
 * the brief for the engines that take no grounding-source list — the
 * alternative was dropping an operator's grounding picks silently, which is
 * the kind of quiet loss that only shows up as a weaker draft nobody can
 * explain.
 */
function briefAssembly(
  ctx: TenantCtx,
  repos: Repos,
  brief: CreateBrief,
  references: readonly ReferenceDescription[],
  deps: CreateRunDeps,
): BriefAssembly {
  const texts = new Map<GroundingMode, Promise<string>>();
  const sources = new Map<GroundingMode, Promise<string>>();

  const text = (grounding: GroundingMode): Promise<string> => {
    const cached = texts.get(grounding);
    if (cached) return cached;
    const pending = (async () => {
      const parts = [
        brief.prompt?.trim(),
        renderWizardSlots(brief.wizard),
        renderReferenceBlock(references),
        grounding === "inline" ? await readGroundingText(ctx, repos, brief.sourceRefs) : undefined,
      ].filter((part): part is string => Boolean(part));
      return parts.join("\n\n");
    })();
    texts.set(grounding, pending);
    return pending;
  };

  const source = (grounding: GroundingMode): Promise<string> => {
    const cached = sources.get(grounding);
    if (cached) return cached;
    const pending = (async () => {
      const { sourceId } = await ingestSource(
        ctx,
        repos,
        {
          kind: "prompt",
          prompt: await text(grounding),
          meta: { origin: "create_run", family: brief.family, mode: brief.mode },
        },
        deps.generation?.ingest ?? {},
      );
      return sourceId;
    })();
    sources.set(grounding, pending);
    return pending;
  };

  return { text, source };
}

/**
 * Wizard slots as prompt text — deterministic (sorted keys, so the same
 * slots always produce the same brief and therefore the same generation
 * key), and skipping empties rather than emitting a label with nothing after
 * it. `undefined` when the wizard carries nothing at all.
 */
export function renderWizardSlots(wizard: Record<string, unknown> | undefined): string | undefined {
  if (!wizard) return undefined;
  const lines = Object.keys(wizard)
    .sort()
    .flatMap((key) => {
      const value = wizard[key];
      if (value === undefined || value === null || value === "") return [];
      const rendered = typeof value === "string" ? value.trim() : JSON.stringify(value);
      return rendered ? [`${key.toUpperCase()}: ${rendered}`] : [];
    });
  return lines.length > 0 ? lines.join("\n") : undefined;
}

/** The picked grounding sources' own text, in the operator's pick order. */
async function readGroundingText(
  ctx: TenantCtx,
  repos: Repos,
  sourceRefs: readonly string[],
): Promise<string | undefined> {
  if (sourceRefs.length === 0) return undefined;
  const parts: string[] = [];
  for (const id of sourceRefs) {
    const chunks = await repos.sourceChunks.listBySource(ctx, id);
    const text = chunks.map((chunk) => chunk.text).join("\n\n");
    if (text.trim()) parts.push(text);
  }
  return parts.length > 0 ? parts.join("\n\n---\n\n") : undefined;
}

/* ------------------------------------------------------------------ */
/* Idempotency and tenant config.                                       */
/* ------------------------------------------------------------------ */

/**
 * The run's identity. The brief is in the key because a different ask is a
 * different run; the ADMITTED destinations are in it because the fan-out's
 * doctrine is idempotency by OUTPUTS, not by request shape — two briefs that
 * resolve to the same destinations are the same run, and a routing change
 * that resolves to different ones is not.
 *
 * Tenant-salted: `create_runs.generation_key` is globally unique, and the
 * repo refuses a key that already exists under another tenant rather than
 * letting one tenant's replay find another's row.
 */
export function createGenerationKey(ctx: TenantCtx, brief: CreateBrief, plan: CreatePlan): string {
  return sha256Hex(
    stableStringify({
      tenantId: ctx.tenantId,
      brief,
      admitted: admittedPlatforms(plan),
    }),
  );
}

/**
 * The tenant's own plan inputs: family routing (config) and the vault's
 * connection states (data). Read here, once, so `deriveCreatePlan` stays
 * pure.
 *
 * ⚠ **`platformRouting` has no storage column yet.** The s87 window added it
 * to `brandProfileConfigSchema`, but `brand_profiles` has no
 * `platform_routing` column and `brandProfilesRepo.create` does not persist
 * it — so a tenant's routing config is accepted at the schema and dropped
 * before the row. This is the third occurrence of exactly that gap: the
 * `outreach` column's own docblock records it happening for `outreach` and
 * `social` before it. Reported to the lead in the lane wrap; until the
 * column lands, every tenant falls back to the generic demo table below.
 * The read is written defensively so the day the column exists this loader
 * starts honouring it with no edit here.
 */
export async function loadPlanContext(ctx: TenantCtx, repos: Repos): Promise<CreatePlanContext> {
  const profile = await repos.brandProfiles.getActive(ctx);
  const stored = profile ? (profile as Record<string, unknown>).platformRouting : undefined;
  const parsed = platformRoutingSchema.safeParse(stored);
  const credentials = await repos.tenantCredentials.list(ctx);
  return {
    routing: parsed.success ? parsed.data : DEFAULT_PLATFORM_ROUTING,
    connections: Object.fromEntries(
      credentials.map((row) => [
        row.destination,
        row.status === "needs_reauth" ? "needs_reauth" : "connected",
      ]),
    ),
  };
}
