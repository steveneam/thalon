import { describe, expect, it } from "vitest";
import {
  SocialCredentialInvalidError,
  SocialPublisherDisarmedError,
} from "../errors";
import {
  createFakeSocialPublisher,
  isRefusingSocialPublisher,
  resolveSocialPublisher,
  socialArmKeys,
  type SocialPostInput,
  type SocialPublisher,
} from "../registry";

const INPUT: SocialPostInput = { draftId: "draft-1", text: "An approved post body." };

/** A stand-in driver a B-pub.2+ bucket would register — never shipped by B-pub.1 itself. */
const linkedinDriver = (config: { accessToken: string }): SocialPublisher => ({
  platform: "linkedin",
  name: `linkedin-test-driver:${config.accessToken}`,
  async publish() {
    return { externalPostId: "li-1" };
  },
});

async function refusal(publisher: SocialPublisher): Promise<SocialPublisherDisarmedError> {
  expect(isRefusingSocialPublisher(publisher)).toBe(true);
  const rejection = await publisher.publish(INPUT).catch((err) => err);
  expect(rejection).toBeInstanceOf(SocialPublisherDisarmedError);
  return rejection as SocialPublisherDisarmedError;
}

describe("socialArmKeys (the per-platform two-key naming convention)", () => {
  it("derives the credential + founder-GO pair per platform", () => {
    expect(socialArmKeys("linkedin")).toEqual({
      credential: "SOCIAL_LINKEDIN_ACCESS_TOKEN",
      armed: "SOCIAL_LINKEDIN_ARMED",
    });
    expect(socialArmKeys("tiktok")).toEqual({
      credential: "SOCIAL_TIKTOK_ACCESS_TOKEN",
      armed: "SOCIAL_TIKTOK_ARMED",
    });
  });
});

