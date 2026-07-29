import {
  DEFAULT_PLATFORM_ROUTING,
  brandProfileConfigSchema,
  createPlanSchema,
  tenantCtx,
  type CreateBriefInput,
  type TenantCtx,
} from "@thalon/contracts";
import { InvalidStateError, openTestDb, type DbHandle, type Repos } from "@thalon/db";
import type { JudgeModelDriver } from "@thalon/judge";
import { afterEach, describe, expect, it } from "vitest";
import { createFakeStoryboardStageDriver, createFakeDirectionScenesDriver, createFakeDirectionPolishDriver } from "../../direction/shell/generator";
import { createFakeDraftGeneratorDriver } from "../../fanout/shell/generator";
import { createFakeEmbeddingDriver } from "../../ingest/shell/embedder";
import { createFakeOutreachEmailDriver } from "../../outreach/shell/generator";
import { createFakeWebPageDriver } from "../../webpage/shell/generator";
import {
  DEFAULT_CREATE_DISPATCH,
  type CreateDispatchInput,
  type CreateDispatchTable,
  type CreateJudgeDeps,
} from "../dispatch";
import { readVariantPlan, type CreatePlanContext } from "../plan";
import { createFakeReferenceVisionDriver } from "../reference";
import {
  createGenerationKey,
  loadPlanContext,
  renderWizardSlots,
  runCreate,
  type CreateRunDeps,
} from "../run";

/**
 * B-create.2 orchestrator (kickoff criteria 2, 3, 4, 6), keyless and
 * networkless: every generation driver, judge driver and vision driver here
 * is a fake, so the whole suite runs at zero spend — which is also the
 * lane's shipping posture.
 */

let handle: DbHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const JUDGE_PASS = { verdict: "pass" as const, claims: [{ claim: "grounded", supported: true, chunkRef: "c1" }] };
const JUDGE_FAIL = { verdict: "fail" as const, claims: [{ claim: "ungrounded", supported: false }] };

function judgeDriver(candidate: unknown): JudgeModelDriver {
  return async () => ({ candidate, tokensIn: 1, tokensOut: 1 });
}

function passJudge(): CreateJudgeDeps {
  return {
    screenDriver: judgeDriver(JUDGE_PASS),
    finalDriver: judgeDriver(JUDGE_PASS),
    capTokens: 1_000_000,
  };
}

const CONNECTED: CreatePlanContext = {
  routing: DEFAULT_PLATFORM_ROUTING,
  connections: {
    linkedin: "connected",
    facebook: "connected",
    bluesky: "connected",
    x: "connected",
    website_hosted: "connected",
    newsletter_resend: "connected",
  },
};

interface Fx {
  ctx: TenantCtx;
  repos: Repos;
  /** Every generation driver a real-dispatch run can reach, all fake. */
  deps: (overrides?: Partial<CreateRunDeps>) => CreateRunDeps;
  generatedPlatforms: string[];
}

async function fixture(): Promise<Fx> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  const ctx = tenantCtx(tenant.id);
  await repos.brandProfiles.create(ctx, {
    config: { voice: { register: "plain" }, denylist: [], platformProfiles: {} },
    activate: true,
  });
  const generatedPlatforms: string[] = [];
  const fanoutDriver = createFakeDraftGeneratorDriver();
  const deps = (overrides: Partial<CreateRunDeps> = {}): CreateRunDeps => ({
    judge: passJudge(),
    planContext: CONNECTED,
    generation: {
      fanout: {
        driver: async (req) => {
          generatedPlatforms.push(req.platform);
          return fanoutDriver(req);
        },
        capTokens: 1_000_000,
      },
      webpage: { driver: createFakeWebPageDriver(), capTokens: 1_000_000 },
      outreach: { driver: createFakeOutreachEmailDriver(), capTokens: 1_000_000 },
      staged: {
        structureDriver: createFakeStoryboardStageDriver(),
        scenesDriver: createFakeDirectionScenesDriver(),
        polishDriver: createFakeDirectionPolishDriver(),
        capTokens: 1_000_000,
      },
      ingest: { embedder: createFakeEmbeddingDriver(), capTokens: 1_000_000 },
    },
    ...overrides,
  });
  return { ctx, repos, deps, generatedPlatforms };
}

