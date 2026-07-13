import { leadInputSchema, type LeadInput, type TenantCtx } from "@thalon/contracts";
import type { Repos } from "@thalon/db";
import { parseCsv } from "./csv";

/**
 * B-crm.1 CSV intake: parse → header-map → per-row insert-or-skip, no file
 * persistence (parse, ingest, discard — ratified build plan). Headers speak
 * the de-facto CRM export conventions (founder answer 2, verified against
 * the vendors' import docs at build time): HubSpot-style spaced headers
 * ("First Name", "Job Title", "Website URL") first, with Salesforce
 * ("FirstName", "Title"), Pipedrive ("Name", "Organization") and
 * snake_case (Atomic-CRM-style) aliases mapped through one normalization.
 * Unknown columns are never dropped — they ride `meta` under their original
 * header, so nothing an operator exported is lost.
 */

/** Lowercase and strip separators: "First Name" / first_name / FirstName → firstname. */
const normalizeHeader = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

type MappedField = "email" | "name" | "firstName" | "lastName" | "company" | "role" | "website" | "notes";

const HEADER_ALIASES: Record<MappedField, readonly string[]> = {
  email: ["email", "emailaddress", "workemail", "primaryemail"],
  name: ["name", "fullname", "contactname"],
  firstName: ["firstname"],
  lastName: ["lastname", "surname"],
  company: ["company", "companyname", "organization", "organisation", "org", "accountname"],
  role: ["jobtitle", "title", "role", "position"],
  website: ["website", "websiteurl", "companywebsite", "companydomainname", "url", "domain"],
  notes: ["notes", "note", "comments", "description"],
};

const ALIAS_LOOKUP: ReadonlyMap<string, MappedField> = new Map(
  (Object.entries(HEADER_ALIASES) as [MappedField, readonly string[]][]).flatMap(
    ([field, aliases]) => aliases.map((alias) => [alias, field] as const),
  ),
);

export interface CsvColumnMapping {
  /** Per column: the lead field it feeds, or null → meta under its original header. */
  columns: Array<{ header: string; field: MappedField | null }>;
}

/** First alias occurrence wins a field; later duplicates fall through to meta. */
export function mapCsvHeaders(headers: string[]): CsvColumnMapping {
  const taken = new Set<MappedField>();
  const columns = headers.map((header) => {
    const field = ALIAS_LOOKUP.get(normalizeHeader(header)) ?? null;
    if (field === null || taken.has(field)) return { header, field: null };
    taken.add(field);
    return { header, field };
  });
  return { columns };
}

export interface CsvImportReport {
  /** Data rows seen (header row excluded). */
  rows: number;
  added: number;
  /** Rows whose contact already existed — in the DB or earlier in this same file. */
  duplicates: number;
  invalid: number;
  /** One readable reason per invalid row; `row` is the 1-based file line (header = row 1). */
  reasons: Array<{ row: number; reason: string }>;
}

/**
 * The import job. Fails loud before touching anything when no email column
 * is recognizable — every row would be invalid, and an all-invalid "report"
 * reads like a partial success. Per-row validation failures are collected
 * as readable reasons instead of aborting the batch: one bad row must not
 * strand the other 400 (the missing-metric convention's cousin).
 */
export async function importLeadsCsv(
  ctx: TenantCtx,
  repos: Repos,
  request: { csv: string },
): Promise<CsvImportReport> {
  const parsed = parseCsv(request.csv);
  if (parsed.length === 0) {
    throw new Error("CSV is empty — expected a header row and at least one contact row");
  }
  const [headerRow, ...dataRows] = parsed;
  const mapping = mapCsvHeaders(headerRow);
  if (!mapping.columns.some((c) => c.field === "email")) {
    throw new Error(
      `CSV has no recognizable email column (got: ${headerRow.join(", ") || "none"}; recognized: ${HEADER_ALIASES.email.join(", ")})`,
    );
  }

  const report: CsvImportReport = { rows: dataRows.length, added: 0, duplicates: 0, invalid: 0, reasons: [] };
  for (let i = 0; i < dataRows.length; i++) {
    const fileRow = i + 2; // 1-based, header is row 1 — matches what the operator sees in their editor
    const input = rowToLeadInput(mapping, dataRows[i]);
    const valid = leadInputSchema.safeParse(input);
    if (!valid.success) {
      report.invalid++;
      const issue = valid.error.issues[0];
      report.reasons.push({
        row: fileRow,
        reason: `${issue.path.join(".") || "row"}: ${issue.message}`,
      });
      continue;
    }
    const { created } = await repos.leads.add(ctx, input);
    if (created) report.added++;
    else report.duplicates++;
  }
  return report;
}

function rowToLeadInput(mapping: CsvColumnMapping, row: string[]): LeadInput {
  const fields: Partial<Record<MappedField, string>> = {};
  const meta: Record<string, unknown> = {};
  mapping.columns.forEach((column, i) => {
    const value = (row[i] ?? "").trim();
    if (value === "") return;
    if (column.field) fields[column.field] = value;
    else meta[column.header] = value;
  });
  const name = fields.name ?? [fields.firstName, fields.lastName].filter(Boolean).join(" ");
  return {
    source: "csv",
    email: fields.email ?? "",
    ...(name ? { name } : {}),
    ...(fields.company ? { company: fields.company } : {}),
    ...(fields.role ? { role: fields.role } : {}),
    ...(fields.website ? { website: fields.website } : {}),
    ...(fields.notes ? { notes: fields.notes } : {}),
    meta,
  };
}
