// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { Intel } from "@/components/intel/intel";
import { DossierCard } from "@/components/intel/dossier-card";
import { toDossierView } from "@/components/intel/intel-model";
import { fixtureTrendCards } from "@/lib/intel/fixtures";
import { server } from "@/lib/testing/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/intel",
  useRouter: () => ({ push: vi.fn() }),
}));

/**
 * The s100 Intel gate's recorded debt, fixed s102 — pinned at the behaviours
 * that would silently come back. Each of these was a control that LOOKED
 * right: the failures were all "the UI says one thing and does another",
 * which is exactly the class no type or lint can see.
 */

const dossierCard = () => toDossierView(fixtureTrendCards[1], Date.now());

describe("a running action says which action is running", () => {
  it("the sweep button names itself while it runs, and the live region announces it", async () => {
    let release: (() => void) | undefined;
    server.use(
      http.post("/api/intel/sweep", async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return HttpResponse.json({ source: "fake", polled: 0, cards: 0, cardsCut: 0, areasSwept: 0 });
      }),
    );
    render(<Intel />);
    const sweep = await screen.findByRole("button", { name: "Sweep now" });

    await userEvent.click(sweep);

    // A dim alone cannot tell "running" from "not ready" — the word does.
    const running = await screen.findByRole("button", { name: "Sweeping…" });
    expect(running).toHaveAttribute("aria-busy", "true");
    expect(running).toBeDisabled();
    await waitFor(() => expect(document.querySelector("[aria-live]")?.textContent).toBe("Sweeping…"));

    release?.();
    await screen.findByRole("button", { name: "Sweep now" });
  });
});

describe("the doors that ran outside the busy gate", () => {
  /**
   * add-area awaited its own fetch with nothing disabled, so a second press
   * submitted again and created a duplicate area. The guard is a REF, because
   * two presses in one tick both read the same rendered state.
   */
  it("a double-pressed Add area posts ONCE", async () => {
    const posts: unknown[] = [];
    server.use(
      http.post("/api/intel/areas", async ({ request }) => {
        posts.push(await request.json());
        await new Promise((resolve) => setTimeout(resolve, 30));
        return HttpResponse.json({ area: { id: "a1", name: "n", description: "d", status: "active" } });
      }),
    );
    render(<Intel />);
    await userEvent.click(await screen.findByRole("button", { name: /Add area or keyword/ }));
    await userEvent.type(screen.getByLabelText("Area name"), "Frontier AI");
    await userEvent.type(screen.getByLabelText("Area description"), "what to watch");

    const submit = screen.getByRole("button", { name: "Add area" });
    await Promise.all([userEvent.click(submit), userEvent.click(submit)]);

    await waitFor(() => expect(posts.length).toBeGreaterThan(0));
    expect(posts).toHaveLength(1);
  });
});

describe("a glyph must not say the opposite of its verb", () => {
  it("the watch chip's control wears a PAUSE mark, never the destroy ×", async () => {
    server.use(
      http.get("/api/intel/trends", () =>
        HttpResponse.json({
          areas: [{ id: "a1", name: "Frontier AI", description: "d", status: "active" }],
          cards: [fixtureTrendCards[0]],
          demo: true,
          sweep: { lastSweptAt: null, dueNow: false, nextSweepAt: null, intervalHours: null },
          sources: [],
        }),
      ),
    );
    render(<Intel />);
    const pause = await screen.findByRole("button", { name: "Pause watching Frontier AI" });
    // The one reversible verb on the band read as the one destructive one.
    expect(pause.textContent).not.toContain("×");
  });
});

describe("\"copied\" must mean copied", () => {
  it("says so when the clipboard refused, instead of claiming success", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<DossierCard card={dossierCard()} />);
    const copyButtons = screen.getAllByRole("button", { name: /^Copy title/ });
    await userEvent.click(copyButtons[0]);

    expect(writeText).toHaveBeenCalled();
    // The operator otherwise pastes the last thing they copied and never
    // learns why.
    expect(await screen.findByText("couldn’t copy")).toBeInTheDocument();
    expect(screen.queryByText("copied")).not.toBeInTheDocument();
  });

  it("says copied only after the write resolved", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(<DossierCard card={dossierCard()} />);
    await userEvent.click(screen.getAllByRole("button", { name: /^Copy title/ })[0]);

    expect(await screen.findByText("copied")).toBeInTheDocument();
  });
});

describe("the ranking's explanation is not mouse-only", () => {
  it("every reason bar carries a name and a value", () => {
    const card = dossierCard();
    render(<DossierCard card={card} />);
    const meters = screen.getAllByRole("meter");
    expect(meters).toHaveLength(card.reasons.length);
    for (const meter of meters) {
      expect(meter).toHaveAttribute("aria-label");
      expect(meter).toHaveAttribute("aria-valuenow");
    }
    // The verbatim sentence lived only in a `title`, which no keyboard reaches.
    const group = screen.getAllByRole("group")[0];
    expect(group.getAttribute("aria-label")).toContain(card.reasons[0].text);
  });
});

describe("machine-written text names its author", () => {
  it("the ready column says the lines were written, not sourced", () => {
    render(<DossierCard card={dossierCard()} />);
    expect(screen.getByText(/Written for you from the item above/)).toBeInTheDocument();
  });

  it("…and says nothing at all when there is no dossier to attribute", () => {
    const bare = { ...dossierCard(), titles: [], angles: [], hook: null };
    render(<DossierCard card={bare} />);
    expect(screen.queryByText(/Written for you from the item above/)).not.toBeInTheDocument();
  });
});

describe("the keyboard grammar is visible", () => {
  it("the rising list teaches j/k/↵ at its own head", async () => {
    render(<Intel />);
    const list = await screen.findByRole("region", { name: "More rising" });
    const legend = within(list).getByText(/move/);
    expect(legend.textContent).toContain("j");
    expect(legend.textContent).toContain("open");
  });
});

describe("the header does not shove the tabs when the read lands", () => {
  it("the rising-count pill holds its box before the read", () => {
    render(<Intel />);
    // Present from the first paint (hidden, not absent) — the read landing
    // used to INSERT it and move the tabs 91px under the cursor.
    const pill = document.querySelector(".pill-idle") as HTMLElement | null;
    expect(pill).not.toBeNull();
    expect(pill).toHaveAttribute("aria-hidden", "true");
  });
});
