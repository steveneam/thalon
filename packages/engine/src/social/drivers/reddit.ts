import { z } from "zod";
import { REDDIT_USER_AGENT } from "../../integrations/validate";
import type { SocialPostInput, SocialPublisher, SocialPublishReceipt } from "../registry";
import {
  hardenedPlatformFetch,
  responseJson,
  SocialDriverApiError,
  type Sleeper,
} from "./errors";

/**
 * D1 (s83): the Reddit driver — the official OAuth `/api/submit` endpoint
 * (ADR 0002: official platform APIs only), posting a SELF (text) post. The
 * FIRST driver built on the hardened platform fetch (429-retry · 401 →
 * typed refresh signal · verbatim platform body). Never constructed outside
 * `productionSocialDrivers` behind the arming ratchet; tests inject
 * `fetchImpl`.
 *
 * Where the post lands: the tenant's configured subreddit (the `reddit`
 * cadence block's `subreddit`, riding the door's settings pass-through), or
 * the connected account's own profile (`u_<username>`) when none is
 * configured — every account has one, so a fresh connection posts without
 * setup. The username comes from `/api/v1/me` at publish time (the
 * LinkedIn author-lookup convention: stateless, no extra config seat).
 *
 * Reddit demands a TITLE. The judged body stays the body, verbatim; the
 * title is the body's FIRST LINE, clamped to the platform's 300 — an
 * excerpt of approved content, never new words. When clamping cuts
 * mid-line, the full body still travels as selftext so nothing approved is
 * lost; when the first line fits whole, selftext carries the remainder.
 *
 * Media: refused typed (v1) — Reddit image posts ride a separate
 * upload-lease flow; landing it later is a reviewed driver change, and
 * silently dropping an image would publish a different post than the
 * operator approved (the Instagram precedent).
 */

const TITLE_MAX = 300;

const meSchema = z.object({ name: z.string().min(1) }).loose();

const submitSchema = z
  .object({
    json: z
      .object({
        errors: z.array(z.array(z.unknown())),
        data: z
          .object({
            name: z.string().optional(),
            id: z.string().optional(),
            url: z.string().optional(),
          })
          .loose()
          .optional(),
      })
      .loose(),
  })
  .loose();

export class RedditMediaUnsupportedError extends SocialDriverApiError {
  constructor() {
    super(
      "reddit",
      0,
      "the Reddit driver posts text (self) posts only — image submission rides a separate upload-lease flow, a later reviewed change; the media stays unpublished rather than silently dropped",
    );
    this.name = "RedditMediaUnsupportedError";
  }
}

/** The driver's slice of the tenant's `reddit` cadence block (door settings pass-through). */
const settingsSchema = z.object({ subreddit: z.string().min(1).optional() }).loose();

export interface RedditDriverConfig {
  accessToken: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  sleep?: Sleeper;
}

/** title = first line clamped to the platform's 300; selftext keeps every approved word. */
export function redditTitleSplit(text: string): { title: string; selftext: string } {
  const firstBreak = text.indexOf("\n");
  const firstLine = (firstBreak === -1 ? text : text.slice(0, firstBreak)).trim();
  if (firstLine.length > TITLE_MAX) {
    return { title: `${firstLine.slice(0, TITLE_MAX - 1)}…`, selftext: text };
  }
  const remainder = firstBreak === -1 ? "" : text.slice(firstBreak + 1).trim();
  return { title: firstLine, selftext: remainder };
}

export function createRedditDriver(config: RedditDriverConfig): SocialPublisher {
  const baseUrl = (config.baseUrl ?? "https://oauth.reddit.com").replace(/\/$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const headers = {
    Authorization: `Bearer ${config.accessToken}`,
    "User-Agent": REDDIT_USER_AGENT,
  };
  return {
    platform: "reddit",
    name: "reddit-submit",
    async publish(input: SocialPostInput): Promise<SocialPublishReceipt> {
      if (input.media && input.media.length > 0) {
        throw new RedditMediaUnsupportedError();
      }

      // 1. Whose account is this? `/api/v1/me` → username: the profile
      // fallback target, and the receipt's provenance.
      const whoami = await hardenedPlatformFetch(
        "reddit",
        fetchImpl,
        `${baseUrl}/api/v1/me`,
        { headers },
        { sleep: config.sleep },
      );
      const me = meSchema.safeParse(await responseJson(whoami));
      if (!me.success) {
        throw new SocialDriverApiError(
          "reddit",
          whoami.status,
          "identity response carries no username — cannot resolve the profile target",
        );
      }

      const settings = settingsSchema.safeParse(input.settings ?? {});
      const subreddit = settings.success ? settings.data.subreddit : undefined;
      const target = subreddit ?? `u_${me.data.name}`;
      const { title, selftext } = redditTitleSplit(input.text);

      // 2. The one submit call — form-encoded, api_type=json so refusals
      // arrive structured instead of as an HTML page.
      const form = new URLSearchParams({
        api_type: "json",
        kind: "self",
        sr: target,
        title,
        text: selftext,
      });
      const res = await hardenedPlatformFetch(
        "reddit",
        fetchImpl,
        `${baseUrl}/api/submit`,
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        },
        { sleep: config.sleep },
      );
      const parsed = submitSchema.safeParse(await responseJson(res));
      if (!parsed.success) {
        throw new SocialDriverApiError(
          "reddit",
          res.status,
          "submit response is not the api_type=json shape — nothing provably landed",
        );
      }
      const { errors, data } = parsed.data.json;
      if (errors.length > 0) {
        // Reddit's structured refusal: [[CODE, message, field], …] — the
        // platform's own words, joined verbatim.
        const detail = errors
          .map((row) => row.filter((cell) => typeof cell === "string").join(" "))
          .join("; ");
        throw new SocialDriverApiError("reddit", res.status, detail || "submit refused");
      }
      const externalPostId = data?.name ?? (data?.id ? `t3_${data.id}` : undefined);
      if (!externalPostId) {
        throw new SocialDriverApiError(
          "reddit",
          res.status,
          "submit reported no errors but returned no post id — nothing provably landed",
        );
      }
      return {
        externalPostId,
        meta: {
          target,
          author: `u/${me.data.name}`,
          ...(data?.url ? { permalink: data.url } : {}),
        },
      };
    },
  };
}
