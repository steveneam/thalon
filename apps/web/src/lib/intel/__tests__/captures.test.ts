import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let repos: Repos | undefined;
vi.mock("@/lib/repos", () => ({
  getRepos: () => {
    if (!repos) throw new Error("test db not opened");
    return Promise.resolve(repos);
  },
}));

const { listCapturesOfKind, recordCapture, resolveCaptureContext } = await import(
  "@/lib/intel/captures"
);
const { dismissTrendCard, IntelStoreError, promoteLead, promoteTrendCard, resetIntelStore, targetSearchQuery } =
  await import("@/lib/intel/store");
const { fixtureTrendCards } = await import("@/lib/intel/fixtures");

let handle: DbHandle | undefined;

async function openSeat(): Promise<void> {
  handle = await openTestDb();
  repos = handle.repos;
  await repos.tenants.create({ slug: "self", name: "Self" });
}

beforeEach(openSeat);

afterEach(async () => {
  resetIntelStore();
  repos = undefined;
  await handle?.close();
  handle = undefined;
});

/**
 * The s102 phase-1 fix, proven at the seam that carries it.
 *
 * The capture spine ran in one process's memory while the `?ctx=` id it mints
 * is a URL the operator can sit on across a deploy. After a restart that link
 * either 404d or resolved to a DIFFERENT capture that had taken the same
 * counter value — a promote briefing Create from someone else's pick. These
 * pin the durable seat: the id survives, and the things that must still fail
 * still fail.
 */
describe("the durable capture seat", () => {
  it("round-trips a promote into the Create context the operator picked", async () => {
    const card = fixtureTrendCards[1];
    const capture = await recordCapture(
      promoteTrendCard(card.id, { family: "video", titleIndex: 1, angleIndex: 0 }),
    );

    // A durable row id, not the fallback's prefixed one.
    expect(capture.id).not.toMatch(/^intel-capture-/);
    expect(capture.ref).toBe(card.id);

    const context = await resolveCaptureContext(capture.id);
    expect(context).toMatchObject({
      captureId: capture.id,
      kind: "trend_promote",
      family: "video",
      title: card.dossier!.titles[1],
      angle: card.dossier!.angles[0],
      hook: card.dossier!.hook,
      areaName: card.areaName,
      score: card.score,
    });
  });

  /**
   * THE bug. The workspace goes away and comes back; the link the operator is
   * holding must still resolve to the capture they made.
   */
  it("resolves a capture minted before a restart", async () => {
    const card = fixtureTrendCards[2];
    const capture = await recordCapture(promoteTrendCard(card.id, { family: "page", titleIndex: 2 }));

    // The process restarts: in-memory state is gone, the database is not.
    const survivingDb = handle;
    resetIntelStore();
    repos = survivingDb!.repos;

    const context = await resolveCaptureContext(capture.id);
    expect(context.captureId).toBe(capture.id);
    expect(context.title).toBe(card.dossier!.titles[2]);
  });

  it("keeps the ref out of the resolved payload while lead context still rides on it", async () => {
    const capture = await recordCapture(
      promoteLead({
        leadId: "lead-7",
        family: "email",
        name: "Sam Reyes",
        company: "Riverbend Plumbing",
        role: "Owner",
        website: "https://riverbend.example",
        notes: "met at the trade expo",
        painPoint: "website never brings in local work",
        score: 0.9,
      }),
    );
    expect(capture.payload.ref).toBeUndefined(); // folded in for storage, lifted back out on read
    expect(await resolveCaptureContext(capture.id)).toMatchObject({
      kind: "lead_promote",
      family: "email",
      leadId: "lead-7",
      contact: "Sam Reyes",
      painPoint: "website never brings in local work",
    });
  });

  it("carries a target-this keyword through", async () => {
    const capture = await recordCapture(targetSearchQuery("what is content automation"));
    expect(await resolveCaptureContext(capture.id)).toMatchObject({
      kind: "search_target_this",
      family: "page",
      keyword: "what is content automation",
    });
  });

  it("a dismiss capture is feedback, not context — resolving one is still a 404", async () => {
    const capture = await recordCapture(dismissTrendCard(fixtureTrendCards[0].id));
    await expect(resolveCaptureContext(capture.id)).rejects.toBeInstanceOf(IntelStoreError);
  });

  it("a real uuid that is not ours 404s rather than resolving", async () => {
    await expect(
      resolveCaptureContext("00000000-0000-4000-8000-000000000000"),
    ).rejects.toBeInstanceOf(IntelStoreError);
  });

  /**
   * `intel_captures.id` is a uuid column. Handing Postgres a stale
   * `intel-capture-…` string — exactly what a bookmark from before this
   * change carries — throws `invalid input syntax for type uuid`, which
   * would surface as a 500 where the honest answer is 404. Non-uuid ids are
   * routed to the fallback seat, which answers the 404 itself.
   */
  it("answers 404, never a driver error, for a stale pre-s102 capture id", async () => {
    await expect(resolveCaptureContext("intel-capture-3")).rejects.toBeInstanceOf(IntelStoreError);
    await expect(resolveCaptureContext("intel-capture-3")).rejects.toMatchObject({
      httpStatus: 404,
    });
  });

  it("lists picks newest first and leaves the other kinds alone", async () => {
    await recordCapture(promoteTrendCard(fixtureTrendCards[0].id, { family: "post" }));
    await recordCapture(dismissTrendCard(fixtureTrendCards[1].id));
    await recordCapture(targetSearchQuery("a keyword"));
    const second = await recordCapture(promoteTrendCard(fixtureTrendCards[2].id, { family: "page" }));

    const picks = await listCapturesOfKind("trend_promote");
    expect(picks.map((p) => p.kind)).toEqual(["trend_promote", "trend_promote"]);
    expect(picks[0].id).toBe(second.id);
  });
});
