/**
 * B3.15 pure HTML core (SPINE §1: no I/O, no clock, deterministic). Two
 * jobs, both structural ratchets:
 *
 * 1. `selfContainmentViolations` — the shipped page must be genuinely
 *    self-contained: a full HTML document that loads NOTHING from the
 *    network and runs NO script. Scripts are an unjudgeable claim surface
 *    and external loads leak the operator's audience to third parties, so
 *    both are invariants (not opinions) for a judged artifact. Anchor links
 *    (`<a href>`) to the tenant's own URLs are fine — navigation is not a
 *    resource load.
 *
 * 2. `extractVisibleText` — the draft `body` (the G1+G3 claim surface) is
 *    DERIVED from the artifact, never authored beside it: everything a
 *    visitor can read (headings, copy, image alt text, the title) is what
 *    the judge judges. Nothing on the page can escape the judge by living
 *    only in the HTML.
 *
 * Both walk the markup with the same QUOTE-AWARE tokenizer rather than
 * naive tag regexes: a `>` inside a quoted attribute value (a data: URI, an
 * alt text) must never truncate a tag — a regex that stops at the first `>`
 * would let visible text vanish from the judged body and let an external
 * URL hide behind a crafted attribute, both invariant-breaking failure
 * modes.
 */

const EXTERNAL_URL = /^\s*(?:https?:)?\/\//i;

interface TagToken {
  /** Lowercased element name. */
  name: string;
  closing: boolean;
  /** Lowercased attribute names → raw (entity-undecoded) values. */
  attrs: Record<string, string>;
  /** Index just past the tag's closing `>`. */
  end: number;
}

/** Parses one tag starting at `lt` (which must point at `<`). Returns null when what follows is not a tag — the caller treats the `<` as text. */
function parseTagAt(html: string, lt: number): TagToken | null {
  let i = lt + 1;
  let closing = false;
  if (html[i] === "/") {
    closing = true;
    i++;
  }
  const nameStart = i;
  while (i < html.length && /[a-zA-Z0-9-]/.test(html[i])) i++;
  if (i === nameStart || !/[a-zA-Z]/.test(html[nameStart])) return null;
  const name = html.slice(nameStart, i).toLowerCase();
  const attrs: Record<string, string> = {};
  while (i < html.length) {
    while (i < html.length && /[\s/]/.test(html[i])) i++;
    if (html[i] === ">") return { name, closing, attrs, end: i + 1 };
    const aStart = i;
    while (i < html.length && !/[\s=/>]/.test(html[i])) i++;
    if (i === aStart) {
      i++;
      continue;
    }
    const attrName = html.slice(aStart, i).toLowerCase();
    while (i < html.length && /\s/.test(html[i])) i++;
    if (html[i] !== "=") {
      attrs[attrName] = "";
      continue;
    }
    i++;
    while (i < html.length && /\s/.test(html[i])) i++;
    const quote = html[i];
    if (quote === '"' || quote === "'") {
      i++;
      const vStart = i;
      while (i < html.length && html[i] !== quote) i++;
      attrs[attrName] = html.slice(vStart, i);
      i++;
    } else {
      const vStart = i;
      while (i < html.length && !/[\s>]/.test(html[i])) i++;
      attrs[attrName] = html.slice(vStart, i);
    }
  }
  return null; // unterminated tag — caller treats the '<' as text
}

/** `<script>`/`<style>` bodies are raw text (not markup): skipped entirely for the claim surface; their resource loads are caught by the dedicated checks. */
const RAW_TEXT_TAGS = new Set(["script", "style"]);

interface WalkEvent {
  tag: TagToken;
  /** Raw text since the previous event (entity-undecoded). */
  precedingText: string;
}

/** Shared quote-aware walk: yields each real tag with the text before it; comments/doctype and raw-text element bodies never reach the visitor as text. */
function* walkHtml(html: string): Generator<WalkEvent, /* trailing text */ string> {
  const lower = html.toLowerCase();
  let i = 0;
  let text = "";
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      text += html.slice(i);
      break;
    }
    text += html.slice(i, lt);
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      text += " ";
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const end = html.indexOf(">", lt);
      i = end === -1 ? html.length : end + 1;
      text += " ";
      continue;
    }
    const tag = parseTagAt(html, lt);
    if (!tag) {
      text += "<";
      i = lt + 1;
      continue;
    }
    yield { tag, precedingText: text };
    text = "";
    i = tag.end;
    if (!tag.closing && RAW_TEXT_TAGS.has(tag.name)) {
      const close = lower.indexOf(`</${tag.name}`, i);
      if (close === -1) {
        i = html.length;
      } else {
        const gt = html.indexOf(">", close);
        i = gt === -1 ? html.length : gt + 1;
      }
    }
  }
  return text;
}

export function selfContainmentViolations(html: string): string[] {
  const violations: string[] = [];
  if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) {
    violations.push("not a full HTML document (missing <html>...</html>)");
  }
  const walk = walkHtml(html);
  let step = walk.next();
  while (!step.done) {
    const { tag } = step.value;
    if (!tag.closing) {
      if (["script", "iframe", "object", "embed"].includes(tag.name)) {
        violations.push(`page must ship no <${tag.name}> element`);
      }
      if (tag.name !== "a") {
        for (const attr of ["src", "srcset", "href"]) {
          const value = tag.attrs[attr];
          if (!value) continue;
          // srcset is a comma-separated list of "URL [descriptor]" entries; src/href are single values.
          const candidates = attr === "srcset" ? value.split(",") : [value];
          for (const candidate of candidates) {
            if (EXTERNAL_URL.test(candidate)) {
              violations.push(
                `<${tag.name}> loads an external URL via ${attr}: "${candidate.trim()}"`,
              );
            }
          }
        }
      }
    }
    step = walk.next();
  }
  // CSS can load externally too: url(https://...) in <style> blocks or style attributes.
  if (/url\(\s*['"]?\s*(?:https?:)?\/\//i.test(html)) {
    violations.push("CSS loads an external URL via url(...)");
  }
  return violations;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

/** Block-level boundaries become newlines so the extracted copy keeps its reading order without smearing headings into paragraphs. */
const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "header", "footer", "main", "nav", "aside",
  "h1", "h2", "h3", "h4", "h5", "h6", "li", "ul", "ol", "table", "tr",
  "blockquote", "figure", "figcaption", "title", "br", "hr",
]);

export function extractVisibleText(html: string): string {
  let out = "";
  const walk = walkHtml(html);
  let step = walk.next();
  while (!step.done) {
    const { tag, precedingText } = step.value;
    out += precedingText;
    // Image alt text IS visible (screen readers, broken loads) — keep it on the claim surface.
    if (!tag.closing && tag.name === "img" && tag.attrs.alt) out += ` ${tag.attrs.alt} `;
    out += BLOCK_TAGS.has(tag.name) ? "\n" : " ";
    step = walk.next();
  }
  out += step.value;
  return decodeEntities(out)
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
