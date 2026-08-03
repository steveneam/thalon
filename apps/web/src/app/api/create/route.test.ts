import { describe, expect, it } from "vitest";
import { POST } from "./route";

/**
 * THE SEQUENCE GATE, EXECUTABLE (invariant): ungranted generation waits on
 * the founder's recorded go-ahead, and the run door refuses it SERVER-side
 * — a hand-crafted POST cannot walk past the gate the surface states. The
 * refusal fires before any repo or driver is touched, so these tests need no
 * database. The post assertion retired s98 with his dogfood GO (`post` armed
 * in `lib/create/families.ts`); `page` still holds, awaiting its own word.
 */
describe("POST /api/create — the run door's gates", () => {
  async function post(body: unknown): Promise<Response> {
    return POST(
      new Request("http://test/api/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  }

  it("refuses a page brief with the seam's own sentence — the founder's sequence gate", async () => {
    const res = await post({ family: "page", mode: "wizard", prompt: "hello" });
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("Live page generation isn’t wired to Create yet");
  });

  it("refuses an email brief that carries no lead — composing needs the recipient's context", async () => {
    const res = await post({ family: "email", mode: "wizard", prompt: "hello" });
    expect(res.status).toBe(409);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("→ Email exit on a lead card");
  });

  it("refuses a shapeless body as a 400, never a 500", async () => {
    const res = await post({ family: "song" });
    expect(res.status).toBe(400);
  });
});
