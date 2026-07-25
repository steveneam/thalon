import { createHmac, randomBytes } from "node:crypto";

/**
 * B-pub.3: a minimal OAuth 1.0a HMAC-SHA1 signer for the X driver — the
 * official user-context auth whose tokens do NOT expire (the OAuth 2.0
 * user token lives ~2 hours; standing env arming has no refresh machinery
 * until B-int.4, so 1.0a is the only auth that can stay armed). Scoped
 * deliberately to what the driver's two calls need: POST requests with no
 * query string and a non-form body (JSON / multipart), where the signature
 * base string carries the oauth_* params ONLY (RFC 5849 §3.4.1.3.1 — only
 * form-encoded bodies contribute body params).
 */

export interface OAuth1Keys {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
}

/** RFC 3986 percent-encoding (encodeURIComponent plus the five characters it leaves bare). */
function pct(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * The Authorization header for one signed request. `nonce`/`timestampSec`
 * are injectable for the stability pin; production callers omit them.
 */
export function oauth1Header(
  method: "POST" | "GET",
  url: string,
  keys: OAuth1Keys,
  opts: { nonce?: string; timestampSec?: number } = {},
): string {
  const nonce = opts.nonce ?? randomBytes(16).toString("hex");
  const timestamp = String(opts.timestampSec ?? Math.floor(Date.now() / 1000));
  const params: Record<string, string> = {
    oauth_consumer_key: keys.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: keys.token,
    oauth_version: "1.0",
  };
  const paramString = Object.keys(params)
    .sort()
    .map((k) => `${pct(k)}=${pct(params[k])}`)
    .join("&");
  const baseString = [method, pct(url), pct(paramString)].join("&");
  const signingKey = `${pct(keys.consumerSecret)}&${pct(keys.tokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");
  const header: Record<string, string> = { ...params, oauth_signature: signature };
  return `OAuth ${Object.keys(header)
    .sort()
    .map((k) => `${pct(k)}="${pct(header[k])}"`)
    .join(", ")}`;
}
