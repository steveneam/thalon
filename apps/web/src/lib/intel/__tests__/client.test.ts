// @vitest-environment jsdom
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { dismissTrend, promoteTrend } from "@/lib/intel/client";
import { server } from "@/lib/testing/server";

/**
 * s100 gate — THE CARD-ID ENCODING RATCHET.
 *
 * A trend card's id is `<areaId>:<the platform's own item id>`, and Bluesky's
 * item id is an AT-URI containing SLASHES:
 *
 *   b7c1a728-…:at://did:plc:dzez…/app.bsky.feed.post/3ms7kfyymvv2p
 *
 * Interpolated raw into a path template those slashes become path separators,
 * and the request lands on a route that does not exist. Proven live before the
 * fix: 404 raw, 200 encoded — on 30 of the 58 cards on the dev shelf, i.e. the
 * flagship "hand this trend to Create" path and Dismiss were both dead for
 * every Bluesky card, silently, showing the operator only "request failed:
 * 404".
 *
 * It survived because the repo's own job-walk happened to land on a YouTube
 * card (uuid id, no slashes) and passed. These cases pin the SHAPE that
 * breaks, not the platform — any future source whose ids carry `/`, `?` or `#`
 * is covered by the same assertion.
 */

const BSKY_CARD_ID =
  "b7c1a728-d3f2-4747-9c5b-a2027bae6cd5:at://did:plc:dzezcmpb3fhcpns4n4xm4ur5/app.bsky.feed.post/3ms7kfyymvv2p";

/** What the route actually receives — one path segment, decoded by the router. */
function captureCardId(verb: "dismiss" | "promote", body: Record<string, unknown>) {
  let seen: string | null = null;
  server.use(
    http.post(`/api/intel/trends/:cardId/${verb}`, ({ params }) => {
      seen = params.cardId as string;
      return HttpResponse.json(body);
    }),
  );
  return () => seen;
}

describe("intel client — a card id is ONE path segment, whatever the platform put in it", () => {
  it("dismiss reaches the route with an AT-URI card id intact", async () => {
    const seen = captureCardId("dismiss", { capture: { id: "c1" } });
    await dismissTrend(BSKY_CARD_ID);
    // Decoded back to the original: the slashes travelled as data, not as
    // path structure. Raw interpolation makes this `b7c1a728-…:at:` instead.
    expect(seen()).toBe(BSKY_CARD_ID);
  });

  it("promote reaches the route with an AT-URI card id intact", async () => {
    const seen = captureCardId("promote", { capture: { id: "c1" }, createHref: "/app/create" });
    await promoteTrend(BSKY_CARD_ID, { family: "post" });
    expect(seen()).toBe(BSKY_CARD_ID);
  });

  it("covers the other URL-significant characters a platform id could carry", async () => {
    for (const nasty of ["area:a/b", "area:q?x=1", "area:frag#part", "area:a b"]) {
      const seen = captureCardId("dismiss", { capture: { id: "c1" } });
      await dismissTrend(nasty);
      expect(seen(), `card id "${nasty}" did not survive the round trip`).toBe(nasty);
    }
  });

  it("a plain uuid card id still round-trips — the YouTube shape that hid this for so long", async () => {
    const seen = captureCardId("dismiss", { capture: { id: "c1" } });
    await dismissTrend("b7c1a728-d3f2-4747-9c5b-a2027bae6cd5:abc123");
    expect(seen()).toBe("b7c1a728-d3f2-4747-9c5b-a2027bae6cd5:abc123");
  });
});
