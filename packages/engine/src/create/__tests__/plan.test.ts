import {
  CREATE_REFUSAL_CODES,
  DEFAULT_PLATFORM_ROUTING,
  KNOWN_JUDGE_GATES,
  admittedPlatforms,
  createBriefSchema,
  createPlanSchema,
  type CreateBriefInput,
  type CreateRefusalCode,
} from "@thalon/contracts";
import { describe, expect, it } from "vitest";
import {
  CREATE_VARIANT_PLAN_KEY,
  classifyDestination,
  deriveCreatePlan,
  readVariantPlan,
  type CreatePlanContext,
} from "../plan";

/**
 * B-create.2 plan derivation (spec R3/R6/R10, kickoff criterion 1): pure, so
 * every refusal reason is pinned here rather than reproduced through a live
 * generation. The CODE is the contract and the message is the operator's
 * sentence — these tests assert the code, and assert of the message only the
 * property R10 demands: that it names a fix.
 */

const CONNECTED: CreatePlanContext = {
  routing: DEFAULT_PLATFORM_ROUTING,
  connections: {
    linkedin: "connected",
    facebook: "connected",
    bluesky: "connected",
    x: "connected",
    instagram: "connected",
    website_hosted: "connected",
    newsletter_resend: "connected",
  },
};

function brief(overrides: Partial<CreateBriefInput> = {}) {
  return createBriefSchema.parse({
    family: "post",
    mode: "prompt",
    prompt: "announce the new pricing",
    ...overrides,
  });
}

function refusalFor(plan: ReturnType<typeof deriveCreatePlan>, platform: string) {
  const entry = plan.platforms.find((p) => p.platform === platform);
  expect(entry, `no plan entry for "${platform}"`).toBeDefined();
  return entry!;
}

describe("deriveCreatePlan — admission", () => {
  it("admits connected destinations the family can ride, keeping the operator's order", () => {
    const plan = deriveCreatePlan(
      brief({ platforms: ["bluesky", "linkedin", "facebook"] }),
      CONNECTED,
    );
    expect(admittedPlatforms(plan)).toEqual(["bluesky", "linkedin", "facebook"]);
    expect(plan.platforms.every((p) => p.refusal === undefined)).toBe(true);
  });

  it("prefills from family routing ONLY when the brief names no platforms", () => {
    const prefilled = deriveCreatePlan(brief(), CONNECTED);
    expect(admittedPlatforms(prefilled)).toEqual(DEFAULT_PLATFORM_ROUTING.post);

    // The operator's ask is never overridden by the tenant's default.
    const asked = deriveCreatePlan(brief({ platforms: ["bluesky"] }), CONNECTED);
    expect(admittedPlatforms(asked)).toEqual(["bluesky"]);
  });

  it("dedupes a repeated destination instead of generating it twice", () => {
    const plan = deriveCreatePlan(brief({ platforms: ["bluesky", "bluesky", " bluesky "] }), CONNECTED);
    expect(plan.platforms).toHaveLength(1);
  });

  it("derives a plan the frozen contract accepts, and names the harness's own gates", () => {
    const plan = deriveCreatePlan(brief({ platforms: ["bluesky", "youtube"] }), CONNECTED);
    expect(() => createPlanSchema.parse(plan)).not.toThrow();
    expect(plan.judgeGates).toEqual([...KNOWN_JUDGE_GATES]);
  });
});

