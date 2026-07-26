/* global document, window, getComputedStyle */
// The globals above are NOT used in Node. They appear only inside callbacks
// handed to page.evaluate / evaluateOnNewDocument, which puppeteer serializes
// and runs INSIDE THE BROWSER. ESLint lints this file as Node and cannot see
// that boundary, so they are declared rather than switched off (the same
// convention shoot-surface.mjs already uses).
//
// surface-driver.mjs — the shared browser plumbing for DRIVING a surface.
//
// WHY THIS EXISTS (s79). The s78 audit machinery reads code: `fe-check` walks
// files and adversarially refutes claims, which is why 59 agents and 189
// findings all missed that the calendar could not PLAN anything. A reviewer saw
// `Reschedule` gated on `kind === "plan"` and marked it consistent; nobody
// noticed there were zero plans and nothing in the product could create one.
// The founder found it in ten minutes of clicking.
//
// A reading audit answers "is this code consistent?". Driving answers "can an
// operator do the job?" — and only the second one catches a capability that is
// ABSENT rather than wrong. That distinction is the whole point of this file.
//
// The verdict vocabulary is deliberately three-valued, taken from the
// video-editor audit's JOBS table, which was the most useful artifact s78
// produced (of 27 jobs: 8 work, 4 dead doors, 15 no affordance at all):
//
//   works        — the operator can do the job end to end
//   dead-door    — the control is THERE and leads nowhere (the worse defect:
//                  it advertises a capability and then eats the intent)
//   no-affordance— nothing on the surface offers the job at all
//
// A two-valued pass/fail cannot express "no affordance", which is exactly the
// class that hid the calendar. Anything else the harness hits is reported as
// `error` and never as a pass — a driver that swallows its own breakage is a
// false-pass gate, the same failure mode the s78 worktree refusal exists for.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHEET_DIR = join(REPO, "docs/research/mock-sheets");

/**
 * MUST be `localhost`, not `127.0.0.1` — inherited the hard way (s76).
 * Next dev blocks cross-origin access to `/_next/*` and treats those two hosts
 * as different origins: on 127.0.0.1 every client chunk is blocked, React never
 * hydrates, and a perfectly healthy app looks dead while curl still answers 200.
 */
export const DEFAULT_BASE = "http://localhost:3111";

/** The viewport comes from the sheets' own theme.css, never from memory. */
export function screenSize() {
  const css = readFileSync(join(SHEET_DIR, "theme.css"), "utf8");
  const rule = css.match(/\.screen\s*\{[^}]*\}/);
  if (!rule) throw new Error("no .screen rule in mock-sheets/theme.css");
  const w = rule[0].match(/width:\s*(\d+)px/);
  const h = rule[0].match(/height:\s*(\d+)px/);
  if (!w || !h) throw new Error(`.screen rule carries no width/height: ${rule[0]}`);
  return { width: Number(w[1]), height: Number(h[1]) };
}

/** Thrown by a job when the surface offers no control for the job at all. */
export class NoAffordance extends Error {
  constructor(message) {
    super(message);
    this.verdict = "no-affordance";
  }
}

/** Thrown by a job when a control exists but leads nowhere / eats the intent. */
export class DeadDoor extends Error {
  constructor(message) {
    super(message);
    this.verdict = "dead-door";
  }
}

/**
 * Thrown when the PRECONDITION for the job is absent, so the job could not be
 * exercised at all — an empty shelf offers nothing to search, and a queue with
 * nothing plannable cannot prove planning works.
 *
 * Added at s79 because the alternative was worse: the job returned normally and
 * the table printed ✓ for work that was never done. "I could not test this" and
 * "this works" are different facts, and a gate that renders them identically is
 * the same class of lie the product's own honest-states rule exists to prevent
 * ("empty" and "broken" must never look alike).
 */
export class Undriven extends Error {
  constructor(message) {
    super(message);
    this.verdict = "undriven";
  }
}

export async function launch(puppeteer) {
  return puppeteer.launch({
    headless: "shell",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
  });
}

