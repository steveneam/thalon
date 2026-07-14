import { describe, expect, it } from "vitest";
import type { LeadRow } from "@thalon/db";
import { toLeadCard } from "../serialize";

function row(meta: Record<string, unknown>): LeadRow {
  return {
    id: "lead-1",
    tenantId: "t1",
    source: "csv",
    email: "jane@acme.example",
    emailHash: "h",
    name: "Jane",
    company: null,
    role: null,
    website: null,
    notes: null,
    painPoint: null,
    status: "new",
    meta,
    createdAt: new Date("2026-07-14T00:00:00.000Z"),
    updatedAt: new Date("2026-07-14T00:00:00.000Z"),
  } as LeadRow;
}

describe("toLeadCard extras (s29 meta rider)", () => {
  it("surfaces unmapped source columns, key-sorted and stringified — internal keys and empties stay out", () => {
    const card = toLeadCard(
      row({
        pinned: true,
        "Phone 1": "+61 400 000 000",
        Tier: "gold",
        "Email 2": "",
        segments: ["a", "b"],
        blank: null,
      }),
      null,
    );
    expect(card.pinned).toBe(true);
    expect(card.extras).toEqual([
      { key: "Phone 1", value: "+61 400 000 000" },
      { key: "Tier", value: "gold" },
      { key: "segments", value: '["a","b"]' },
    ]);
  });

  it("an empty meta yields no extras section", () => {
    expect(toLeadCard(row({}), null).extras).toEqual([]);
  });
});
