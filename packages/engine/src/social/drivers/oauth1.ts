import { createHmac, randomBytes } from "node:crypto";

/**
 * B-pub.3: a minimal OAuth 1.0a HMAC-SHA1 signer for the X driver — the
 * official user-context auth whose tokens do NOT expire (the OAuth 2.0
 * user token lives ~2 hours; standing env arming has no refresh machinery
 * until B-int.4, so 1.0a is the only auth that can stay armed). Scoped
 * deliberately to what the driver's calls need: requests with a non-form
 * body (JSON / multipart), where the signature base string carries the
 * oauth_* params plus any QUERY params (RFC 5849 §3.4.1.3.1 — only
 * form-encoded bodies contribute body params).
 *
 * D2 (s87) widened it once, for a real reason: the metrics read is
 * `GET /2/tweets?ids=…&tweet.fields=public_metrics`, and under 1.0a a query
 * string is NOT optional decoration — every query parameter is part of the
 * signature base and the base URL must exclude the query entirely. Signing
 * the full URL with the query attached (what the POST-only version did) has
 * exactly one outcome: a 401 that reads like a dead credential, from a
 * credential that is perfectly alive. The POST-without-query path is
 * byte-identical to before, and its pin still holds.
 */

export interface OAuth1Keys {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
}

/**
 * The signature base URI and the query parameters, separated. Hand-split
 * rather than via `new URL`, so a URL the driver built stays byte-identical
 * in the base string (URL would normalise the host case and default port —
 * correct per §3.4.1.2, but a change to the POST path this file has already
 * signed in production, and this widening buys no reason to risk it).
 */
function splitQuery(url: string): { baseUri: string; queryPairs: Array<[string, string]> } {
  const hash = url.indexOf("#");
  const withoutFragment = hash === -1 ? url : url.slice(0, hash);
  const mark = withoutFragment.indexOf("?");
  if (mark === -1) return { baseUri: withoutFragment, queryPairs: [] };
  const baseUri = withoutFragment.slice(0, mark);
  const query = withoutFragment.slice(mark + 1);
  const queryPairs: Array<[string, string]> = [];
  for (const part of query.split("&")) {
    if (part === "") continue;
    const eq = part.indexOf("=");
    const name = eq === -1 ? part : part.slice(0, eq);
    const value = eq === -1 ? "" : part.slice(eq + 1);
    // The driver builds these already-encoded; decode so `pct` re-encodes
    // exactly once (double-encoding is the classic 1.0a signature bug).
    queryPairs.push([decodeURIComponent(name), decodeURIComponent(value)]);
  }
  return { baseUri, queryPairs };
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
 *
 * A query string on `url` is handled per RFC 5849 §3.4.1: it is stripped
 * from the base URL and its parameters join the oauth_* set, sorted together
 * by encoded name then encoded value.
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
  // §3.4.1.2: the base URI carries no query and no fragment. §3.4.1.3.1: the
  // query's parameters are signed alongside the oauth_* ones. A repeated key
  // is legal and must be kept, so the pairs are a LIST, never a record.
  const { baseUri, queryPairs } = splitQuery(url);
  const pairs: Array<[string, string]> = [
    ...queryPairs,
    ...Object.entries(params),
  ].map(([k, v]) => [pct(k), pct(v)]);
  // §3.4.1.3.2: sort by encoded name, then by encoded value.
  pairs.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1));
  const paramString = pairs.map(([k, v]) => `${k}=${v}`).join("&");
  const baseString = [method, pct(baseUri), pct(paramString)].join("&");
  const signingKey = `${pct(keys.consumerSecret)}&${pct(keys.tokenSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");
  const header: Record<string, string> = { ...params, oauth_signature: signature };
  return `OAuth ${Object.keys(header)
    .sort()
    .map((k) => `${pct(k)}="${pct(header[k])}"`)
    .join(", ")}`;
}
