import { describe, expect, it } from "vitest";
import {
  composerHeadline,
  composerTabs,
  discoverability,
  fieldLabel,
  firstMediaKind,
  fitWords,
  hasFirstComment,
  hitTerm,
  markBody,
  moreSettingsFields,
  previewActions,
  provenanceParts,
  sendToApproveHref,
  stripStatus,
  tabDot,
  videoProjectHref,
  wouldBlockCount,
} from "@/components/composer/composer-model";
import type { FitResponse } from "@/components/approve/queue-client";
import type { CreateRunWire } from "@/lib/create/client";
import type { GridDraft } from "@/lib/approve-queue/types";

/**
 * The Composer's pure derivations against Composer.dc.html (the s90c
 * iteration): honest tab dots, the counter-with-reason fit grammar
 * (refusals VERBATIM), the marked hit, and provenance that names only what
 * the wire carries.
 */

function draft(overrides: Partial<GridDraft>): GridDraft {
  return {
    id: "d1",
    tenantId: "t1",
    fanoutRunId: "fr1",
    sourceId: "s1",
    platform: "linkedin",
    format: "single-post",
    body: "Deterministic video changed what we can promise.",
    bodyHash: "h1",
    meta: {},
    status: "queued",
    captureId: null,
    createdAt: "2026-08-02T10:00:00Z",
    updatedAt: "2026-08-02T10:00:00Z",
    ...overrides,
  } as GridDraft;
}

function fit(over: {
  fits?: boolean;
  overBy?: number;
  billed?: number;
  max?: number;
  mediaRequired?: boolean;
  mediaCount?: number;
  problems?: Array<{ code: string; message: string }>;
}): FitResponse {
  return {
    supported: true,
    bodyHash: "h1",
    suggestedAt: "2026-08-03T09:30:00Z",
    fit: {
      platform: "linkedin",
      fits: over.fits ?? true,
      problems: over.problems ?? [],
      text: {
        rawChars: over.billed ?? 2412,
        billedChars: over.billed ?? 2412,
        maxChars: over.max ?? 3000,
        overBy: over.overBy ?? 0,
        cutIndex: 210,
        urlWeight: null,
        links: [],
        hashtags: [],
        maxHashtags: null,
        segments: [],
      },
      media: {
        count: over.mediaCount ?? 0,
        required: over.mediaRequired ?? false,
      },
    },
  } as unknown as FitResponse;
}

const run: CreateRunWire = {
  id: "cr1",
  family: "post",
  mode: "prompt",
  brief: { prompt: "Launch film" },
  plan: {},
  children: [{ kind: "fanout_run", id: "fr1" }],
  status: "complete",
  lastError: null,
  createdAt: "2026-08-02T09:00:00Z",
};

describe("tab dots — what makes tabs honest", () => {
  it("blocked = err · media-required-and-missing = err · a cut = warn · else ok", () => {
    expect(tabDot(draft({ status: "blocked" }), null)).toBe("err");
    expect(tabDot(draft({}), fit({ mediaRequired: true, mediaCount: 0 }))).toBe("err");
    expect(tabDot(draft({}), fit({ overBy: 12, fits: false }))).toBe("warn");
    expect(tabDot(draft({}), fit({}))).toBe("ok");
    // Unmeasured never invents a warning.
    expect(tabDot(draft({}), null)).toBe("ok");
  });

  it("tabs carry the platform's label and its draft's dot", () => {
    const tabs = composerTabs(
      [draft({}), draft({ id: "d2", platform: "bluesky", status: "blocked" })],
      { d2: null },
    );
    expect(tabs.map((t) => t.label)).toEqual(["LinkedIn", "Bluesky"]);
    expect(tabs.map((t) => t.dot)).toEqual(["ok", "err"]);
  });
});