function postBrief(overrides: Partial<CreateBriefInput> = {}): CreateBriefInput {
  return {
    family: "post",
    mode: "prompt",
    prompt: "We shipped usage-based pricing today. It halves the entry cost.",
    platforms: ["bluesky", "linkedin"],
    ...overrides,
  };
}

/** A dispatch table that records what it was handed and produces one fake child. */
function recordingDispatch(): {
  table: CreateDispatchTable;
  calls: CreateDispatchInput[];
} {
  const calls: CreateDispatchInput[] = [];
  const arm = (input: CreateDispatchInput) => {
    calls.push(input);
    return [
      {
        label: "fake",
        run: async () => [{ kind: "fanout_run" as const, id: "00000000-0000-4000-8000-00000000fa11" }],
      },
    ];
  };
  return { table: { post: arm, video: arm, page: arm, email: arm }, calls };
}

/* ------------------------------------------------------------------ */

describe("runCreate — the run of record (R1)", () => {
  it("records brief, plan and children, and lands every draft judged", async () => {
    const fx = await fixture();
    const result = await runCreate(fx.ctx, fx.repos, postBrief(), fx.deps());

    expect(result.run.status).toBe("complete");
    expect(result.run.family).toBe("post");
    expect(result.failures).toEqual([]);
    // One fan-out anchor + one draft per destination.
    expect(result.children.filter((c) => c.kind === "fanout_run")).toHaveLength(2);
    const drafts = result.children.filter((c) => c.kind === "draft");
    expect(drafts).toHaveLength(2);
    expect(fx.generatedPlatforms.sort()).toEqual(["bluesky", "linkedin"]);

    // The judge is the only path onward: a Create run never leaves drafts
    // sitting in `generated`, and it never sets a status itself.
    for (const child of drafts) {
      const draft = await fx.repos.drafts.get(fx.ctx, child.id);
      expect(draft.status).toBe("queued");
    }

    const stored = await fx.repos.createRuns.get(fx.ctx, result.run.id);
    expect(stored?.children).toHaveLength(4);
    expect((stored?.brief as { prompt?: string }).prompt).toBe(postBrief().prompt);
    expect((stored?.plan as { platforms: unknown[] }).platforms).toHaveLength(2);
    // R13 groundwork lands ON THE ROW, which is where the Composer reads it.
    expect(readVariantPlan(createPlanSchema.parse(stored?.plan))).toEqual({
      master: { kind: "brief" },
      variants: [
        { platform: "bluesky", diverged: false },
        { platform: "linkedin", diverged: false },
      ],
    });
  });

  it("is idempotent: a double-clicked Generate returns the first run with zero generation calls", async () => {
    const fx = await fixture();
    const first = await runCreate(fx.ctx, fx.repos, postBrief(), fx.deps());
    const callsAfterFirst = fx.generatedPlatforms.length;

    const second = await runCreate(fx.ctx, fx.repos, postBrief(), fx.deps());
    expect(second.dispatched).toBe(false);
    expect(second.run.id).toBe(first.run.id);
    expect(second.children).toEqual(first.children);
    // A Create run SPENDS — this is the money guard, not a nicety.
    expect(fx.generatedPlatforms.length).toBe(callsAfterFirst);
  });

  it("re-dispatches an INCOMPLETE run and converges instead of doubling its children", async () => {
    const fx = await fixture();
    let failNext = true;
    const flaky = fx.deps({
      generation: {
        ...fx.deps().generation,
        fanout: {
          driver: async (req) => {
            if (req.platform === "linkedin" && failNext) throw new Error("shell melted");
            fx.generatedPlatforms.push(req.platform);
            return createFakeDraftGeneratorDriver()(req);
          },
          capTokens: 1_000_000,
        },
      },
    });

    const failed = await runCreate(fx.ctx, fx.repos, postBrief(), flaky);
    expect(failed.run.status).toBe("failed");
    expect(failed.children.filter((c) => c.kind === "draft")).toHaveLength(1);

    failNext = false;
    const retried = await runCreate(fx.ctx, fx.repos, postBrief(), flaky);
    expect(retried.run.id).toBe(failed.run.id);
    expect(retried.run.status).toBe("complete");
    // `recordChildren` replaces the whole set, so the bluesky draft that
    // already existed appears exactly once — not twice.
    expect(retried.children.filter((c) => c.kind === "draft")).toHaveLength(2);
    expect(new Set(retried.children.map((c) => c.id)).size).toBe(retried.children.length);
    // And the stale failure is cleared rather than worn forever.
    expect(retried.run.lastError).toBeNull();
  });
});

