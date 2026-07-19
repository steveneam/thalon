import { describe, expect, it } from "vitest";
import { formToConfig, parseLinks, profileToForm, type ProfileFormState } from "@/lib/profiles/form";
import type { ProfileWire } from "@/lib/profiles/types";

const emptyForm: ProfileFormState = {
  company: "",
  oneLiner: "",
  philosophy: "",
  audience: "",
  offers: "",
  facts: "",
  topics: "",
  links: "",
  denylist: "",
  voiceJson: "",
  platformProfilesJson: "",
};

describe("profile form mapping", () => {
  it("maps list fields line-per-item and links as label: url", () => {
    const result = formToConfig({
      ...emptyForm,
      company: "Thalon",
      offers: "Content engine\n\n  Video pipeline  ",
      topics: "ai video",
      links: "site: https://example.com\ngithub: https://github.com/example",
      denylist: "guarantee\nfree money",
      voiceJson: '{ "tone": "direct" }',
    });
    expect(result.error).toBeNull();
    expect(result.config).toMatchObject({
      voice: { tone: "direct" },
      denylist: ["guarantee", "free money"],
      identity: {
        company: "Thalon",
        offers: ["Content engine", "Video pipeline"],
        topics: ["ai video"],
        links: { site: "https://example.com", github: "https://github.com/example" },
      },
    });
  });

  it("fails loud on a malformed link line, naming the field", () => {
    const result = formToConfig({ ...emptyForm, links: "just-a-url-no-label" });
    expect(result.config).toBeNull();
    expect(result.error).toContain("Links");
  });

  it("fails loud on invalid voice JSON instead of silently dropping it", () => {
    const result = formToConfig({ ...emptyForm, voiceJson: "{nope" });
    expect(result.config).toBeNull();
    expect(result.error).toContain("Voice");
  });

  it("URLs keep their colons when links parse", () => {
    expect(parseLinks("site: https://example.com/a:b").links).toEqual({
      site: "https://example.com/a:b",
    });
  });

  it("round-trips a wire profile back into the form", () => {
    const wire: ProfileWire = {
      id: "p1",
      version: 3,
      active: true,
      config: {
        voice: { tone: "direct" },
        denylist: ["guarantee"],
        platformProfiles: { linkedin: { charLimit: 3000 } },
        identity: {
          company: "Thalon",
          offers: ["Engine"],
          facts: [],
          topics: ["ai"],
          links: { site: "https://example.com" },
        },
      },
      createdAt: "2026-07-05T12:00:00.000Z",
    };
    const form = profileToForm(wire);
    expect(form.company).toBe("Thalon");
    expect(form.offers).toBe("Engine");
    expect(form.links).toBe("site: https://example.com");
    expect(form.denylist).toBe("guarantee");
    const back = formToConfig(form);
    expect(back.error).toBeNull();
    expect(back.config?.identity).toMatchObject({ company: "Thalon", topics: ["ai"] });
  });
});

describe("formToConfig carry — the non-form-backed blocks the form doesn't edit (2026-07-14 staging find; window-2 pair 2026-07-19)", () => {
  const form: ProfileFormState = {
    company: "Thalon",
    oneLiner: "",
    philosophy: "",
    audience: "",
    offers: "",
    facts: "",
    topics: "",
    links: "",
    denylist: "",
    voiceJson: "",
    platformProfilesJson: "",
  };

  it("carries icp, cadence, routing, outreach and social through the save verbatim", () => {
    const carry = {
      icp: { description: "Owner-operated local services", verticals: ["plumbing"] },
      cadence: { linkedin: { maxPerDay: 2 } },
      routing: { launch: ["linkedin"] },
      outreach: { touchOffsetsDays: [0, 3, 10], dailyBatchCap: 25 },
      social: { linkedin: { maxPostsPerDay: 1 } },
    };
    const mapped = formToConfig(form, carry);
    expect(mapped.error).toBeNull();
    expect(mapped.config?.icp).toEqual(carry.icp);
    expect(mapped.config?.cadence).toEqual(carry.cadence);
    expect(mapped.config?.routing).toEqual(carry.routing);
    expect(mapped.config?.outreach).toEqual(carry.outreach);
    expect(mapped.config?.social).toEqual(carry.social);
  });

  it("absent blocks stay absent — no keys invented on a pre-window profile", () => {
    const mapped = formToConfig(form, {});
    expect(mapped.error).toBeNull();
    expect(mapped.config && "icp" in mapped.config).toBe(false);
    expect(mapped.config && "cadence" in mapped.config).toBe(false);
    expect(mapped.config && "routing" in mapped.config).toBe(false);
    expect(mapped.config && "outreach" in mapped.config).toBe(false);
    expect(mapped.config && "social" in mapped.config).toBe(false);

    const noCarry = formToConfig(form);
    expect(noCarry.config && "icp" in noCarry.config).toBe(false);
  });
});