describe("deriveCreatePlan — every refusal reason, pinned", () => {
  it("unknown_platform: a destination neither registry knows", () => {
    const plan = deriveCreatePlan(brief({ platforms: ["mastodon"] }), CONNECTED);
    const entry = refusalFor(plan, "mastodon");
    expect(entry.admitted).toBe(false);
    expect(entry.refusal?.code).toBe("unknown_platform");
    // R10: the sentence names the fix — here, what the operator may pick instead.
    expect(entry.refusal?.message).toContain("Pick one of:");
  });

  it("channel_not_connected: youtube is a KNOWN platform now, refused for its missing connector (s90)", () => {
    // s87 pinned youtube as unknown_platform citing SETTINGS_DEFERRED; the
    // s90 destination lane resolved that deferral (platform key + capability
    // rows + disarmed driver), so youtube now takes the TikTok-shaped
    // refusal: a real platform whose connector window — the founder's Google
    // portal app — has not landed. Telling the operator to "connect it in
    // Settings" would still point at a card that does not exist yet.
    const entry = refusalFor(deriveCreatePlan(brief({ platforms: ["youtube"] }), CONNECTED), "youtube");
    expect(entry.refusal?.code).toBe("channel_not_connected");
    expect(entry.refusal?.message).toContain("no connector in this build");
    expect(entry.refusal?.message).not.toContain("Settings");
  });

  it("channel_not_connected: a known platform the tenant never connected", () => {
    const entry = refusalFor(
      deriveCreatePlan(brief({ platforms: ["reddit"] }), CONNECTED),
      "reddit",
    );
    expect(entry.refusal?.code).toBe("channel_not_connected");
    expect(entry.refusal?.message).toContain("Settings");
  });

  it("channel_not_connected: a stale credential says RECONNECT, not connect", () => {
    const entry = refusalFor(
      deriveCreatePlan(brief({ platforms: ["reddit"] }), {
        ...CONNECTED,
        connections: { ...CONNECTED.connections, reddit: "needs_reauth" },
      }),
      "reddit",
    );
    expect(entry.refusal?.code).toBe("channel_not_connected");
    expect(entry.refusal?.message).toMatch(/re-?authoris|Reconnect/i);
  });

  it("channel_not_connected: a platform with a capability row but NO connector says so", () => {
    // TikTok is the live example of the split `platform-capability.ts`
    // documents: the matrix describes the platform, the registry decides
    // whether we can reach it. Telling the operator to "connect it in
    // Settings" would point at a card that will never exist.
    const entry = refusalFor(
      deriveCreatePlan(brief({ family: "video", platforms: ["tiktok"] }), CONNECTED),
      "tiktok",
    );
    expect(entry.refusal?.code).toBe("channel_not_connected");
    expect(entry.refusal?.message).toContain("no connector in this build");
    expect(entry.refusal?.message).not.toContain("Settings");
  });

  it("family_platform_mismatch: a video run cannot ride a website destination", () => {
    const entry = refusalFor(
      deriveCreatePlan(brief({ family: "video", platforms: ["website_hosted"] }), CONNECTED),
      "website_hosted",
    );
    expect(entry.refusal?.code).toBe("family_platform_mismatch");
    expect(entry.refusal?.message).toContain("social");
  });

  it("family_platform_mismatch: an intel source is an intake, never a destination", () => {
    const entry = refusalFor(
      deriveCreatePlan(brief({ platforms: ["intel_bluesky"] }), CONNECTED),
      "intel_bluesky",
    );
    expect(entry.refusal?.code).toBe("family_platform_mismatch");
    expect(entry.refusal?.message).toContain("intel source");
  });

  it("media_required: a text-only post to a platform that refuses one", () => {
    const entry = refusalFor(
      deriveCreatePlan(brief({ platforms: ["instagram"] }), CONNECTED),
      "instagram",
    );
    expect(entry.refusal?.code).toBe("media_required");
  });

  it("media_required: REFERENCE media cannot satisfy it — the licensing wall, in the plan", () => {
    // A reference informs generation and never rides the post, so it can
    // never be the image a platform is demanding. If this ever passes with
    // only a reference attached, reference bytes are one step from being
    // published as ours.
    const referenceOnly = brief({
      platforms: ["instagram"],
      media: [
        {
          ref: { kind: "stored", sha256: "a".repeat(64), ext: "jpg" },
          provenance: "operator",
          role: "reference",
        },
      ],
    });
    expect(refusalFor(deriveCreatePlan(referenceOnly, CONNECTED), "instagram").refusal?.code).toBe(
      "media_required",
    );

    const withUse = brief({
      platforms: ["instagram"],
      media: [
        {
          ref: { kind: "stored", sha256: "a".repeat(64), ext: "jpg" },
          provenance: "operator",
          role: "reference",
        },
        {
          ref: { kind: "stored", sha256: "b".repeat(64), ext: "jpg" },
          provenance: "operator",
          role: "use",
        },
      ],
    });
    expect(deriveCreatePlan(withUse, CONNECTED).platforms[0].admitted).toBe(true);
  });

  it("media_required never fires for video — the run's own output IS the media", () => {
    const entry = refusalFor(
      deriveCreatePlan(brief({ family: "video", platforms: ["instagram"] }), CONNECTED),
      "instagram",
    );
    expect(entry.admitted).toBe(true);
  });

  it("pins the whole refusal vocabulary — a new code cannot land untested", () => {
    const seen = new Set<CreateRefusalCode>();
    for (const [platforms, context] of [
      [["mastodon"], CONNECTED],
      [["reddit"], CONNECTED],
      [["intel_bluesky"], CONNECTED],
      [["instagram"], CONNECTED],
    ] as const) {
      for (const entry of deriveCreatePlan(brief({ platforms: [...platforms] }), context).platforms) {
        if (entry.refusal) seen.add(entry.refusal.code);
      }
    }
    expect([...seen].sort()).toEqual([...CREATE_REFUSAL_CODES].sort());
  });
});