describe("resolveSocialPublisher (per-platform arming ratchet — disarmed by default)", () => {
  it("an empty env refuses, naming every missing arm verbatim (credential, founder GO, driver)", async () => {
    const publisher = resolveSocialPublisher("linkedin", {});
    expect(publisher.name).toBe("disarmed");
    const err = await refusal(publisher);
    const named = err.missing.join(" ");
    expect(named).toContain("SOCIAL_LINKEDIN_ACCESS_TOKEN");
    expect(named).toContain("SOCIAL_LINKEDIN_ARMED");
    expect(named).toContain("driver");
    expect(err.message).toContain("SOCIAL_LINKEDIN_ACCESS_TOKEN");
  });

  it("the credential alone must NOT arm — the founder GO is the flag", async () => {
    const publisher = resolveSocialPublisher(
      "linkedin",
      { SOCIAL_LINKEDIN_ACCESS_TOKEN: "tok_x" },
      { linkedin: linkedinDriver },
    );
    const err = await refusal(publisher);
    expect(err.missing).toHaveLength(1);
    expect(err.missing[0]).toContain("SOCIAL_LINKEDIN_ARMED");
  });

  it("the flag alone must NOT arm — no credential, no driver call", async () => {
    const publisher = resolveSocialPublisher(
      "linkedin",
      { SOCIAL_LINKEDIN_ARMED: "true" },
      { linkedin: linkedinDriver },
    );
    const err = await refusal(publisher);
    expect(err.missing).toEqual(["SOCIAL_LINKEDIN_ACCESS_TOKEN"]);
  });

  it('arming is EXACTLY the string "true" — case variants and truthy strings stay disarmed', () => {
    for (const value of ["TRUE", "True", "1", "yes", "armed"]) {
      const publisher = resolveSocialPublisher(
        "linkedin",
        { SOCIAL_LINKEDIN_ACCESS_TOKEN: "tok_x", SOCIAL_LINKEDIN_ARMED: value },
        { linkedin: linkedinDriver },
      );
      expect(publisher.name, `SOCIAL_LINKEDIN_ARMED=${value}`).toBe("disarmed");
    }
  });

  it("a blank credential counts as unset — the readEnv blank-line rule", async () => {
    const publisher = resolveSocialPublisher(
      "linkedin",
      { SOCIAL_LINKEDIN_ACCESS_TOKEN: "", SOCIAL_LINKEDIN_ARMED: "true" },
      { linkedin: linkedinDriver },
    );
    const err = await refusal(publisher);
    expect(err.missing).toEqual(["SOCIAL_LINKEDIN_ACCESS_TOKEN"]);
  });

  it("both env arms WITHOUT an installed driver still refuse — B-pub.1 ships zero drivers, so everything refuses", async () => {
    const publisher = resolveSocialPublisher("linkedin", {
      SOCIAL_LINKEDIN_ACCESS_TOKEN: "tok_x",
      SOCIAL_LINKEDIN_ARMED: "true",
    });
    const err = await refusal(publisher);
    expect(err.missing).toHaveLength(1);
    expect(err.missing[0]).toContain("driver");
  });

  it("both arms + an installed driver resolve the driver publisher", () => {
    const publisher = resolveSocialPublisher(
      "linkedin",
      { SOCIAL_LINKEDIN_ACCESS_TOKEN: "tok_x", SOCIAL_LINKEDIN_ARMED: "true" },
      { linkedin: linkedinDriver },
    );
    expect(publisher.name).toBe("linkedin-test-driver:tok_x");
    expect(isRefusingSocialPublisher(publisher)).toBe(false);
  });

  it("platforms arm INDEPENDENTLY — a fully armed linkedin never arms x", async () => {
    const env = { SOCIAL_LINKEDIN_ACCESS_TOKEN: "tok_x", SOCIAL_LINKEDIN_ARMED: "true" };
    const drivers = { linkedin: linkedinDriver };
    expect(resolveSocialPublisher("linkedin", env, drivers).name).toBe(
      "linkedin-test-driver:tok_x",
    );
    const x = resolveSocialPublisher("x", env, drivers);
    const err = await refusal(x);
    const named = err.missing.join(" ");
    expect(named).toContain("SOCIAL_X_ACCESS_TOKEN");
    expect(named).toContain("SOCIAL_X_ARMED");
    expect(named).toContain("x driver");
  });

  it("an armed platform with a whitespace-broken credential refuses as credential_invalid — never reaches the driver", async () => {
    for (const broken of ["tok x", "tok\nx", "tok\tx"]) {
      const publisher = resolveSocialPublisher(
        "linkedin",
        { SOCIAL_LINKEDIN_ACCESS_TOKEN: broken, SOCIAL_LINKEDIN_ARMED: "true" },
        { linkedin: linkedinDriver },
      );
      expect(publisher.name).toBe("disarmed");
      const rejection = await publisher.publish(INPUT).catch((err) => err);
      expect(rejection).toBeInstanceOf(SocialCredentialInvalidError);
      expect((rejection as SocialCredentialInvalidError).key).toBe(
        "SOCIAL_LINKEDIN_ACCESS_TOKEN",
      );
    }
  });

  it("the refusing publisher exposes the SAME refusal its publish() throws (the door reads it without a call)", async () => {
    const publisher = resolveSocialPublisher("linkedin", {});
    expect(isRefusingSocialPublisher(publisher)).toBe(true);
    if (!isRefusingSocialPublisher(publisher)) throw new Error("unreachable");
    const rejection = await publisher.publish(INPUT).catch((err) => err);
    expect(rejection).toBe(publisher.refusal);
  });
});

describe("createFakeSocialPublisher", () => {
  it("records every call and mints deterministic accepted-post ids", async () => {
    const publisher = createFakeSocialPublisher();
    expect(publisher.platform).toBe("linkedin");
    expect(await publisher.publish(INPUT)).toEqual({ externalPostId: "fake-post-1" });
    expect(await publisher.publish(INPUT)).toEqual({ externalPostId: "fake-post-2" });
    expect(publisher.calls).toEqual([INPUT, INPUT]);
  });

  it("failWith throws AFTER recording the call — tests can see the door reached the publisher", async () => {
    const publisher = createFakeSocialPublisher({ failWith: new Error("platform down") });
    await expect(publisher.publish(INPUT)).rejects.toThrow("platform down");
    expect(publisher.calls).toHaveLength(1);
  });
});