describe("runCreate — the judge is never bypassed (criterion 2)", () => {
  it("hands each family arm the caller's judge deps, intact and unwrapped", async () => {
    const fx = await fixture();
    const { table, calls } = recordingDispatch();
    const judge = passJudge();
    await runCreate(fx.ctx, fx.repos, postBrief(), fx.deps({ judge, dispatch: table }));

    expect(calls).toHaveLength(1);
    // Identity, not equality: the orchestrator forwards the drivers it was
    // given. It cannot substitute a permissive one because it never builds
    // one — this module constructs no gateway driver anywhere.
    expect(calls[0].judge).toBe(judge);
    expect(calls[0].judge.screenDriver).toBe(judge.screenDriver);
    expect(calls[0].judge.finalDriver).toBe(judge.finalDriver);
  });

  it("makes no judge call of its own — every gate belongs to the family engine", async () => {
    const fx = await fixture();
    let judgeCalls = 0;
    const counting: CreateJudgeDeps = {
      screenDriver: async (req) => {
        judgeCalls += 1;
        return judgeDriver(JUDGE_PASS)(req);
      },
      finalDriver: async (req) => {
        judgeCalls += 1;
        return judgeDriver(JUDGE_PASS)(req);
      },
      capTokens: 1_000_000,
    };
    const { table } = recordingDispatch();
    await runCreate(fx.ctx, fx.repos, postBrief(), fx.deps({ judge: counting, dispatch: table }));
    expect(judgeCalls).toBe(0);
  });

  it("records a judge REFUSAL as a child with its verbatim reason — and still completes", async () => {
    const fx = await fixture();
    const result = await runCreate(
      fx.ctx,
      fx.repos,
      postBrief({ platforms: ["bluesky"] }),
      fx.deps({
        judge: {
          screenDriver: judgeDriver(JUDGE_FAIL),
          finalDriver: judgeDriver(JUDGE_FAIL),
          capTokens: 1_000_000,
        },
      }),
    );

    const draft = result.children.find((c) => c.kind === "draft");
    expect(draft?.error).toContain("judge blocked");
    // The gate spoke, which is the gate WORKING. A refusal is an outcome
    // with a reason attached, not a crash — only an exception fails a run.
    expect(result.run.status).toBe("complete");
    expect(result.failures).toEqual([]);
    const stored = await fx.repos.drafts.get(fx.ctx, draft!.id);
    expect(stored.status).toBe("blocked");
  });
});

