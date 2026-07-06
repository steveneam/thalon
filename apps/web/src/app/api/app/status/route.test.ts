import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/app/status", () => {
  it("reads the seam/driver/model readout from the platform env choke point — names only, never key material", async () => {
    const body = await (await GET()).json();
    expect(body.seams).toMatchObject({ db: expect.any(String), objectStore: expect.any(String) });
    expect(["configured", "unconfigured"]).toContain(body.seams.gateway);
    expect(["configured", "unconfigured"]).toContain(body.seams.tracing);
    expect(body.drivers).toEqual({
      render: expect.any(String),
      transcript: expect.any(String),
      searchIntel: expect.any(String),
    });
    expect(body.models.draft.length).toBeGreaterThan(0);
    expect(body.budget.tenantDailyTokens).toBeGreaterThan(0);
    expect(typeof body.tenantSlug).toBe("string");
    // No secret-bearing field ever crosses this wire.
    const flat = JSON.stringify(body).toLowerCase();
    expect(flat).not.toContain("key");
    expect(flat).not.toContain("secret");
  });
});
