// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { Library } from "@/components/library/library";
import { seedLibraryRow } from "@/lib/testing/handlers";
import { server } from "@/lib/testing/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/library",
  useRouter: () => ({ push: vi.fn() }),
}));

/**
 * The shelf read on a chosen provider seam. Only `caption-file` consumes pasted
 * captions (the engine's own registry) — which is the whole reason the drop has
 * to branch. Used by the drop tests, which need no rows.
 */
function seamIs(selected: string) {
  server.use(
    http.get("/api/library", () =>
      HttpResponse.json({
        sources: [],
        seam: {
          selected,
          registered: ["caption-file", "hosted-vendor", "whisper-local"],
          vendorConfigured: true,
        },
      }),
    ),
  );
}
const seed = seedLibraryRow;

/**
 * The s79 lane-3 fix pass — the three findings that survived the adversarial
 * verify round (T1 3/3, T2 3/3, T3 2/3), carried whole through the s94 §5.3
 * re-homing (Transcription → Library). Each test was originally run against
 * the reverted fix to prove it fails without it.
 */
describe("Library — s79 verified fixes (carried through the §5.3 re-homing)", () => {
  /* ── T1 [high] — a refused control must not look armed ──────────────────── */

  it("T1: the resting Ingest refusal names what it is waiting for", async () => {
    render(<Library />);
    const ingest = await screen.findByRole("button", { name: "Ingest" });
    expect(ingest).toBeDisabled();
    expect(ingest).toHaveAttribute("title", expect.stringContaining("Paste a video URL first"));
    // Not busy, so no busy claim.
    expect(ingest).not.toHaveAttribute("aria-busy");
  });

  it("T1: an in-flight control says RUNNING, never wearing the refusal look alone", async () => {
    const user = userEvent.setup();
    // Hold the ingest open so the busy state is observable.
    const gate: { release: () => void } = { release: () => {} };
    server.use(
      http.post("/api/library/ingest", async () => {
        await new Promise<void>((resolve) => {
          gate.release = resolve;
        });
        return HttpResponse.json({ sourceId: "held", created: true }, { status: 201 });
      }),
    );
    render(<Library />);
    await screen.findByRole("button", { name: "Ingest" });
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/held");
    await user.click(screen.getByRole("button", { name: "Ingest" }));

    const busy = await screen.findByRole("button", { name: "Ingesting…" });
    expect(busy).toHaveAttribute("aria-busy", "true");
    // The word is what distinguishes running from not-ready; the dim alone
    // cannot, which is why a blanket :disabled rule needed this half.
    gate.release();
  });

  /* ── T2 [high] — the advertised file drop ───────────────────────────────── */

  function dropEvent(file: File) {
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "dataTransfer", { value: { files: [file] } });
    return event;
  }

  it("T2: a dropped file never reaches the browser — the surface handles the event", async () => {
    const { container } = render(<Library />);
    await screen.findByRole("button", { name: "Ingest" });
    const form = container.querySelector(".ingest") as HTMLElement;

    const over = new Event("dragover", { bubbles: true, cancelable: true });
    form.dispatchEvent(over);
    // Without preventDefault on dragover the drop event never fires at all,
    // and the browser then navigates the tab to the dropped file.
    expect(over.defaultPrevented).toBe(true);

    const drop = dropEvent(new File(["hello"], "cues.srt", { type: "text/plain" }));
    form.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
  });

  it("T2: a non-caption file is refused BY NAME, not silently swallowed", async () => {
    const { container } = render(<Library />);
    await screen.findByRole("button", { name: "Ingest" });
    (container.querySelector(".ingest") as HTMLElement).dispatchEvent(
      dropEvent(new File(["not a transcript"], "clip.mp4", { type: "video/mp4" })),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("clip.mp4");
    expect(alert.textContent).toMatch(/\.srt, \.vtt or \.txt/);
  });

  it("T2: on a fetching seam the drop is refused in the engine's own words", async () => {
    // The live seam is hosted-vendor, which fetches from the link and IGNORES
    // captions — reading the file into invisible state under a still-disabled
    // button would be worse than the refusal.
    const { container } = render(<Library />);
    await screen.findByRole("button", { name: "Ingest" });
    (container.querySelector(".ingest") as HTMLElement).dispatchEvent(
      dropEvent(new File(["1\n00:00:01,000 --> 00:00:02,000\nhi\n"], "cues.srt")),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("hosted-vendor");
    expect(alert.textContent).toMatch(/caption-file/);
    // Nothing was quietly stored.
    expect(screen.queryByLabelText(/Captions/)).toBeNull();
  });

  it("T2: on the caption-file seam the drop lands VISIBLY, in the box the operator can see", async () => {
    seamIs("caption-file");
    const { container } = render(<Library />);
    // Wait for the SEAM to arrive, not just the button: captionMode is a fact
    // of the read, and a drop before it lands would take the refusal branch.
    await screen.findByText(/Nothing ingested yet/);
    (container.querySelector(".ingest") as HTMLElement).dispatchEvent(
      dropEvent(new File(["1\n00:00:01,000 --> 00:00:02,000\nhi\n"], "cues.srt")),
    );

    // The extras panel opens, so the captions are on screen rather than in
    // state nothing renders.
    const box = await screen.findByLabelText("Captions (SRT, WebVTT, or plain text)");
    await waitFor(() => expect((box as HTMLTextAreaElement).value).toContain("00:00:01,000"));
    // …and the URL the schema still requires is asked for at that moment.
    expect(await screen.findByRole("status")).toHaveTextContent(/cues\.srt.*paste the video URL/);
  });

  /* ── T3 [high] — filters, sort by (the founder's own re-introduction) ───── */

  it("T3: no shelf, no knobs — the band never appears with nothing to control", async () => {
    const { container } = render(<Library />);
    expect(await screen.findByText(/Nothing ingested yet/)).toBeInTheDocument();
    expect(container.querySelector(".shelf-knobs")).toBeNull();
  });

  it("T3: find narrows the shelf and the count pill states the bound", async () => {
    const user = userEvent.setup();
    seed({ uri: "https://example.com/a", title: "Cold brew basics", tags: ["coffee"] });
    seed({ uri: "https://example.com/b", title: "Roast profiles", tags: ["coffee", "roasting"] });
    seed({ uri: "https://example.com/c", title: "Hiring engineers", tags: ["hiring"] });
    render(<Library />);

    expect(await screen.findByText("3 sources")).toBeInTheDocument();
    // "coffee" is a TAG on two rows and in no title — so this also proves the
    // find reaches the tags, which is the half the row's prose line clips away.
    await user.type(screen.getByLabelText("Find a source"), "coffee");
    expect(await screen.findByText("2 of 3 sources")).toBeInTheDocument();
    expect(screen.queryByText("Hiring engineers")).toBeNull();
  });

  it("T3: the tag filter is a real control built from the shelf's own tags", async () => {
    const user = userEvent.setup();
    seed({ uri: "https://example.com/a", title: "Cold brew basics", tags: ["coffee"] });
    seed({ uri: "https://example.com/c", title: "Hiring engineers", tags: ["hiring"] });
    render(<Library />);
    await screen.findByText("2 sources");

    const tagFilter = screen.getByLabelText("Tag filter");
    expect(within(tagFilter).getByRole("option", { name: "coffee" })).toBeInTheDocument();
    expect(within(tagFilter).getByRole("option", { name: "hiring" })).toBeInTheDocument();
    await user.selectOptions(tagFilter, "hiring");

    expect(await screen.findByText("1 of 2 sources")).toBeInTheDocument();
    expect(screen.queryByText("Cold brew basics")).toBeNull();
  });

  it("T3: sort reorders the shelf, and the order is stated at the control", async () => {
    const user = userEvent.setup();
    seed({ uri: "https://example.com/old", title: "Older", createdAt: "2026-07-01T00:00:00.000Z" });
    seed({ uri: "https://example.com/new", title: "Newer", createdAt: "2026-07-20T00:00:00.000Z" });
    const { container } = render(<Library />);
    await screen.findByText("2 sources");

    const leads = () =>
      Array.from(container.querySelectorAll(".src-lead")).map((el) => el.textContent);
    expect(leads()).toEqual(["Newer", "Older"]);

    await user.selectOptions(screen.getByLabelText("Sort order"), "oldest");
    await waitFor(() => expect(leads()).toEqual(["Older", "Newer"]));
    // The chip face states the order.
    expect(screen.getByText("Oldest first", { selector: ".sel-ctl" })).toBeInTheDocument();
  });

  it("T3: a narrowed-empty shelf says the KNOB emptied it, and offers the way back", async () => {
    const user = userEvent.setup();
    seed({ uri: "https://example.com/a", title: "Cold brew basics" });
    render(<Library />);
    await screen.findByText("1 sources");

    await user.type(screen.getByLabelText("Find a source"), "zzzz");
    expect(await screen.findByText(/No source matches “zzzz”/)).toBeInTheDocument();
    expect(screen.getByText(/1 source is on the shelf/)).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Clear" })[0]);
    await waitFor(() => expect(screen.getByText("Cold brew basics")).toBeInTheDocument());
  });

  it("T3: the cursor can never land on a row the filter removed — the kind qtab included", async () => {
    const user = userEvent.setup();
    seed({ uri: "https://example.com/a", title: "Cold brew basics" });
    seed({
      uri: "https://example.com/c",
      title: "An article source",
      kind: "url",
      provider: null,
      segmentCount: null,
    });
    render(<Library />);
    await screen.findByText("2 sources");

    // Pick the row that the lens is about to remove.
    const article = screen.getByRole("button", { name: "An article source" });
    await user.click(article);
    await waitFor(() => expect(article).toHaveClass("sel"));

    await user.click(screen.getByRole("tab", { name: "Video 1" }));

    // The selected source is gone from the shelf; the cursor falls back to the
    // first VISIBLE row, never to an index into a list nobody can see — this
    // surface's d/↵ verbs act on it.
    const remaining = await screen.findByRole("button", { name: "Cold brew basics" });
    expect(remaining).toHaveClass("sel");
    const shelf = remaining.parentElement as HTMLElement;
    expect(within(shelf).queryByText("An article source")).toBeNull();
  });

  it("T3: an ingest is never hidden behind a filter the operator forgot — the kind lens included", async () => {
    const user = userEvent.setup();
    seed({
      uri: "https://example.com/article",
      title: "An article source",
      kind: "url",
      provider: null,
      segmentCount: null,
    });
    render(<Library />);
    await screen.findByText("1 sources");
    await user.click(screen.getByRole("tab", { name: "Article 1" }));
    expect(await screen.findByText("1 of 1 sources")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Video URL"), "https://example.com/fresh");
    await user.click(screen.getByRole("button", { name: "Ingest" }));

    // A write that lands behind a filter reads as a failed write — the fresh
    // video row must be visible even though the Article lens was on.
    await waitFor(() => expect(screen.getByText("2 sources")).toBeInTheDocument());
    expect(screen.getByRole("tab", { name: "All 2" })).toHaveClass("on");
  });
});
