import { describe, expect, it } from "vitest";
import { brandProfileConfigSchema } from "../brand-profile";
import {
  CREATE_CHILD_KINDS,
  CREATE_FAMILIES,
  DEFAULT_PLATFORM_ROUTING,
  admittedPlatforms,
  createBriefSchema,
  createChildRefsSchema,
  createPlanSchema,
  platformRoutingSchema,
} from "../create-run";
import { postDraftMetaSchema } from "../format-registry";
import {
  MEDIA_ROLES,
  isReferenceOnly,
  mediaRefEnvelopeSchema,
  mediaRole,
  outputEligible,
} from "../media";
import {
  SETTINGS_DEFERRED,
  SETTINGS_PLATFORMS,
  platformSettingsSchema,
} from "../platform-settings";
import { SOCIAL_PLATFORMS } from "../social";

/**
 * s87 contract window: the Create run shapes (B-create.1), media roles, the
 * family-routing config block, and the D3 per-platform settings slice.
 * Additivity is proven here, not asserted in prose — every pre-window shape
 * must still parse to the same object it did before this window existed.
 */

const STORED_REF = {
  kind: "stored" as const,
  sha256: "a".repeat(64),
  ext: "webp" as const,
};

/* ------------------------------------------------------------------ */
/* Media roles — the licensing wall.                                    */
/* ------------------------------------------------------------------ */

