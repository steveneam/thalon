import { credentialEnvelopeSchema, tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { readEnv, type ThalonEnv } from "@thalon/platform";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  VaultKeyMissingError,
  VaultNotConnectedError,
  VaultShapeError,
} from "../errors";
import {
  connectDestination,
  disconnectDestination,
  listCredentialCards,
  openDestinationCredentials,
  type VaultDeps,
} from "../vault";

/**
 * B-int.1 pins: the vault DOORS — paste validated against the destination
 * shape BEFORE crypto (a malformed paste stores nothing and never echoes),
 * rows store sealed, reads round-trip typed, and every user-facing
 * projection is a card with NO envelope fields. Extends the B-int.0
 * redaction pin one layer up.
 */

const MASTER_B64 = Buffer.alloc(32, 5).toString("base64");
const SECRET = "SUPERSECRET-pasted-token";
const ENVELOPE_FIELDS = ["ciphertext", "dataKeyWrapped", "iv", "authTag", "keyVersion"];

let handle: DbHandle;
let ctx: TenantCtx;
let otherCtx: TenantCtx;
let env: ThalonEnv;

function deps(overrides: Partial<VaultDeps> = {}): VaultDeps {
  return { repos: handle.repos, ctx, env, ...overrides };
}

beforeEach(async () => {
  handle = await openTestDb();
  const a = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  const b = await handle.repos.tenants.create({ slug: "other", name: "Other" });
  ctx = tenantCtx(a.id);
  otherCtx = tenantCtx(b.id);
  env = readEnv({ THALON_VAULT_MASTER_KEY: MASTER_B64 });
});

afterEach(async () => {
  await handle.close();
});

describe("connectDestination (the write door)", () => {
  it("seals before storing: the row carries a valid envelope and never the pasted token", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: SECRET },
      connectedAs: "Steven",
    });
    const row = await handle.repos.tenantCredentials.get(ctx, "linkedin");
    expect(row).not.toBeNull();
    expect(
      credentialEnvelopeSchema.safeParse({
        ciphertext: row!.ciphertext,
        dataKeyWrapped: row!.dataKeyWrapped,
        iv: row!.iv,
        authTag: row!.authTag,
        keyVersion: row!.keyVersion,
      }).success,
    ).toBe(true);
    expect(JSON.stringify(row)).not.toContain(SECRET);
  });

  it("returns a CARD — no envelope field rides a door's return value", async () => {
    const card = await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: SECRET },
    });
    for (const field of ENVELOPE_FIELDS) {
      expect(Object.keys(card)).not.toContain(field);
    }
    expect(card.destination).toBe("linkedin");
    expect(card.status).toBe("connected");
  });

  it("refuses a malformed paste BEFORE crypto: VaultShapeError with issue paths only, nothing stored", async () => {
    const thrown = await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { token: SECRET }, // wrong field name — the paste itself must never echo
    }).then(
      () => null,
      (err: Error) => err,
    );
    expect(thrown).toBeInstanceOf(VaultShapeError);
    expect((thrown as VaultShapeError).issuePaths).toContain("accessToken");
    expect(thrown!.message).not.toContain(SECRET);
    expect(await handle.repos.tenantCredentials.list(ctx)).toEqual([]);
  });

  it("refuses without a master key — a credential can never store unencrypted", async () => {
    await expect(
      connectDestination(deps({ env: readEnv({}) }), {
        destination: "linkedin",
        credentials: { accessToken: SECRET },
      }),
    ).rejects.toBeInstanceOf(VaultKeyMissingError);
    expect(await handle.repos.tenantCredentials.list(ctx)).toEqual([]);
  });
});

describe("openDestinationCredentials (the read door — engine seams only)", () => {
  it("round-trips the typed credentials", async () => {
    await connectDestination(deps(), {
      destination: "website_wordpress",
      credentials: { baseUrl: "https://example.com", username: "steve", applicationPassword: SECRET },
    });
    const creds = await openDestinationCredentials(deps(), "website_wordpress");
    expect(creds).toEqual({
      baseUrl: "https://example.com",
      username: "steve",
      applicationPassword: SECRET,
    });
  });

  it("refuses a never-connected destination", async () => {
    await expect(openDestinationCredentials(deps(), "x")).rejects.toBeInstanceOf(
      VaultNotConnectedError,
    );
  });

  it("is tenancy-walled through the repo: another tenant cannot open what it never connected", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: SECRET },
    });
    await expect(
      openDestinationCredentials(deps({ ctx: otherCtx }), "linkedin"),
    ).rejects.toBeInstanceOf(VaultNotConnectedError);
  });
});

describe("cards + disconnect", () => {
  it("listCredentialCards redacts every row — no envelope field in any card", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: SECRET },
      connectedAs: "Steven",
    });
    await connectDestination(deps(), {
      destination: "intel_youtube",
      credentials: { apiKey: SECRET },
    });
    const cards = await listCredentialCards(deps());
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      for (const field of ENVELOPE_FIELDS) {
        expect(Object.keys(card)).not.toContain(field);
      }
      expect(JSON.stringify(card)).not.toContain(SECRET);
    }
  });

  it("disconnect removes the row; the read door then refuses", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: SECRET },
    });
    await disconnectDestination(deps(), "linkedin");
    await expect(openDestinationCredentials(deps(), "linkedin")).rejects.toBeInstanceOf(
      VaultNotConnectedError,
    );
  });
});
