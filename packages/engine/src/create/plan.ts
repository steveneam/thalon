import {
  DESTINATIONS,
  KNOWN_JUDGE_GATES,
  PLATFORM_CAPABILITIES,
  SETTINGS_DEFERRED,
  createPlanSchema,
  outputEligible,
  socialPlatformSchema,
  type CreateBrief,
  type CreateFamily,
  type CreatePlan,
  type CreateRefusal,
  type DestinationClass,
  type PlatformCapability,
  type PlatformRouting,
} from "@thalon/contracts";
import { z } from "zod";
import { referenceDescribability } from "./reference-scope";

/**
 * B-create.2, half one: **plan derivation — pure, and deliberately so.**
 * Charter `docs/create-engine/spec.md` (APPROVED) R3/R6/R10; the shapes are
 * the s87 frozen window (`@thalon/contracts` create-run.ts).
 *
 * `deriveCreatePlan` answers one question — *what will this run actually do,
 * and what will it refuse?* — with no db, no clock, no network, so the
 * wizard can show the answer BEFORE the run spends (R6, HubSpot's
 * review-outline pattern) and every refusal sentence is pinnable by a unit
 * test rather than reproduced through a live generation.
 *
 * THE REFUSAL LADDER is the load-bearing idea. Every destination hits at
 * most ONE wall, and the order is *cheapest-to-fix last*: a destination that
 * this engine does not know is refused as unknown even if it is also
 * disconnected, because "connect it" would be a fix that cannot work. The
 * contract binds `admitted` and `refusal` to each other
 * (`createPlanSchema.superRefine`), so R10 — say why AND name the fix — is
 * structural here: a refusal without a sentence is unstorable.
 *
 * WHAT DERIVATION DOES NOT READ: the brand profile. The kickoff's signature
 * sketch named a `profile` in this context and there is nothing honest for
 * it to do — the fan-out already folds the profile's identity topics into
 * `targetTerms` at their own last-priority rung (`fanout/target-terms.ts`),
 * so re-supplying them here would silently promote them above that rung.
 * An unused parameter would be a lie about what this function depends on.
 */

/* ------------------------------------------------------------------ */
/* The inputs derivation is allowed to see.                             */
/* ------------------------------------------------------------------ */

/** How the vault holds a destination the tenant has touched (`tenant_credentials.status`). */
export type CreateConnectionState = "connected" | "needs_reauth";

export interface CreatePlanContext {
  /**
   * Family → default destinations (`brand_profiles.config.platformRouting`,
   * the s87 window). Read ONLY when the brief names no platforms: this is a
   * PREFILL for the wizard's platform step, never an override of what the
   * operator asked for.
   */
  routing: PlatformRouting;
  /**
   * Destination key → its stored connection state. A key that is absent was
   * never connected. Passed IN rather than read here — the vault is a db
   * read and this function is pure; `runCreate` loads it once per run.
   */
  connections: Readonly<Record<string, CreateConnectionState>>;
  /**
   * The D0 capability matrix. Injectable so the media-required rung can be
   * exercised against a fixed matrix instead of against whichever platform
   * happens to demand media this month.
   */
  matrix?: Readonly<Record<string, PlatformCapability>>;
}

/**
 * The Intel `CreateContext` a pick chip carries (apps/web `lib/intel/types`).
 * Read DEFENSIVELY and narrowly: the brief's `context` is an open record on
 * purpose (per-family vocabulary is data), so derivation parses out only the
 * two fields it genuinely consumes and ignores the rest rather than
 * asserting a shape it does not own.
 */
const createContextSchema = z
  .object({
    /** The monitored area's keyword — a discoverability candidate for generation. */
    keyword: z.string().min(1).optional(),
    /** The lead behind a `lead_promote` capture — what the email family addresses. */
    leadId: z.string().min(1).optional(),
    /** The item's own URL — provenance the video door already takes (`apps/web/api/create/video`). */
    sourceUrl: z.string().min(1).optional(),
  })
  .loose();

/** The three fields Create reads out of an Intel context chip. */
export function readCreateContext(context: unknown): {
  keyword?: string;
  leadId?: string;
  sourceUrl?: string;
} {
  const parsed = createContextSchema.safeParse(context ?? {});
  if (!parsed.success) return {};
  return {
    keyword: parsed.data.keyword,
    leadId: parsed.data.leadId,
    sourceUrl: parsed.data.sourceUrl,
  };
}

/* ------------------------------------------------------------------ */
/* Destination classification — from the frozen registries, not opinion. */
/* ------------------------------------------------------------------ */