describe("runCreate — partial failure (criterion 3)", () => {
  it("records the failed destination verbatim and lets the others through", async () => {
    const fx = await fixture();
    const result = await runCreate(
      fx.ctx,
      fx.repos,
      postBrief({ platforms: ["bluesky", "linkedin", "facebook"] }),
      fx.deps({
        generation: {
          ...fx.deps().generation,
          fanout: {
            driver: async (req) => {
              if (req.platform === "linkedin") throw new Error("shell returned nothing usable");
              fx.generatedPlatforms.push(req.platform);
              return createFakeDraftGeneratorDriver()(req);
            },
            capTokens: 1_000_000,
          },
        },
      }),
    );

    expect(fx.generatedPlatforms.sort()).toEqual(["bluesky", "facebook"]);
    expect(result.children.filter((c) => c.kind === "draft")).toHaveLength(2);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain("linkedin");
    // Verbatim: the family engine names itself and its platform, and
    // rewording it here would cost the operator the detail that locates it.
    expect(result.failures[0]).toContain("shell returned nothing usable");
    expect(result.run.lastError).toContain("shell returned nothing usable");
    // A run that lost a destination is NOT the word an operator scans for
    // when they want to know everything shipped.
    expect(result.run.status).toBe("failed");
  });

  it("records the refusals and spends nothing when every destination is refused", async () => {
    const fx = await fixture();
    const result = await runCreate(
      fx.ctx,
      fx.repos,
      postBrief({ platforms: ["reddit", "mastodon"] }),
      fx.deps(),
    );

    expect(fx.generatedPlatforms).toEqual([]);
    expect(result.children).toEqual([]);
    expect(result.run.status).toBe("failed");
    // The ask is still on the record, with the reason the operator needs.
    expect(result.run.lastError).toContain("reddit");
    expect(result.run.lastError).toContain("mastodon");
  });
});

describe("runCreate — the licensing wall (criterion 4)", () => {
  const REFERENCE_SHA = "d".repeat(64);
  const USE_SHA = "e".repeat(64);

  function briefWithBothRoles(): CreateBriefInput {
    return postBrief({
      platforms: ["bluesky"],
      media: [
        {
          ref: { kind: "stored", sha256: USE_SHA, ext: "jpg" },
          provenance: "operator",
          role: "use",
        },
        {
          ref: { kind: "stored", sha256: REFERENCE_SHA, ext: "jpg" },
          provenance: "operator",
          role: "reference",
          alt: "a rival's launch card",
        },
      ],
    });
  }

  it("REFERENCE-ROLE MEDIA NEVER REACHES A DISPATCH ARM — only its notes do", async () => {
    // THIS IS THE LICENSING WALL. A reference is material we may have no
    // right to publish: the operator brought it so generation could be told
    // what it looks like and write something similar but DIFFERENT. The
    // moment its bytes reach a draft's mediaRefs, the public-asset door or a
    // platform call, that distinction is lost silently — and silently is the
    // only way this kind of breach ever happens. So the wall is structural:
    // the brief an arm receives has been through `outputEligible`, and the
    // reference is not in it to forward.
    const fx = await fixture();
    const { table, calls } = recordingDispatch();
    await runCreate(
      fx.ctx,
      fx.repos,
      briefWithBothRoles(),
      fx.deps({ dispatch: table, reference: { driver: createFakeReferenceVisionDriver() } }),
    );

    const input = calls[0];
    expect(input.brief.media).toHaveLength(1);
    expect(input.brief.media[0].role).toBe("use");
    // Nothing anywhere in what the arm can see addresses the reference bytes.
    const everythingTheArmSees = JSON.stringify({ brief: input.brief, plan: input.plan });
    expect(everythingTheArmSees).not.toContain(REFERENCE_SHA);
    expect(everythingTheArmSees).toContain(USE_SHA);

    // The reference's INFLUENCE does arrive — as text, in the brief.
    const text = await input.briefText("inline");
    expect(text).toContain("a rival's launch card");
    expect(text).toContain("DIFFERENT");
    expect(text).not.toContain(REFERENCE_SHA);
  });

  it("no draft a reference-carrying run produces holds the reference anywhere", async () => {
    const fx = await fixture();
    const result = await runCreate(
      fx.ctx,
      fx.repos,
      briefWithBothRoles(),
      fx.deps({ reference: { driver: createFakeReferenceVisionDriver() } }),
    );
    for (const child of result.children.filter((c) => c.kind === "draft")) {
      const draft = await fx.repos.drafts.get(fx.ctx, child.id);
      expect(JSON.stringify(draft)).not.toContain(REFERENCE_SHA);
    }
  });

  it("an undescribed reference degrades honestly and never blocks the run", async () => {
    const fx = await fixture();
    // No vision driver wired — today's real state.
    const result = await runCreate(fx.ctx, fx.repos, briefWithBothRoles(), fx.deps());
    expect(result.run.status).toBe("complete");
    expect(result.references).toHaveLength(1);
    expect(result.references[0].status).toBe("not_analysed");
  });
});

