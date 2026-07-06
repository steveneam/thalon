import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { dogfoodInputSchema, loadDogfoodInput, TENANT_ZERO } from "../dogfood";

/** Shipped tenant-run configs (B2.1: tenants land as data files, never code). */
const shippedTenantsDir = fileURLToPath(
  new URL("../../../proprietary/profiles/tenants", import.meta.url),
);

let tmp: string | undefined;
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = undefined;
});

function writeTmpJson(value: unknown): string {
  tmp = mkdtempSync(path.join(tmpdir(), "thalon-dogfood-input-"));
  const file = path.join(tmp, "tenant.json");
  writeFileSync(file, JSON.stringify(value), "utf8");
  return file;
}

const validInput = {
  tenantSlug: "tenant-two",
  tenantName: "Tenant Two (fictional)",
  brandConfig: {
    voice: { register: "warm" },
    denylist: ["guaranteed"],
    platformProfiles: {
      linkedin: { tone: "practical", charLimit: 2800 },
    },
  },
  prompt: "A groundable announcement with concrete facts.",
  platforms: ["linkedin", "x"],
};

describe("dogfood input as data (B2.1)", () => {
  it("the built-in tenant #0 satisfies the same schema as file-supplied tenants", () => {
    expect(() => dogfoodInputSchema.parse(TENANT_ZERO)).not.toThrow();
  });

  it("tenant #0 IS the tracked self profile (B6.3): real Thalon identity, pillar-#1 prompt locked to Thalon itself", () => {
    // The deep profile lives in proprietary/profiles/tenants/self.v1.json —
    // data, never code. These pins keep the load-bearing parts from drifting:
    // the slug the web app's demo-tenant lookup expects, the real identity,
    // the platforms the dogfood slice tests exercise, and the composition
    // styling seam (deriveBrandStyle reads identity.style at render time).
    expect(TENANT_ZERO.tenantSlug).toBe("self");
    expect(TENANT_ZERO.brandConfig.identity?.company).toBe("Thalon");
    expect(TENANT_ZERO.prompt).toContain("Thalon");
    expect(TENANT_ZERO.platforms).toEqual(["linkedin", "x"]);
    expect(TENANT_ZERO.brandConfig.denylist).toContain("guaranteed");
    const identity = TENANT_ZERO.brandConfig.identity as Record<string, unknown>;
    expect(identity.style).toMatchObject({
      background: expect.stringMatching(/^#[0-9a-f]{6}$/),
      accentColor: expect.stringMatching(/^#[0-9a-f]{6}$/),
    });
  });

  it("loads and validates a tenant-run JSON file", () => {
    const input = loadDogfoodInput(writeTmpJson(validInput));
    expect(input.tenantSlug).toBe("tenant-two");
    expect(input.brandConfig.platformProfiles?.linkedin?.charLimit).toBe(2800);
    expect(input.platforms).toEqual(["linkedin", "x"]);
  });

  it("rejects an input file with no prompt or no platforms — loudly, before any DB write", () => {
    expect(() => loadDogfoodInput(writeTmpJson({ ...validInput, prompt: "" }))).toThrow();
    expect(() => loadDogfoodInput(writeTmpJson({ ...validInput, platforms: [] }))).toThrow();
  });

  it("every shipped tenant config in proprietary/profiles/tenants validates", () => {
    let entries: string[] = [];
    try {
      entries = readdirSync(shippedTenantsDir).filter((f) => f.endsWith(".json"));
    } catch {
      // Directory may not exist yet — the ratchet arms itself the moment the first tenant file ships.
    }
    for (const entry of entries) {
      expect(() => loadDogfoodInput(path.join(shippedTenantsDir, entry)), entry).not.toThrow();
    }
  });
});
