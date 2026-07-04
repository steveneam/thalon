import { describe, expect, it } from "vitest";
import {
  brandIdentitySchema,
  brandProfileConfigSchema,
  renderBrandIdentity,
} from "../brand-profile";

describe("brand identity (B3.8)", () => {
  it("a pre-B3.8 config without identity still parses — identity defaults to empty", () => {
    const config = brandProfileConfigSchema.parse({
      voice: { register: "plain" },
      denylist: [],
      platformProfiles: {},
    });
    expect(config.identity).toEqual({ offers: [], links: {}, facts: [], topics: [] });
    expect(renderBrandIdentity(config.identity)).toBe("");
  });

  it("renders every populated field in stable order and skips empties", () => {
    const identity = brandIdentitySchema.parse({
      company: "Fernwood Outfitters",
      oneLiner: "A fictional gear shop.",
      philosophy: "Repair first.",
      audience: "Local hikers.",
      offers: ["Gear repair", "  ", "Gear sales"],
      facts: ["Family-run."],
      topics: ["hiking", "repair"],
      links: { site: "https://example.test" },
    });
    expect(renderBrandIdentity(identity)).toBe(
      [
        "COMPANY: Fernwood Outfitters",
        "WHAT IT DOES: A fictional gear shop.",
        "PHILOSOPHY: Repair first.",
        "AUDIENCE: Local hikers.",
        "OFFERS:",
        "- Gear repair",
        "- Gear sales",
        "FACTS:",
        "- Family-run.",
        "TOPICS: hiking, repair",
        "LINKS:",
        "- site: https://example.test",
      ].join("\n"),
    );
  });

  it("whitespace-only fields render nothing — the block stays empty, so callers omit it entirely", () => {
    const identity = brandIdentitySchema.parse({
      company: "   ",
      offers: ["  "],
      links: { site: " " },
    });
    expect(renderBrandIdentity(identity)).toBe("");
  });

  it("operator-added catchall keys render too, sorted, without a code change (config-not-code)", () => {
    const identity = brandIdentitySchema.parse({
      company: "Fernwood",
      zeta: "last extra",
      alpha: { nested: true },
    });
    expect(renderBrandIdentity(identity)).toBe(
      ["COMPANY: Fernwood", 'ALPHA: {"nested":true}', "ZETA: last extra"].join("\n"),
    );
  });

  it("rendering is deterministic — identical identity, identical block (it feeds both the prompt and the judge grounding chunk)", () => {
    const raw = {
      company: "Fernwood",
      facts: ["Family-run.", "Two technicians."],
      links: { site: "https://example.test", shop: "https://shop.example.test" },
    };
    expect(renderBrandIdentity(brandIdentitySchema.parse(raw))).toBe(
      renderBrandIdentity(brandIdentitySchema.parse(raw)),
    );
  });
});
