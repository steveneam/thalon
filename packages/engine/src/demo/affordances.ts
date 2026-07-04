/**
 * Pure core (B2.5 stage 2): extracts interactive affordances — nav links,
 * forms, and inputs (search boxes in particular) — from one crawled page's
 * HTML. Regex-based, like ../ingest/extract.ts (SPINE §1: deterministic
 * fallbacks are pure functions, never a model) — no new HTML-parsing
 * dependency. Selectors favor `id`, then `name`/`action`, then a stable
 * positional fallback, so the storyboard shell (stage 3) always has a
 * concrete, addressable target to select from.
 */
export interface FlowMapAffordance {
  kind: "nav_link" | "form" | "input";
  selector: string;
  label: string;
}

const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
const FORM_RE = /<form\b([^>]*)>/gi;
const INPUT_RE = /<input\b([^>]*?)\/?>/gi;

function attr(tag: string, name: string): string | undefined {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i");
  return re.exec(tag)?.[1];
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractAffordances(html: string): FlowMapAffordance[] {
  const affordances: FlowMapAffordance[] = [];

  for (const match of html.matchAll(ANCHOR_RE)) {
    const [, attrs, inner] = match;
    const href = attr(attrs, "href");
    if (!href || href.startsWith("#") || /^javascript:/i.test(href)) continue;
    const id = attr(attrs, "id");
    const selector = id ? `#${id}` : `a[href="${href}"]`;
    const label = textOf(inner) || attr(attrs, "aria-label") || href;
    affordances.push({ kind: "nav_link", selector, label });
  }

  let formIndex = 0;
  for (const match of html.matchAll(FORM_RE)) {
    const attrs = match[1];
    formIndex += 1;
    const id = attr(attrs, "id");
    const action = attr(attrs, "action");
    const selector = id
      ? `#${id}`
      : action
        ? `form[action="${action}"]`
        : `form:nth-of-type(${formIndex})`;
    const label = attr(attrs, "aria-label") ?? action ?? "form";
    affordances.push({ kind: "form", selector, label });
  }

  for (const match of html.matchAll(INPUT_RE)) {
    const attrs = match[1];
    const type = (attr(attrs, "type") ?? "text").toLowerCase();
    if (type === "hidden" || type === "submit" || type === "button") continue;
    const id = attr(attrs, "id");
    const name = attr(attrs, "name");
    const selector = id ? `#${id}` : name ? `input[name="${name}"]` : `input[type="${type}"]`;
    const label = attr(attrs, "placeholder") ?? attr(attrs, "aria-label") ?? name ?? type;
    affordances.push({ kind: "input", selector, label });
  }

  return affordances;
}
