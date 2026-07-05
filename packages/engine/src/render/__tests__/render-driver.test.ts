import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getRenderTarget } from "../render-driver";

/** Mirrors transcript-providers.test.ts: tests own the env var, restore after. */
const savedDriver = process.env.RENDER_DRIVER;
beforeEach(() => {
  delete process.env.RENDER_DRIVER;
});
afterAll(() => {
  if (savedDriver === undefined) delete process.env.RENDER_DRIVER;
  else process.env.RENDER_DRIVER = savedDriver;
});

describe("getRenderTarget (B5.1 env-selected registry)", () => {
  it("defaults to hyperframes (charter A11 / ADR-0004)", () => {
    expect(getRenderTarget().name).toBe("hyperframes");
  });

  it("selects via RENDER_DRIVER through the platform env choke point", () => {
    process.env.RENDER_DRIVER = "fake";
    expect(getRenderTarget().name).toBe("fake");
  });

  it("an explicit name beats the env", () => {
    process.env.RENDER_DRIVER = "hyperframes";
    expect(getRenderTarget("fake").name).toBe("fake");
  });

  it("remotion is the RECORDED swap path — named, honest, unimplemented", () => {
    expect(() => getRenderTarget("remotion")).toThrow(/RECORDED SWAP PATH.*0004-render-driver-default/);
  });

  it("an unknown driver fails loud with the registry listed", () => {
    expect(() => getRenderTarget("imaginary")).toThrow(
      /unknown render driver "imaginary".*hyperframes, fake.*swap path: remotion/,
    );
  });
});
