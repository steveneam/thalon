import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { readEnv, type EnvSource } from "@thalon/platform";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TransportDisarmedError } from "../../outreach/transport";
import {
  vaultIntelEnvView,
  vaultOutreachEnvView,
  vaultSendTransportResolver,
} from "../env-view";
import { VaultKeyMissingError } from "../errors";
import { connectDestination, type VaultDeps } from "../vault";

/**
 * B-int.3 pins: THE precedence table, for the intel and outreach seat
 * families (the social family pins live in social-arming.test.ts — one
 * table, per-family proof): vault-only fills, env-only passes through,
 * both-set-env-wins, and the arming flags are never credential seats.
 */

const MASTER_B64 = Buffer.alloc(32, 9).toString("base64");

let handle: DbHandle;
let ctx: TenantCtx;

function deps(envSource: EnvSource = {}): VaultDeps {
  return {
    repos: handle.repos,
    ctx,
    env: readEnv({ THALON_VAULT_MASTER_KEY: MASTER_B64, ...envSource }),
  };
}

beforeEach(async () => {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  ctx = tenantCtx(tenant.id);
});

afterEach(async () => {
  await handle.close();
});

describe("vaultIntelEnvView", () => {
  it("vault-only: connected intel credentials fill the driver seats env left silent", async () => {
    await connectDestination(deps(), {
      destination: "intel_youtube",
      credentials: { apiKey: "vault-yt-key" },
    });
    await connectDestination(deps(), {
      destination: "intel_bluesky",
      credentials: { identifier: "self.bsky.social", appPassword: "app-pass" },
    });
    const view = await vaultIntelEnvView(deps());
    expect(view.YOUTUBE_API_KEY).toBe("vault-yt-key");
    expect(view.BLUESKY_IDENTIFIER).toBe("self.bsky.social");
    expect(view.BLUESKY_APP_PASSWORD).toBe("app-pass");
  });

  it("both set: env is the emergency override and wins", async () => {
    await connectDestination(deps(), {
      destination: "intel_youtube",
      credentials: { apiKey: "vault-yt-key" },
    });
    const view = await vaultIntelEnvView(deps({ YOUTUBE_API_KEY: "env-yt-key" }));
    expect(view.YOUTUBE_API_KEY).toBe("env-yt-key");
  });

  it("no intel rows → the view IS the env, untouched (env-only just passes through)", async () => {
    const d = deps({ YOUTUBE_API_KEY: "env-yt-key" });
    const view = await vaultIntelEnvView(d);
    expect(view).toEqual(d.env);
  });

  it("families stay walled: a connected SOCIAL credential never fills an intel seat", async () => {
    await connectDestination(deps(), {
      destination: "linkedin",
      credentials: { accessToken: "li-token" },
    });
    const view = await vaultIntelEnvView(deps());
    expect(view).toEqual(deps().env);
  });

  it("needs_reauth contributes nothing", async () => {
    await connectDestination(deps(), {
      destination: "intel_youtube",
      credentials: { apiKey: "vault-yt-key" },
    });
    await handle.repos.tenantCredentials.markStatus(ctx, "intel_youtube", "needs_reauth");
    const view = await vaultIntelEnvView(deps());
    expect(view.YOUTUBE_API_KEY).toBeUndefined();
  });

  it("rows exist but the master key vanished → loud VaultKeyMissingError, never silent degradation", async () => {
    await connectDestination(deps(), {
      destination: "intel_youtube",
      credentials: { apiKey: "vault-yt-key" },
    });
    const broken: VaultDeps = { repos: handle.repos, ctx, env: readEnv({}) };
    await expect(vaultIntelEnvView(broken)).rejects.toBeInstanceOf(VaultKeyMissingError);
  });
});

describe("vaultOutreachEnvView + vaultSendTransportResolver", () => {
  async function connectResend(apiKey = "vault-resend-key") {
    await connectDestination(deps(), {
      destination: "newsletter_resend",
      credentials: { apiKey },
    });
  }

  it("vault-only: newsletter_resend fills RESEND_API_KEY; env set wins", async () => {
    await connectResend();
    expect((await vaultOutreachEnvView(deps())).RESEND_API_KEY).toBe("vault-resend-key");
    expect(
      (await vaultOutreachEnvView(deps({ RESEND_API_KEY: "env-resend-key" }))).RESEND_API_KEY,
    ).toBe("env-resend-key");
  });

  it("arming ≠ credentials: the vault NEVER fills OUTREACH_SEND_ARMED — the founder GO stays env-side, exactly as frozen", async () => {
    await connectResend();
    const view = await vaultOutreachEnvView(deps());
    expect(view.OUTREACH_SEND_ARMED).toBeUndefined();
  });

  it("vault credential + env founder GO + sender identity → the live resend transport", async () => {
    await connectResend();
    const transport = await vaultSendTransportResolver(deps({ OUTREACH_SEND_ARMED: "true" }), {
      from: "Self <self@example.com>",
    });
    expect(transport.name).toBe("resend");
  });

  it("vault credential WITHOUT the founder GO → the refusing transport names OUTREACH_SEND_ARMED", async () => {
    await connectResend();
    const transport = await vaultSendTransportResolver(deps(), {
      from: "Self <self@example.com>",
    });
    expect(transport.name).toBe("disarmed");
    await expect(transport.sendEmail({ to: "a@b.c", subject: "s", text: "t" })).rejects.toThrow(
      TransportDisarmedError,
    );
    await expect(
      transport.sendEmail({ to: "a@b.c", subject: "s", text: "t" }),
    ).rejects.toThrow(/OUTREACH_SEND_ARMED/);
  });

  it("no credential anywhere → the refusal names RESEND_API_KEY", async () => {
    const transport = await vaultSendTransportResolver(deps({ OUTREACH_SEND_ARMED: "true" }), {
      from: "Self <self@example.com>",
    });
    await expect(
      transport.sendEmail({ to: "a@b.c", subject: "s", text: "t" }),
    ).rejects.toThrow(/RESEND_API_KEY/);
  });
});
