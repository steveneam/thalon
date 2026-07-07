// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { seedLibraryRow } from "@/lib/testing/handlers";
import { server } from "@/lib/testing/server";
import { LibrarySurface, parseTags } from "../library-surface";

/**
 * Session-19 rider pins: title-first shelf rows, tag chips, the thermal
 * relevance badge, tags riding the ingest request, and the transcript
 * panel collapsed-by-default after ingest — with the honest degrade on
 * pre-rider rows (URL identity, no chips, no badge).
 */

describe("library surface (session-19 rider)", () => {
  it("renders title-first rows with the URL demoted, tag chips, and the relevance badge", async () => {
    seedLibraryRow({
      uri: "https://youtube.com/watch?v=abc",
      title: "How the judge gate works",
      tags: ["ai", "hooks"],
      areaRelevance: [
        { areaId: "a1", areaName: "ai tooling", score: 0.82, reason: "close to the area description" },
      ],
    });
    render(<LibrarySurface />);
    const row = await screen.findByRole("button", { name: /how the judge gate works/i });
    // Title is the identity; the URL is present but secondary.
    expect(within(row).getByText("https://youtube.com/watch?v=abc")).toBeInTheDocument();
    expect(within(row).getByText("ai")).toBeInTheDocument();
    expect(within(row).getByText("hooks")).toBeInTheDocument();
    // Thermal grammar: 0.82 lands in the "hot" band; the reason rides the label.
    const badge = within(row).getByRole("img", { name: /heat hot/i });
    expect(badge).toHaveAccessibleName(/close to the area description/i);
    expect(within(row).getByText("ai tooling")).toBeInTheDocument();
  });

  it("degrades pre-rider rows honestly: URL as identity, no chips, no badge", async () => {
    seedLibraryRow({ uri: "https://youtube.com/watch?v=old" });
    render(<LibrarySurface />);
    const row = await screen.findByRole("button", { name: /watch\?v=old/i });
    expect(within(row).queryByRole("img", { name: /heat/i })).not.toBeInTheDocument();
    expect(within(row).queryAllByText(/./, { selector: "[data-slot=badge]" }).length).toBeLessThanOrEqual(1);
  });

  it("sends parsed tags with the ingest request and collapses the fresh transcript", async () => {
    let capturedTags: string[] | undefined;
    server.use(
      http.post("/api/library/ingest", async ({ request }) => {
        const body = (await request.json()) as { url: string; tags?: string[] };
        capturedTags = body.tags;
        const row = seedLibraryRow(
          { uri: body.url, tags: body.tags ?? [] },
          [
            { text: "first ingested segment", startMs: 0, endMs: 1500 },
            { text: "second ingested segment", startMs: 1500, endMs: 3000 },
          ],
        );
        return HttpResponse.json(
          { sourceId: row.id, created: true, chunkCount: 2, provider: row.provider },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    render(<LibrarySurface />);
    await user.type(await screen.findByLabelText("Video URL"), "https://example.com/v1");
    await user.type(screen.getByLabelText(/tags/i), " ai,  hooks , ai ");
    await user.click(screen.getByRole("button", { name: /get transcript/i }));

    // Tags rode the request — trimmed and deduped.
    expect(capturedTags).toEqual(["ai", "hooks"]);
    // Collapsed by default after ingest: the toggle is visible, the segments are not.
    const toggle = await screen.findByRole("button", { name: /show transcript \(2 segments\)/i });
    expect(screen.queryByText("first ingested segment")).not.toBeInTheDocument();
    await user.click(toggle);
    expect(screen.getByText("first ingested segment")).toBeInTheDocument();
  });

  it("opens expanded from the shelf — that click IS the expand-on-demand", async () => {
    seedLibraryRow({ uri: "https://example.com/v2", title: "Shelf opened" }, [
      { text: "shelf segment text", startMs: 0, endMs: 900 },
    ]);
    const user = userEvent.setup();
    render(<LibrarySurface />);
    await user.click(await screen.findByRole("button", { name: /shelf opened/i }));
    expect(await screen.findByText("shelf segment text")).toBeInTheDocument();
  });
});

describe("parseTags", () => {
  it("splits on commas, trims, dedupes, and caps at 12", () => {
    expect(parseTags(" ai,  hooks , ai ,")).toEqual(["ai", "hooks"]);
    expect(parseTags("")).toEqual([]);
    expect(parseTags(Array.from({ length: 20 }, (_, i) => `t${i}`).join(","))).toHaveLength(12);
  });
});
