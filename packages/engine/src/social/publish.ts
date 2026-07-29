import {
  resolveDraftFormatSpec,
  socialPlatformSchema,
  socialPublishConfigSchema,
  type SocialPlatform,
  type SocialPublishConfig,
  type TenantCtx,
} from "@thalon/contracts";
import { ArtifactMissingError, type BrandProfile, type Draft, type Repos, type SocialPublicationRow } from "@thalon/db";
import { getContentAddressed, getObjectStore, type ObjectStore } from "@thalon/platform";
import { z } from "zod";
import {
  DraftAlreadyPublishedError,
  SocialDailyCapReachedError,
  SocialDraftNotApprovedError,
  SocialFormatNotPublishableError,
  SocialPublishDisarmedError,
} from "./errors";
import {
  isRefusingSocialPublisher,
  type SocialPostMedia,
  type SocialPublisher,
} from "./registry";

/**
 * B-pub.1 (Sprint-8 window): the publish door — the ONLY path from an
 * APPROVED `post`-family draft to a platform call, built TO the door and
 * never through it (live posting is a separate per-platform founder GO;
 * deps.resolvePublisher has no network-reaching default, and B-pub.1 ships
 * zero drivers). Mirrors the outreach send door (../outreach/send.ts):
 * deterministic clock passed in, never read in core; every refusal below
 * is an executable invariant with its own typed error (./errors.ts) and
 * its own test, checked in ladder order a→f:
 *
 *   a. draft exists (tenant-walled get), registry-resolved `post` family,
 *      status APPROVED (approval happens through the approvals path — the
 *      judge gate + drafts.transition — never here);
 *   b. the platform's publisher is armed — a refusing publisher carries
 *      its typed refusal (unarmed platform / invalid credential shape)
 *      and the door throws it WITHOUT a call;
 *   c. tenant config: active brand profile → `social` block → an entry
 *      for the target platform (absence at any level disarms);
 *   d. per-platform daily cap: ledger countSince over the UTC day vs the
 *      platform block's maxPostsPerDay (0 = configured but paused);
 *   e. duplicate pre-check: this draft has no recorded publication on
 *      THIS platform (cross-posting to other platforms stays legal);
 *   f. only then: publisher call → socialPublications.record with the
 *      passed clock — the platform result recorded exactly ONCE; the
 *      repo's unique key backstops e's pre-check, so a raced double-post
 *      surfaces DuplicatePublicationError LOUD (the platform call already
 *      happened — an incident, never a replay).
 */
export interface PublishApprovedDraftDeps {
  ctx: TenantCtx;
  repos: Repos;
  /**
   * The publisher seam — REQUIRED, no default: nothing reaches a platform
   * unless the caller wired `resolveSocialPublisher`'s per-platform arming
   * ratchet (or a test injected the fake).
   */
  resolvePublisher(platform: SocialPlatform): SocialPublisher;
  /** Media bytes source (B-pub.3) — defaults to the platform store (the deploy.ts convention); tests inject. */
  objectStore?: ObjectStore;
  /**
   * B-ig.1: the PUBLIC-ADDRESS seam, for the one driver family that
   * publishes media by URL instead of by upload (Instagram's `/media`
   * container; see registry `needsPublicMediaUrl`). Given a draft's media
   * ref, it makes those bytes reachable anonymously and hands back the
   * absolute URL plus its revocation.
   *
   * Deliberately OPTIONAL and deliberately un-defaulted, exactly like
   * `resolvePublisher`: an unwired seam grants no address, so the driver
   * refuses honestly and NOTHING is ever made public by accident. It is
   * called only when the resolved publisher declared the need, so a
   * byte-uploading platform never widens the public-asset gate at all.
   */
  admitPublicMedia?(request: AdmitPublicMediaRequest): Promise<PublicMediaAdmission | null>;
}

/** What the door knows about one image when it asks for a public address. */
export interface AdmitPublicMediaRequest {
  /** The approved draft being published — the admission's audit key and its scope. */
  draftId: string;
  /** The platform the address is being opened for — admission is never platform-blind. */
  platform: SocialPlatform;
  /** The draft's content-addressed media ref, verbatim (`social-media/<sha256>.<ext>`). */
  ref: string;
  /** The ref's declared image/* type, as the draft carries it. */
  contentType: string;
}