/**
 * WHAT KIND OF DESTINATION IS THIS? Answered from the two registries that
 * already exist, never from a list invented here:
 *
 *  - `DESTINATIONS` (contracts/integrations) — every destination the
 *    connector seam knows, each carrying its own `class`.
 *  - `SOCIAL_PLATFORMS` (contracts/social) — the platform vocabulary, which
 *    is NOT the same set: TikTok has a capability row and no destination
 *    key, exactly as `platform-capability.ts` says ("the matrix describes
 *    the PLATFORM, whether we can reach it is the registry's arming
 *    question"). Both refusals exist; keeping them apart is what lets an
 *    operator be told which wall they hit.
 */
export function classifyDestination(destination: string): DestinationClass | "unknown" {
  const registered = (DESTINATIONS as Record<string, { class: DestinationClass } | undefined>)[
    destination
  ];
  if (registered) return registered.class;
  return socialPlatformSchema.safeParse(destination).success ? "social" : "unknown";
}

/**
 * Which destination classes a family can ride. The one place a
 * family/platform mismatch is decided, and every entry is a product fact
 * rather than a technical one:
 *
 *  - `post` rides social AND website — the s70c blog-mirror doctrine is that
 *    the article and its social echoes are ONE decision (see `blogMirror`).
 *  - `video` rides social; a rendered cut is not a landing page.
 *  - `page` rides website by construction (`runWebPageGeneration` deploys
 *    through the website targets).
 *  - `email` rides the newsletter class; a social channel is not a mailbox.
 *
 * `intel` appears in no row on purpose: an intel destination is an INTAKE
 * (what we read the world with), so it can never carry output. That is a
 * mismatch, not an unknown key — and the sentence says so.
 */
const FAMILY_DESTINATION_CLASSES: Readonly<Record<CreateFamily, readonly DestinationClass[]>> = {
  post: ["social", "website"],
  video: ["social"],
  page: ["website"],
  email: ["newsletter"],
};

/**
 * Media-required is checked for the POST family only, and the asymmetry is
 * deliberate rather than an oversight. Instagram and TikTok refuse
 * text-only posts; a `video` run's own output IS the media that satisfies
 * them, so applying the rung there would refuse every video run to the two
 * platforms video exists for. `page` and `email` never touch the matrix at
 * all (a landing page has no platform ceiling).
 */
const MEDIA_REQUIRED_FAMILIES: readonly CreateFamily[] = ["post"];

/* ------------------------------------------------------------------ */
/* The variant plan — R13 groundwork the Composer reads.                */
/* ------------------------------------------------------------------ */

/**
 * Master + forks (spec §The Composer's variant model). Derivation records
 * the RELATIONSHIP; the Composer records divergence as the operator edits.
 *
 * Lives here rather than in `@thalon/contracts` because the s87 window is
 * frozen: `createPlanSchema.family` is an open record precisely so a family
 * can carry detail the window did not pre-guess. When the Composer lands
 * (B-create.3/.4) this shape is a contract-window candidate — it is exported
 * so that promotion is a move, not a rewrite.
 */
export const createVariantPlanSchema = z.strictObject({
  master: z.strictObject({
    /**
     * `article` — a website destination carries the master body and the
     * social variants mirror it (s70c).
     * `brief`   — no generated master exists; the operator's brief is the
     *             common ancestor. Stated rather than left implicit, because
     *             "re-derive from master" needs to know there is nothing to
     *             re-derive FROM.
     */
    kind: z.enum(["article", "brief"]),
    /** The article's destination. Present exactly when `kind` is `article`. */
    platform: z.string().min(1).optional(),
  }),
  variants: z
    .array(
      z.strictObject({
        platform: z.string().min(1),
        /** Always false at derivation — nothing has been edited yet (R13). */
        diverged: z.boolean().default(false),
      }),
    )
    .default([]),
});
export type CreateVariantPlan = z.infer<typeof createVariantPlanSchema>;

/** The key `plan.family` files the variant plan under — one word, read by two lanes. */
export const CREATE_VARIANT_PLAN_KEY = "variants";

/** Pull the variant plan back out of a stored plan; `null` when the run predates it or carries none. */
export function readVariantPlan(plan: CreatePlan): CreateVariantPlan | null {
  const parsed = createVariantPlanSchema.safeParse(plan.family[CREATE_VARIANT_PLAN_KEY]);
  return parsed.success ? parsed.data : null;
}

/* ------------------------------------------------------------------ */
/* Derivation.                                                          */
/* ------------------------------------------------------------------ */

