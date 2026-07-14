import { tenantCtx, type TenantCtx } from "@thalon/contracts";
import { openTestDb, type DbHandle, type Repos } from "@thalon/db";
import { afterEach, describe, expect, it } from "vitest";
import { parseCsv } from "../csv";
import { importLeadsCsv, mapCsvHeaders } from "../csv-import";
import { syncWaitlistLeads, waitlistEntryToLeadInput } from "../intake";

let handle: DbHandle | undefined;

afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

async function setup(): Promise<{ ctx: TenantCtx; repos: Repos }> {
  handle = await openTestDb();
  const { repos } = handle;
  const tenant = await repos.tenants.create({ slug: "self", name: "Self" });
  return { ctx: tenantCtx(tenant.id), repos };
}

describe("parseCsv (B-crm.1)", () => {
  it("handles BOM, CRLF, quoted commas/quotes/newlines — the real-export edge cases", () => {
    const csv = '﻿name,notes\r\n"Doe, Jane","said ""hi""\nsecond line"\r\nBob,plain\r\n';
    expect(parseCsv(csv)).toEqual([
      ["name", "notes"],
      ["Doe, Jane", 'said "hi"\nsecond line'],
      ["Bob", "plain"],
    ]);
  });

  it("skips blank lines and fails loud on a truncated quoted field", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(() => parseCsv('a,b\n"unterminated,2')).toThrow(/unterminated/);
  });
});

describe("mapCsvHeaders (B-crm.1)", () => {
  it("speaks HubSpot, Salesforce, Pipedrive and snake_case dialects through one normalization", () => {
    // HubSpot-style spaced headers (the vendor sample-file convention).
    expect(mapCsvHeaders(["Email", "First Name", "Last Name", "Company", "Job Title", "Website URL"]).columns.map((c) => c.field))
      .toEqual(["email", "firstName", "lastName", "company", "role", "website"]);
    // Salesforce-style compact headers.
    expect(mapCsvHeaders(["FirstName", "LastName", "Email", "Title"]).columns.map((c) => c.field))
      .toEqual(["firstName", "lastName", "email", "role"]);
    // Pipedrive-style person headers.
    expect(mapCsvHeaders(["Name", "Email", "Organization", "Job title"]).columns.map((c) => c.field))
      .toEqual(["name", "email", "company", "role"]);
    // snake_case exports (Atomic-CRM-style).
    expect(mapCsvHeaders(["first_name", "last_name", "email", "company_name"]).columns.map((c) => c.field))
      .toEqual(["firstName", "lastName", "email", "company"]);
  });

  it("unknown columns map to null (→ meta) and a duplicate alias falls through instead of clobbering", () => {
    const { columns } = mapCsvHeaders(["Email", "Phone Number", "E-mail"]);
    expect(columns[0]).toEqual({ header: "Email", field: "email" });
    expect(columns[1]).toEqual({ header: "Phone Number", field: null });
    expect(columns[2]).toEqual({ header: "E-mail", field: null }); // first email column won
  });

  it("speaks the 2026-07-14 header-survey dialects: numbered emails, enterprise pain-point, enrichment notes", () => {
    // Numbered-email exports: "Email 1" is the primary; "Email 2" rides meta.
    expect(mapCsvHeaders(["Email 1", "Email 2", "First Name"]).columns.map((c) => c.field))
      .toEqual(["email", null, "firstName"]);
    // A plain "Email" column still wins over a later "Email 1" (first alias occurrence).
    expect(mapCsvHeaders(["Email", "Email 1"]).columns.map((c) => c.field))
      .toEqual(["email", null]);
    // AWS Partner Central-style lead schema: projectDescription = the customer
    // need (pain_point analog); Title → role, the rest map as before.
    expect(mapCsvHeaders(["email", "firstName", "lastName", "title", "projectDescription"]).columns.map((c) => c.field))
      .toEqual(["email", "firstName", "lastName", "role", "painPoint"]);
    // Enrichment-style "Company Notes" feeds notes (the scorer reads notes, never meta).
    expect(mapCsvHeaders(["Email", "Company", "Company Notes"]).columns.map((c) => c.field))
      .toEqual(["email", "company", "notes"]);
  });
});