describe("runCreate — the other family arms", () => {
  it("page: produces one judged web-page draft and threads grounding picks as IDS", async () => {
    const fx = await fixture();
    const { source } = await fx.repos.sourceChunks.ingest(fx.ctx, {
      kind: "doc",
      contentHash: "a".repeat(64),
      chunks: [{ seq: 0, text: "Pricing starts at $19 a month.", tokenCount: 7, contentHash: "b".repeat(64) }],
    });
    const result = await runCreate(
      fx.ctx,
      fx.repos,
      {
        family: "page",
        mode: "prompt",
        prompt: "a pricing page",
        platforms: ["website_hosted"],
        sourceRefs: [source.id],
      },
      fx.deps(),
    );

    expect(result.run.status).toBe("complete");
    const draftRef = result.children.find((c) => c.kind === "draft");
    const draft = await fx.repos.drafts.get(fx.ctx, draftRef!.id);
    expect(draft.format).toBe("web_page");
    expect(draft.status).toBe("queued");
    // The single-draft spine grounds each picked source separately, so the
    // ids ride rather than the text.
    expect((draft.meta as { groundingSourceIds: string[] }).groundingSourceIds).toContain(source.id);
  });

  it("email: addresses the lead the Intel context carries, never an invented address", async () => {
    const fx = await fixture();
    const { lead } = await fx.repos.leads.add(fx.ctx, {
      source: "api",
      email: "dana@example.com",
      name: "Dana",
      painPoint: "spends two hours a week reformatting reports",
    });
    const result = await runCreate(
      fx.ctx,
      fx.repos,
      {
        family: "email",
        mode: "prompt",
        prompt: "offer a walkthrough",
        context: { kind: "lead_promote", leadId: lead.id },
      },
      fx.deps(),
    );

    expect(result.run.status).toBe("complete");
    const draftRef = result.children.find((c) => c.kind === "draft");
    const draft = await fx.repos.drafts.get(fx.ctx, draftRef!.id);
    expect(draft.format).toBe("outreach_email");
    const meta = draft.meta as { recipient: { leadId: string; email: string } };
    expect(meta.recipient.leadId).toBe(lead.id);
    expect(meta.recipient.email).toBe("dana@example.com");
  });

  it("email: a brief with no lead is refused BEFORE anything is written", async () => {
    const fx = await fixture();
    await expect(
      runCreate(
        fx.ctx,
        fx.repos,
        { family: "email", mode: "prompt", prompt: "offer a walkthrough" },
        fx.deps(),
      ),
    ).rejects.toBeInstanceOf(InvalidStateError);
    // Nothing half-run: a brief that was never dispatchable leaves no row.
    expect(await fx.repos.createRuns.list(fx.ctx)).toEqual([]);
  });

  it("video/wizard: takes the staged door and records the stage draft", async () => {
    const fx = await fixture();
    const result = await runCreate(
      fx.ctx,
      fx.repos,
      {
        family: "video",
        mode: "wizard",
        platforms: ["facebook"],
        wizard: { topic: "how the pricing works", audience: "operations leads" },
      },
      fx.deps(),
    );

    expect(result.run.status).toBe("complete");
    const draftRef = result.children.find((c) => c.kind === "draft");
    const draft = await fx.repos.drafts.get(fx.ctx, draftRef!.id);
    // Stage 0 of the staged plan — the wizard's review flow starts here, and
    // `advanceVideoStage` refuses to advance past an unjudged stage.
    expect(draft.status).toBe("queued");
    expect(result.children.some((c) => c.kind === "fanout_run")).toBe(true);
  });

  it("video/prompt: takes the one-prompt door and records the video project", async () => {
    const fx = await fixture();
    const result = await runCreate(
      fx.ctx,
      fx.repos,
      {
        family: "video",
        mode: "prompt",
        prompt: "a sixty-second explainer on usage-based pricing",
        platforms: ["facebook"],
      },
      fx.deps({ now: () => new Date("2026-07-29T00:00:00.000Z") }),
    );

    expect(result.run.status).toBe("complete");
    const project = result.children.find((c) => c.kind === "video_project");
    expect(project).toBeDefined();
    expect(await fx.repos.videoProjects.get(fx.ctx, project!.id)).toBeTruthy();
    expect(result.children.some((c) => c.kind === "draft")).toBe(true);
  });

  it("dispatches on the family, one arm each — nothing runs two engines", async () => {
    // The table is closed over CREATE_FAMILIES; a family without an arm is a
    // type error rather than a run that silently produces nothing.
    expect(Object.keys(DEFAULT_CREATE_DISPATCH).sort()).toEqual(["email", "page", "post", "video"]);
  });
});

