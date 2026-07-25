import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { readEnv, type EnvSource } from "@thalon/platform";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isRefusingSocialPublisher } from "../../social/registry";
import { VaultKeyMissingError } from "../errors";
import { vaultSocialEnvView, vaultSocialPublisherResolver } from "../social-arming";
import { connectDestination, type VaultDeps } from "../vault";

/**
 * B-int.1 pins (ADR 0011 decision 3): the dogfood tenant runs vault-first —
 * vault token material fills seats env left silent, env stays the
 * emergency override when set, needs_reauth never arms, and the untouched
 * per-platform ratchet still demands the env-side ARMED founder GO.
 */

const MASTER_B64 = Buffer.alloc(32, 5).toString("base64");

let handle: DbHandle;
let ctx: TenantCtx;

function deps(envSource: EnvSource = {}): VaultDeps {
  return {
    repos: handle.repos,
    ctx,
    env: readEnv({ THALON_VAULT_MASTER_KEY: MASTER_B64, ...envSource }),
  };
}

async function connectLinkedIn(token = "vault-token") {
  await connectDestination(deps(), {
    destination: "linkedin",
    credentials: { accessToken: token },
  });
}

beforeEach(async () => {
  handle = await openTestDb();
  const tenant = await handle.repos.tenants.create({ slug: "self", name: "Self" });
  ctx = tenantCtx(tenant.id);
});

afterEach(async () => {
  await handle.close();
});

describe("vaultSocialEnvView (the precedence table)", () => {
  it("fills a seat env left silent with the vault's opened token", async () => {
    await connectLinkedIn("vault-token");
    const view = await vaultSocialEnvView(deps());
    expect(view.SOCIAL_LINKEDIN_ACCESS_TOKEN).toBe("vault-token");
  });

  it("env set = the emergency override wins over the vault", async () => {
    await connectLinkedIn("vault-token");
    const view = await vaultSocialEnvView(deps({ SOCIAL_LINKEDIN_ACCESS_TOKEN: "env-token" }));
    expect(view.SOCIAL_LINKEDIN_ACCESS_TOKEN).toBe("env-token");
  });

  it("fills driver EXTRAS too: a vault facebook credential contributes its pageId seat", async () => {
    await connectDestination(deps(), {
      destination: "facebook",
      credentials: { accessToken: "fb-token", pageId: "page-42" },
    });
    const view = await vaultSocialEnvView(deps());
    expect(view.SOCIAL_FACEBOOK_ACCESS_TOKEN).toBe("fb-token");
    expect(view.SOCIAL_FACEBOOK_PAGE_ID).toBe("page-42");
  });

  it("needs_reauth never arms: the row contributes nothing", async () => {
    await connectLinkedIn();
    await handle.repos.tenantCredentials.markStatus(ctx, "linkedin", "needs_reauth");
    const view = await vaultSocialEnvView(deps());
    expect(view.SOCIAL_LINKEDIN_ACCESS_TOKEN).toBeUndefined();
  });

  it("no social vault rows → the view IS the env, untouched", async () => {
    const d = deps({ SOCIAL_X_ACCESS_TOKEN: "envx" });
    const view = await vaultSocialEnvView(d);
    expect(view).toEqual(d.env);
  });

  it("rows exist but the master key vanished → loud VaultKeyMissingError, never silent disarming", async () => {
    await connectLinkedIn();
    const broken: VaultDeps = { repos: handle.repos, ctx, env: readEnv({}) };
    await expect(vaultSocialEnvView(broken)).rejects.toBeInstanceOf(VaultKeyMissingError);
  });
});

describe("vaultSocialPublisherResolver (the untouched ratchet over the merged view)", () => {
  it("vault credential + env ARMED GO → the real driver arms", async () => {
    await connectLinkedIn();
    const resolve = await vaultSocialPublisherResolver(deps({ SOCIAL_LINKEDIN_ARMED: "true" }));
    const publisher = resolve("linkedin");
    expect(isRefusingSocialPublisher(publisher)).toBe(false);
    expect(publisher.name).toBe("linkedin-rest-posts");
  });

  it("vault credential WITHOUT the founder GO still refuses, naming the ARMED flag — a connected account is not an armed one", async () => {
    await connectLinkedIn();
    const resolve = await vaultSocialPublisherResolver(deps());
    const publisher = resolve("linkedin");
    expect(isRefusingSocialPublisher(publisher)).toBe(true);
    expect(
      isRefusingSocialPublisher(publisher) ? publisher.refusal.message : "",
    ).toContain("SOCIAL_LINKEDIN_ARMED");
  });

  it("platforms stay independent: a vault linkedin credential never arms x", async () => {
    await connectLinkedIn();
    const resolve = await vaultSocialPublisherResolver(
      deps({ SOCIAL_LINKEDIN_ARMED: "true", SOCIAL_X_ARMED: "true" }),
    );
    expect(isRefusingSocialPublisher(resolve("x"))).toBe(true);
    expect(isRefusingSocialPublisher(resolve("linkedin"))).toBe(false);
  });
});
