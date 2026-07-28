import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle } from "@thalon/db";
import { readEnv, type EnvSource } from "@thalon/platform";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isRefusingSocialPublisher } from "../../social/registry";
import { VaultKeyMissingError } from "../errors";
import {
  socialArmed,
  vaultSocialEnvView,
  vaultSocialPublisherResolver,
  type SocialArmingDeps,
} from "../social-arming";
import { connectDestination } from "../vault";

/**
 * B-int.1 + B-int.3 pins (ADR 0011): the tenant runs vault-first — vault
 * token material fills seats env left silent, env stays the emergency
 * override when set, needs_reauth never arms — and ARMING IS TENANT DATA:
 * the platform present in the social config block + its vault credential
 * connected arms the untouched per-platform ratchet, with the env
 * `SOCIAL_<P>_ARMED` pair winning wherever it is literally set.
 */

const MASTER_B64 = Buffer.alloc(32, 5).toString("base64");

let handle: DbHandle;
let ctx: TenantCtx;

function deps(envSource: EnvSource = {}): SocialArmingDeps {
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

/** The tenant's social config block — the arming rung's tenant-data half. */
async function configureSocial(social: Record<string, { maxPostsPerDay: number }>) {
  await handle.repos.brandProfiles.create(ctx, {
    config: { voice: {}, denylist: [], platformProfiles: {}, social },
    activate: true,
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
    const broken: SocialArmingDeps = { repos: handle.repos, ctx, env: readEnv({}) };
    await expect(vaultSocialEnvView(broken)).rejects.toBeInstanceOf(VaultKeyMissingError);
  });

  it("B-int.3 arming rung: config block + connected credential fills the ARMED seat where env is silent", async () => {
    await connectLinkedIn();
    await configureSocial({ linkedin: { maxPostsPerDay: 1 } });
    const view = await vaultSocialEnvView(deps());
    expect(view.SOCIAL_LINKEDIN_ARMED).toBe("true");
  });

  it("the ARMED env seat, when literally set, wins over tenant data — both directions stay the operator's", async () => {
    await connectLinkedIn();
    await configureSocial({ linkedin: { maxPostsPerDay: 1 } });
    const view = await vaultSocialEnvView(deps({ SOCIAL_LINKEDIN_ARMED: "false" }));
    expect(view.SOCIAL_LINKEDIN_ARMED).toBe("false");
  });
});

describe("vaultSocialPublisherResolver (the untouched ratchet over the merged view)", () => {
  it("TENANT DATA ARMS: platform in the social block + connected vault credential → the real driver, no env pair at all", async () => {
    await connectLinkedIn();
    await configureSocial({ linkedin: { maxPostsPerDay: 1 } });
    const resolve = await vaultSocialPublisherResolver(deps());
    const publisher = resolve("linkedin");
    expect(isRefusingSocialPublisher(publisher)).toBe(false);
    expect(publisher.name).toBe("linkedin-rest-posts");
  });

  it("a connected credential WITHOUT the platform in the social block stays unarmed — config presence is the arming rung", async () => {
    await connectLinkedIn();
    await configureSocial({ x: { maxPostsPerDay: 1 } });
    const publisher = (await vaultSocialPublisherResolver(deps()))("linkedin");
    expect(isRefusingSocialPublisher(publisher)).toBe(true);
    expect(
      isRefusingSocialPublisher(publisher) ? publisher.refusal.message : "",
    ).toContain("SOCIAL_LINKEDIN_ARMED");
  });

  it("a configured platform WITHOUT a connected vault credential stays unarmed — even when env carries a token", async () => {
    await configureSocial({ linkedin: { maxPostsPerDay: 1 } });
    const publisher = (
      await vaultSocialPublisherResolver(deps({ SOCIAL_LINKEDIN_ACCESS_TOKEN: "env-token" }))
    )("linkedin");
    expect(isRefusingSocialPublisher(publisher)).toBe(true);
  });

  it("needs_reauth disarms the tenant-data rung: config present, credential stale → refusal", async () => {
    await connectLinkedIn();
    await configureSocial({ linkedin: { maxPostsPerDay: 1 } });
    await handle.repos.tenantCredentials.markStatus(ctx, "linkedin", "needs_reauth");
    const publisher = (await vaultSocialPublisherResolver(deps()))("linkedin");
    expect(isRefusingSocialPublisher(publisher)).toBe(true);
  });

  it("env force-DISARM: the ARMED pair set to anything but \"true\" beats tenant data — the emergency kill switch", async () => {
    await connectLinkedIn();
    await configureSocial({ linkedin: { maxPostsPerDay: 1 } });
    const publisher = (
      await vaultSocialPublisherResolver(deps({ SOCIAL_LINKEDIN_ARMED: "false" }))
    )("linkedin");
    expect(isRefusingSocialPublisher(publisher)).toBe(true);
  });

  it("env force-ARM: the dogfood posture keeps posting mid-transition — env pair + env token, zero tenant data", async () => {
    const resolve = await vaultSocialPublisherResolver(
      deps({ SOCIAL_LINKEDIN_ACCESS_TOKEN: "env-token", SOCIAL_LINKEDIN_ARMED: "true" }),
    );
    const publisher = resolve("linkedin");
    expect(isRefusingSocialPublisher(publisher)).toBe(false);
    expect(publisher.name).toBe("linkedin-rest-posts");
  });

  it("vault credential alone (no config block, no env GO) still refuses — a connected account is not an armed one", async () => {
    await connectLinkedIn();
    const resolve = await vaultSocialPublisherResolver(deps());
    const publisher = resolve("linkedin");
    expect(isRefusingSocialPublisher(publisher)).toBe(true);
    expect(
      isRefusingSocialPublisher(publisher) ? publisher.refusal.message : "",
    ).toContain("SOCIAL_LINKEDIN_ARMED");
  });

  it("platforms stay independent: linkedin's tenant-data arming never arms x", async () => {
    await connectLinkedIn();
    await configureSocial({ linkedin: { maxPostsPerDay: 1 }, x: { maxPostsPerDay: 1 } });
    const resolve = await vaultSocialPublisherResolver(deps());
    expect(isRefusingSocialPublisher(resolve("x"))).toBe(true);
    expect(isRefusingSocialPublisher(resolve("linkedin"))).toBe(false);
  });
});

