// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { Library } from "@/components/library/library";
import { seedLibraryRow } from "@/lib/testing/handlers";
import { server } from "@/lib/testing/server";

const SEGMENTS = [
  { text: "first ingested segment", startMs: 0, endMs: 1_500 },
  { text: "second ingested segment", startMs: 1_500, endMs: 3_000 },
];

describe("Library (exact-mock rebuild, Library.dc.html — the s90 W2 amendment, §5.3)", () => {
  it("renders the sheet's bands: headline + source count, the ingest band with its seg, kind qtabs, shelf rows, the footer", async () => {
    seedLibraryRow({
      uri: "https://youtube.com/watch?v=abc",
      title: "Build-step pipeline walkthrough",
      tags: ["ai", "hooks"],
      areaRelevance: [
        { areaId: "a1", areaName: "ai tooling", score: 0.82, reason: "close to the area description" },
      ],
    }, SEGMENTS);
    render(<Library />);

    expect(screen.getByRole("heading", { name: "Library" })).toBeInTheDocument();
    expect(await screen.findByText("1 sources")).toBeInTheDocument();
    expect(
      screen.getByText(/everything here is grounding — the judge cites these verbatim/),
    ).toBeInTheDocument();
    // The ingest band is the sheet's box + seg + button at rest — the box
    // states what the seam actually takes (video/audio URL), never more.
    expect(screen.getByLabelText("Video URL")).toHaveAttribute(
      "placeholder",
      expect.stringContaining("Paste a video or audio URL"),
    );
    expect(screen.getByRole("button", { name: "Free transcript" })).toHaveClass("seg-opt", "on");
    expect(screen.getByRole("button", { name: "AI enhance" })).toHaveClass("seg-opt");
    expect(screen.getByRole("button", { name: "Ingest" })).toBeInTheDocument();

    // The §5.3 kind lens: All plus each kind the shelf actually holds.
    const tabs = screen.getByRole("tablist", { name: "Source kind" });
    expect(within(tabs).getByRole("tab", { name: "All 1" })).toHaveClass("qtab", "on");
    expect(within(tabs).getByRole("tab", { name: "Video 1" })).toBeInTheDocument();

    const row = screen.getByRole("button", { name: "Build-step pipeline walkthrough" });
    // The facts line states only what the ingest recorded — led by the row's
    // kind word — plus the way back; the scoring reason rides the tooltip.
    const facts = within(row).getByTitle("close to the area description");
    expect(facts.textContent).toContain("Video · 2 segments · hosted-vendor · ai, hooks");
    expect(facts.textContent).toContain("relevant to ai tooling");
    expect(within(row).getByRole("link", { name: /Open the original source/ })).toHaveAttribute(
      "href",
      "https://youtube.com/watch?v=abc",
    );
    expect(
      screen.getByText(/Sources are per-tenant and chunked once/),
    ).toBeInTheDocument();
  });

  it("the kind qtabs are a lens with real counts — they cut the shelf and never invent a zero tab", async () => {
    const user = userEvent.setup();
    seedLibraryRow({ uri: "https://youtube.com/watch?v=v1", title: "A video source" }, SEGMENTS);
    seedLibraryRow({
      uri: "https://example.com/deterministic-rendering",
      title: "Deterministic rendering docs",
      kind: "url",
      provider: null,
      segmentCount: null,
    });
    render(<Library />);
    await screen.findByText("2 sources");

    const tabs = screen.getByRole("tablist", { name: "Source kind" });
    // Only kinds the shelf HOLDS get a tab — no fixture tabs, no zeros.
    expect(within(tabs).getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "All2",
      "Article1",
      "Video1",
    ]);

    await user.click(within(tabs).getByRole("tab", { name: "Article 1" }));
    expect(within(tabs).getByRole("tab", { name: "Article 1" })).toHaveClass("on");
    expect(screen.getByText("1 of 2 sources")).toBeInTheDocument();
    expect(screen.queryByText("A video source")).toBeNull();
    // The article row leads its facts with its own kind word.
    const article = screen.getByRole("button", { name: "Deterministic rendering docs" });
    expect(article.textContent).toContain("Article");

    await user.click(within(tabs).getByRole("tab", { name: "All 2" }));
    expect(await screen.findByText("2 sources")).toBeInTheDocument();
  });

  it("a non-transcript row carries no transcript doors — the server refuses them, so none are drawn", async () => {
    seedLibraryRow({ uri: "https://youtube.com/watch?v=v1", title: "A video source" }, SEGMENTS);
    seedLibraryRow({
      uri: "https://example.com/article",
      title: "An article source",
      kind: "url",
      provider: null,
      segmentCount: null,
    });
    render(<Library />);
    await screen.findByText("2 sources");

    const video = screen.getByRole("button", { name: "A video source" });
    expect(within(video).getByRole("button", { name: "Copy transcript" })).toBeInTheDocument();
    expect(within(video).getByRole("button", { name: "Export" })).toBeInTheDocument();

    const article = screen.getByRole("button", { name: "An article source" });
    expect(within(article).queryByRole("button", { name: "Copy transcript" })).toBeNull();
    expect(within(article).queryByRole("button", { name: "Export" })).toBeNull();
    // Its way back survives — the origin link is the row's own door.
    expect(within(article).getByRole("link", { name: /Open the original source/ })).toBeInTheDocument();
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
    render(<Library />);
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

  it("the extras state the ingest kinds that are still deferred — a fact line, never a dead door", async () => {
    const user = userEvent.setup();
    render(<Library />);
    await screen.findByText("0 sources");

    await user.click(screen.getByLabelText("Video URL"));
    const deferral = screen.getByText(/Article, file and pasted-text ingest land with their own pass/);
    expect(deferral.textContent).toMatch(/today the band transcribes video\/audio URLs/);
  });

  it("opening a row reveals the transcript doors — read, copy the brief, export, delete", async () => {
    const user = userEvent.setup();
    seedLibraryRow({ uri: "https://example.com/v2", title: "Shelf opened" }, SEGMENTS);
    render(<Library />);

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
    render(<Library />);

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
    render(<Library />);

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

  it("d and ↵ are inert on a non-transcript row — the guarded verbs never reach the server", async () => {
    const user = userEvent.setup();
    seedLibraryRow({
      uri: "https://example.com/article",
      title: "An article source",
      kind: "url",
      provider: null,
      segmentCount: null,
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Library />);
    await screen.findByText("1 sources");

    await user.keyboard("d");
    expect(confirmSpy).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    confirmSpy.mockRestore();
  });

  it("the row region is BOUNDED and the bound is stated — never a silent truncation", async () => {
    for (let i = 0; i < 55; i++) {
      seedLibraryRow({ uri: `https://example.com/v${i}`, title: `Source ${i}` });
    }
    const { container } = render(<Library />);
    await screen.findByText("55 sources");

    // 50 rows render; the foot row counts the rest and names the lenses.
    expect(container.querySelectorAll(".card .row[role='button']")).toHaveLength(50);
    const foot = screen.getByText(/\+5 more/);
    expect(foot.textContent).toMatch(/narrow with find or the kind tabs/);
  });

  it("a failed read is an alert with retry, never an empty shelf", async () => {
    server.use(http.get("/api/library", () => HttpResponse.error()));
    render(<Library />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/Couldn’t read the library/);
    expect(alert).toHaveTextContent(/read failure, not an empty shelf/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    // The count never fabricates a zero it hasn't read.
    expect(screen.getByText("– sources")).toBeInTheDocument();
  });

  it("an empty shelf says so plainly — and draws no qtabs over nothing", async () => {
    const { container } = render(<Library />);
    expect(await screen.findByText(/Nothing ingested yet/)).toBeInTheDocument();
    expect(container.querySelector(".qtabs")).toBeNull();
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
    render(<Library />);
    await screen.findByText("0 sources");

    await user.click(screen.getByLabelText("Video URL"));
    expect(screen.getByLabelText(/captions/i)).toBeInTheDocument();
    expect(screen.getByText(/paste the captions above/)).toBeInTheDocument();
  });
});
