// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { ApproveSurface } from "@/components/approve/approve-surface";
import { CreateContextLoader } from "@/components/create/create-context-loader";
import { NeedsYouCard } from "@/components/dashboard/needs-you-card";
import { Integrations } from "@/components/settings/integrations";
import { LeadsSurface } from "@/components/leads/leads-surface";
import { Library } from "@/components/library/library";
import { draftA, FIXTURE_DRAFT_A_ID, FIXTURE_DRAFT_B_ID } from "@/lib/approve-queue/fixtures";
import type { NeedsYouRow } from "@/components/dashboard/dashboard-model";
import type { CreateContext } from "@/lib/intel/types";
import type { LeadCard, LeadsPayload } from "@/lib/leads/types";
import type { WireIntegrationCard } from "@/lib/integrations/client";
import { seedLibraryRow } from "@/lib/testing/handlers";
import { server } from "@/lib/testing/server";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push: routerPush }),
}));

/**
 * STATE THAT OUTLIVES ITS ENTITY — the s78 keyed-by-entity sweep.
 *
 * One disease, found in six places. The founder hit it by hand in Intel
 * (`DossierCard` carried no React `key`, so a title pick survived the card
 * switch and went out of range on a smaller card), and the s77 fan-out then
 * found the same shape across the workspace — including one instance that
 * corrupts data.
 *
 * The rule, stated once so it is never re-derived per surface:
 *
 *   State that describes ONE entity must be keyed to that entity — either
 *   by remounting on its id (`key={id}`) or by holding the id itself and
 *   deriving the position. An ARRAY INDEX is not an identity: the list
 *   re-reads, re-orders, gains and loses rows underneath it, and the index
 *   silently comes to mean a different thing.
 *
 * These tests fail without their fix. They are deliberately in ONE file
 * rather than scattered per surface, because the point is the class.
 */
