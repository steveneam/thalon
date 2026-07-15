// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { seedLibraryRow } from "@/lib/testing/handlers";
import { server } from "@/lib/testing/server";
import { SELECTED_ROW } from "@/lib/workspace/selected-row";
import { LibrarySurface } from "../library-surface";

const SEGMENTS = [{ text: "a segment", startMs: 0, endMs: 1000 }];

describe("library keyboard grammar + bulk delete (s40 parity)", () => {
  it("j opens the first shelf row (selected-row recipe); d deletes it behind the named confirm", async () => {
    const user = userEvent.setup();
    // The shelf is newest-first (seedLibraryRow unshifts) — seed in reverse
    // so "First video" is the top row j lands on.
    seedLibraryRow({ uri: "https://x.example/2", title: "Second video" }, SEGMENTS);
    seedLibraryRow({ uri: "https://x.example/1", title: "First video" }, SEGMENTS);
    const confirms: string[] = [];
    vi.spyOn(window, "confirm").mockImplementation((msg) => {
      confirms.push(msg ?? "");
      return true;
    });

    render(<LibrarySurface />);
    const firstRow = await screen.findByRole("button", { name: /^first video/i });
    expect(firstRow.className).not.toContain(SELECTED_ROW);

    // j opens the first row — selection drives the detail (approve-queue model).
    await user.keyboard("j");
    await waitFor(() => expect(firstRow.className).toContain(SELECTED_ROW));
    // The transcript panel now leads with the row's title.
    expect(await screen.findByText("a segment", { exact: false })).toBeInTheDocument();

    // d = this surface's Four-Verbs word (Delete), still confirmed by name.
    await user.keyboard("d");
    expect(confirms).toHaveLength(1);
    expect(confirms[0]).toContain("First video");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^first video/i })).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/deleted "first video"/i);
    vi.mocked(window.confirm).mockRestore();
  });

  it("bulk delete: pick rows → ONE named confirm with the count → toast", async () => {
    const user = userEvent.setup();
    seedLibraryRow({ uri: "https://x.example/1", title: "Alpha" }, SEGMENTS);
    seedLibraryRow({ uri: "https://x.example/2", title: "Beta" }, SEGMENTS);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<LibrarySurface />);
    await screen.findByRole("button", { name: /^alpha/i });
    await user.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Beta" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete selected/i }));
    expect(confirmSpy).toHaveBeenCalledExactlyOnceWith("Delete 2 transcripts from the library?");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^alpha/i })).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /^beta/i })).not.toBeInTheDocument();
    expect(await screen.findByRole("status")).toHaveTextContent(/deleted 2 transcripts/i);
    confirmSpy.mockRestore();
  });

  it("a refuse-while-referenced failure surfaces with the partial count — never silently", async () => {
    const user = userEvent.setup();
    const kept = seedLibraryRow({ uri: "https://x.example/1", title: "Grounds a draft" }, SEGMENTS);
    seedLibraryRow({ uri: "https://x.example/2", title: "Free to go" }, SEGMENTS);
    server.use(
      http.delete(`/api/library/${kept.id}`, () =>
        HttpResponse.json({ error: "this source still grounds 2 drafts" }, { status: 409 }),
      ),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<LibrarySurface />);
    await screen.findByRole("button", { name: /^grounds a draft/i });
    await user.click(screen.getByRole("checkbox", { name: "Select Grounds a draft" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Free to go" }));
    await user.click(screen.getByRole("button", { name: /delete selected/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/deleted 1; 1 refused/i);
    expect(alert).toHaveTextContent(/still grounds 2 drafts/i);
    // The refused row honestly survives on the shelf.
    expect(screen.getByRole("button", { name: /^grounds a draft/i })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });
});