export async function openPage(browser, { mode = "dark" } = {}) {
  const page = await browser.newPage();
  const { width, height } = screenSize();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  // The workspace reads its mode pre-paint from localStorage; seed it before
  // the first navigation so nothing flashes and re-lays-out mid-drive.
  await page.evaluateOnNewDocument((m) => {
    try {
      window.localStorage.setItem("thalon-workspace-mode", m);
    } catch {
      // Storage can be denied; the theme falls back to its default.
    }
  }, mode);
  return page;
}

/**
 * Navigate and wait for the surface to actually hold its DATA.
 *
 * Readiness, not optimism: every workspace surface fetches rows on the client,
 * so `networkidle` alone lands on the loading state. The topbar's tenant name
 * is the app's own global data signal (`pulse.tenant.name ?? "No tenant"`), so
 * it resolving proves the data layer answered — the same check shoot-surface
 * uses, for the same reason.
 */
export async function goto(page, base, route) {
  const res = await page.goto(`${base}${route}`, { waitUntil: "networkidle2", timeout: 45_000 });
  if (!res || !res.ok()) {
    throw new Error(`${route} — HTTP ${res ? res.status() : "no response"}`);
  }
  await page.waitForFunction(() => !document.body.innerText.includes("No tenant"), {
    timeout: 20_000,
    polling: 250,
  });
  await page.waitForNetworkIdle({ idleTime: 1_000, timeout: 20_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
}

/**
 * The interactive inventory of whatever is on screen.
 *
 * This is how a job set gets authored honestly: list what the surface actually
 * offers, then compare it against the jobs an operator would try. The gap IS
 * the no-affordance column — you cannot derive that column from the code, which
 * is precisely why the reading audit could not produce it.
 */
export async function inventory(page) {
  return page.evaluate(() => {
    const sel = 'button, a[href], [role="button"], [role="tab"], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll(sel)).map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const name =
        el.getAttribute("aria-label") ||
        (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60) ||
        el.getAttribute("placeholder") ||
        el.getAttribute("title") ||
        "";
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") || "",
        name,
        href: el.getAttribute("href") || "",
        disabled: el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
        // Visible AND laid out — a 0-size or display:none control is not an
        // affordance no matter what the markup says.
        shown: r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none",
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      };
    });
  });
}

/**
 * Is this element the thing a click at its centre would actually hit?
 *
 * `elementFromPoint` beats geometry, and geometry beats a screenshot (s78: the
 * calendar's Remove sat under an off-screen popover edge and measured fine).
 * A control that is present, enabled and visually perfect but covered by
 * another layer is not clickable, and only this check knows the difference.
 */
export async function hittable(page, handle) {
  return page.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { ok: false, why: "zero-size" };
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) {
      return { ok: false, why: `centre outside viewport (${Math.round(cx)},${Math.round(cy)})` };
    }
    const top = document.elementFromPoint(cx, cy);
    if (!top) return { ok: false, why: "nothing at centre" };
    if (el === top || el.contains(top)) return { ok: true };
    return {
      ok: false,
      why: `covered by <${top.tagName.toLowerCase()}${top.className ? ` class="${String(top.className).slice(0, 40)}"` : ""}>`,
    };
  }, handle);
}

/** Find one control by accessible name, or declare the job unofferable. */
export async function control(page, { name, tag = "button", exact = false }) {
  const handles = await page.$$(tag);
  for (const h of handles) {
    const label = await page.evaluate(
      (el) => (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " "),
      h,
    );
    if (exact ? label === name : label.includes(name)) return h;
  }
  throw new NoAffordance(`no ${tag} named ${JSON.stringify(name)} on this surface`);
}

/** Click a control, refusing to pretend a covered or dead control was clicked. */
export async function press(page, handle, what) {
  const hit = await hittable(page, handle);
  if (!hit.ok) throw new DeadDoor(`${what} is present but not clickable — ${hit.why}`);
  await handle.click();
  await page.waitForNetworkIdle({ idleTime: 400, timeout: 8_000 }).catch(() => {});
}

/** Layout + scroll metrics — the s78 board regression was invisible without these. */
export async function measure(page, selector) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrolls: el.scrollHeight > el.clientHeight + 1,
      overflowY: getComputedStyle(el).overflowY,
    };
  }, selector);
}

export function text(page) {
  return page.evaluate(() => document.body.innerText);
}