export function deriveCreatePlan(brief: CreateBrief, context: CreatePlanContext): CreatePlan {
  const matrix = context.matrix ?? PLATFORM_CAPABILITIES;
  // The operator's ask wins; routing only PREFILLS an empty ask. Deduped
  // with first-mention order kept — the order is what the Composer's tab
  // strip reads, so it must be the operator's, not a sort's.
  const requested = dedupe(
    brief.platforms.length > 0 ? brief.platforms : (context.routing[brief.family] ?? []),
  );

  // The licensing wall, asked once: reference-role media informs generation
  // and never rides the post, so it can never satisfy a platform that
  // demands media. `outputEligible` is THE filter (contracts/media.ts) —
  // hand-rolling `role !== "reference"` here would put a second copy of the
  // wall in a file that is not the wall.
  const hasOutputMedia = outputEligible(brief.media).length > 0;

  const platforms = requested.map((platform) => {
    const refusal = refuseDestination(platform, brief.family, context, matrix, hasOutputMedia);
    return refusal
      ? { platform, admitted: false, refusal }
      : { platform, admitted: true as const };
  });

  const admitted = platforms.filter((p) => p.admitted).map((p) => p.platform);
  const blogMirror = deriveBlogMirror(brief.family, admitted);
  const { keyword } = readCreateContext(brief.context);

  return createPlanSchema.parse({
    platforms,
    // NAMES only — the harness owns the lenses, and this is its own list
    // (contracts/judge.ts), not a Create opinion about what should be judged.
    judgeGates: [...KNOWN_JUDGE_GATES],
    // The candidates the fan-out weaves in. The profile's identity topics
    // are NOT here: the fan-out folds those itself at last priority.
    targetTerms: keyword ? [keyword] : [],
    costPreview: deriveCostPreview(brief, admitted.length),
    ...(blogMirror ? { blogMirror } : {}),
    family: {
      [CREATE_VARIANT_PLAN_KEY]: deriveVariantPlan(admitted, blogMirror),
      ...(brief.family === "video"
        ? {
            // Which video door this run takes — the same fact the dispatch
            // table reads, recorded so the Composer and an eval row can see
            // it without re-deriving it from `mode`.
            video: { door: brief.mode === "wizard" ? "staged" : "one_prompt" },
          }
        : {}),
    },
  });
}

/** The one destination-refusal ladder. At most one wall per destination; order is fix-ability, not convenience. */
function refuseDestination(
  destination: string,
  family: CreateFamily,
  context: CreatePlanContext,
  matrix: Readonly<Record<string, PlatformCapability>>,
  hasOutputMedia: boolean,
): CreateRefusal | undefined {
  const kind = classifyDestination(destination);

  // 1. Unknown FIRST. "Connect it" is not a fix for a destination that has
  //    no connector to connect, and offering it would send the operator
  //    hunting through Settings for a card that does not exist.
  if (kind === "unknown") {
    const deferred = SETTINGS_DEFERRED[destination];
    return {
      code: "unknown_platform",
      message: deferred
        ? `"${destination}" is not a destination this engine can reach — ${deferred}. Pick a connected destination instead.`
        : `"${destination}" is not a destination this engine knows. Pick one of: ${knownDestinations().join(", ")}.`,
    };
  }

  // 2. Wrong shape for the family — unfixable by connecting, so it outranks
  //    the connection rung too.
  if (!FAMILY_DESTINATION_CLASSES[family].includes(kind)) {
    if (kind === "intel") {
      return {
        code: "family_platform_mismatch",
        message: `"${destination}" is an intel source, not a publishing destination — it is where Create reads the world, never where a ${family} run lands. Remove it from this run.`,
      };
    }
    return {
      code: "family_platform_mismatch",
      message: `"${destination}" is a ${kind} destination and a ${family} run cannot ride it — route ${family} to a ${FAMILY_DESTINATION_CLASSES[family].join(" or ")} destination instead.`,
    };
  }

  // 3. Reachability. A social platform with a capability row but no
  //    destination key is a different fact from one the operator simply has
  //    not connected, and the sentence has to say which — a "connect it in
  //    Settings" pointed at a card that will never exist is the fabricated
  //    fix R10 forbids.
  const connectable = destination in DESTINATIONS;
  if (!connectable) {
    return {
      code: "channel_not_connected",
      message: `"${destination}" has no connector in this build — reaching it needs its own connector window (destination key + driver), not a setting you can change. Drop it from this run for now.`,
    };
  }
  const state = context.connections[destination];
  if (state === undefined) {
    return {
      code: "channel_not_connected",
      message: `"${destination}" has no connected channel — connect it under Settings → Integrations, then re-run the plan.`,
    };
  }
  if (state === "needs_reauth") {
    return {
      code: "channel_not_connected",
      message: `"${destination}" needs re-authorising — its stored credential no longer works. Reconnect it under Settings → Integrations.`,
    };
  }

  // 4. Physics last: it is the only rung the operator fixes inside this run.
  if (MEDIA_REQUIRED_FAMILIES.includes(family)) {
    const capability = matrix[destination];
    if (capability?.media.required && !hasOutputMedia) {
      return {
        code: "media_required",
        message: `"${destination}" refuses text-only posts — attach an image in the "use" role. Reference-role media informs generation and never rides the post, so it cannot satisfy this.`,
      };
    }
  }

  return undefined;
}

