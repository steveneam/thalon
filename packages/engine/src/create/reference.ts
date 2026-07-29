import { isReferenceOnly, type MediaRef, type MediaRefEnvelope, type TenantCtx } from "@thalon/contracts";
import { InvalidStateError, type Repos } from "@thalon/db";
import { modelTiers, readEnv, withGatewayGuard } from "@thalon/platform";
import { referenceDescribability } from "./reference-scope";
import {
  gatewayReferenceVisionDriver,
  type ReferenceVisionCallDriver,
} from "./shell/describe-reference";

/**
 * B-create.2, the **reference-describe seam** (spec R4, §Design/The engine).
 *
 * An operator attaches media in one of two declared roles. `use` media rides
 * the draft as the post's own; `reference` media is inspiration we may have
 * no right to publish — the operator brought it so generation could be told
 * what it LOOKS like and then write something *similar but different* (the
 * template method's own doctrine). This file is where that description
 * happens, and its entire reason for existing is that the description is
 * TEXT: notes thread into the family prompt as grounding, and the bytes stay
 * behind. Reference media reaching a draft's `mediaRefs`, the public-asset
 * door or a platform call is a licensing breach, not a cosmetic bug.
 *
 * **The real driver landed in `shell/describe-reference.ts`** (the lane this
 * file's own predecessor named), metered from HERE — core meters the shell,
 * as every other family does — under the operation label
 * `create.describe_reference`, which is pinned in the shell-inventory
 * ratchet (`__tests__/shell-inventory.test.ts`) and in SPINE §1.
 *
 * The injectable `ReferenceVisionDriver` seam is UNCHANGED by that arrival,
 * which is the point: a caller who hands over no driver still gets honest
 * absence, and every test still injects the deterministic fake, so the suite
 * stays keyless and networkless. A live call happens only when a caller
 * explicitly builds `meteredReferenceVisionDriver` — and that constructor is
 * the only thing in this module that can reach a gateway.
 *
 * A describe that cannot happen is honestly absent rather than faked: the
 * run proceeds, the reference stays attached, and the operator is told it
 * was not analysed WITH the reason (spec Error Behavior — degradation is
 * non-blocking).
 */

/* ------------------------------------------------------------------ */
/* The seam.                                                            */
/* ------------------------------------------------------------------ */

export interface ReferenceVisionRequest {
  /** The bytes' address. A driver reads them; core never does. */
  ref: MediaRef;
  /** The operator's own alt text when the envelope carries one — context for the describer, never a substitute for looking. */
  alt?: string;
}

export interface ReferenceVisionOutput {
  /** How it looks: composition, palette, light, register. */
  style: string;
  /** What is in it: subject, setting, action. */
  subject: string;
}

export type ReferenceVisionDriver = (
  request: ReferenceVisionRequest,
) => Promise<ReferenceVisionOutput>;

export interface DescribeReferenceDeps {
  /**
   * Absent = no describer is wired, which is TODAY's honest state and not an
   * error. The result says so in words; nothing blocks.
   */
  driver?: ReferenceVisionDriver;
}

/**
 * The outcome, as two facts rather than a nullable string: an absent
 * description and a failed one are the same to a caller (proceed without
 * notes) but never the same to an operator, who is owed the reason.
 */
export type ReferenceDescription =
  | { status: "described"; notes: string }
  | { status: "not_analysed"; reason: string };

/** The sentence the surfaces show for an undescribed reference (spec Error Behavior, verbatim). */
export const REFERENCE_NOT_ANALYSED = "reference attached, not yet analysed";

/**
 * The describability rule itself lives in `reference-scope.ts` — a pure
 * module, because `plan.ts` counts against the same rule to price a run and
 * must not import this file's gateway graph. Re-exported here so the seam's
 * own consumers keep one import.
 */
export { referenceDescribability, type ReferenceDescribability } from "./reference-scope";

/* ------------------------------------------------------------------ */
/* Describing.                                                          */
/* ------------------------------------------------------------------ */

/**
 * Describe ONE reference-role attachment.
 *
 * A `use`-role envelope is refused loudly rather than described. Use media
 * needs no description — it rides the draft as itself — so a caller handing
 * one here has confused the two roles, which is precisely the confusion the
 * licensing wall exists to prevent. Failing quietly would let that confusion
 * survive into a build where it costs a vision call per published image.
 */