describe("media roles (s87)", () => {
  it("ADDITIVITY: a pre-window envelope parses byte-identically — role stays ABSENT, never defaulted in", () => {
    const input = { ref: STORED_REF, provenance: "captured" as const };
    const parsed = mediaRefEnvelopeSchema.parse(input);
    expect(parsed).toEqual(input);
    expect("role" in parsed).toBe(false);
  });

  it("absence reads as `use` in exactly one place, so no two call sites can disagree", () => {
    expect(mediaRole({})).toBe("use");
    expect(mediaRole({ role: "use" })).toBe("use");
    expect(mediaRole({ role: "reference" })).toBe("reference");
    expect(MEDIA_ROLES).toEqual(["use", "reference"]);
  });

  it("THE LICENSING WALL: reference-role media is never output-eligible", () => {
    // This is the whole point of the two-role model. A reference is material
    // we may hold no right to publish — it informs generation and stops
    // there. `outputEligible` is the one filter, so a future third role
    // cannot quietly land on the publish side of the wall.
    const media = [
      { ref: STORED_REF, provenance: "operator" as const, role: "use" as const },
      { ref: STORED_REF, provenance: "operator" as const, role: "reference" as const },
      { ref: STORED_REF, provenance: "captured" as const },
    ];
    expect(outputEligible(media)).toHaveLength(2);
    expect(outputEligible(media).every((m) => !isReferenceOnly(m))).toBe(true);
    expect(media.filter(isReferenceOnly)).toHaveLength(1);
  });

  it("an unknown role is refused rather than carried as data", () => {
    expect(
      mediaRefEnvelopeSchema.safeParse({
        ref: STORED_REF,
        provenance: "operator",
        role: "inspiration",
      }).success,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* The brief.                                                           */
/* ------------------------------------------------------------------ */

describe("createBriefSchema (s87)", () => {
  it("a minimal prompt-mode brief parses and defaults its collections to empty", () => {
    const brief = createBriefSchema.parse({
      family: "post",
      mode: "prompt",
      prompt: "A launch note.",
    });
    expect(brief.platforms).toEqual([]);
    expect(brief.sourceRefs).toEqual([]);
    expect(brief.media).toEqual([]);
  });

  it("media role is REQUIRED at the Create attach door (R4: explicit, never inferred)", () => {
    // The general envelope tolerates absence for pre-window media; the
    // attach door does not, because the operator is making a
    // licensing-relevant declaration.
    expect(
      createBriefSchema.safeParse({
        family: "post",
        mode: "wizard",
        media: [{ ref: STORED_REF, provenance: "operator" }],
      }).success,
    ).toBe(false);
    const ok = createBriefSchema.parse({
      family: "post",
      mode: "wizard",
      media: [{ ref: STORED_REF, provenance: "operator", role: "reference" }],
    });
    expect(ok.media[0].role).toBe("reference");
  });

  it("refuses an unknown family and an unknown authoring mode", () => {
    expect(createBriefSchema.safeParse({ family: "podcast", mode: "prompt" }).success).toBe(false);
    expect(createBriefSchema.safeParse({ family: "post", mode: "osmosis" }).success).toBe(false);
    expect(CREATE_FAMILIES).toEqual(["post", "video", "page", "email"]);
  });
});

/* ------------------------------------------------------------------ */
/* The plan.                                                            */
/* ------------------------------------------------------------------ */

describe("createPlanSchema (s87)", () => {
  it("a refused platform MUST say why — R10 made structural, not remembered", () => {
    const silent = createPlanSchema.safeParse({
      platforms: [{ platform: "instagram", admitted: false }],
    });
    expect(silent.success).toBe(false);
    const spoken = createPlanSchema.parse({
      platforms: [
        {
          platform: "instagram",
          admitted: false,
          refusal: {
            code: "media_required",
            message: "Instagram refuses text-only posts — attach an image to this run.",
          },
        },
      ],
    });
    expect(spoken.platforms[0].refusal?.code).toBe("media_required");
  });

  it("an admitted platform cannot also carry a refusal (the two are bound, not conventional)", () => {
    expect(
      createPlanSchema.safeParse({
        platforms: [
          {
            platform: "bluesky",
            admitted: true,
            refusal: { code: "unknown_platform", message: "n/a" },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("every refusal code is a real word the derivation can use", () => {
    for (const code of [
      "unknown_platform",
      "channel_not_connected",
      "family_platform_mismatch",
      "media_required",
    ] as const) {
      const plan = createPlanSchema.parse({
        platforms: [{ platform: "x", admitted: false, refusal: { code, message: "because." } }],
      });
      expect(plan.platforms[0].refusal?.code).toBe(code);
    }
    expect(
      createPlanSchema.safeParse({
        platforms: [
          { platform: "x", admitted: false, refusal: { code: "vibes", message: "no" } },
        ],
      }).success,
    ).toBe(false);
  });

  it("admittedPlatforms names exactly what the run will generate for", () => {
    const plan = createPlanSchema.parse({
      platforms: [
        { platform: "bluesky", admitted: true },
        { platform: "linkedin", admitted: true },
        {
          platform: "instagram",
          admitted: false,
          refusal: { code: "media_required", message: "needs media." },
        },
      ],
    });
    expect(admittedPlatforms(plan)).toEqual(["bluesky", "linkedin"]);
  });

  it("a cost that cannot be estimated says so — never a 0 that reads as free", () => {
    const plan = createPlanSchema.parse({
      costPreview: { unestimated: ["video mint price depends on the model the beat picks"] },
    });
    expect(plan.costPreview?.credits).toBeUndefined();
    expect(plan.costPreview?.unestimated).toHaveLength(1);
  });
});

describe("createChildRefsSchema (s87)", () => {
  it("carries a partial run: one child ran, one recorded its verbatim refusal", () => {
    const children = createChildRefsSchema.parse([
      { kind: "fanout_run", id: "run-1" },
      { kind: "draft", id: "draft-9", error: "instagram refused: media required" },
    ]);
    expect(children[1].error).toBe("instagram refused: media required");
    expect(CREATE_CHILD_KINDS).toEqual(["fanout_run", "draft", "video_project"]);
  });

  it("refuses a child kind no family engine produces", () => {
    expect(createChildRefsSchema.safeParse([{ kind: "email_send", id: "x" }]).success).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Family routing — and the trap of confusing it with `routing`.        */
/* ------------------------------------------------------------------ */

describe("platformRouting (s87)", () => {
  it("ADDITIVITY: a pre-window config parses byte-identically — platformRouting stays ABSENT", () => {
    const config = brandProfileConfigSchema.parse({ voice: { register: "plain" } });
    expect("platformRouting" in config).toBe(false);
  });

  it("is keyed by CREATE FAMILY, while `routing` is keyed by content bucket — both can coexist", () => {
    // The two blocks answer different questions and must never be collapsed:
    // family routing PREFILLS the wizard's platform step; bucket routing
    // decides an individual fan-out. A tenant holding both is normal.
    const config = brandProfileConfigSchema.parse({
      routing: { "product-updates": ["linkedin"] },
      platformRouting: { video: ["tiktok", "instagram"] },
    });
    expect(config.routing?.["product-updates"]).toEqual(["linkedin"]);
    expect(config.platformRouting?.video).toEqual(["tiktok", "instagram"]);
  });

  it("an unroutable family key is a typo, not data", () => {
    expect(platformRoutingSchema.safeParse({ podcast: ["spotify"] }).success).toBe(false);
  });

  it("PARTIAL maps parse — the zod-4 exhaustive-record trap, pinned so nobody reverts it", () => {
    // `z.record()` over an enum key is EXHAUSTIVE in zod 4: it would demand
    // every family be routed at once, so a tenant routing only video would
    // fail to parse. This window's first cut did exactly that and this test
    // is what caught it. `partialRecord` is the fix; this pins it.
    expect(platformRoutingSchema.safeParse({ video: ["tiktok"] }).success).toBe(true);
    expect(platformRoutingSchema.safeParse({}).success).toBe(true);
    const full = platformRoutingSchema.parse({
      post: ["linkedin"],
      video: ["tiktok"],
      page: ["own-site"],
      email: ["list"],
    });
    expect(Object.keys(full)).toHaveLength(4);
  });

  it("destination VALUES stay free-form — the engine is generic about where content goes", () => {
    // Plan derivation is where an unreachable destination earns its
    // `unknown_platform` refusal; storage does not pre-judge it.
    expect(platformRoutingSchema.safeParse({ page: ["own-site"] }).success).toBe(true);
  });

  it("the demo default ships only destinations the engine can actually reach today", () => {
    const reachable = new Set<string>(SOCIAL_PLATFORMS);
    for (const destinations of Object.values(DEFAULT_PLATFORM_ROUTING)) {
      for (const destination of destinations ?? []) {
        expect(reachable, `default routing names "${destination}", which has no driver`).toContain(
          destination,
        );
      }
    }
    // page/email have exactly one destination each, so routing them decides
    // nothing — absence is more truthful than a one-element array.
    expect("page" in DEFAULT_PLATFORM_ROUTING).toBe(false);
    expect("email" in DEFAULT_PLATFORM_ROUTING).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* D3 per-platform settings slice.                                      */
/* ------------------------------------------------------------------ */

describe("platform settings (s87 D3 slice)", () => {
  it("declares a settings shape for EVERY platform — silence would read as 'no settings'", () => {
    const declared = Object.keys(platformSettingsSchema.shape).filter((k) => k !== "video");
    expect(declared.sort()).toEqual([...SETTINGS_PLATFORMS].sort());
    expect([...SETTINGS_PLATFORMS].sort()).toEqual([...SOCIAL_PLATFORMS].sort());
  });

  it("the YouTube gap is a VALUE a test reads, so it cannot quietly outlive its truth", () => {
    // Both specs name YouTube's title/thumbnail/made-for-kids settings.
    // There is no youtube platform key, capability row or driver — so the
    // day one lands, this fails until the deferral is resolved rather than
    // sitting in a docblock nobody re-reads.
    expect(Object.keys(SETTINGS_DEFERRED)).toContain("youtube");
    for (const deferred of Object.keys(SETTINGS_DEFERRED)) {
      expect(
        SOCIAL_PLATFORMS as readonly string[],
        `"${deferred}" is now a real platform — give it a settings schema and drop the deferral`,
      ).not.toContain(deferred);
    }
  });

  it("TikTok's video variant carries the fields the video spec names", () => {
    const settings = platformSettingsSchema.parse({
      tiktok: { privacy: "public", allowDuet: false, allowStitch: true, brandedContent: true },
      video: { coverFrameMs: 12_000 },
    });
    expect(settings.tiktok?.allowDuet).toBe(false);
    expect(settings.video?.coverFrameMs).toBe(12_000);
  });

  it("the cover frame belongs to the CUT, not to a tab — there is exactly one per run", () => {
    // Five tabs each owning a cover frame would let one video drift to five
    // posters, which no operator ever means.
    expect("coverFrameMs" in platformSettingsSchema.shape).toBe(false);
    expect(
      platformSettingsSchema.safeParse({ linkedin: { coverFrameMs: 0 } }).success,
    ).toBe(false);
  });

  it("refuses a knob a platform does not have (strict shapes, not permissive bags)", () => {
    expect(platformSettingsSchema.safeParse({ bluesky: { visibility: "anyone" } }).success).toBe(
      false,
    );
    expect(platformSettingsSchema.safeParse({ linkedin: { allowDuet: true } }).success).toBe(false);
  });

  it("empty strings are refused rather than quietly meaning 'off' (the alt-text convention)", () => {
    expect(platformSettingsSchema.safeParse({ linkedin: { firstComment: "" } }).success).toBe(
      false,
    );
  });

  it("reddit's per-post subreddit override keeps the bare-name rule of its cadence config", () => {
    expect(platformSettingsSchema.safeParse({ reddit: { subreddit: "r/test" } }).success).toBe(
      false,
    );
    expect(platformSettingsSchema.safeParse({ reddit: { subreddit: "test" } }).success).toBe(true);
  });

  it("ADDITIVITY: a pre-window post draft meta parses byte-identically", () => {
    const legacy = {
      promptVersion: "fanout.v1",
      brandProfileVersion: 3,
      platformProfileVersion: "linkedin.v2",
    };
    const parsed = postDraftMetaSchema.parse(legacy);
    expect(parsed).toEqual(legacy);
    expect("platformSettings" in parsed).toBe(false);
    // …and the new home works when the Composer does write settings.
    const withSettings = postDraftMetaSchema.parse({
      ...legacy,
      platformSettings: { linkedin: { visibility: "connections" } },
    });
    expect(withSettings.platformSettings?.linkedin?.visibility).toBe("connections");
  });
});
