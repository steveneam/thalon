// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { Transcription } from "@/components/transcription/transcription";
import { seedLibraryRow } from "@/lib/testing/handlers";
import { server } from "@/lib/testing/server";

const SEGMENTS = [
  { text: "first ingested segment", startMs: 0, endMs: 1_500 },
  { text: "second ingested segment", startMs: 1_500, endMs: 3_000 },
];

describe("Library (exact-mock rebuild, Library.dc.html)", () => {
  it("renders the sheet's bands: headline + source count, the ingest band, shelf rows, the footer", async () => {
    seedLibraryRow({
      uri: "https://youtube.com/watch?v=abc",
      title: "Build-step pipeline walkthrough",
      tags: ["ai", "hooks"],
      areaRelevance: [
        { areaId: "a1", areaName: "ai tooling", score: 0.82, reason: "close to the area description" },
      ],
    }, SEGMENTS);
    render(<Transcription />);

    expect(screen.getByRole("heading", { name: "Transcription" })).toBeInTheDocument();
    expect(await screen.findByText("1 sources")).toBeInTheDocument();
    expect(
      screen.getByText(/everything here is grounding — the judge cites these verbatim/),
    ).toBeInTheDocument();
    // The ingest band is the sheet's box + button at rest.
    expect(screen.getByLabelText("Video URL")).toHaveAttribute(
      "placeholder",
      expect.stringContaining("Paste a video URL"),
    );
    expect(screen.getByRole("button", { name: "Ingest" })).toBeInTheDocument();

    const row = screen.getByRole("button", { name: "Build-step pipeline walkthrough" });
    // The facts line states only what the ingest recorded — plus the way back;
    // the engine's scoring reason rides the line's tooltip.
    const facts = within(row).getByTitle("close to the area description");
    expect(facts.textContent).toContain("Video · 2 segments · hosted-vendor · ai, hooks");
    expect(facts.textContent).toContain("relevant to ai tooling");
    expect(within(row).getByRole("link", { name: /Open the original source/ })).toHaveAttribute(
      "href",
      "https://youtube.com/watch?v=abc",
    );
    expect(
      screen.getByText(/Sources are per-tenant, chunked and embedded once/),
    ).toBeInTheDocument();
  });

  it("keeps the ingest keepers behind the sheet's resting chrome: tags + seam unfold on engage", async () => {
    const user = userEvent.setup();
    let capturedTags: string[] | undefined;
    server.use(
      http.post("/api/library/ingest", async ({ request }) => {
        const body = (await request.json()) as { url: string; tags?: string[] };
        capturedTags = body.tags;
        const row = seedLibraryRow({ uri: body.url, tags: body.tags ?? [] }, SEGMENTS);
        return HttpResponse.json(
          { sourceId: row.id, created: true, chunkCount: 2, provider: row.provider },
          { status: 201 },
        );
      }),
    );
    render(<Transcription />);
    await screen.findByText("0 sources");

    // At rest the sheet's band carries no tag field — it unfolds on engage.
    expect(screen.queryByLabelText(/tags/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/v1");
    await user.type(screen.getByLabelText(/tags/i), " ai,  hooks , ai ");
    expect(screen.getByText("hosted-vendor")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ingest" }));
    // Tags rode the request — trimmed and deduped.
    await waitFor(() => expect(capturedTags).toEqual(["ai", "hooks"]));
    // The fresh transcript opens in its panel; the shelf shows the new row.
    expect(await screen.findByText("first ingested segment")).toBeInTheDocument();
    expect(screen.getByText("1 sources")).toBeInTheDocument();
  });

  it("opening a row reveals the transcript doors — read, copy the brief, export, delete", async () => {
    const user = userEvent.setup();
    seedLibraryRow({ uri: "https://example.com/v2", title: "Shelf opened" }, SEGMENTS);
    render(<Transcription />);

    // Resting chrome: no panel until a row is opened.
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Shelf opened" }));

    expect(await screen.findByText("first ingested segment")).toBeInTheDocument();
    expect(screen.getByText("2 segments · 00:00:03")).toBeInTheDocument();
    for (const format of [".md", ".txt", ".csv", ".srt"]) {
      expect(screen.getByRole("button", { name: format })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Copy transcript" }));
    await waitFor(async () =>
      expect(await window.navigator.clipboard.readText()).toContain("first ingested segment"),
    );
    // The copied state is a state — the resting label returns.
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("delete asks once BY NAME and a server refusal surfaces verbatim", async () => {
    const user = userEvent.setup();
    const kept = seedLibraryRow({ uri: "https://example.com/v3", title: "Grounds a draft" }, SEGMENTS);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    server.use(
      http.delete(`/api/library/${kept.id}`, () =>
        HttpResponse.json({ error: "this source still grounds 2 drafts" }, { status: 409 }),
      ),
    );
    render(<Transcription />);

    await user.click(await screen.findByRole("button", { name: "Grounds a draft" }));
    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(confirmSpy).toHaveBeenCalledExactlyOnceWith(
      'Delete "Grounds a draft" from the library?',
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/still grounds 2 drafts/);
    // The refused row honestly survives on the shelf.
    expect(screen.getByRole("button", { name: "Grounds a draft" })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it("j/k move the sheet's .row.sel and d deletes behind the named confirm", async () => {
    const user = userEvent.setup();
    // The shelf is newest-first (seedLibraryRow unshifts) — seed in reverse.
    seedLibraryRow({ uri: "https://x.example/2", title: "Second video" }, SEGMENTS);
    seedLibraryRow({ uri: "https://x.example/1", title: "First video" }, SEGMENTS);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Transcription />);

    const first = await screen.findByRole("button", { name: "First video" });
    expect(first.className).toContain("row sel");
    await user.keyboard("j");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Second video" }).className).toContain("row sel"),
    );

    await user.keyboard("d");
    expect(confirmSpy).toHaveBeenCalledExactlyOnceWith(
      'Delete "Second video" from the library?',
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Second video" })).not.toBeInTheDocument(),
    );
    confirmSpy.mockRestore();
  });

  it("a failed read is an alert with retry, never an empty shelf", async () => {
    server.use(http.get("/api/library", () => HttpResponse.error()));
    render(<Transcription />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Couldn’t read the library/);
    expect(alert).toHaveTextContent(/read failure, not an empty shelf/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    // The count never fabricates a zero it hasn't read.
    expect(screen.getByText("– sources")).toBeInTheDocument();
  });

  it("an empty shelf says so plainly", async () => {
    render(<Transcription />);
    expect(await screen.findByText(/Nothing ingested yet/)).toBeInTheDocument();
  });

  it("the caption-file seam asks for captions instead of pretending URL-only works", async () => {
    const user = userEvent.setup();
    server.use(
      http.get("/api/library", () =>
        HttpResponse.json({
          sources: [],
          seam: {
            selected: "caption-file",
            registered: ["caption-file"],
            vendorConfigured: false,
          },
        }),
      ),
    );
    render(<Transcription />);
    await screen.findByText("0 sources");

    await user.click(screen.getByLabelText("Video URL"));
    expect(screen.getByLabelText(/captions/i)).toBeInTheDocument();
    expect(screen.getByText(/paste the captions above/)).toBeInTheDocument();
  });
});
