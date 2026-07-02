import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("reports ok with the resolved seams and no secrets", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("thalon");
    expect(body.seams).toMatchObject({
      objectStore: "local",
      queue: "inline",
    });
    expect(JSON.stringify(body)).not.toMatch(/key|secret|password/i);
  });
});
