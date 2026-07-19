import type { SocialPlatform } from "@thalon/contracts";
import type { EnvSource } from "@thalon/platform";
import {
  SocialCredentialInvalidError,
  SocialPublisherDisarmedError,
  type PublishRefusedError,
} from "./errors";

/**
 * B-pub.1 (Sprint-8): the social publisher SEAM — the outreach
 * ./outreach/transport.ts pattern applied per platform. The publish door
 * (./publish.ts) takes a publisher resolver through deps — there is
 * deliberately NO default that reaches the network: tests inject the fake,
 * and the only production wiring is `resolveSocialPublisher`, whose
 * per-platform arming ratchet returns a REFUSING publisher unless the
 * operator set the platform's credential AND its founder-GO flag AND a
 * driver is installed. B-pub.1 ships ZERO drivers, so every platform
 * refuses even fully armed — live posting is structurally impossible until
 * a driver bucket (B-pub.2+) lands behind its own per-platform founder GO.
 *
 * Env keys are read from a passed `EnvSource` (the same record `readEnv`
 * consumes), never from the process environment directly (SPINE §3.2 —
 * platform env.ts is the ONE reader; the boundary ratchet greps for the
 * literal, comments included, which is why this note names it obliquely).
 * The SOCIAL_* arming pairs are declared in the platform env schema
 * (Sprint-8 window 2); driver-specific extras (page ids etc.) land with
 * their driver at B-pub.2+ as their own reviewed additions.
 */

export interface SocialPostInput {
  /** The approved draft this post publishes — the ledger's audit key. */
  draftId: string;
  /** The judged body verbatim (post format: body IS the authored copy) — the publisher must not alter it. */
  text: string;
}

/** A platform-ACCEPTED result — official-API semantics only (ADR 0002): the id is the platform's, never invented. */
export interface SocialPublishReceipt {
  /** The platform's accepted post id — becomes the ledger row's external_post_id. */
  externalPostId: string;
  /** Platform extras (permalink, API echoes) recorded into the ledger row's meta. */
  meta?: Record<string, unknown>;
}

export interface SocialPublisher {
  readonly platform: SocialPlatform;
  /** Driver label for messages and tests ("fake" | "disarmed" | a driver name, B-pub.2+). */
  readonly name: string;
  /** One official-API call. Resolves ONLY on a platform-accepted post. */
  publish(input: SocialPostInput): Promise<SocialPublishReceipt>;
}

/** The refusing publisher: exposes its typed refusal so the door can refuse in ladder order WITHOUT a call; publish() throws the same error (the backstop). */
export interface RefusingSocialPublisher extends SocialPublisher {
  readonly name: "disarmed";
  readonly refusal: PublishRefusedError;
}

export function isRefusingSocialPublisher(
  publisher: SocialPublisher,
): publisher is RefusingSocialPublisher {
  return publisher.name === "disarmed" && "refusal" in publisher;
}

/** The per-platform arming pair, derived — e.g. linkedin → SOCIAL_LINKEDIN_ACCESS_TOKEN + SOCIAL_LINKEDIN_ARMED (the outreach RESEND_API_KEY + OUTREACH_SEND_ARMED convention, platform-scoped). */
export function socialArmKeys(platform: SocialPlatform): { credential: string; armed: string } {
  const upper = platform.toUpperCase();
  return {
    credential: `SOCIAL_${upper}_ACCESS_TOKEN`,
    armed: `SOCIAL_${upper}_ARMED`,
  };
}

/** How a driver bucket (B-pub.2+) registers a platform driver — credentials in, publisher out. */
export type SocialDriverFactory = (config: { accessToken: string }) => SocialPublisher;

/** The readEnv blank-line rule, mirrored: an empty string never silently arms a seam. */
function readArm(env: EnvSource, key: string): string | undefined {
  const value = env[key];
  return value === undefined || value === "" ? undefined : value;
}

/** Deterministic credential SHAPE check (a dead credential surfaces from the driver at B-pub.2+). */
function credentialShapeProblem(token: string): string | null {
  if (/\s/.test(token)) {
    return "contains whitespace or line breaks — a credential must be a single unbroken token";
  }
  // eslint-disable-next-line no-control-regex -- control chars in a pasted secret are exactly what this detects
  if (/[\u0000-\u001f\u007f]/.test(token)) {
    return "contains control characters — the paste is corrupt";
  }
  return null;
}

function refusingSocialPublisher(
  platform: SocialPlatform,
  refusal: PublishRefusedError,
): RefusingSocialPublisher {
  return {
    platform,
    name: "disarmed",
    refusal,
    async publish() {
      throw refusal;
    },
  };
}

/**
 * The per-platform arming ratchet: a driver publisher is returned ONLY when
 * the platform's credential key AND its `*_ARMED="true"` founder GO are set
 * — two distinct keys, because the founder GO is the flag and a credential
 * landing in the environment must never arm by itself — AND a driver is
 * installed for the platform. Anything less returns a refusing publisher
 * whose error names every missing arm. Each platform arms INDEPENDENTLY:
 * one dead credential never blocks another platform.
 */
export function resolveSocialPublisher(
  platform: SocialPlatform,
  env: EnvSource,
  drivers: Partial<Record<SocialPlatform, SocialDriverFactory>> = {},
): SocialPublisher {
  const keys = socialArmKeys(platform);
  const token = readArm(env, keys.credential);
  const missing: string[] = [];
  if (!token) missing.push(keys.credential);
  if (readArm(env, keys.armed) !== "true") {
    missing.push(`${keys.armed} (exactly "true" — the per-platform founder GO)`);
  }
  const factory = drivers[platform];
  if (!factory) {
    missing.push(
      `${platform} driver (B-pub.1 ships no drivers — official-API drivers land per-platform at B-pub.2+)`,
    );
  }
  if (!token || !factory || missing.length > 0) {
    return refusingSocialPublisher(platform, new SocialPublisherDisarmedError(platform, missing));
  }
  const problem = credentialShapeProblem(token);
  if (problem) {
    return refusingSocialPublisher(
      platform,
      new SocialCredentialInvalidError(platform, keys.credential, problem),
    );
  }
  return factory({ accessToken: token });
}

export interface FakeSocialPublisher extends SocialPublisher {
  /** Every input the door handed over, in order — the tests' assertion surface. */
  readonly calls: SocialPostInput[];
}

/**
 * The tests' publisher: deterministic accepted-post ids, zero network.
 * `failWith` simulates a platform failure AFTER the door reached the
 * publisher — the call is still recorded so tests can assert the door got
 * this far while proving nothing landed in the ledger.
 */
export function createFakeSocialPublisher(
  opts: { platform?: SocialPlatform; failWith?: Error } = {},
): FakeSocialPublisher {
  const calls: SocialPostInput[] = [];
  return {
    platform: opts.platform ?? "linkedin",
    name: "fake",
    calls,
    async publish(input) {
      calls.push(input);
      if (opts.failWith) throw opts.failWith;
      return { externalPostId: `fake-post-${calls.length}` };
    },
  };
}
