/**
 * Extraction (deterministic core, SPINE §1 deterministic-fallback doctrine).
 * No LLM extraction in B1.1 — url/doc/prompt all resolve to plain text
 * through pure functions only.
 */
export interface ExtractedContent {
  text: string;
}

export function extractPrompt(prompt: string): ExtractedContent {
  return { text: prompt.trim() };
}

export function extractDoc(doc: string): ExtractedContent {
  return { text: doc.trim() };
}

const SCRIPT_STYLE_RE = /<(script|style)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi;
const TAG_RE = /<[^>]+>/g;
const ENTITY_RE = /&(nbsp|amp|lt|gt|quot|#39);/g;
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** Deterministic HTML -> text: strip script/style blocks, strip tags, decode common entities, collapse whitespace. */
export function extractHtml(html: string): ExtractedContent {
  const withoutScripts = html.replace(SCRIPT_STYLE_RE, " ");
  const withoutTags = withoutScripts.replace(TAG_RE, " ");
  const decoded = withoutTags.replace(ENTITY_RE, (match) => ENTITIES[match] ?? match);
  const collapsed = decoded.replace(/\s+/g, " ").trim();
  return { text: collapsed };
}