/** A granted address and the way to take it back. */
export interface PublicMediaAdmission {
  /** Absolute URL the platform's servers fetch anonymously. */
  url: string;
  /**
   * Withdraw the admission. The door calls this the moment the platform
   * call returns — success OR failure — so the address is public for one
   * API call and no longer. Implementations MUST NOT reject: a revoke that
   * throws would mask the publish outcome, so the mechanism's own expiry is
   * the crash backstop, not this call.
   */
  revoke(): Promise<void>;
}

/**
 * One queue item's essentials, handed IN by the caller. `publish_queue`
 * deliberately has no repository yet (charter standing discipline — the
 * workspace approve door only records approvals; nothing writes the
 * queue). When the worker bucket lands, IT owns queue reads/state and
 * hands each item here — this door stays queue-agnostic on purpose.
 */
export interface PublishApprovedDraftInput {
  draftId: string;
  platform: SocialPlatform;
}

export interface PublishApprovedDraftResult {
  /** The recorded ledger row — the audit answer to "what did we post where". */
  publication: SocialPublicationRow;
}

export async function publishApprovedDraft(
  deps: PublishApprovedDraftDeps,
  input: PublishApprovedDraftInput,
  now: Date,
): Promise<PublishApprovedDraftResult> {
  const { ctx, repos } = deps;
  const platform = socialPlatformSchema.parse(input.platform);

  // (a) draft exists (tenant-walled — repos.drafts.get throws NotFoundError),
  // resolves to a `publishable`-capability format (Sprint-8 window 2: the
  // registry flag decides — never a format-name branch), status APPROVED.
  const draft = await repos.drafts.get(ctx, input.draftId);
  const spec = resolveDraftFormatSpec(draft.format);
  if (!spec.capabilities.publishable) {
    throw new SocialFormatNotPublishableError(draft.id, draft.format);
  }
  if (draft.status !== "approved") {
    throw new SocialDraftNotApprovedError(draft.id, draft.status);
  }

  // (b) the platform's publisher is armed — a refusing publisher names its
  // missing arms (or its invalid credential shape) and is thrown here,
  // before any repo reads; its publish() throwing the same error is the
  // structural backstop.
  const publisher = deps.resolvePublisher(platform);
  if (isRefusingSocialPublisher(publisher)) throw publisher.refusal;

  // (c) tenant config rung — absence disarms at every level.
  const profile = await repos.brandProfiles.getActive(ctx);
  if (!profile) {
    throw new SocialPublishDisarmedError(
      "tenant has no active brand profile — no social config block",
    );
  }
  const config = readSocialConfig(profile);
  if (!config) {
    throw new SocialPublishDisarmedError(
      'the active brand profile carries no "social" block — absence disarms the publish door',
    );
  }
  const cadence = config[platform];
  if (!cadence) {
    throw new SocialPublishDisarmedError(
      `the tenant's social block carries no "${platform}" entry — an unconfigured platform is disarmed`,
    );
  }

  // (d) the per-platform ≤cap/day rung (UTC day from the passed clock).
  const publishedToday = await repos.socialPublications.countSince(ctx, platform, utcDayStart(now));
  if (publishedToday >= cadence.maxPostsPerDay) {
    throw new SocialDailyCapReachedError(platform, cadence.maxPostsPerDay, publishedToday);
  }

  // (e) duplicate pre-check — platform-scoped: cross-posting the same
  // draft to a DIFFERENT platform stays legal (the ledger's key design).
  const priors = await repos.socialPublications.listForDraft(ctx, draft.id);
  const prior = priors.find((row) => row.platform === platform);
  if (prior) throw new DraftAlreadyPublishedError(draft.id, platform, prior.externalPostId);

  // (f) only now: platform call → ledger, exactly once. The row snapshots
  // what actually went out (external id + judged-body hash) at post time;
  // a raced duplicate surfaces the repo's DuplicatePublicationError LOUD.
  const loaded = await loadDraftMedia(deps, draft);
  const media = loaded.length > 0 ? loaded.map((entry) => entry.media) : undefined;

  // B-ig.1: the public-address leg, opened as late and as narrowly as it
  // can be. Only a driver that DECLARED it publishes by URL gets here, only
  // the refs this draft actually carries are admitted, and the admission is
  // revoked the instant the platform call returns — the image is reachable
  // for one API call, not for as long as the post exists.
  const admissions: PublicMediaAdmission[] = [];
  if (publisher.needsPublicMediaUrl && deps.admitPublicMedia) {
    for (const entry of loaded) {
      const admission = await deps.admitPublicMedia({
        draftId: draft.id,
        platform,
        ref: entry.ref,
        contentType: entry.media.contentType,
      });
      if (!admission) continue;
      admissions.push(admission);
      entry.media.publicUrl = admission.url;
    }
  }

  let receipt;
  try {
    receipt = await publisher.publish({
      draftId: draft.id,
      text: draft.body,
      media,
      // The platform's own cadence block rides along (D1): per-tenant posting
      // settings reach the driver without a second config read.
      settings: cadence,
    });
  } finally {
    // Always, on both paths — a refused publish must not leave an image
    // public. Swallowed on purpose: a revoke failure must never replace the
    // publish's own error (the operator needs THAT one), and the admission
    // mechanism's expiry is what closes the gate if this call cannot.
    for (const admission of admissions) {
      await admission.revoke().catch(() => {});
    }
  }
  const publication = await repos.socialPublications.record(ctx, {
    draftId: draft.id,
    platform,
    externalPostId: receipt.externalPostId,
    bodyHash: draft.bodyHash,
    publishedAt: now,
    meta: receipt.meta,
  });
  return { publication };
}

