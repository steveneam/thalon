import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { InvalidStateError, NotFoundError } from "../errors";
import type { Repos } from "../repos";
import { fixture, type Fixture } from "./helpers";

/**
 * s83 contract-window repos (D1): the OAuth connect dance's single-use state
 * store. Every behavior test doubles as the tenancy-wall proof. No events
 * pin: state rows are transport scaffolding by design (the audit fact is the
 * vault connect they lead to).
 */

let fx: Fixture | undefined;

afterEach(async () => {
  await fx?.close();
  fx = undefined;
});

async function setup(): Promise<{ ctx: TenantCtx; other: TenantCtx; repos: Repos }> {
  fx = await fixture();
  const { repos } = fx.handle;
  const stranger = await repos.tenants.create({ slug: "other", name: "Other" });
  return { ctx: fx.ctx, other: tenantCtx(stranger.id), repos };
}

const NOW = new Date("2026-08-01T09:30:00Z");
const LATER = new Date("2026-08-01T09:40:00Z");
const TTL = new Date("2026-08-01T09:35:00Z");

describe("oauthStates repo (s83 D1 window)", () => {
  it("create → consume returns the flight exactly once; the replayed callback finds nothing", async () => {
    const { ctx, repos } = await setup();
    await repos.oauthStates.create(ctx, {
      state: "st-abc",
      destination: "reddit",
      codeVerifier: "ver-123",
      expiresAt: TTL,
    });
    const row = await repos.oauthStates.consume(ctx, "st-abc", NOW);
    expect(row.destination).toBe("reddit");
    expect(row.codeVerifier).toBe("ver-123");
    // Single-use: the delete-returning consumed it — a replay is NotFound.
    await expect(repos.oauthStates.consume(ctx, "st-abc", NOW)).rejects.toThrow(NotFoundError);
  });

  it("an expired flight refuses with the reason on its face — and is gone afterwards", async () => {
    const { ctx, repos } = await setup();
    await repos.oauthStates.create(ctx, {
      state: "st-slow",
      destination: "reddit",
      expiresAt: TTL,
    });
    await expect(repos.oauthStates.consume(ctx, "st-slow", LATER)).rejects.toThrow(
      /expired at 2026-08-01T09:35:00\.000Z/,
    );
    await expect(repos.oauthStates.consume(ctx, "st-slow", NOW)).rejects.toThrow(NotFoundError);
  });

  it("tenancy wall: another tenant's consume answers exactly like a flight that never existed", async () => {
    const { ctx, other, repos } = await setup();
    await repos.oauthStates.create(ctx, {
      state: "st-mine",
      destination: "reddit",
      expiresAt: TTL,
    });
    await expect(repos.oauthStates.consume(other, "st-mine", NOW)).rejects.toThrow(NotFoundError);
    // The owner's flight survived the stranger's probe.
    const row = await repos.oauthStates.consume(ctx, "st-mine", NOW);
    expect(row.state).toBe("st-mine");
  });

  it("purgeExpired sweeps abandoned flights and leaves live ones", async () => {
    const { ctx, repos } = await setup();
    await repos.oauthStates.create(ctx, { state: "st-dead", destination: "reddit", expiresAt: TTL });
    await repos.oauthStates.create(ctx, {
      state: "st-live",
      destination: "bluesky",
      expiresAt: new Date("2026-08-01T10:00:00Z"),
    });
    expect(await repos.oauthStates.purgeExpired(LATER)).toBe(1);
    const live = await repos.oauthStates.consume(ctx, "st-live", LATER);
    expect(live.destination).toBe("bluesky");
  });

  it("an unknown destination refuses at the write door (the registry is the vocabulary)", async () => {
    const { ctx, repos } = await setup();
    await expect(
      repos.oauthStates.create(ctx, {
        state: "st-bad",
        destination: "myspace" as never,
        expiresAt: TTL,
      }),
    ).rejects.toThrow();
  });
});

describe("expired-consume ordering (the trap the verbs must not swap)", () => {
  it("InvalidStateError for expired beats NotFound semantics only AFTER the row proved to be the tenant's", async () => {
    const { other, repos } = await setup();
    // A stranger probing an expired state still gets NotFound — expiry
    // information leaks nothing across the wall.
    const { ctx } = { ctx: fx!.ctx };
    await repos.oauthStates.create(ctx, { state: "st-x", destination: "reddit", expiresAt: TTL });
    await expect(repos.oauthStates.consume(other, "st-x", LATER)).rejects.toThrow(NotFoundError);
    await expect(repos.oauthStates.consume(ctx, "st-x", LATER)).rejects.toThrow(InvalidStateError);
  });
});
