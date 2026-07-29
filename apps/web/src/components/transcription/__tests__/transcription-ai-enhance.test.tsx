// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { Transcription } from "@/components/transcription/transcription";
import { seedLibraryRow } from "@/lib/testing/handlers";
import { server } from "@/lib/testing/server";

/**
 * THE AI-ENHANCE TOGGLE (founder ruling, s79: transcription is HIS knowledge
 * tool — free and deterministic by default, with an AI-enhance toggle beside
 * Ingest, per-ingest, his choice).
 *
 * Two things this pins that the engine tests cannot:
 *
 * 1. THE DEFAULT THE OPERATOR ACTUALLY GETS. The engine defaults to free, but
 *    a surface that ticks the box for him would spend anyway. So: the box is
 *    off at rest, and an untouched ingest sends no flag at all.
 * 2. THAT THE SURFACE SAYS WHAT FREE COSTS, IN WORDS, BEFORE HE CHOOSES. A
 *    free source has no relevance score and is not semantically retrievable;
 *    on the shelf that shows up as an ABSENCE (no "relevant to …" clause), and
 *    an absence nobody explained reads as "nothing matched" rather than "you
 *    chose not to score this". The consequence line and the footer are the
 *    words, and they are asserted as words.
 *
 * Rule 7 (docs/research/ux-refinement-program.md): a lane never runs its own
 * design pass and never amends a sheet. The toggle therefore joins the ingest
 * box's EXISTING unfolding extras — the same group the tags field and the seam
 * readout live in — rather than growing the sheet's resting band.
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

describe("Transcription — AI-enhance is a per-ingest choice, off by default", () => {
  it("the toggle is not in the resting band; it unfolds with the other extras, unticked", async () => {
    const user = userEvent.setup();
    render(<Transcription />);
    await screen.findByText("0 sources");

    expect(screen.queryByLabelText(/AI-enhance this ingest/i)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Video URL"));
    const toggle = screen.getByLabelText(/AI-enhance this ingest/i);
    expect(toggle).not.toBeChecked();
  });

  it("states what free gives up BEFORE the choice, and what enhancing costs after it", async () => {
    const user = userEvent.setup();
    render(<Transcription />);
    await screen.findByText("0 sources");
    await user.click(screen.getByLabelText("Video URL"));

    // The two real consequences, in words — not a 0, not a blank.
    const resting = screen.getByText(/Free and deterministic/i);
    expect(resting.textContent).toMatch(/no relevance score/i);
    expect(resting.textContent).toMatch(/no semantic retrieval/i);

    await user.click(screen.getByLabelText(/AI-enhance this ingest/i));
    const armed = screen.getByText(/scores them against your monitored areas/i);
    expect(armed.textContent).toMatch(/metered/i);
    // And that it is a ONE-INGEST choice, not a setting that stays on.
    expect(armed.textContent).toMatch(/back to free for the next one/i);
  });

  it("an untouched ingest sends NO flag — the free default lives engine-side, once", async () => {
    const user = userEvent.setup();
    const bodies = captureIngest();
    render(<Transcription />);
    await screen.findByText("0 sources");

    await user.type(screen.getByLabelText("Video URL"), "https://example.com/v-free");
    await user.click(screen.getByRole("button", { name: "Ingest" }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].url).toBe("https://example.com/v-free");
    expect("aiEnhance" in bodies[0]).toBe(false);
  });

  it("ticking it carries aiEnhance:true — and the next ingest is free again", async () => {
    const user = userEvent.setup();
    const bodies = captureIngest();
    render(<Transcription />);
    await screen.findByText("0 sources");

    await user.type(screen.getByLabelText("Video URL"), "https://example.com/v-paid");
    await user.click(screen.getByLabelText(/AI-enhance this ingest/i));
    await user.click(screen.getByRole("button", { name: "Ingest" }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].aiEnhance).toBe(true);

    // Per-ingest means per-ingest: the box returns to its resting free state
    // rather than quietly spending on everything that follows.
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/v-next");
    expect(screen.getByLabelText(/AI-enhance this ingest/i)).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Ingest" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect("aiEnhance" in bodies[1]).toBe(false);
  });

  it("a re-ingest re-processes nothing, and says so instead of letting the toggle look effective", async () => {
    const user = userEvent.setup();
    captureIngest(false);
    render(<Transcription />);
    await screen.findByText("0 sources");

    await user.type(screen.getByLabelText("Video URL"), "https://example.com/v-dup");
    await user.click(screen.getByLabelText(/AI-enhance this ingest/i));
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
    render(<Transcription />);

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
    render(<Transcription />);

    const footer = await screen.findByText(/Sources are per-tenant and chunked once/);
    // The sheet-wide honest statement: an absent "relevant to …" on a row is a
    // free ingest, not an area that scored nothing.
    expect(footer.textContent).toMatch(/free ingests are stored verbatim/i);
    expect(footer.textContent).toMatch(/no relevance score and no semantic retrieval/i);
    expect(footer.textContent).not.toMatch(/chunked and embedded once/i);
  });
});
