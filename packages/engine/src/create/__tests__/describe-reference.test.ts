import { tenantCtx, type MediaRefEnvelope, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { ContentAddressMismatchError, type ObjectStore } from "@thalon/platform";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { pinnedAssetKey } from "../../assets/pin";
import { describeReference, meteredReferenceVisionDriver } from "../reference";
import {
  createFakeReferenceVisionCallDriver,
  gatewayReferenceVisionDriver,
} from "../shell/describe-reference";

/**
 * B-create.2 follow-through — the `create.describe_reference` shell and its
 * metering. Keyless and networkless: the live driver is only ever exercised
 * along paths that refuse BEFORE reaching the gateway, and the metering path
 * runs on a fake call driver.
 */

let handle: DbHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

const IMAGE_BYTES = Buffer.from("not really a jpeg, but bytes are bytes");
const IMAGE_SHA = createHash("sha256").update(IMAGE_BYTES).digest("hex");

/** An in-memory store — the driver reads bytes, so a test needs somewhere for them to be. */
function fakeStore(entries: Record<string, Buffer> = {}): ObjectStore {
  return {
    get: async (key: string) => entries[key] ?? null,
    put: async (key: string, body: Buffer) => {
      entries[key] = body;
    },
    delete: async (key: string) => {
      delete entries[key];
    },
    list: async (prefix: string) => Object.keys(entries).filter((k) => k.startsWith(prefix)),
  } as unknown as ObjectStore;
}

function storedRef(sha = IMAGE_SHA): MediaRefEnvelope {
  return {
    ref: { kind: "stored", sha256: sha, ext: "jpg", width: 1200, height: 800 },
    provenance: "operator",
    role: "reference",
  };
}

async function fixture(): Promise<{ ctx: TenantCtx; repos: Repos }> {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self (dogfood)" });
  return { ctx: tenantCtx(tenant.id), repos: handle.repos };
}

/* ------------------------------------------------------------------ */

describe("gatewayReferenceVisionDriver — the walls that fire before the gateway", () => {
  it("refuses a claude-cli vision tier by name — that transport carries no image", async () => {
    const previous = process.env.MODEL_VISION;
    process.env.MODEL_VISION = "claude-cli/sonnet";
    try {
      const driver = gatewayReferenceVisionDriver({ store: fakeStore() });
      await expect(driver({ ref: storedRef().ref })).rejects.toThrow(/carries text only/);
    } finally {
      if (previous === undefined) delete process.env.MODEL_VISION;
      else process.env.MODEL_VISION = previous;
    }
  });

  it("refuses an external ref rather than fetching a stranger's bytes", async () => {
    const driver = gatewayReferenceVisionDriver({ store: fakeStore() });
    await expect(
      driver({ ref: { kind: "external", url: "https://example.com/a.jpg" } }),
    ).rejects.toThrow(/stored bytes only/);
  });

  it("names the key when the bytes are simply not there", async () => {
    const driver = gatewayReferenceVisionDriver({ store: fakeStore() });
    await expect(driver({ ref: storedRef().ref })).rejects.toThrow(
      new RegExp(pinnedAssetKey(IMAGE_SHA, "jpg").replace(/\//g, "\\/")),
    );
  });

  it("refuses bytes that no longer hash to the key naming them", async () => {
    // Content-address verification is on the read path: describing rotted or
    // tampered bytes would put their description into a generation prompt.
    const key = pinnedAssetKey(IMAGE_SHA, "jpg");
    const driver = gatewayReferenceVisionDriver({
      store: fakeStore({ [key]: Buffer.from("different bytes entirely") }),
    });
    await expect(driver({ ref: storedRef().ref })).rejects.toBeInstanceOf(
      ContentAddressMismatchError,
    );
  });
});

/* ------------------------------------------------------------------ */

describe("meteredReferenceVisionDriver — core meters the shell", () => {
  it("records the call's usage and threads the description into the seam's notes", async () => {
    const fx = await fixture();
    const before = await fx.repos.usageLedger.totalForDay(fx.ctx);

    const driver = meteredReferenceVisionDriver({
      ctx: fx.ctx,
      repos: fx.repos,
      capTokens: 1_000_000,
      driver: createFakeReferenceVisionCallDriver({ tokensIn: 900, tokensOut: 40 }),
    });

    const result = await describeReference(storedRef(), { driver });
    expect(result.status).toBe("described");
    if (result.status !== "described") return;
    expect(result.notes).toContain("DIFFERENT");

    const after = await fx.repos.usageLedger.totalForDay(fx.ctx);
    expect(after.tokensIn - before.tokensIn).toBe(900);
    expect(after.tokensOut - before.tokensOut).toBe(40);
  });

  it("a describe failure still degrades honestly through the guard", async () => {
    const fx = await fixture();
    const driver = meteredReferenceVisionDriver({
      ctx: fx.ctx,
      repos: fx.repos,
      capTokens: 1_000_000,
      driver: async () => {
        throw new Error("vision endpoint returned 503");
      },
    });

    const result = await describeReference(storedRef(), { driver });
    // Non-blocking by design (spec Error Behavior): the run proceeds, the
    // reference stays attached, and the reason rides verbatim.
    expect(result.status).toBe("not_analysed");
    if (result.status !== "not_analysed") return;
    expect(result.reason).toContain("vision endpoint returned 503");
  });

  it("costs nothing to CONSTRUCT — a run with no describable references never spends", async () => {
    const fx = await fixture();
    const before = await fx.repos.usageLedger.totalForDay(fx.ctx);
    meteredReferenceVisionDriver({
      ctx: fx.ctx,
      repos: fx.repos,
      capTokens: 1_000_000,
      driver: createFakeReferenceVisionCallDriver(),
    });
    const after = await fx.repos.usageLedger.totalForDay(fx.ctx);
    expect(after.tokensIn).toBe(before.tokensIn);
    expect(after.tokensOut).toBe(before.tokensOut);
  });
});