describe("runCreate — briefs with nothing to generate from", () => {
  it("refuses a brief carrying neither a prompt nor wizard slots", async () => {
    const fx = await fixture();
    await expect(
      runCreate(fx.ctx, fx.repos, { family: "post", mode: "wizard", platforms: ["bluesky"] }, fx.deps()),
    ).rejects.toBeInstanceOf(InvalidStateError);
    expect(await fx.repos.createRuns.list(fx.ctx)).toEqual([]);
  });
});

describe("the brief assembly", () => {
  it("renders wizard slots deterministically — the same slots, the same brief, the same key", () => {
    const rendered = renderWizardSlots({ topic: "pricing", audience: "ops leads", empty: "" });
    expect(rendered).toBe("AUDIENCE: ops leads\nTOPIC: pricing");
    expect(renderWizardSlots({})).toBeUndefined();
    expect(renderWizardSlots(undefined)).toBeUndefined();
  });

  it("inlines the picked sources for engines that take no grounding list — nothing is dropped", async () => {
    const fx = await fixture();
    const { source } = await fx.repos.sourceChunks.ingest(fx.ctx, {
      kind: "doc",
      contentHash: "c".repeat(64),
      chunks: [{ seq: 0, text: "Churn fell 11% after the change.", tokenCount: 8, contentHash: "d".repeat(64) }],
    });
    const { table, calls } = recordingDispatch();
    await runCreate(
      fx.ctx,
      fx.repos,
      postBrief({ sourceRefs: [source.id] }),
      fx.deps({ dispatch: table }),
    );

    // `runFanout` grounds on the ONE source it is given, so an operator's
    // grounding pick would otherwise vanish between the brief and the draft.
    expect(await calls[0].briefText("inline")).toContain("Churn fell 11%");
    expect(await calls[0].briefText("ids")).not.toContain("Churn fell 11%");
  });

  it("ingests ONE brief source per run however often an arm asks", async () => {
    const fx = await fixture();
    const { table, calls } = recordingDispatch();
    await runCreate(fx.ctx, fx.repos, postBrief(), fx.deps({ dispatch: table }));
    const [first, second] = await Promise.all([
      calls[0].briefSource("inline"),
      calls[0].briefSource("inline"),
    ]);
    expect(first).toBe(second);
  });
});

