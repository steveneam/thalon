// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { Library } from "@/components/library/library";
import { seedLibraryRow } from "@/lib/testing/handlers";
import { server } from "@/lib/testing/server";

/**
 * THE FREE | AI-ENHANCE CHOICE (founder ruling, s79: the shelf is HIS
 * knowledge tool — free and deterministic by default, per-ingest, his choice).
 * The s90 W2 sheet drew the s86 control properly: a seg IN the ingest band,
 * free leading, enhance stating that it is metered — so the control now
 * rests in the band the sheet draws it in, and picking enhance unfolds the
 * extras so its cost words are on screen BEFORE the run.
 *
 * Two things this pins that the engine tests cannot:
 *
 * 1. THE DEFAULT THE OPERATOR ACTUALLY GETS. The engine defaults to free, but
 *    a surface that armed enhance for him would spend anyway. So: Free
 *    transcript is on at rest, and an untouched ingest sends no flag at all.
 * 2. THAT THE SURFACE SAYS WHAT EACH CHOICE COSTS, IN WORDS, BEFORE HE
 *    CHOOSES. A free source has no relevance score and is not semantically
 *    retrievable; on the shelf that shows up as an ABSENCE, and an absence
 *    nobody explained reads as "nothing matched" rather than "you chose not
 *    to score this". The consequence line and the footer are the words.
 */

const SEGMENTS = [
  { text: "first ingested segment", startMs: 0, endMs: 1_500 },
  { text: "second ingested segment", startMs: 1_500, endMs: 3_000 },
];

/** Captures the ingest body; `created` is the caller's to choose (the re-ingest case). */
function captureIngest(created = true) {
  const bodies: { url: string; aiEnhance?: boolean }[] = [];
  server.use(
    http.post("/api/library/ingest", async ({ request }) => {
      const body = (await request.json()) as { url: string; aiEnhance?: boolean };
      bodies.push(body);
      const row = seedLibraryRow({ uri: body.url }, SEGMENTS);
      return HttpResponse.json(
        { sourceId: row.id, created, chunkCount: 2, provider: row.provider },
        { status: created ? 201 : 200 },
      );
    }),
  );
  return bodies;
}

describe("Library — AI-enhance is a per-ingest choice, free by default (the W2 seg)", () => {
  it("the seg rests in the band with Free transcript on, and its title states the deal", async () => {
    render(<Library />);
    await screen.findByText("0 sources");

    const free = screen.getByRole("button", { name: "Free transcript" });
    expect(free).toHaveClass("seg-opt", "on");
    expect(free).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "AI enhance" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(free.closest(".seg")).toHaveAttribute(
      "title",
      expect.stringContaining("AI enhance is metered"),
    );
  });

  it("picking AI enhance puts its cost words ON SCREEN before the run", async () => {
    const user = userEvent.setup();
    render(<Library />);
    await screen.findByText("0 sources");

    // At rest nothing has unfolded and nothing is armed.
    expect(screen.queryByText(/scores them against your monitored areas/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "AI enhance" }));
    expect(screen.getByRole("button", { name: "AI enhance" })).toHaveClass("on");
    const armed = screen.getByText(/scores them against your monitored areas/i);
    expect(armed.textContent).toMatch(/metered/i);
    // And that it is a ONE-INGEST choice, not a setting that stays on.
    expect(armed.textContent).toMatch(/back to free for the next one/i);

    // Flipping back states what free gives up, in the same slot.
    await user.click(screen.getByRole("button", { name: "Free transcript" }));
    const resting = screen.getByText(/Free and deterministic/i);
    expect(resting.textContent).toMatch(/no relevance score/i);
    expect(resting.textContent).toMatch(/no semantic retrieval/i);
  });

  it("an untouched ingest sends NO flag — the free default lives engine-side, once", async () => {
    const user = userEvent.setup();
    const bodies = captureIngest();
    render(<Library />);
    await screen.findByText("0 sources");

    await user.type(screen.getByLabelText("Video URL"), "https://example.com/v-free");
    await user.click(screen.getByRole("button", { name: "Ingest" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].url).toBe("https://example.com/v-free");
    expect("aiEnhance" in bodies[0]).toBe(false);
  });

  it("picking enhance carries aiEnhance:true — and the next ingest is free again", async () => {
    const user = userEvent.setup();
    const bodies = captureIngest();
    render(<Library />);
    await screen.findByText("0 sources");

    await user.type(screen.getByLabelText("Video URL"), "https://example.com/v-paid");
    await user.click(screen.getByRole("button", { name: "AI enhance" }));
    await user.click(screen.getByRole("button", { name: "Ingest" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].aiEnhance).toBe(true);

    // Per-ingest means per-ingest: the seg returns to its resting free state
    // rather than quietly spending on everything that follows.
    expect(screen.getByRole("button", { name: "Free transcript" })).toHaveClass("on");
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/v-next");
    await user.click(screen.getByRole("button", { name: "Ingest" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect("aiEnhance" in bodies[1]).toBe(false);
  });

  it("a re-ingest re-processes nothing, and says so instead of letting the seg look effective", async () => {
    const user = userEvent.setup();
    captureIngest(false);
    render(<Library />);
    await screen.findByText("0 sources");

    await user.type(screen.getByLabelText("Video URL"), "https://example.com/v-dup");
    await user.click(screen.getByRole("button", { name: "AI enhance" }));
    await user.click(screen.getByRole("button", { name: "Ingest" }));

    const note = await screen.findByText(/Already on the shelf/i);
    expect(note.textContent).toMatch(/nothing was re-processed/i);
    expect(note.textContent).toMatch(/AI-enhance did not apply/i);
  });

  it("a free row SAYS what it gives up, in the slot an enhanced row states its area", async () => {
    seedLibraryRow({ uri: "https://example.com/v-free", title: "Free row", aiEnhanced: false }, SEGMENTS);
    seedLibraryRow(
      {
        uri: "https://example.com/v-paid",
        title: "Enhanced row",
        aiEnhanced: true,
        areaRelevance: [{ areaId: "a1", areaName: "ai tooling", score: 0.8, reason: "why" }],
      },
      SEGMENTS,
    );
    // A row from before the key existed: nothing is known about it, so nothing
    // is claimed — it must not be labelled free retroactively.
    seedLibraryRow({ uri: "https://example.com/v-old", title: "Pre-s86 row" }, SEGMENTS);
    render(<Library />);

    const free = await screen.findByRole("button", { name: "Free row" });
    expect(free.textContent).toMatch(
      /free ingest — no relevance score, not semantically retrievable/,
    );

    const enhanced = screen.getByRole("button", { name: "Enhanced row" });
    expect(enhanced.textContent).toMatch(/relevant to ai tooling/);
    expect(enhanced.textContent).not.toMatch(/free ingest/);

    const old = screen.getByRole("button", { name: "Pre-s86 row" });
    expect(old.textContent).not.toMatch(/free ingest/);
    expect(old.textContent).not.toMatch(/relevant to/);
  });

  it("the shelf footer no longer claims every source is embedded", async () => {
    seedLibraryRow({ uri: "https://example.com/v1" }, SEGMENTS);
    render(<Library />);

    const footer = await screen.findByText(/Sources are per-tenant and chunked once/);
    // The sheet-wide honest statement: an absent "relevant to …" on a row is a
    // free ingest, not an area that scored nothing.
    expect(footer.textContent).toMatch(/free ingests are stored verbatim/i);
    expect(footer.textContent).toMatch(/no relevance score and no semantic retrieval/i);
    expect(footer.textContent).not.toMatch(/chunked and embedded once/i);
  });
});