describe("keyed by entity — state must not outlive the entity it describes", () => {
  it("Approve [blocker]: the editor does not outlive the draft — a mid-edit switch cannot write draft A's body onto draft B", async () => {
    const user = userEvent.setup();
    const edits: { draftId: string; body: string }[] = [];
    server.use(
      http.post("/api/drafts/:draftId/edit", async ({ params, request }) => {
        const body = (await request.json()) as { editedBody: string };
        edits.push({ draftId: String(params.draftId), body: body.editedBody });
        return HttpResponse.json({
          approval: {
            id: "appr",
            tenantId: "t",
            draftId: String(params.draftId),
            actor: "operator",
            action: "edit",
            editedBody: body.editedBody,
            createdAt: "2026-07-04T11:00:00.000Z",
          },
          draft: { ...draftA, status: "queued" },
        });
      }),
    );

    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    // Re-queried per switch: the card now REMOUNTS per draft, so a held
    // reference goes stale by design — that remount is the fix.
    const detail = () => screen.getByRole("region", { name: "Draft detail" });
    // Let the surface land on its own auto-selection (newest-first picks the
    // blocked draft) before driving it — otherwise the click races the
    // mount-time selection that resolves behind the blocked-reason reads.
    await within(detail()).findByText("Run2 X draft");

    // Open the editor on draft A and type into it.
    await user.click(
      await within(queue).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` }),
    );
    await waitFor(() => expect(within(detail()).getByText("Run2 LinkedIn draft")).toBeInTheDocument());
    await user.keyboard("e");
    const textarea = await within(detail()).findByRole("textbox", { name: "Edit draft body" });
    await user.type(textarea, " — EDITED ON A");
    expect(textarea).toHaveValue(`${draftA.body} — EDITED ON A`);

    // Switch to draft B WITHOUT saving. The editor belongs to draft A; it
    // must not survive the switch carrying A's body.
    await user.click(
      within(queue).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }),
    );
    await waitFor(() => expect(within(detail()).getByText("Run2 X draft")).toBeInTheDocument());
    await waitFor(() =>
      expect(within(detail()).queryByRole("textbox", { name: "Edit draft body" })).toBeNull(),
    );

    // The regression, stated as the founder would hit it: with the editor
    // still open, "Save edit" posts to the SELECTED draft (B) carrying the
    // body of the draft that is no longer on screen (A).
    expect(within(detail()).queryByRole("button", { name: "Save edit" })).toBeNull();
    expect(edits).toHaveLength(0);

    // And re-opening the editor on B starts from B's own body.
    await user.keyboard("e");
    const reopened = await within(detail()).findByRole("textbox", { name: "Edit draft body" });
    expect(reopened).toHaveValue("Run2 X draft");
  });

  it("Approve: an action failure does not outlive the draft it happened on", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("/api/drafts/:draftId/approve", () =>
        HttpResponse.json({ error: "gateway 402 — budget halt" }, { status: 502 }),
      ),
    );

    render(<ApproveSurface />);
    const queue = await screen.findByRole("region", { name: "Approve queue" });
    const detail = () => screen.getByRole("region", { name: "Draft detail" });
    await within(detail()).findByText("Run2 X draft");

    await user.click(
      await within(queue).findByRole("button", { name: `Select linkedin draft ${FIXTURE_DRAFT_A_ID}` }),
    );
    await waitFor(() => expect(within(detail()).getByText("Run2 LinkedIn draft")).toBeInTheDocument());
    await user.keyboard("a");
    await waitFor(() => expect(within(detail()).getByText(/budget halt/)).toBeInTheDocument());

    // The failure describes work attempted on A. Under B it is a lie — and
    // it lives ABOVE the keyed remount, so the key alone does not clear it.
    await user.click(
      within(queue).getByRole("button", { name: `Select x draft ${FIXTURE_DRAFT_B_ID}` }),
    );
    await waitFor(() => expect(within(detail()).getByText("Run2 X draft")).toBeInTheDocument());
    await waitFor(() => expect(within(detail()).queryByText(/budget halt/)).toBeNull());
  });

  it("Create: the resolved capture does not outlive its ?ctx= — a capture switch never renders the previous one's handoff", async () => {
    const contexts: Record<string, CreateContext> = {
      "capture-first": {
        captureId: "capture-first",
        kind: "trend_promote",
        family: "video",
        title: "FIRST CAPTURE TITLE",
        angle: "the first angle",
        hook: "the first hook",
        sourceUrl: "https://example.com/first",
        areaName: "First area",
        score: 0.9,
        text: "first capture text",
      },
      "capture-second": {
        captureId: "capture-second",
        kind: "trend_promote",
        family: "video",
        title: "SECOND CAPTURE TITLE",
        angle: "the second angle",
        hook: "the second hook",
        sourceUrl: "https://example.com/second",
        areaName: "Second area",
        score: 0.8,
        text: "second capture text",
      },
    };
    // The second read is held open, so the render between the id change and
    // its resolution is the one under test.
    let releaseSecond!: () => void;
    const secondHeld = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    server.use(
      http.get("/api/intel/context/:captureId", async ({ params }) => {
        const id = String(params.captureId);
        if (id === "capture-second") await secondHeld;
        return HttpResponse.json({ context: contexts[id] });
      }),
    );

    const props = { initialPrompt: "", initialKeyword: "" };
    const promptValue = () =>
      (screen.getByRole("textbox", { name: "The prompt" }) as HTMLTextAreaElement).value;

    const { rerender } = render(<CreateContextLoader contextId="capture-first" {...props} />);
    // The capture rides into the prompt itself (seedPrompt) — this is the
    // text that would actually be generated from.
    await waitFor(() => expect(promptValue()).toContain("the first hook"));

    // The ?ctx= changes. This loader re-renders WITHOUT unmounting, so an
    // unstamped "resolved" would keep the first capture on screen — Create
    // would offer to generate from a handoff the operator has left.
    rerender(<CreateContextLoader contextId="capture-second" {...props} />);
    await waitFor(() =>
      expect(screen.getByText("Reading the capture you brought…")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("textbox", { name: "The prompt" })).toBeNull();

    releaseSecond();
    await waitFor(() => expect(promptValue()).toContain("the second hook"));
    expect(promptValue()).not.toContain("the first hook");
  });

  it("Dashboard: the needs-you selection is a draft, not a position — it survives a re-read that re-orders the list", async () => {
    const user = userEvent.setup();
    const row = (draftId: string, lead: string): NeedsYouRow => ({
      draftId,
      href: `/app/approve?draft=${draftId}`,
      blocked: false,
      lead,
      excerpt: `${lead} excerpt`,
      reason: null,
      thumb: null,
      at: new Date("2026-07-26T06:00:00.000Z"),
    });
    const first = [row("draft-1", "LinkedIn · post"), row("draft-2", "X · post")];
    const props = { count: 2, status: "success" as const, now: new Date("2026-07-26T08:00:00.000Z") };

    const { rerender } = render(<NeedsYouCard rows={first} {...props} />);

    // Move onto the SECOND row.
    await user.keyboard("j");
    const second = screen.getByText("X · post").closest(".row");
    await waitFor(() => expect(second).toHaveClass("sel"));

    // A re-read lands and a newer draft arrives at the top. An index would
    // still say "row 1" — which is now a different draft, and ↵ would open
    // a draft the operator never chose.
    const reread = [row("draft-3", "Bluesky · post"), ...first];
    rerender(<NeedsYouCard rows={reread} {...{ ...props, count: 3 }} />);

    await waitFor(() => expect(screen.getByText("X · post").closest(".row")).toHaveClass("sel"));
    expect(screen.getByText("Bluesky · post").closest(".row")).not.toHaveClass("sel");
    expect(screen.getByText("LinkedIn · post").closest(".row")).not.toHaveClass("sel");
  });

  it("Library: the selection is a source, not a position — it survives an ingest that prepends", async () => {
    const user = userEvent.setup();
    seedLibraryRow({ uri: "https://example.com/older", title: "OLDER SOURCE" });
    seedLibraryRow({ uri: "https://example.com/newer", title: "NEWER SOURCE" });

    render(<Library />);
    // seedLibraryRow unshifts, so the shelf reads NEWER (0) → OLDER (1).
    const older = await screen.findByRole("button", { name: "OLDER SOURCE" });
    await user.click(older);
    await waitFor(() => expect(older).toHaveClass("sel"));

    // Ingest prepends a third row. The operator's source is now at index 2,
    // so a held index would slide the selection onto its neighbour — and
    // this surface's Copy/Export/Delete verbs act on the selected row.
    await user.click(screen.getByRole("button", { name: "Ingest" }));
    await user.type(screen.getByLabelText("Video URL"), "https://example.com/ingested");
    await user.click(screen.getByRole("button", { name: "Ingest" }));

    await waitFor(() => expect(screen.getByText("3 sources")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "OLDER SOURCE" })).toHaveClass("sel");
    expect(screen.getByRole("button", { name: "NEWER SOURCE" })).not.toHaveClass("sel");
  });

  it("Settings/Integrations [blocker]: a pasted credential does not outlive its destination", async () => {
    const user = userEvent.setup();
    const intCard = (destination: string, label: string): WireIntegrationCard => ({
      destination,
      class: "social",
      label,
      driver: `${destination}-driver`,
      state: "not_connected",
      connectedAs: null,
      validatedAt: null,
      expiresAt: null,
      envOverride: false,
      // s78 lane 2 widened WireIntegrationCard with the arming rung, s83 with
      // the connect flavor; these keep this fixture compiling. COMPILE-ONLY —
      // no assertion here changed, and this pin still tests exactly what it
      // always did.
      armed: null,
      armedReason: null,
      connectFlavor: "manual",
      fields: [{ key: "accessToken", optional: false }],
    });
    server.use(
      http.get("/api/integrations", () =>
        HttpResponse.json({
          cards: [intCard("bluesky", "Bluesky"), intCard("mastodon", "Mastodon")],
        }),
      ),
      http.get("/api/integrations/published", () =>
        HttpResponse.json({ items: [], total: 0 }),
      ),
    );

    render(<Integrations />);
    const cardFor = (label: string) =>
      screen.getByText(label, { selector: ".int-name" }).closest(".int-card") as HTMLElement;

    // Paste a secret into Bluesky's panel — then walk away to Mastodon's
    // WITHOUT connecting. The grid stays on screen, so this is one click.
    await screen.findByText("Bluesky", { selector: ".int-name" });
    await user.click(within(cardFor("Bluesky")).getByRole("button", { name: "Set up" }));
    await user.type(screen.getByLabelText(/Access token/), "bluesky-secret-token");
    expect(screen.getByLabelText(/Access token/)).toHaveValue("bluesky-secret-token");

    await user.click(within(cardFor("Mastodon")).getByRole("button", { name: "Set up" }));
    expect(screen.getByText("Connect Mastodon")).toBeInTheDocument();

    // The box must be empty. Unkeyed, Bluesky's token is still sitting in
    // it under Mastodon's title — and Connect would seal it there.
    expect(screen.getByLabelText(/Access token/)).toHaveValue("");
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
  });

  it("Leads: a compose failure does not outlive its lead — lead A's error never renders under lead B", async () => {
    const user = userEvent.setup();
    const lead = (id: string, name: string, company: string): LeadCard => ({
      id,
      source: "csv",
      email: `${id}@example.com`,
      name,
      company,
      role: "Ops lead",
      website: null,
      notes: null,
      painPoint: "asked about content automation",
      status: "scored",
      pinned: false,
      createdAt: "2026-07-18T02:00:00.000Z",
      score: 0.88,
      reasons: ["fit 0.92"],
      scoredAt: "2026-07-22T02:00:00.000Z",
      profileHash: "icp-v1",
      weightStateId: null,
      extras: [],
    });
    server.use(
      http.get("/api/leads", () =>
        HttpResponse.json({
          leads: [lead("lead-a", "Mara Kessler", "Fieldline Robotics"), lead("lead-b", "Tomas Reyes", "Northbank Freight")],
          scoringArmed: true,
          currentProfileHash: "icp-v1",
          learnedWeights: { state: null, staleForProfile: false },
          counts: { new: 0, scored: 2, dismissed: 0 },
        } satisfies LeadsPayload),
      ),
      http.post("/api/create/email", () =>
        HttpResponse.json({ error: "the gateway refused this compose" }, { status: 502 }),
      ),
    );

    render(<LeadsSurface />);
    await user.click(await screen.findByRole("button", { name: /Mara Kessler/ }));
    const compose = await screen.findByRole("button", { name: "Draft outreach" });
    await user.click(compose);
    expect(await screen.findByText(/the gateway refused this compose/)).toBeInTheDocument();

    // Switch leads. The failure describes work attempted on Mara's lead; on
    // Tomas's dossier it claims a compose that never happened.
    await user.click(screen.getByRole("button", { name: /Tomas Reyes/ }));
    await waitFor(() =>
      expect(screen.queryByText(/the gateway refused this compose/)).toBeNull(),
    );

    // And it is still true where it belongs.
    await user.click(screen.getByRole("button", { name: /Mara Kessler/ }));
    expect(await screen.findByText(/the gateway refused this compose/)).toBeInTheDocument();
  });
});