describe("the fit grammar — a counter WITH its reason", () => {
  it("fits: the count and the no-cut sentence", () => {
    const words = fitWords(fit({}));
    expect(words.count).toBe("2,412 / 3,000");
    expect(words.why).toBe("Fits. The body posts whole — no cut.");
    expect(words.tone).toBe("ok");
  });

  it("over: the engine's own message rides VERBATIM", () => {
    const words = fitWords(
      fit({
        overBy: 12,
        fits: false,
        billed: 312,
        max: 300,
        problems: [{ code: "over", message: "Over by 12. The last sentence gets cut — trim it here." }],
      }),
    );
    expect(words.count).toBe("312 / 300");
    expect(words.why).toBe("Over by 12. The last sentence gets cut — trim it here.");
    expect(words.tone).toBe("warn");
  });

  it("an outright refusal says refuses, with the platform's fix in words", () => {
    const words = fitWords(
      fit({
        mediaRequired: true,
        mediaCount: 0,
        fits: false,
        problems: [{ code: "media", message: "No text-only post. Attach media, or drop it from this run." }],
      }),
    );
    expect(words.count).toBe("refuses");
    expect(words.why).toBe("No text-only post. Attach media, or drop it from this run.");
    expect(words.tone).toBe("err");
  });

  it("an unsupported destination (the blog) has no ceiling — the engine's reason rides", () => {
    const words = fitWords({
      supported: false,
      platform: "blog",
      reason: "Your own site — no platform ceiling.",
    } as FitResponse);
    expect(words.count).toBe("no limit");
    expect(words.why).toBe("Your own site — no platform ceiling.");
  });

  it("unmeasured is measuring, never a fake number", () => {
    expect(fitWords(null)).toEqual({ count: "—", why: "measuring…", tone: "none" });
  });
});

describe("the marked hit — a gate that points at a word sits next to the word", () => {
  it("extracts the judge's quoted term and splits the body at it", () => {
    const term = hitTerm("Denylist — screen: “guaranteed” is denylisted");
    expect(term).toBe("guaranteed");
    const marked = markBody("Nothing here is guaranteed to be faster.", term);
    expect(marked).toEqual(["Nothing here is ", "guaranteed", " to be faster."]);
  });

  it("no quoted term, or a term not in the body → no mark, never a guess", () => {
    expect(hitTerm("blocked without recorded detail")).toBeNull();
    expect(markBody("body", "absent")).toBeNull();
  });
});

describe("run-scope facts", () => {
  it("the headline is the run's own brief + destination count", () => {
    expect(composerHeadline(run, 5)).toBe("Launch film — 5 destinations");
    expect(composerHeadline({ ...run, brief: {} }, 1)).toBe("post run — 1 destination");
  });

  it("would-block counts blocked drafts only", () => {
    expect(wouldBlockCount([draft({}), draft({ id: "d2", status: "blocked" })])).toBe(1);
  });

  it("Send to Approve exits into the run's own queue slice", () => {
    expect(sendToApproveHref(run)).toBe("/app/approve?run=fr1");
    expect(sendToApproveHref({ ...run, children: [] })).toBe("/app/approve");
  });

  it("provenance names only what the wire carries", () => {
    const parts = provenanceParts(
      run,
      draft({ captureId: "cap1", meta: { groundingSourceIds: ["s1", "s2"] } }),
    );
    expect(parts.map((p) => p.text)).toEqual([
      "From the Launch film run",
      "post · one prompt",
      "from an Intel pick",
      "2 grounding sources",
    ]);
    // No capture, no grounding: neither part is invented.
    expect(provenanceParts(run, draft({})).map((p) => p.text)).toEqual([
      "From the Launch film run",
      "post · one prompt",
    ]);
  });
});

describe("the schema-generated rail", () => {
  it("firstComment exists only where the platform's schema declares it", () => {
    expect(hasFirstComment("linkedin")).toBe(true);
    expect(hasFirstComment("facebook")).toBe(true);
    expect(hasFirstComment("bluesky")).toBe(false);
    expect(hasFirstComment("x")).toBe(false);
  });

  it("More settings counts the platform's remaining schema fields, humanized", () => {
    const more = moreSettingsFields("linkedin");
    expect(more.length).toBeGreaterThan(0);
    expect(more).not.toContain("firstComment");
    expect(fieldLabel("firstComment")).toBe("First comment");
  });

  it("a video destination declares more than a text one (the Postiz finding)", () => {
    expect(moreSettingsFields("youtube").length).toBeGreaterThan(
      moreSettingsFields("bluesky").length,
    );
  });
});

