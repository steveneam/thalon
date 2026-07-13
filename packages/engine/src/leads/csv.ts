/**
 * B-crm.1: a minimal RFC-4180 CSV reader — zero-dep by design (repo
 * licensing hygiene: nothing on the hot path we could hand-write in a
 * screenful). Handles exactly what real CRM exports throw at us, each
 * test-pinned: UTF-8 BOM (the founder-file lesson generalized: normalize
 * before use), CRLF/LF rows, quoted fields containing commas, quotes
 * (doubled) and newlines. An unterminated quote fails loud — a truncated
 * upload must never half-import silently.
 */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\r") {
      if (src[i + 1] === "\n") i++;
      pushRow();
    } else if (ch === "\n") {
      pushRow();
    } else {
      field += ch;
    }
  }
  if (inQuotes) {
    throw new Error("unterminated quoted field in CSV — the file looks truncated or corrupted");
  }
  if (field !== "" || row.length > 0) pushRow();

  // Blank lines (a single empty field) carry no data — skip them.
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
