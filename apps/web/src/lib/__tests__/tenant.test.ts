import type { Repos } from "@thalon/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoTenantSlug, resolveTenantCtx } from "../tenant";

afterEach(() => {
  vi.unstubAllEnvs();
});

function fakeRepos(known: Record<string, { id: string }>) {
  const getBySlug = vi.fn(async (slug: string) => known[slug] ?? null);
  return { repos: { tenants: { getBySlug } } as unknown as Repos, getBySlug };
}

describe("tenant resolution is runtime config (B2.1)", () => {
  it("defaults to tenant #0 (slug 'self') when DEMO_TENANT_SLUG is unset", async () => {
    expect(demoTenantSlug()).toBe("self");
    const { repos, getBySlug } = fakeRepos({ self: { id: "t0" } });
    const ctx = await resolveTenantCtx(repos);
    expect(getBySlug).toHaveBeenCalledWith("self");
    expect(ctx?.tenantId).toBe("t0");
  });

  it("operates as the env-configured tenant — a second tenant needs env, not code", async () => {
    vi.stubEnv("DEMO_TENANT_SLUG", "tenant-two");
    const { repos, getBySlug } = fakeRepos({ "tenant-two": { id: "t2" } });
    const ctx = await resolveTenantCtx(repos);
    expect(getBySlug).toHaveBeenCalledWith("tenant-two");
    expect(ctx?.tenantId).toBe("t2");
  });

  it("returns null (empty state, not an error) when the configured tenant is unseeded", async () => {
    vi.stubEnv("DEMO_TENANT_SLUG", "nobody-yet");
    const { repos } = fakeRepos({});
    expect(await resolveTenantCtx(repos)).toBeNull();
  });
});