describe("discoverability — warns, never blocks", () => {
  it("counts coverage of the CURRENT body and names the first miss", () => {
    const d = discoverability(["deterministic video", "build step"], "every beat is a build step");
    expect(d).toEqual({ have: 1, total: 2, missing: "deterministic video" });
  });

  it("no declared targets = no invented lens", () => {
    expect(discoverability([], "body")).toBeNull();
  });
});

describe("preview honesty", () => {
  it("each platform gets its OWN action row; an article gets none", () => {
    expect(previewActions("linkedin")).toEqual(["Like", "Comment", "Repost", "Send"]);
    expect(previewActions("blog")).toEqual([]);
  });

  it("media kind reads the draft's own refs, never invents one", () => {
    expect(firstMediaKind(draft({}))).toBeNull();
    expect(firstMediaKind(draft({ meta: { mediaRefs: [{ ref: "m1", mime: "video/mp4" }] } }))).toBe(
      "video",
    );
    expect(firstMediaKind(draft({ meta: { mediaRefs: [{ ref: "m1", mime: "image/png" }] } }))).toBe(
      "image",
    );
  });
});

/** s99 — the fe-check fix round's pure-model pins. */
describe("s99: the strip's seven eras, the failed measure, the doors that exist on the wire", () => {
  it("never tells an approved or published variant that the human gate is next", () => {
    expect(stripStatus("queued", null).line).toContain("the human gate is next");
    expect(stripStatus("approved", null)).toMatchObject({ word: "approved", pill: "pill-ok" });
    expect(stripStatus("approved", null).line).not.toContain("next");
    expect(stripStatus("published", null).word).toBe("published");
    expect(stripStatus("rejected", null)).toMatchObject({ word: "rejected", pill: "pill-err" });
    expect(stripStatus("generated", null).line).toContain("not judged yet");
    // A blocked draft still leads with the failing gate's own label.
    expect(stripStatus("blocked", "Denylist — “guaranteed”").line).toBe("Denylist — “guaranteed”");
  });

  it("a failed fit measure says so — it never measures forever", () => {
    expect(fitWords("failed")).toMatchObject({ tone: "err" });
    expect(fitWords("failed").why).toContain("couldn’t measure");
    // Still-measuring stays its own, quieter fact.
    expect(fitWords(null)).toMatchObject({ why: "measuring…", tone: "none" });
  });

  it("an unmeasurable destination warns on its tab rather than reading clean", () => {
    const draft = { status: "queued" } as never;
    expect(tabDot(draft, "failed")).toBe("warn");
    expect(tabDot(draft, null)).toBe("ok");
  });
});

describe("s99: the provenance facts that were on the wire all along", () => {
  it("finds the Intel pick on the RUN's brief when the draft carries no captureId", () => {
    // The fan-out leaves draft.captureId null; the capture that seeded the
    // run sits on run.brief.context — the door never fired (live, s98 run).
    const seeded: CreateRunWire = {
      ...run,
      brief: {
        prompt: "Launch film",
        context: { captureId: "cap-9", title: "Why the US is Restricting Access" },
      },
    };
    const parts = provenanceParts(seeded, draft({ captureId: null }));
    const pick = parts.find((p) => p.text.startsWith("from an Intel pick"));
    expect(pick).toBeDefined();
    expect(pick?.text).toContain("Why the US is Restricting Access");
    expect(pick?.href).toBe("/app/intel");
    // Still absent when no capture rode in at all — never invented.
    expect(provenanceParts(run, draft({})).some((p) => p.text.includes("Intel"))).toBe(false);
  });

  it("names the profile VERSION the body was written against — it is on the wire", () => {
    const parts = provenanceParts(run, draft({ meta: { brandProfileVersion: 5 } }));
    expect(parts.map((p) => p.text)).toContain("profile v5");
  });

  it("the run's own video project is a door — the media band's stated cut", () => {
    expect(videoProjectHref(run)).toBeNull();
    const withVideo: CreateRunWire = {
      ...run,
      children: [...run.children, { kind: "video_project", id: "vp1" }],
    };
    expect(videoProjectHref(withVideo)).toBe("/app/videos/vp1");
    // A child that errored is not a door.
    expect(
      videoProjectHref({ ...run, children: [{ kind: "video_project", id: "vp2", error: "boom" }] }),
    ).toBeNull();
  });
});