describe("deriveCreatePlan — the refusal ladder's order", () => {
  it("an unknown destination is unknown, never 'not connected'", () => {
    // "Connect it" is not a fix for a destination with nothing to connect.
    const entry = refusalFor(deriveCreatePlan(brief({ platforms: ["mastodon"] }), CONNECTED), "mastodon");
    expect(entry.refusal?.code).toBe("unknown_platform");
  });

  it("a mismatched destination reports the mismatch even when it is also disconnected", () => {
    const entry = refusalFor(
      deriveCreatePlan(brief({ family: "page", platforms: ["reddit"] }), {
        ...CONNECTED,
        connections: {},
      }),
      "reddit",
    );
    expect(entry.refusal?.code).toBe("family_platform_mismatch");
  });

  it("a disconnected media-demanding platform reports the connection first", () => {
    // Attaching an image cannot help a channel that is not connected, so the
    // rung the operator can act on comes last.
    const entry = refusalFor(
      deriveCreatePlan(brief({ platforms: ["instagram"] }), { ...CONNECTED, connections: {} }),
      "instagram",
    );
    expect(entry.refusal?.code).toBe("channel_not_connected");
  });
});

describe("deriveCreatePlan — blog-mirror pairing (s70c)", () => {
  it("pairs the article with its social mirrors when a post run carries one website destination", () => {
    const plan = deriveCreatePlan(
      brief({ platforms: ["website_hosted", "linkedin", "bluesky"] }),
      CONNECTED,
    );
    expect(plan.blogMirror).toEqual({
      articlePlatform: "website_hosted",
      mirrorPlatforms: ["linkedin", "bluesky"],
    });
  });

  it("records the article even when nothing mirrors it", () => {
    const plan = deriveCreatePlan(brief({ platforms: ["website_hosted"] }), CONNECTED);
    expect(plan.blogMirror).toEqual({ articlePlatform: "website_hosted", mirrorPlatforms: [] });
  });

  it("pairs nothing when a refused website destination never made the run", () => {
    const plan = deriveCreatePlan(brief({ platforms: ["website_ghost", "linkedin"] }), CONNECTED);
    expect(plan.blogMirror).toBeUndefined();
  });

  it("pairs nothing for two article destinations — there is no single master to pair against", () => {
    const plan = deriveCreatePlan(brief({ platforms: ["website_hosted", "website_ghost", "linkedin"] }), {
      ...CONNECTED,
      connections: { ...CONNECTED.connections, website_ghost: "connected" },
    });
    expect(plan.blogMirror).toBeUndefined();
  });

  it("pairs nothing for a non-post family", () => {
    expect(
      deriveCreatePlan(brief({ family: "page", platforms: ["website_hosted"] }), CONNECTED)
        .blogMirror,
    ).toBeUndefined();
  });
});

describe("deriveCreatePlan — variant provenance groundwork (R13)", () => {
  it("makes the article the master and every social destination a fork of it", () => {
    const plan = deriveCreatePlan(
      brief({ platforms: ["website_hosted", "linkedin", "bluesky"] }),
      CONNECTED,
    );
    expect(readVariantPlan(plan)).toEqual({
      master: { kind: "article", platform: "website_hosted" },
      variants: [
        { platform: "linkedin", diverged: false },
        { platform: "bluesky", diverged: false },
      ],
    });
  });

  it("names the BRIEF as master when no article exists — 're-derive from master' needs to know", () => {
    const plan = deriveCreatePlan(brief({ platforms: ["linkedin", "bluesky"] }), CONNECTED);
    expect(readVariantPlan(plan)?.master).toEqual({ kind: "brief" });
  });

  it("no variant starts diverged, and refused destinations are not variants", () => {
    const plan = deriveCreatePlan(brief({ platforms: ["linkedin", "reddit"] }), CONNECTED);
    expect(readVariantPlan(plan)?.variants).toEqual([{ platform: "linkedin", diverged: false }]);
  });

  it("survives the contract's own round-trip — the plan is stored as jsonb", () => {
    const plan = deriveCreatePlan(brief({ platforms: ["linkedin"] }), CONNECTED);
    const reparsed = createPlanSchema.parse(JSON.parse(JSON.stringify(plan)));
    expect(readVariantPlan(reparsed)).toEqual(readVariantPlan(plan));
    expect(plan.family[CREATE_VARIANT_PLAN_KEY]).toBeDefined();
  });
});