/**
 * s78 — `socialArmed` is the ONE arming answer, extracted so the Integrations
 * card and the publish ratchet cannot drift into two spellings of "armed".
 * Pure: no vault, no db. The env pair is the emergency OVERRIDE and wins in
 * BOTH directions, which is the part a second implementation always gets
 * wrong (it is easy to treat an override as arm-only).
 */
describe("socialArmed — the one arming answer (s78)", () => {
  const bare = readEnv({});

  it("needs BOTH a credential and a social-block entry", () => {
    expect(socialArmed(bare, "linkedin", { connected: true, configured: true }).armed).toBe(true);
    expect(socialArmed(bare, "linkedin", { connected: true, configured: false }).armed).toBe(false);
    expect(socialArmed(bare, "linkedin", { connected: false, configured: true }).armed).toBe(false);
    expect(socialArmed(bare, "linkedin", { connected: false, configured: false }).armed).toBe(false);
  });

  it("names WHY, distinguishing a missing credential from a missing social entry", () => {
    expect(socialArmed(bare, "x", { connected: false, configured: true }).reason).toContain(
      "no stored credential",
    );
    expect(socialArmed(bare, "x", { connected: true, configured: false }).reason).toContain(
      'no "x" entry',
    );
  });

  it("the env seat overrides in BOTH directions", () => {
    const forceOn = readEnv({ SOCIAL_FACEBOOK_ARMED: "true" });
    const forceOff = readEnv({ SOCIAL_FACEBOOK_ARMED: "false" });

    // Force-ARMS a platform the tenant never configured…
    const on = socialArmed(forceOn, "facebook", { connected: false, configured: false });
    expect(on.armed).toBe(true);
    expect(on.reason).toContain("force-armed");

    // …and force-DISARMS one the tenant did.
    const off = socialArmed(forceOff, "facebook", { connected: true, configured: true });
    expect(off.armed).toBe(false);
    expect(off.reason).toContain("force-disarmed");
  });

  it("anything other than the literal \"true\" disarms — a typo never arms a platform", () => {
    const typo = readEnv({ SOCIAL_INSTAGRAM_ARMED: "TRUE" });
    expect(socialArmed(typo, "instagram", { connected: true, configured: true }).armed).toBe(false);
  });
});

describe("D1 (s83): the proof pair arms through the same one ratchet", () => {
  it("bluesky: a vaulted pair + configured tenant fills BOTH seats (password on the token seat, identifier on the extra) and resolves a live driver", async () => {
    await connectDestination(deps(), {
      destination: "bluesky",
      credentials: { identifier: "steve.bsky.social", appPassword: "app-pw" },
    });
    await configureSocial({ bluesky: { maxPostsPerDay: 1 } });
    const view = await vaultSocialEnvView(deps());
    expect(view.SOCIAL_BLUESKY_ACCESS_TOKEN).toBe("app-pw");
    expect(view.SOCIAL_BLUESKY_IDENTIFIER).toBe("steve.bsky.social");
    expect(view.SOCIAL_BLUESKY_ARMED).toBe("true");
    const resolve = await vaultSocialPublisherResolver(deps());
    const publisher = resolve("bluesky");
    expect(isRefusingSocialPublisher(publisher)).toBe(false);
    expect(publisher.name).toBe("bluesky-post");
  });

  it("reddit: the vaulted dance yield fills the access-token seat (refresh token deliberately NOT a seat) and resolves a live driver", async () => {
    await connectDestination(deps(), {
      destination: "reddit",
      credentials: { accessToken: "at_vault", refreshToken: "rt_vault" },
    });
    await configureSocial({ reddit: { maxPostsPerDay: 1 } });
    const view = await vaultSocialEnvView(deps());
    expect(view.SOCIAL_REDDIT_ACCESS_TOKEN).toBe("at_vault");
    expect(view.SOCIAL_REDDIT_ARMED).toBe("true");
    expect(Object.values(view)).not.toContain("rt_vault");
    const resolve = await vaultSocialPublisherResolver(deps());
    const publisher = resolve("reddit");
    expect(isRefusingSocialPublisher(publisher)).toBe(false);
    expect(publisher.name).toBe("reddit-submit");
  });

  it("an unconfigured proof platform stays a refusing publisher naming its missing arms — connecting is not arming", async () => {
    await connectDestination(deps(), {
      destination: "bluesky",
      credentials: { identifier: "steve.bsky.social", appPassword: "app-pw" },
    });
    const resolve = await vaultSocialPublisherResolver(deps());
    const publisher = resolve("bluesky");
    expect(isRefusingSocialPublisher(publisher)).toBe(true);
  });
});