describe("createGenerationKey", () => {
  it("is stable for the same ask and different for a different one", async () => {
    const fx = await fixture();
    const { table, calls } = recordingDispatch();
    await runCreate(fx.ctx, fx.repos, postBrief(), fx.deps({ dispatch: table }));
    const plan = calls[0].plan;
    const brief = { ...calls[0].brief };

    expect(createGenerationKey(fx.ctx, brief, plan)).toBe(createGenerationKey(fx.ctx, brief, plan));
    expect(createGenerationKey(fx.ctx, { ...brief, prompt: "something else" }, plan)).not.toBe(
      createGenerationKey(fx.ctx, brief, plan),
    );
  });

  it("is tenant-salted — one tenant's replay can never find another's run", async () => {
    const fx = await fixture();
    const { table, calls } = recordingDispatch();
    await runCreate(fx.ctx, fx.repos, postBrief(), fx.deps({ dispatch: table }));
    const other = tenantCtx("00000000-0000-4000-8000-0000000000ff");
    expect(createGenerationKey(other, calls[0].brief, calls[0].plan)).not.toBe(
      createGenerationKey(fx.ctx, calls[0].brief, calls[0].plan),
    );
  });

  it("changes when routing resolves the SAME brief to different destinations", async () => {
    // The fan-out's doctrine: idempotency by OUTPUTS, not by request shape.
    const fx = await fixture();
    const { table, calls } = recordingDispatch();
    await runCreate(fx.ctx, fx.repos, postBrief({ platforms: [] }), fx.deps({ dispatch: table }));
    const brief = calls[0].brief;
    const wide = calls[0].plan;
    const narrow = { ...wide, platforms: wide.platforms.slice(0, 1) };
    expect(createGenerationKey(fx.ctx, brief, narrow)).not.toBe(
      createGenerationKey(fx.ctx, brief, wide),
    );
  });
});

describe("loadPlanContext", () => {
  it("reads the vault's connection states, and calls a stale credential what it is", async () => {
    const fx = await fixture();
    const envelope = {
      ciphertext: "x",
      dataKeyWrapped: "y",
      iv: "z",
      authTag: "w",
      keyVersion: 1,
    };
    await fx.repos.tenantCredentials.connect(fx.ctx, { destination: "bluesky", envelope });
    await fx.repos.tenantCredentials.connect(fx.ctx, { destination: "linkedin", envelope });
    await fx.repos.tenantCredentials.markStatus(fx.ctx, "linkedin", "needs_reauth");

    const context = await loadPlanContext(fx.ctx, fx.repos);
    expect(context.connections).toEqual({ bluesky: "connected", linkedin: "needs_reauth" });
  });

  it("falls back to the generic demo routing table when the tenant has none", async () => {
    const fx = await fixture();
    expect((await loadPlanContext(fx.ctx, fx.repos)).routing).toEqual(DEFAULT_PLATFORM_ROUTING);
  });

  it("a tenant's OWN platformRouting beats the demo defaults, end to end", async () => {
    // This replaces the lane's red-on-fix ratchet. That ratchet pinned the
    // s87 window's gap — `platformRouting` accepted by the config schema and
    // never stored, the third recurrence of a gap the `outreach` docblock
    // already records for `outreach` and `social`. The column and the repo's
    // persist landed at merge, so the ratchet went red exactly as designed
    // and is now this: proof the tenant's setting survives schema → row →
    // engine, which is what the ratchet was standing in for.
    //
    // The gap itself is now guarded generically, from the contract rather
    // than from anyone's memory, in
    // `packages/db/src/__tests__/brand-profile-config-blocks.test.ts`.
    const fx = await fixture();
    const config = brandProfileConfigSchema.parse({
      voice: { register: "plain" },
      denylist: [],
      platformProfiles: {},
      platformRouting: { post: ["bluesky"], video: ["tiktok"] },
    });
    await fx.repos.brandProfiles.create(fx.ctx, { config, activate: true });

    const active = await fx.repos.brandProfiles.getActive(fx.ctx);
    expect((active as Record<string, unknown>).platformRouting).toEqual({
      post: ["bluesky"],
      video: ["tiktok"],
    });
    const context = await loadPlanContext(fx.ctx, fx.repos);
    expect(context.routing).toEqual({ post: ["bluesky"], video: ["tiktok"] });
    expect(context.routing).not.toEqual(DEFAULT_PLATFORM_ROUTING);
  });
});