/**
 * s70c blog-mirror pairing: when a post run carries exactly ONE admitted
 * website destination, that destination is the ARTICLE and every admitted
 * social destination mirrors it — recorded so the Composer and the Approve
 * queue can show them as one decision instead of unrelated drafts that
 * happen to share a run.
 *
 * TWO admitted website destinations record nothing, deliberately: there is
 * no single master article to pair against, and picking one would be
 * inventing a decision the operator never made.
 */
function deriveBlogMirror(
  family: CreateFamily,
  admitted: readonly string[],
): { articlePlatform: string; mirrorPlatforms: string[] } | undefined {
  if (family !== "post") return undefined;
  const articles = admitted.filter((p) => classifyDestination(p) === "website");
  if (articles.length !== 1) return undefined;
  return {
    articlePlatform: articles[0],
    mirrorPlatforms: admitted.filter((p) => classifyDestination(p) === "social"),
  };
}

/** R13 groundwork: who forked from what. The article is the master when there is one; otherwise the brief is. */
function deriveVariantPlan(
  admitted: readonly string[],
  blogMirror: { articlePlatform: string; mirrorPlatforms: string[] } | undefined,
): CreateVariantPlan {
  return createVariantPlanSchema.parse({
    master: blogMirror
      ? { kind: "article", platform: blogMirror.articlePlatform }
      : { kind: "brief" },
    variants: admitted
      .filter((platform) => platform !== blogMirror?.articlePlatform)
      .map((platform) => ({ platform, diverged: false })),
  });
}

/**
 * What the run will cost, before it spends (R6). Two honesty rules from the
 * contract's own docblock are load-bearing here:
 *
 *  - A number that IS knowable is stated. `credits: 0` is not a fabricated
 *    default: no Create dispatch mints. The one-prompt video path's own
 *    invariant is that render/mint spend is structurally impossible on it
 *    (`pipeline/one-prompt-video.ts`), the staged path produces drafts, and
 *    the other three families are text. If that ever stops being true, the
 *    dispatch table changed and this number changes with it.
 *  - A number that is NOT knowable is named, never rendered as 0. The judge
 *    runs one or two tiers per draft depending on whether the screen tier
 *    refuses, so an exact call count cannot be promised — `meteredCalls`
 *    counts the generation calls the dispatch will certainly make, and
 *    `unestimated` says what rides on top.
 */
function deriveCostPreview(brief: CreateBrief, admittedCount: number): {
  credits: number;
  meteredCalls: number;
  unestimated: string[];
} {
  // One generation call per admitted destination for a fan-out; the
  // single-draft families generate once whatever their destination count.
  const generationCalls = brief.family === "post" ? admittedCount : 1;
  // "Plan-visible" (spec §Design/The engine) now that the describer is real:
  // each DESCRIBABLE reference is exactly one metered
  // `create.describe_reference` call, so it is a knowable number and must be
  // stated rather than deferred to `unestimated`. Undescribable references
  // (external — never fetched; audio — not a vision input) cost nothing at
  // all: `referenceDescribability` refuses them before the guard, so
  // counting them here would inflate the preview an operator budgets from.
  const references = brief.media.filter((m) => m.role === "reference");
  const describeCalls = references.filter((m) => referenceDescribability(m.ref).ok).length;
  const undescribable = references.length - describeCalls;
  const unestimated = [
    "judge calls vary — a screen-tier refusal skips the final tier, so the gate costs one or two calls per draft",
  ];
  if (undescribable > 0) {
    unestimated.push(
      `${undescribable} attached reference${undescribable === 1 ? " is" : "s are"} not describable (external references are never fetched; audio is not a vision input) — ${undescribable === 1 ? "it stays" : "they stay"} attached and unanalysed at no cost`,
    );
  }
  if (brief.family === "video") {
    unestimated.push(
      "rendering the cut is a separate armed door and is not part of this run — its mint cost is not previewed here",
    );
  }
  return { credits: 0, meteredCalls: generationCalls + describeCalls, unestimated };
}

/** Every destination key an operator could legitimately name — the sentence in refusal #1 reads this. */
function knownDestinations(): string[] {
  return Object.keys(DESTINATIONS).sort();
}

function dedupe(values: readonly string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}
