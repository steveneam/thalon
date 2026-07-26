import { describe, expect, it } from "vitest";
import { chooseUpstream, upstreamLabel } from "../provider";

/**
 * The upstream decision. It is the SAME rule the catalog read and the preview
 * route both run, on purpose: two copies of "which portfolio are we serving?"
 * is how a gallery ends up listing one origin's records while the thumbnails
 * come from another.
 *
 * These drive the PURE half. The resolver around it reads `process.cwd()` and
 * the filesystem, and a test that assumed either passed alone and failed
 * under the root runner — which is exactly why the rule is separable.
 */

const DIR = "/repo/proprietary/templates/sites";

describe("chooseUpstream", () => {
  it("serves the configured origin when one is set, trailing slash and all", () => {
    expect(chooseUpstream({ SITES_BASE_URL: "https://sites.example/" }, DIR, true)).toEqual({
      kind: "origin",
      origin: "https://sites.example",
    });
  });

  it("outranks everything else with the base URL — staging never reads a stray local tree", () => {
    expect(
      chooseUpstream(
        { SITES_BASE_URL: "https://sites.example", SITES_PREVIEW_ORIGIN: "http://127.0.0.1:8899" },
        DIR,
        true,
      ),
    ).toEqual({ kind: "origin", origin: "https://sites.example" });
  });

  it("reads the local template directory in dev — no preview server required", () => {
    expect(chooseUpstream({}, DIR, true)).toEqual({ kind: "dir", dir: DIR });
  });

  it("still honours SITES_PREVIEW_ORIGIN for anyone who wants the 8899 server", () => {
    expect(chooseUpstream({ SITES_PREVIEW_ORIGIN: "http://127.0.0.1:8899/" }, DIR, true)).toEqual({
      kind: "origin",
      origin: "http://127.0.0.1:8899",
    });
  });

  it("is unconfigured with no base URL and no local tree — there is no catalog either", () => {
    expect(chooseUpstream({}, DIR, false)).toEqual({ kind: "unconfigured" });
    // Even with a preview origin named: previews for a portfolio the surface
    // cannot list would be an origin without a catalog, so the surface says
    // the setting is missing instead.
    expect(chooseUpstream({ SITES_PREVIEW_ORIGIN: "http://127.0.0.1:8899" }, DIR, false)).toEqual({
      kind: "unconfigured",
    });
  });
});

describe("upstreamLabel (the visible-provenance words)", () => {
  it("says what is true about each upstream, never a guess", () => {
    expect(upstreamLabel({ kind: "dir", dir: DIR })).toBe("the local template directory");
    expect(upstreamLabel({ kind: "origin", origin: "https://sites.example" })).toBe(
      "https://sites.example",
    );
    expect(upstreamLabel({ kind: "unconfigured" })).toBe("no origin configured");
  });
});