/**
 * The gap the B-pub.1 wrap reported is CLOSED (Sprint-8 window 2):
 * `brand_profiles.social` exists and the repo carries the block, so this
 * reads the typed column — still schema-parsed at this boundary, because a
 * stored block must never be trusted shapeless (write-door validation is
 * the other half of the same contract).
 */
function readSocialConfig(profile: BrandProfile): SocialPublishConfig | null {
  if (profile.social === undefined || profile.social === null) return null;
  return socialPublishConfigSchema.parse(profile.social);
}

/** The ≤cap/day window start: 00:00 UTC of the calendar day `now` falls in. */
function utcDayStart(now: Date): Date {
  const start = new Date(now.getTime());
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/**
 * B-pub.3: the draft's media surface — `meta.mediaRefs` names
 * content-addressed image artifacts (`social-media/<sha256>.<ext>`, put by
 * the drafting path) that load VERIFIED here at publish time and travel to
 * the driver as bytes. One image for now (the schema ceiling — lifting it
 * is a per-driver reviewed change). A stored ref must never be trusted
 * shapeless (the readSocialConfig convention), and a ref whose artifact is
 * gone is a broken content-address invariant — ArtifactMissingError, never
 * a silent text-only post. NOTE the judge gates cover the TEXT claim
 * surface; the image itself rides the operator's approval (the approve
 * queue is the human gate for what the picture shows).
 */
const mediaRefsSchema = z
  .array(
    z.object({
      ref: z.string().min(1),
      contentType: z.string().regex(/^image\//, "mediaRefs carry image/* content types only"),
      altText: z.string().optional(),
    }),
  )
  .max(1);

/**
 * One loaded image, still paired with the REF it came from. B-ig.1 keeps the
 * address the B-pub.3 loader used to drop: drivers still receive bytes only
 * (they never touch the object store), but the door needs the ref to ask for
 * a public URL on behalf of the one platform that publishes by address.
 */
interface LoadedDraftMedia {
  /** The content-addressed ref, verbatim — the door's key into the public-asset seam. */
  ref: string;
  media: SocialPostMedia;
}

async function loadDraftMedia(
  deps: PublishApprovedDraftDeps,
  draft: Draft,
): Promise<LoadedDraftMedia[]> {
  const raw = (draft.meta as { mediaRefs?: unknown }).mediaRefs;
  if (raw === undefined || raw === null) return [];
  const refs = mediaRefsSchema.parse(raw);
  if (refs.length === 0) return [];
  const store = deps.objectStore ?? getObjectStore();
  const loaded: LoadedDraftMedia[] = [];
  for (const entry of refs) {
    const bytes = await getContentAddressed(store, entry.ref);
    if (!bytes) {
      throw new ArtifactMissingError(
        entry.ref,
        `draft "${draft.id}" media artifact "${entry.ref}" is missing from the object store — a broken content-address invariant, never a silent text-only post`,
      );
    }
    loaded.push({
      ref: entry.ref,
      media: { bytes, contentType: entry.contentType, altText: entry.altText },
    });
  }
  return loaded;
}