export async function describeReference(
  media: MediaRefEnvelope,
  deps: DescribeReferenceDeps = {},
): Promise<ReferenceDescription> {
  if (!isReferenceOnly(media)) {
    throw new InvalidStateError(
      `describeReference was handed ${roleWord(media)}-role media — only reference-role attachments are described (use-role media rides the draft as itself)`,
    );
  }
  if (!deps.driver) {
    return {
      status: "not_analysed",
      reason: `${REFERENCE_NOT_ANALYSED} — no vision driver is wired in this build`,
    };
  }
  // Before the driver, therefore before the guard: an undescribable ref
  // costs nothing at all, not even a budget read.
  const describable = referenceDescribability(media.ref);
  if (!describable.ok) {
    return { status: "not_analysed", reason: `${REFERENCE_NOT_ANALYSED} — ${describable.reason}` };
  }
  try {
    const output = await deps.driver({ ref: media.ref, ...(media.alt ? { alt: media.alt } : {}) });
    return { status: "described", notes: renderReferenceNotes(output) };
  } catch (error) {
    // Non-blocking by design: a describe failure must never cost the
    // operator their run. The reason rides verbatim — a swallowed vision
    // error would leave "not analysed" with no way to find out why.
    return {
      status: "not_analysed",
      reason: `${REFERENCE_NOT_ANALYSED} — ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Describe every reference-role attachment on a brief, in attachment order.
 * `use`-role envelopes are skipped silently here (unlike the singular call):
 * this is the bulk door a run uses, and a brief carrying both roles is the
 * normal case, not a mistake.
 */
export async function describeReferences(
  media: readonly MediaRefEnvelope[],
  deps: DescribeReferenceDeps = {},
): Promise<ReferenceDescription[]> {
  const out: ReferenceDescription[] = [];
  for (const envelope of media) {
    if (!isReferenceOnly(envelope)) continue;
    out.push(await describeReference(envelope, deps));
  }
  return out;
}

/**
 * THE one rendering of reference notes into prompt text (the
 * `renderBrandIdentity` convention: one canonical rendering, so generation
 * and any future judge grounding can never read two different versions).
 *
 * The instruction line is not decoration. Notes reach the shell as grounding
 * text, and grounding text is material a generator will happily reproduce —
 * so the block says, in the prompt itself, that this material is to be
 * echoed in spirit and never copied.
 */
export function renderReferenceNotes(output: ReferenceVisionOutput): string {
  return [
    "REFERENCE (inspiration only — write something similar but DIFFERENT; never reproduce it, never describe it as ours):",
    `- style: ${output.style.trim()}`,
    `- subject: ${output.subject.trim()}`,
  ].join("\n");
}

/**
 * The block that rides a brief, or `undefined` when nothing was described.
 * Undescribed references contribute NOTHING to the prompt — an honest
 * absence beats a placeholder line that generation would try to honour.
 */
export function renderReferenceBlock(
  descriptions: readonly ReferenceDescription[],
): string | undefined {
  const described = descriptions.flatMap((d) => (d.status === "described" ? [d.notes] : []));
  return described.length > 0 ? described.join("\n\n") : undefined;
}

/* ------------------------------------------------------------------ */
/* Metering — core meters the shell (SPINE §1; amendment A2).           */
/* ------------------------------------------------------------------ */

export interface MeteredReferenceVisionDeps {
  ctx: TenantCtx;
  repos: Repos;
  /** Overrides the tenant daily token budget cap (tests only; production reads TENANT_DAILY_TOKEN_BUDGET). */
  capTokens?: number;
  /** The raw call driver. Defaults to the live gateway one — pass a fake to exercise metering without a key. */
  driver?: ReferenceVisionCallDriver;
}

/**
 * Wraps a raw describe call in the ONE gateway choke point and hands back
 * the plain `ReferenceVisionDriver` the seam above already takes: budget
 * asserted before, usage recorded after, span traced — under the operation
 * label **`create.describe_reference`**.
 *
 * This is the only constructor in the create module that can reach a
 * gateway, and it is never called by `runCreate` itself: a caller wires it
 * deliberately (`deps.reference.driver`), which is what keeps the whole
 * suite keyless. Building it does NOT spend — `gatewayReferenceVisionDriver`
 * resolves its model and store per call — so a caller may construct it once
 * per run and describe zero references at no cost.
 */
export function meteredReferenceVisionDriver(
  deps: MeteredReferenceVisionDeps,
): ReferenceVisionDriver {
  const raw = deps.driver ?? gatewayReferenceVisionDriver();
  const capTokens = deps.capTokens ?? readEnv().TENANT_DAILY_TOKEN_BUDGET;
  const model = modelTiers().vision;
  return (request) =>
    withGatewayGuard({
      usage: {
        assertWithinBudget: (o) => deps.repos.usageLedger.assertWithinBudget(deps.ctx, o),
        recordUsage: (o) => deps.repos.usageLedger.record(deps.ctx, o),
      },
      capTokens,
      model,
      operation: "create.describe_reference",
      call: async () => {
        const out = await raw(request);
        return { result: out.output, tokensIn: out.tokensIn, tokensOut: out.tokensOut };
      },
    });
}

/**
 * A deterministic, keyless, networkless describer — the `createFake*Driver`
 * convention. It reports what the ref itself already carries (address and
 * dimensions) and invents no aesthetics, so a test asserting on notes is
 * asserting on the seam's plumbing rather than on a fake's imagination.
 */
export function createFakeReferenceVisionDriver(): ReferenceVisionDriver {
  return async ({ ref, alt }) => ({
    style: `flat studio light, centred composition (${describeRef(ref)})`,
    subject: alt ?? "an unlabelled product photograph",
  });
}

function describeRef(ref: MediaRef): string {
  const size = ref.width && ref.height ? `${ref.width}x${ref.height}` : "unmeasured";
  return ref.kind === "stored" ? `stored ${ref.ext}, ${size}` : `external, ${size}`;
}

function roleWord(media: MediaRefEnvelope): string {
  return media.role ?? "use";
}
