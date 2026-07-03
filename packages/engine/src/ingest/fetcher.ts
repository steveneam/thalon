/**
 * Fetcher seam: isolates URL fetching so tests use fixtures instead of the
 * network (ground rule: every test keyless + networkless). Not a `shell/`
 * module — no LLM touches this — but the same driver-seam pattern as
 * @thalon/platform's object-store/queue seams.
 */
export interface FetchedPage {
  html: string;
  contentType?: string;
}

export interface Fetcher {
  fetch(url: string): Promise<FetchedPage>;
}

export class HttpFetcher implements Fetcher {
  async fetch(url: string): Promise<FetchedPage> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`fetch failed for "${url}": ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    return { html, contentType: res.headers.get("content-type") ?? undefined };
  }
}

export function getFetcher(): Fetcher {
  return new HttpFetcher();
}
