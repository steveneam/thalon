import { brandProfileConfigSchema, type BrandProfileConfigInput } from "@thalon/contracts";
import { getTableColumns } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { brandProfiles } from "../schema";
import { fixture, type Fixture } from "./helpers";

/**
 * THE ratchet for a gap that shipped THREE TIMES — invariant class.
 *
 * `brandProfileConfigSchema` grows an optional block; the window ships the
 * contract field and stops; `brand_profiles` never gets a column and
 * `brandProfilesRepo.create` never persists it. The config is then accepted
 * at the write door and silently dropped, so no real tenant's setting can be
 * read back and the feature it arms is dead for everyone. It happened to
 * `outreach` (s54), then to `social`, then to `platformRouting` (s87) — the
 * last found by the create-engine lane while consuming the window it broke.
 *
 * Every previous fix added the missing column AND a hand-written test for
 * that one block, which is exactly why it recurred: nothing failed when the
 * NEXT block arrived. This file fails instead, because it enumerates the
 * blocks from the CONTRACT rather than from a list someone must remember to
 * extend.
 *
 * If you are here because this test went red after adding a config block:
 * add the `jsonb` column to `brand_profiles`, persist it in
 * `brandProfilesRepo.create`, add a sample below, and generate the
 * migration. That is the whole fix.
 */

/** camelCase contract key → snake_case column name, the drizzle convention. */
function columnFor(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

const shape = brandProfileConfigSchema.shape;
const CONFIG_KEYS = Object.keys(shape);

/**
 * A block is OPTIONAL (absence disarms its feature) when parsing `undefined`
 * yields `undefined`. A DEFAULTED block also accepts `undefined` but yields a
 * value — so this distinguishes the two without hard-coding either list.
 */
const OPTIONAL_KEYS = CONFIG_KEYS.filter((key) => {
  const parsed = shape[key as keyof typeof shape].safeParse(undefined);
  return parsed.success && parsed.data === undefined;
});

/**
 * One valid value per optional block. The completeness test below binds this
 * map to the contract, so a new block cannot be added without landing here —
 * and landing here is what proves the repo actually persists it.
 */
const SAMPLES: Record<string, unknown> = {
  icp: { description: "Owner-operated local service businesses" },
  cadence: { linkedin: { maxPerDay: 1 } },
  routing: { "product-updates": ["linkedin"] },
  outreach: { dailyBatchCap: 5 },
  social: { linkedin: { maxPostsPerDay: 2, armState: "live" } },
  platformRouting: { video: ["tiktok"] },
};

let fx: Fixture | undefined;

afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

describe("brand profile config blocks (invariant: contract field ⇒ column ⇒ persisted)", () => {
  it("every config block the CONTRACT declares has a column on brand_profiles", () => {
    const columns = new Set(Object.values(getTableColumns(brandProfiles)).map((c) => c.name));
    for (const key of CONFIG_KEYS) {
      expect(
        columns,
        `brandProfileConfigSchema declares "${key}" but brand_profiles has no "${columnFor(key)}" column — the config would be accepted at the write door and silently dropped (this exact gap shipped for outreach, social, and platformRouting)`,
      ).toContain(columnFor(key));
    }
  });

  it("every optional block has a sample here, so none can be added without proving it persists", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...OPTIONAL_KEYS].sort());
  });

  it("EVERY optional block round-trips: create persists it and getActive serves it back", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    const config = {
      voice: {},
      denylist: [],
      platformProfiles: {},
      ...SAMPLES,
    } as BrandProfileConfigInput;

    const profile = await repos.brandProfiles.create(fx.ctx, { config, activate: true });
    const row = profile as unknown as Record<string, unknown>;
    for (const key of OPTIONAL_KEYS) {
      expect(
        row[key],
        `"${key}" was supplied but the ROW came back null — brandProfilesRepo.create is not persisting it`,
      ).not.toBeNull();
    }

    const active = (await repos.brandProfiles.getActive(fx.ctx)) as unknown as Record<
      string,
      unknown
    >;
    for (const key of OPTIONAL_KEYS) {
      expect(active[key], `"${key}" did not survive the read back`).not.toBeNull();
    }
    // Spot-check the s87 block specifically, since it is the one this file was written for.
    expect(active.platformRouting).toEqual({ video: ["tiktok"] });
  });

  /**
   * s102, control-arc part A: the block-level round-trip above proves a BLOCK
   * survives, which is the gap that shipped three times. It cannot see a field
   * added INSIDE a block being dropped — and `armState` is an authorization
   * fact, so a silent drop would read as "not armed" and the operator's
   * decision would vanish without a word. This is the field-level twin.
   *
   * It is deliberately a real round-trip and not a schema assertion: zod
   * strips unknown keys, so a field that is written but never declared, or
   * declared but never persisted, dies here rather than in production.
   */
  it("a field INSIDE a block survives too — the arm state is not silently dropped", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await repos.brandProfiles.create(fx.ctx, {
      config: {
        voice: {},
        denylist: [],
        platformProfiles: {},
        social: { bluesky: { maxPostsPerDay: 1, armState: "review" } },
      } as BrandProfileConfigInput,
      activate: true,
    });

    const active = (await repos.brandProfiles.getActive(fx.ctx)) as unknown as Record<
      string,
      unknown
    >;
    expect(active.social).toEqual({ bluesky: { maxPostsPerDay: 1, armState: "review" } });
  });

  /** Absence disarms INSIDE a block as well: a pre-s102 entry reads back unauthorized, never live. */
  it("a config written without an arm state reads back as off", async () => {
    fx = await fixture();
    const { repos } = fx.handle;
    await repos.brandProfiles.create(fx.ctx, {
      config: {
        voice: {},
        denylist: [],
        platformProfiles: {},
        social: { bluesky: { maxPostsPerDay: 1 } },
      } as BrandProfileConfigInput,
      activate: true,
    });

    const active = (await repos.brandProfiles.getActive(fx.ctx)) as unknown as Record<
      string,
      unknown
    >;
    expect(active.social).toEqual({ bluesky: { maxPostsPerDay: 1, armState: "off" } });
  });

  it("absent blocks stay NULL — absence disarms, and is never a stored default", async () => {
    fx = await fixture();
    const bare = (await fx.handle.repos.brandProfiles.create(fx.ctx, {
      config: { voice: {}, denylist: [], platformProfiles: {} },
      activate: true,
    })) as unknown as Record<string, unknown>;
    for (const key of OPTIONAL_KEYS) {
      expect(bare[key], `"${key}" must be NULL when unsupplied`).toBeNull();
    }
  });
});