describe("importLeadsCsv (B-crm.1)", () => {
  it("imports a HubSpot-shaped file: adds, skips in-file and cross-source duplicates, reports invalid rows with readable reasons", async () => {
    const { ctx, repos } = await setup();
    // A contact that already exists from another source — the import must not duplicate it.
    await repos.leads.add(ctx, { source: "api", email: "existing@acme.com" });

    const csv = [
      "Email,First Name,Last Name,Company,Job Title,Phone Number",
      '"Jane.Doe@Acme.com",Jane,Doe,"Acme, Inc",Owner,+61 400 000 000',
      "existing@ACME.com,Already,There,Acme,GM,",
      "not-an-email,Bad,Row,,,",
      ",Missing,Email,,,",
      "jane.doe@acme.com,Jane,Again,,,", // in-file duplicate of row 2
    ].join("\r\n");

    const report = await importLeadsCsv(ctx, repos, { csv });
    expect(report).toMatchObject({ rows: 5, added: 1, duplicates: 2, invalid: 2 });
    expect(report.reasons).toHaveLength(2);
    expect(report.reasons.map((r) => r.row)).toEqual([4, 5]); // 1-based file lines, header = 1
    for (const { reason } of report.reasons) expect(reason).toMatch(/email/);

    const jane = await repos.leads.getByEmail(ctx, "jane.doe@acme.com");
    expect(jane).toMatchObject({
      source: "csv",
      name: "Jane Doe",
      company: "Acme, Inc",
      role: "Owner",
    });
    // Unknown columns ride meta under their original header — nothing is dropped.
    expect(jane?.meta).toEqual({ "Phone Number": "+61 400 000 000" });
    expect(await repos.leads.list(ctx)).toHaveLength(2); // existing + jane
  });

  it("fails loud before touching anything when no email column is recognizable", async () => {
    const { ctx, repos } = await setup();
    await expect(importLeadsCsv(ctx, repos, { csv: "Name,Phone\nJane,123\n" })).rejects.toThrow(
      /no recognizable email column/,
    );
    await expect(importLeadsCsv(ctx, repos, { csv: "" })).rejects.toThrow(/empty/);
    expect(await repos.leads.list(ctx)).toHaveLength(0);
  });
});

describe("waitlist→leads bridge (B-crm.1)", () => {
  it("bridges signups with referral context in meta; re-running adds zero (idempotent on the dedupe key)", async () => {
    const { ctx, repos } = await setup();
    const first = await repos.waitlist.join(ctx, { email: "a@x.example", referralCode: "code-a" });
    await repos.waitlist.join(ctx, {
      email: "b@x.example",
      referralCode: "code-b",
      referredBy: first.entry.id,
    });

    const run1 = await syncWaitlistLeads(ctx, repos);
    expect(run1).toEqual({ seen: 2, added: 2, existing: 0 });
    const bridged = await repos.leads.getByEmail(ctx, "b@x.example");
    expect(bridged?.source).toBe("waitlist");
    expect(bridged?.meta).toEqual({
      waitlist: expect.objectContaining({
        position: 2,
        referralCode: "code-b",
        referredBy: first.entry.id,
      }),
    });

    // Replay bridges nothing; a NEW signup after the first sync is picked up.
    expect(await syncWaitlistLeads(ctx, repos)).toEqual({ seen: 2, added: 0, existing: 2 });
    await repos.waitlist.join(ctx, { email: "c@x.example", referralCode: "code-c" });
    expect(await syncWaitlistLeads(ctx, repos)).toEqual({ seen: 3, added: 1, existing: 2 });
  });

  it("the pure mapping keeps the waitlist as system of record — lead meta carries the context verbatim", async () => {
    const { ctx, repos } = await setup();
    const { entry } = await repos.waitlist.join(ctx, { email: "z@x.example", referralCode: "zz" });
    const input = waitlistEntryToLeadInput(entry);
    expect(input.source).toBe("waitlist");
    expect(input.email).toBe("z@x.example");
    expect((input.meta as { waitlist: { joinedAt: string } }).waitlist.joinedAt).toBe(
      entry.createdAt.toISOString(),
    );
  });
});
