import { tenantCtx, type CredentialEnvelope, type TenantCtx } from "@thalon/contracts";
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { NotFoundError } from "../errors";
import { openTestDb, type DbHandle } from "../client";

/**
 * B-int.0 window pins: the vault's storage doors. Tenancy wall · one row
 * per (tenant, destination) with rotate-as-upsert · stored-state
 * transitions · event names · and the REDACTION invariant — no envelope
 * field ever reaches an event payload.
 */

let handle: DbHandle;
let ctx: TenantCtx;
let otherCtx: TenantCtx;

const envelope: CredentialEnvelope = {
  ciphertext: "c2VhbGVk",
  dataKeyWrapped: "d3JhcHBlZA==",
  iv: "aXY=",
  authTag: "dGFn",
  keyVersion: 1,
};

beforeEach(async () => {
  handle = await openTestDb();
  const a = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  const b = await handle.repos.tenants.create({ slug: "other", name: "Other" });
  ctx = tenantCtx(a.id);
  otherCtx = tenantCtx(b.id);
});

afterEach(async () => {
  await handle.close();
});

describe("tenantCredentials repo (B-int.0 — the vault's storage doors)", () => {
  it("connect stores the sealed envelope, emits .connected, and the event payload is REDACTED", async () => {
    const row = await handle.repos.tenantCredentials.connect(ctx, {
      destination: "linkedin",
      envelope,
      connectedAs: "@thalon",
    });
    expect(row.destination).toBe("linkedin");
    expect(row.status).toBe("connected");
    expect(row.ciphertext).toBe(envelope.ciphertext);

    const events = await handle.repos.events.list(ctx, { entityType: "tenant_credential", limit: 10 });
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe("tenant_credential.connected");
    // The redaction invariant: destination + public label ONLY.
    expect(events[0].payload).toEqual({ destination: "linkedin", connectedAs: "@thalon" });
    const serialized = JSON.stringify(events[0].payload);
    for (const secret of Object.values(envelope)) {
      expect(serialized).not.toContain(String(secret));
    }
  });

  it("reconnect is rotate: same row, new envelope, .rotated event, still ONE row", async () => {
    const first = await handle.repos.tenantCredentials.connect(ctx, {
      destination: "linkedin",
      envelope,
    });
    const second = await handle.repos.tenantCredentials.connect(ctx, {
      destination: "linkedin",
      envelope: { ...envelope, ciphertext: "bmV3", keyVersion: 2 },
      connectedAs: "@thalon",
    });
    expect(second.id).toBe(first.id);
    expect(second.ciphertext).toBe("bmV3");
    expect(second.keyVersion).toBe(2);
    expect(await handle.repos.tenantCredentials.list(ctx)).toHaveLength(1);

    const events = await handle.repos.events.list(ctx, { entityType: "tenant_credential", limit: 10 });
    expect(events.map((e) => e.event).sort()).toEqual([
      "tenant_credential.connected",
      "tenant_credential.rotated",
    ]);
  });

  it("is tenancy-walled: another tenant sees nothing and cannot transition or remove", async () => {
    await handle.repos.tenantCredentials.connect(ctx, { destination: "x", envelope });
    expect(await handle.repos.tenantCredentials.get(otherCtx, "x")).toBeNull();
    expect(await handle.repos.tenantCredentials.list(otherCtx)).toEqual([]);
    await expect(
      handle.repos.tenantCredentials.markStatus(otherCtx, "x", "needs_reauth"),
    ).rejects.toThrow(NotFoundError);
    await expect(handle.repos.tenantCredentials.remove(otherCtx, "x")).rejects.toThrow(
      NotFoundError,
    );
  });

  it("markStatus transitions stored states and stamps validatedAt on a validate ping", async () => {
    await handle.repos.tenantCredentials.connect(ctx, { destination: "intel_youtube", envelope });
    const flagged = await handle.repos.tenantCredentials.markStatus(
      ctx,
      "intel_youtube",
      "needs_reauth",
    );
    expect(flagged.status).toBe("needs_reauth");

    const at = new Date("2026-07-19T12:00:00Z");
    const validated = await handle.repos.tenantCredentials.markStatus(ctx, "intel_youtube", "connected", {
      validatedAt: at,
    });
    expect(validated.status).toBe("connected");
    expect(validated.validatedAt?.toISOString()).toBe(at.toISOString());

    const events = await handle.repos.events.list(ctx, { entityType: "tenant_credential", limit: 10 });
    expect(events.filter((e) => e.event === "tenant_credential.state_changed")).toHaveLength(2);
  });

  it("remove disconnects loudly: row gone, .removed ledgered, second remove throws", async () => {
    await handle.repos.tenantCredentials.connect(ctx, { destination: "website_webhook", envelope });
    await handle.repos.tenantCredentials.remove(ctx, "website_webhook");
    expect(await handle.repos.tenantCredentials.get(ctx, "website_webhook")).toBeNull();
    await expect(handle.repos.tenantCredentials.remove(ctx, "website_webhook")).rejects.toThrow(
      NotFoundError,
    );
    const events = await handle.repos.events.list(ctx, { entityType: "tenant_credential", limit: 10 });
    expect(events.map((e) => e.event)).toContain("tenant_credential.removed");
  });

  it("validates at the write door: unknown destination and malformed envelope store NOTHING", async () => {
    await expect(
      handle.repos.tenantCredentials.connect(ctx, {
        destination: "myspace" as never,
        envelope,
      }),
    ).rejects.toThrow();
    await expect(
      handle.repos.tenantCredentials.connect(ctx, {
        destination: "linkedin",
        envelope: { ...envelope, authTag: "" },
      }),
    ).rejects.toThrow();
    expect(await handle.repos.tenantCredentials.list(ctx)).toEqual([]);
  });
});