describe("deriveCreatePlan — cost preview (R6)", () => {
  it("counts one generation call per admitted destination for a fan-out", () => {
    const plan = deriveCreatePlan(brief({ platforms: ["linkedin", "bluesky", "reddit"] }), CONNECTED);
    expect(plan.costPreview?.meteredCalls).toBe(2);
  });

  it("counts ONE call for the single-draft families however many destinations they carry", () => {
    const plan = deriveCreatePlan(
      brief({ family: "page", platforms: ["website_hosted"] }),
      CONNECTED,
    );
    expect(plan.costPreview?.meteredCalls).toBe(1);
  });

  it("never renders an unknowable cost as a number — the judge's tier count is NAMED", () => {
    const plan = deriveCreatePlan(brief({ platforms: ["linkedin"] }), CONNECTED);
    expect(plan.costPreview?.unestimated.some((line) => line.includes("judge"))).toBe(true);
  });

  it("names the video mint it does NOT preview, rather than implying 0 covers it", () => {
    const plan = deriveCreatePlan(brief({ family: "video", platforms: ["facebook"] }), CONNECTED);
    expect(plan.costPreview?.credits).toBe(0);
    expect(plan.costPreview?.unestimated.some((line) => line.includes("render"))).toBe(true);
  });

  it("COUNTS each describable reference — one describe call each, now that the describer is real", () => {
    // "plan-visible" (spec §Design/The engine). Before the shell landed this
    // was an `unestimated` line; a knowable number must be stated, and one
    // metered `create.describe_reference` call per describable reference is
    // knowable. One generation call (linkedin) + two describes = 3.
    const plan = deriveCreatePlan(
      brief({
        platforms: ["linkedin"],
        media: [
          {
            ref: { kind: "stored", sha256: "c".repeat(64), ext: "png" },
            provenance: "operator",
            role: "reference",
          },
          {
            ref: { kind: "stored", sha256: "d".repeat(64), ext: "jpg" },
            provenance: "operator",
            role: "reference",
          },
          // `use` media rides the draft as itself and is never described.
          {
            ref: { kind: "stored", sha256: "e".repeat(64), ext: "jpg" },
            provenance: "operator",
            role: "use",
          },
        ],
      }),
      CONNECTED,
    );
    expect(plan.costPreview?.meteredCalls).toBe(3);
    expect(plan.costPreview?.unestimated.some((line) => line.includes("reference"))).toBe(false);
  });

  it("does NOT count references it will refuse to describe — the preview matches what the run spends", () => {
    const plan = deriveCreatePlan(
      brief({
        platforms: ["linkedin"],
        media: [
          // External: never fetched. Audio: not a vision input. Both are
          // refused before the guard, so both cost exactly nothing — counting
          // them would inflate the number an operator budgets from.
          {
            ref: { kind: "external", url: "https://example.com/a.jpg" },
            provenance: "operator",
            role: "reference",
          },
          {
            ref: { kind: "stored", sha256: "f".repeat(64), ext: "mp3" },
            provenance: "operator",
            role: "reference",
          },
        ],
      }),
      CONNECTED,
    );
    expect(plan.costPreview?.meteredCalls).toBe(1);
    // Named, not silent: the operator attached two references and gets told
    // why neither will be analysed (R10).
    expect(
      plan.costPreview?.unestimated.some((line) => line.includes("not describable")),
    ).toBe(true);
  });
});

describe("deriveCreatePlan — discoverability terms", () => {
  it("carries the Intel chip's keyword as a candidate", () => {
    const plan = deriveCreatePlan(
      brief({ platforms: ["linkedin"], context: { keyword: "usage-based pricing", kind: "trend_promote" } }),
      CONNECTED,
    );
    expect(plan.targetTerms).toEqual(["usage-based pricing"]);
  });

  it("carries none when the brief was not seeded from Intel", () => {
    expect(deriveCreatePlan(brief({ platforms: ["linkedin"] }), CONNECTED).targetTerms).toEqual([]);
  });

  it("ignores an unrecognisable context rather than failing the run", () => {
    const plan = deriveCreatePlan(
      brief({ platforms: ["linkedin"], context: { keyword: 42 } as Record<string, unknown> }),
      CONNECTED,
    );
    expect(plan.targetTerms).toEqual([]);
  });
});

describe("classifyDestination", () => {
  it("reads the connector registry first, then the platform vocabulary", () => {
    expect(classifyDestination("linkedin")).toBe("social");
    expect(classifyDestination("website_hosted")).toBe("website");
    expect(classifyDestination("newsletter_resend")).toBe("newsletter");
    expect(classifyDestination("intel_youtube")).toBe("intel");
    // In SOCIAL_PLATFORMS, absent from DESTINATIONS — known, unreachable.
    expect(classifyDestination("tiktok")).toBe("social");
    expect(classifyDestination("mastodon")).toBe("unknown");
  });
});
