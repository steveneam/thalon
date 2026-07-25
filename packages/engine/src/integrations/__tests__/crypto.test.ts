import { describe, expect, it } from "vitest";
import {
  decodeVaultMasterKey,
  openCredential,
  sealCredential,
  VAULT_KEY_VERSION,
} from "../crypto";
import { VaultKeyInvalidError, VaultKeyMissingError, VaultOpenError } from "../errors";

/**
 * B-int.1 pins: the envelope crypto round-trips, refuses tampering, binds
 * every envelope to its row (tenant + destination AAD), and NEVER echoes
 * key material or plaintext through an error.
 */

const MASTER_B64 = Buffer.alloc(32, 7).toString("base64");
const OTHER_B64 = Buffer.alloc(32, 9).toString("base64");
const masterKey = () => decodeVaultMasterKey(MASTER_B64);

const TENANT = "11111111-1111-4111-8111-111111111111";
const SECRET = "SUPERSECRET-token-material-XYZ";

function seal(overrides: Partial<Parameters<typeof sealCredential>[0]> = {}) {
  return sealCredential({
    masterKey: masterKey(),
    tenantId: TENANT,
    destination: "linkedin",
    plaintext: SECRET,
    ...overrides,
  });
}

describe("vault master key decoding", () => {
  it("refuses absence and emptiness with VaultKeyMissingError", () => {
    expect(() => decodeVaultMasterKey(undefined)).toThrow(VaultKeyMissingError);
    expect(() => decodeVaultMasterKey("")).toThrow(VaultKeyMissingError);
  });

  it("refuses wrong-length and junk values with VaultKeyInvalidError, never echoing them", () => {
    for (const bad of ["short", Buffer.alloc(16, 1).toString("base64"), "!!!not-base64!!!"]) {
      const thrown = (() => {
        try {
          decodeVaultMasterKey(bad);
          return null;
        } catch (err) {
          return err as Error;
        }
      })();
      expect(thrown).toBeInstanceOf(VaultKeyInvalidError);
      expect(thrown?.message).not.toContain(bad);
    }
  });

  it("accepts exactly 32 base64 bytes", () => {
    expect(decodeVaultMasterKey(MASTER_B64)).toHaveLength(32);
  });
});

describe("seal/open round trip", () => {
  it("round-trips plaintext and stamps the current key version", () => {
    const envelope = seal();
    expect(envelope.keyVersion).toBe(VAULT_KEY_VERSION);
    expect(
      openCredential({ masterKey: masterKey(), tenantId: TENANT, destination: "linkedin", envelope }),
    ).toBe(SECRET);
  });

  it("uses fresh randomness per seal — same plaintext, different envelope every time", () => {
    const a = seal();
    const b = seal();
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.dataKeyWrapped).not.toBe(b.dataKeyWrapped);
  });

  it("never stores plaintext recoverable without the key: ciphertext differs from the secret", () => {
    const envelope = seal();
    expect(envelope.ciphertext).not.toContain(SECRET);
    expect(Buffer.from(envelope.ciphertext, "base64").toString("utf8")).not.toContain(SECRET);
  });
});

describe("open refusals (all VaultOpenError, all redacted)", () => {
  it("refuses tampered ciphertext", () => {
    const envelope = seal();
    const tampered = { ...envelope, ciphertext: Buffer.from("tampered!").toString("base64") };
    expect(() =>
      openCredential({ masterKey: masterKey(), tenantId: TENANT, destination: "linkedin", envelope: tampered }),
    ).toThrow(VaultOpenError);
  });

  it("refuses an envelope moved to another tenant (AAD binding)", () => {
    const envelope = seal();
    expect(() =>
      openCredential({
        masterKey: masterKey(),
        tenantId: "22222222-2222-4222-8222-222222222222",
        destination: "linkedin",
        envelope,
      }),
    ).toThrow(VaultOpenError);
  });

  it("refuses an envelope moved to another destination (AAD binding)", () => {
    const envelope = seal();
    expect(() =>
      openCredential({ masterKey: masterKey(), tenantId: TENANT, destination: "x", envelope }),
    ).toThrow(VaultOpenError);
  });

  it("refuses the wrong master key", () => {
    const envelope = seal();
    expect(() =>
      openCredential({
        masterKey: decodeVaultMasterKey(OTHER_B64),
        tenantId: TENANT,
        destination: "linkedin",
        envelope,
      }),
    ).toThrow(VaultOpenError);
  });

  it("refuses an unknown key version, naming versions only", () => {
    const envelope = { ...seal(), keyVersion: 99 };
    const thrown = (() => {
      try {
        openCredential({ masterKey: masterKey(), tenantId: TENANT, destination: "linkedin", envelope });
        return null;
      } catch (err) {
        return err as Error;
      }
    })();
    expect(thrown).toBeInstanceOf(VaultOpenError);
    expect(thrown?.message).toContain("99");
  });

  it("REDACTION: no refusal message ever carries plaintext, key material, or envelope contents", () => {
    const envelope = seal();
    const attempts: Array<() => void> = [
      () =>
        openCredential({
          masterKey: decodeVaultMasterKey(OTHER_B64),
          tenantId: TENANT,
          destination: "linkedin",
          envelope,
        }),
      () =>
        openCredential({
          masterKey: masterKey(),
          tenantId: TENANT,
          destination: "linkedin",
          envelope: { ...envelope, authTag: Buffer.alloc(16, 3).toString("base64") },
        }),
      () =>
        openCredential({
          masterKey: masterKey(),
          tenantId: TENANT,
          destination: "linkedin",
          envelope: { ...envelope, keyVersion: 5 },
        }),
    ];
    for (const attempt of attempts) {
      const thrown = (() => {
        try {
          attempt();
          return null;
        } catch (err) {
          return err as Error;
        }
      })();
      expect(thrown).toBeInstanceOf(VaultOpenError);
      const message = thrown?.message ?? "";
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain(MASTER_B64);
      expect(message).not.toContain(OTHER_B64);
      expect(message).not.toContain(envelope.ciphertext);
      expect(message).not.toContain(envelope.dataKeyWrapped);
    }
  });
});
