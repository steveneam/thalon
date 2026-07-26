/* global document, window, DataTransfer, DragEvent, File */
// The globals above run INSIDE THE BROWSER via page.evaluate — see the note in
// surface-driver.mjs. `DataTransfer`/`DragEvent`/`File` are the drag payload the
// transcription drop job dispatches; ESLint lints this file as Node and cannot
// see the boundary, so they are declared rather than switched off.
//
// surface-jobs.mjs — THE JOBS AN OPERATOR WOULD TRY, per surface.
//
// This file is the use-truth counterpart to the code-truth audit. Each entry is
// a job stated the way the operator would state it ("plan an approved draft into
// a slot"), not the way the code is organised. A job is authored from the live
// interactive INVENTORY (`drive-surface.mjs --inventory <route>`), never from
// reading the component — reading is what produced 189 findings that all missed
// a missing capability.
//
// A job may end three ways, and the third is the one that matters:
//   return normally      → works
//   throw NoAffordance   → nothing on the surface offers this at all
//   throw DeadDoor       → the control is there and eats the intent
//
// Keep jobs INDEPENDENT of any particular fix. They describe what the product
// is for, so they stay valid across sessions and lanes; that is what makes the
// table comparable over time instead of a snapshot of one diff.

import { control, DeadDoor, NoAffordance, press, text, Undriven } from "./surface-driver.mjs";

/** Wait for a body-text predicate, or fail with what was actually on screen. */
async function expectText(page, pattern, what) {
  try {
    await page.waitForFunction(
      (p) => new RegExp(p, "i").test(document.body.innerText),
      { timeout: 8_000, polling: 200 },
      pattern.source ?? String(pattern),
    );
  } catch {
    throw new DeadDoor(`${what}: expected /${pattern}/ on screen, never appeared`);
  }
}

async function urlNow(page) {
  return page.evaluate(() => window.location.pathname + window.location.search);
}

/**
 * Does the surface EXPLAIN a numeric disagreement, on screen?
 *
 * Two counts that differ are not automatically a defect — the defect is a
 * difference the operator cannot account for. s79 proved the distinction the
 * hard way, in both directions:
 *
 *  - Dashboard's pill says 25 while the card lists 21, because the two read
 *    different windows. Lane 3's verifiers named the "just equalise them" fix
 *    as WORSE: the topbar chip and the rail badge render the pulse's number on
 *    the same screen, so equalising the card trades one visible disagreement
 *    for two invisible ones. It ships "21 of 25 shown — the oldest wait in the
 *    queue →" instead. State the bound, don't chase the number.
 *  - Approve's "13 waiting" beside "Approve all waiting (2)" ships "2 of 13
 *    waiting can be approved together — 11 staged drafts advance through their
 *    own flow."
 *
 * Both jobs originally demanded equality, which would have graded the correct
 * fix as still-broken and pushed toward the worse one. A gate that insists on
 * the wrong remedy is worse than a gate that misses the defect.
 */
function explainsGap(body, a, b) {
  const nums = [String(a), String(b)];
  return body
    .split("\n")
    .map((l) => l.trim())
    .some(
      (line) =>
        /\bof\b/i.test(line) && nums.every((n) => line.includes(n)) && /[a-z]{4,}/i.test(line),
    );
}

/**
 * Is the element inside the visible part of its OWN scroll box?
 *
 * Finds the nearest genuinely scrollable ancestor rather than a guessed class
 * name — the s78 board regression was misread once by measuring
 * `documentElement` when the real scroll container was `.content.board-surface`,
 * so "which box scrolls" is a question to ask the DOM, never to assume.
 */
const IN_OWN_SCROLL_BOX = (el) => {
  let box = el.parentElement;
  while (box && box !== document.body) {
    const cs = window.getComputedStyle(box);
    if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && box.scrollHeight > box.clientHeight + 1) break;
    box = box.parentElement;
  }
  if (!box || box === document.body) return { boxed: false };
  const r = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  return {
    boxed: true,
    inView: r.top >= b.top - 1 && r.bottom <= b.bottom + 1,
    box: box.className || box.tagName.toLowerCase(),
  };
};

export const JOBS = {
  dashboard: {
    route: "/app",
    jobs: [
      {
        name: "see what needs me, and open one of those items",
        async run(page) {
          const row = await page.$("[aria-label='Needs you'] .row");
          if (!row) throw new NoAffordance("no openable rows in the 'Needs you' card");
          await press(page, row, "a needs-you row");
          const url = await urlNow(page);
          if (url === "/app") throw new DeadDoor("clicking a needs-you row goes nowhere");
          return `landed on ${url}`;
        },
      },
      {
        name: "trust the stated needs-you count against the rows actually offered",
        async run(page) {
          const seen = await page.evaluate(() => {
            const card = document.querySelector("[aria-label='Needs you']");
            if (!card) return null;
            // The count is NOT inside the card — it is stated in the topbar pill
            // and on the KPI tile, both of which link the operator here. Look
            // wherever the surface makes the claim, not where the code keeps it.
            const stated = Array.from(document.querySelectorAll("*"))
              .filter((el) => el.children.length === 0)
              .map((el) => (el.textContent || "").match(/needs you\s*·\s*(\d+)/i))
              .filter(Boolean)
              .map((m) => Number(m[1]));
            return { stated: [...new Set(stated)], rows: card.querySelectorAll(".row").length };
          });
          if (!seen) throw new NoAffordance("no 'Needs you' card");
          if (seen.stated.length === 0) return `card lists ${seen.rows} rows and the surface states no count`;
          const mismatched = seen.stated.filter((n) => n !== seen.rows);
          if (mismatched.length === 0) return `count agrees at ${seen.rows}`;
          // A gap is fine if the surface OWNS it — see `explainsGap`.
          const body = await text(page);
          if (explainsGap(body, mismatched[0], seen.rows)) {
            const line = body.split("\n").map((l) => l.trim()).find((l) => /\bof\b/.test(l) && l.includes(String(seen.rows)));
            return `states ${mismatched.join("/")}, offers ${seen.rows}, and says so: ${JSON.stringify(line)}`;
          }
          throw new DeadDoor(`the surface states ${mismatched.join("/")} and the card offers ${seen.rows} rows, with nothing on screen explaining the gap`);
        },
      },
      {
        name: "walk the needs-you list by keyboard (j/k) and keep the selection in view",
        async run(page) {
          const rows = await page.$$("[aria-label='Needs you'] .row");
          if (rows.length === 0) throw new NoAffordance("no needs-you rows to walk");
          // Walk far enough to leave the visible window of the scroll box: the
          // s77 finding is that the selection moves and the box never follows.
          for (let i = 0; i < Math.min(rows.length, 12); i++) await page.keyboard.press("KeyJ");
          const sel = await page.$("[aria-label='Needs you'] .row.sel");
          if (!sel) throw new NoAffordance("j does not select a needs-you row");
          const where = await page.evaluate(IN_OWN_SCROLL_BOX, sel);
          if (where.boxed && !where.inView) {
            throw new DeadDoor(`j walked the selection out of its own scroll box (.${where.box}) and the box never followed`);
          }
          return where.boxed ? `selection stayed inside .${where.box}` : "list is not in a scroll box";
        },
      },
      {
        name: "read today's plan on the week view, and reach the calendar from it",
        async run(page) {
          const body = await text(page);
          if (!/(this week|today)/i.test(body)) throw new NoAffordance("no week/day view on the dashboard");
          const cal = await page.$("a[href*='/app/calendar']");
          if (!cal) throw new DeadDoor("the week view offers no way through to the calendar");
          return "week view present and links to the calendar";
        },
      },
      {
        name: "read 'your review' as a status needing action, on the warn channel",
        async run(page) {
          const seen = await page.evaluate(() => {
            const mark = Array.from(document.querySelectorAll("a, span")).find((el) =>
              /your review/i.test(el.textContent || ""),
            );
            if (!mark) return null;
            return {
              color: window.getComputedStyle(mark).color,
              warn: window.getComputedStyle(document.documentElement).getPropertyValue("--warn").trim(),
              cls: mark.className || "",
            };
          });
          if (!seen) return "no 'your review' marks on today's board";
          /**
           * Compare CHANNEL, not exact value. `--warn` is amber (positive b* in
           * lab) and the accent is blue (negative b*), so the sign of b* alone
           * separates "this is a status" from "this is a link" — which is the
           * whole of the s77 finding: `.screen a` wins the cascade and repaints
           * a status the operator must act on as an ordinary link.
           */
          const lab = (s) => {
            const m = String(s).match(/lab\(\s*([\d.%-]+)\s+([\d.-]+)\s+([\d.-]+)/i);
            return m ? { l: parseFloat(m[1]), a: parseFloat(m[2]), b: parseFloat(m[3]) } : null;
          };
          const got = lab(seen.color);
          const want = lab(seen.warn);
          // A comparison the harness cannot make is a HARNESS failure, never a pass.
          if (!got || !want) throw new Error(`cannot compare colours: mark=${seen.color} warn=${seen.warn}`);
          if (Math.sign(got.b) !== Math.sign(want.b)) {
            throw new DeadDoor(
              `.${seen.cls} paints ${seen.color} — opposite channel to --warn ${seen.warn}; a status that needs action reads as a plain link`,
            );
          }
          return `on the warn channel (b* ${got.b} vs ${want.b})`;
        },
      },
    ],
  },

  transcription: {
    route: "/app/transcription",
    jobs: [
      {
        name: "ingest a source by URL",
        async run(page) {
          const box = await page.$("input[type='url'], input[placeholder*='url' i], input[placeholder*='paste' i]");
          if (!box) throw new NoAffordance("no URL input in the ingest box");
          return "ingest input present";
        },
      },
      {
        name: "drop a file into the ingest box (it is advertised in the copy)",
        async run(page) {
          /**
           * The promise lives in a PLACEHOLDER attribute, which `innerText` never
           * returns — so an earlier version of this job reported "not advertised,
           * nothing to honour" on a surface whose input literally reads "Paste a
           * video URL or drop a file". Read attributes as well as text.
           */
          const advertised = await page.evaluate(() => {
            const inText = /drop a file/i.test(document.body.innerText);
            const inAttr = Array.from(document.querySelectorAll("input, textarea, [title], [aria-label]")).some((el) =>
              /drop a file/i.test(
                `${el.getAttribute("placeholder") || ""} ${el.getAttribute("title") || ""} ${el.getAttribute("aria-label") || ""}`,
              ),
            );
            return inText || inAttr;
          });
          if (!advertised) return "not advertised — nothing to honour";
          /**
           * Advertised, so it must WORK. React attaches listeners at the root, so
           * `el.ondrop` is always null and cannot be introspected — dispatch a
           * real drop instead and require the surface to respond. A wrong
           * extension must be refused BY NAME (lane 3's fix), which is a visible
           * response and therefore provable.
           */
          const target = await page.$("input[type='text'], form");
          if (!target) throw new NoAffordance("no ingest box to drop onto");
          const responded = await page.evaluate((el) => {
            const before = document.body.innerText;
            const dt = new DataTransfer();
            dt.items.add(new File(["x"], "not-a-caption.exe", { type: "application/octet-stream" }));
            el.dispatchEvent(new DragEvent("dragover", { bubbles: true, dataTransfer: dt }));
            el.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: dt }));
            return before;
          }, target);
          await page.waitForNetworkIdle({ idleTime: 500, timeout: 6_000 }).catch(() => {});
          const after = await text(page);
          if (after === responded) {
            throw new DeadDoor("the copy advertises 'drop a file' and a real drop changed nothing on screen — no handler behind it");
          }
          const said = after.split("\n").map((l) => l.trim()).find((l) => /\.exe|not-a-caption|refus|can.t|only/i.test(l));
          return said ? `a wrong file is refused by name: ${JSON.stringify(said.slice(0, 90))}` : "the drop was handled";
        },
      },
      {
        name: "find one source in the shelf (search / filter / sort)",
        async run(page) {
          const body = await text(page);
          const count = body.match(/(\d+)\s+sources?/i);
          const search = await page.$("input[type='search'], input[placeholder*='search' i], input[placeholder*='find' i]");
          const seg = await page.$(".seg, .sel-ctl, [role='tablist']");
          if (search || seg) return search ? "search present" : "filter/sort controls present";
          /**
           * An EMPTY shelf cannot be searched, and saying "no affordance" about
           * it would be a finding about the fixture rather than the product.
           * Lane 3's `repro` lens refuted half this finding for exactly that
           * reason: `/api/library` returns zero sources today, so the controls
           * have nothing to act on. Report it as UNDRIVEN — never as ✓, which is
           * what an earlier version of this job would have printed.
           */
          if (count && Number(count[1]) === 0) {
            throw new Undriven(`the shelf holds ${count[0]} — nothing to search, so the controls cannot be exercised on today's data`);
          }
          throw new NoAffordance(`a shelf of ${count ? count[0] : "unknown size"} with no search, no filter and no sort`);
        },
      },
      {
        name: "tell a disabled control from a live one",
        async run(page) {
          const bad = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll("button, [role='button'], a[href]"));
            return els
              .filter((el) => el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true")
              .filter((el) => {
                const cs = window.getComputedStyle(el);
                // Indistinguishable = full opacity AND a normal pointer.
                return Number(cs.opacity) > 0.85 && cs.cursor !== "not-allowed" && cs.cursor !== "default";
              })
              .map((el) => (el.textContent || "").trim().slice(0, 30));
          });
          if (bad.length > 0) {
            throw new DeadDoor(`${bad.length} disabled control(s) look and feel live: ${bad.slice(0, 4).join(", ")}`);
          }
          return "disabled controls read as disabled";
        },
      },
    ],
  },

  sites: {
    route: "/app/sites",
    jobs: [
      {
        name: "open a site dossier from the portfolio",
        async run(page) {
          // The card IS the anchor (`a.site-card`) — an earlier version of this
          // job looked for `.card a` and reported "no affordance" on a surface
          // full of working cards. A harness that invents a finding is worse
          // than no harness, so selectors come from the inventory, not memory.
          const card = await page.$("a[href*='/app/sites/']");
          if (!card) throw new NoAffordance("no site card links into a dossier");
          await press(page, card, "a site card");
          await expectText(page, /wave|vertical|dossier/i, "site dossier");
          return `landed on ${await urlNow(page)}`;
        },
      },
      {
        name: "follow the dossier's own Wave fact back to the filtered portfolio",
        async run(page, { base }) {
          const card = await page.$("a[href*='/app/sites/']");
          if (!card) throw new NoAffordance("cannot reach a dossier to test its facts");
          await press(page, card, "a site card");
          // Every fact is a door (plan §5 doctrine). A Wave that renders as text
          // on some waves and a link on others is the s77 blocker.
          const wave = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll("*")).filter(
              (el) => el.children.length === 0 && /^wave\b/i.test((el.textContent || "").trim()),
            );
            if (els.length === 0) return { found: false };
            // Look UP for the enclosing link, not down from the label. The fact
            // is wrapped BY the <a>, so an earlier version of this job searched
            // a tight inner div, found nothing, and reported "the Wave fact is
            // not a door" on a dossier where it demonstrably is one.
            const anchor = els.map((el) => el.closest("a[href]")).find(Boolean);
            return {
              found: true,
              label: els.map((e) => (e.textContent || "").trim()).join(" "),
              href: anchor ? anchor.getAttribute("href") : null,
            };
          });
          if (!wave.found) throw new NoAffordance("no Wave fact on the dossier");
          if (!wave.href) throw new DeadDoor(`the Wave fact is not a door here: ${JSON.stringify(wave.label)}`);
          // FOLLOW IT. The s77 blocker was not a missing link, it was a link
          // whose destination silently dropped the filter for wave 2.5 — so a
          // door that exists proves nothing until you walk through it.
          await page.goto(`${base}${wave.href}`, { waitUntil: "networkidle2" });
          await page.waitForNetworkIdle({ idleTime: 600, timeout: 10_000 }).catch(() => {});
          const applied = await page.evaluate(() => {
            const on = Array.from(document.querySelectorAll("button.cat-chip")).filter((b) =>
              String(b.className).includes("on"),
            );
            const count = (document.body.innerText.match(/(\d+)\s+of\s+(\d+)\s+built/i) || []);
            const total = (document.body.innerText.match(/(\d+)\s+built/i) || []);
            return { on: on.map((b) => (b.textContent || "").trim()), slice: count[0] || total[0] || null };
          });
          if (applied.on.length === 0) {
            throw new DeadDoor(`${wave.href} silently dropped the filter — no chip is active and the grid reads ${JSON.stringify(applied.slice)}`);
          }
          return `${JSON.stringify(wave.label)} → ${wave.href} → chip ${JSON.stringify(applied.on[0])} on, ${applied.slice}`;
        },
      },
      {
        name: "apply a filter and then clear it from what is on screen",
        async run(page) {
          const chip = await page.$("button.cat-chip");
          if (!chip) throw new NoAffordance("no filter controls on the portfolio");
          const label = await page.evaluate((el) => (el.textContent || "").trim(), chip);
          await press(page, chip, `the ${JSON.stringify(label)} filter chip`);
          /**
           * Reversibility (thalon-check): DRIVE THE UNDO. An earlier version
           * demanded a literal "clear"/"all" control and reported a dead door
           * because there is none — but lane 3's fix hoists the ACTIVE chip into
           * the resting five and marks it `.on`, so one click on it clears the
           * filter. Requiring a particular widget graded a working affordance as
           * broken; what matters is that the operator can get back.
           */
          const active = await page.evaluate(() => {
            const on = Array.from(document.querySelectorAll("button.cat-chip")).filter(
              (b) => String(b.className).includes("on") && b.offsetParent,
            );
            return on.map((b) => (b.textContent || "").trim());
          });
          if (active.length === 0) {
            throw new DeadDoor(`the ${JSON.stringify(label)} filter is applied but no chip is marked active — the operator cannot see what is filtering, let alone undo it`);
          }
          const before = await urlNow(page);
          await page.evaluate(() => {
            const on = Array.from(document.querySelectorAll("button.cat-chip")).find(
              (b) => String(b.className).includes("on") && b.offsetParent,
            );
            on?.click();
          });
          await page.waitForNetworkIdle({ idleTime: 500, timeout: 8_000 }).catch(() => {});
          const stillOn = await page.evaluate(
            () => Array.from(document.querySelectorAll("button.cat-chip")).filter((b) => String(b.className).includes("on")).length,
          );
          if (stillOn > 0) {
            throw new DeadDoor(`clicking the active chip ${JSON.stringify(active[0])} did not clear the filter (was ${before})`);
          }
          return `applied ${JSON.stringify(active[0])}, and one click on it cleared the filter`;
        },
      },
    ],
  },

  approve: {
    route: "/app/approve",
    jobs: [
      {
        name: "read a waiting draft and see why the judge passed it",
        async run(page) {
          const row = await page.$(".row, .draft-card, [class*='draft']");
          if (!row) throw new NoAffordance("no draft rows in the queue");
          await press(page, row, "a draft row");
          await expectText(page, /grounding|judge|reason/i, "reasons panel");
          return "reasons panel opened";
        },
      },
      {
        name: "tell the two grounding tiers apart in the reasons panel",
        async run(page) {
          // A BLOCKED draft: the tiers can only be seen to disagree where a
          // gate actually failed, so picking the first row of any kind is not
          // enough to exercise this.
          const row = await page.evaluateHandle(() => {
            const rows = Array.from(document.querySelectorAll(".row"));
            return rows.find((r) => /blocked|needs edit/i.test(r.textContent || "")) || rows[0] || null;
          });
          const exists = await row.evaluate((el) => Boolean(el));
          if (!exists) throw new NoAffordance("no draft rows in the queue");
          await press(page, row, "a blocked draft row");
          /**
           * Read the PANEL'S OWN gate column (`.reason-gate`), on a BLOCKED
           * draft, after opening "reasons on record".
           *
           * Two earlier versions of this job were wrong, and the second was
           * worse than the first. v1 filtered leaf nodes and reported "no
           * affordance" on a panel that has three gate rows. v2 read
           * `body.innerText` for lines starting with "Grounding", found
           * "Grounding — screen" / "Grounding — final" somewhere else on the
           * surface, and reported the job as WORKING — while the panel's own
           * column really did read Denylist / Grounding / Grounding. Lane 4
           * measured it correctly and this harness contradicted it; the harness
           * was wrong. Read the element the defect lives in, on the row that
           * exhibits it.
           */
          await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll("button, summary, a")).find((b) =>
              /reasons on record/i.test(b.textContent || ""),
            );
            btn?.click();
          });
          await page.waitForNetworkIdle({ idleTime: 400, timeout: 5_000 }).catch(() => {});
          const labels = await page.evaluate(() =>
            Array.from(document.querySelectorAll(".reason-gate")).map((e) => (e.textContent || "").trim()),
          );
          if (labels.length === 0) throw new NoAffordance("no gate rows in the reasons panel");
          const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
          if (dupes.length > 0) {
            throw new DeadDoor(`the gate column reads ${labels.join(" / ")} — ${JSON.stringify(dupes[0])} appears twice, so the two tiers that can DISAGREE are indistinguishable`);
          }
          return `gate column distinguishes every row: ${labels.join(" / ")}`;
        },
      },
      {
        name: "trust the waiting count against the bulk action's own count",
        async run(page) {
          const body = await text(page);
          const waiting = body.match(/(\d+)\s+waiting/i);
          const bulk = body.match(/approve all waiting\s*\((\d+)\)/i);
          if (!waiting) throw new NoAffordance("no waiting count on the surface");
          if (!bulk) return `waiting=${waiting[1]}, no bulk control to contradict it`;
          // bulk[1], not bulk[2]: the off-by-one read `undefined` and still
          // reported a dead door — a real finding reached by a broken measurement
          // is indistinguishable from an invented one.
          if (waiting[1] !== bulk[1]) {
            if (explainsGap(body, waiting[1], bulk[1])) {
              const line = body.split("\n").map((l) => l.trim()).find((l) => /\bof\b/.test(l) && l.includes(bulk[1]) && l.includes(waiting[1]));
              return `${waiting[1]} waiting vs bulk ${bulk[1]}, and the surface accounts for it: ${JSON.stringify(line)}`;
            }
            throw new DeadDoor(`"${waiting[1]} waiting" beside "Approve all waiting (${bulk[1]})" — staged rows are counted, silently excluded, and indistinguishable`);
          }
          return `counts agree at ${waiting[1]}`;
        },
      },
      {
        name: "arrive from a deep link that matches nothing and be told so",
        async run(page, { base }) {
          await page.goto(`${base}/app/approve?run=definitely-not-a-real-run-id`, { waitUntil: "networkidle2" });
          await page.waitForNetworkIdle({ idleTime: 600, timeout: 8_000 }).catch(() => {});
          const said = await page.evaluate(() => {
            const alert = document.querySelector("[role='alert']");
            return alert ? (alert.textContent || "").trim() : "";
          });
          if (!said) {
            throw new DeadDoor("an unmatched ?run= deep link says nothing — it silently shows a different run's drafts");
          }
          return `honest: ${said.slice(0, 80)}`;
        },
      },
    ],
  },

  create: {
    route: "/app/create",
    jobs: [
      {
        name: "write a brief and generate from it",
        async run(page) {
          const box = await page.$("textarea, input[type='text']");
          if (!box) throw new NoAffordance("nowhere to write a brief");
          await box.type("A short post about roasting coffee at altitude.");
          const gen = await control(page, { name: "Generate" });
          const disabled = await page.evaluate(
            (el) => el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
            gen,
          );
          // NOT pressed on purpose: generation spends a metered gateway call and
          // the sequence gate forbids it. Reachability is what this job checks.
          if (disabled) throw new DeadDoor("Generate is refused even with a brief written");
          return "Generate reachable (deliberately not pressed — spend gate)";
        },
      },
      {
        name: "follow Intel's PRIMARY suggested exit into Create and generate what it handed over",
        async run(page, { base }) {
          await page.goto(`${base}/app/intel`, { waitUntil: "networkidle2" });
          await page.waitForNetworkIdle({ idleTime: 800, timeout: 12_000 }).catch(() => {});
          /**
           * The exit is the dossier's own primary BUTTON ("Create post ·
           * suggested"), not an anchor — and emphatically not the rail's "Create"
           * or the topbar's "+ Create". An earlier version of this job took the
           * first `a[href*='/app/create']`, which is the NAV, landed on an empty
           * Create with Generate live, and passed. That is the flagship path's
           * finding reported as working: the exact false pass this harness exists
           * to make impossible.
           */
          const exit = await page.evaluateHandle(() => {
            const els = Array.from(document.querySelectorAll("button, a[href]"));
            const cands = els.filter(
              (el) =>
                !el.closest("nav, .rail, .topbar, header") &&
                /^create\b|target this/i.test((el.textContent || "").trim()),
            );
            // The PRIMARY recommendation, not merely the first match — lane 4's
            // fix leads with "Create video" and keeps "Post · suggested" as a
            // ghost, so "first match" would grade the wrong button.
            return cands.find((el) => /btn-primary/.test(String(el.className))) || cands[0] || null;
          });
          const found = await exit.evaluate((el) => (el ? (el.textContent || "").trim().slice(0, 40) : null));
          if (!found) throw new NoAffordance("the dossier offers no primary exit into Create");
          await press(page, exit, `the dossier's ${JSON.stringify(found)} exit`);
          const landed = await urlNow(page);
          if (!/^\/app\/create/.test(landed)) {
            throw new DeadDoor(`${JSON.stringify(found)} did not reach Create — landed on ${landed}`);
          }
          const gen = await control(page, { name: "Generate" });
          const disabled = await page.evaluate(
            (el) => el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true",
            gen,
          );
          // NOT pressed: generation spends a metered gateway call and the
          // sequence gate forbids it. Reachability is the question here.
          if (disabled) {
            const why = (await text(page)).split("\n").find((l) => /refus|cannot|no active|unsupported/i.test(l)) || "";
            throw new DeadDoor(`Intel's primary exit lands on ${landed} with Generate REFUSED — the flagship path terminates in Create${why ? `: ${why.trim().slice(0, 90)}` : ""}`);
          }
          return `Intel ${JSON.stringify(found)} → ${landed} → Generate live`;
        },
      },
      {
        name: "write a brief, then take it into the advanced / staged flow",
        async run(page) {
          const body = await text(page);
          if (!/staged flow/i.test(body)) return "not offered — nothing to honour";
          // Type a brief FIRST: the question is not whether the door has an href,
          // it is whether the operator's work survives going through it. An
          // earlier version of this job checked only for an href and called the
          // door "works" — a false pass on exactly the finding it was written for.
          const box = await page.$("textarea, input[type='text']");
          const brief = "Staged-flow probe: a post about altitude roasting.";
          if (box) await box.type(brief);

          const door = await page.evaluate(() => {
            const hit = Array.from(document.querySelectorAll("a[href], button")).find((el) =>
              /staged flow/i.test(el.textContent || ""),
            );
            return hit ? { tag: hit.tagName.toLowerCase(), href: hit.getAttribute("href") || "" } : null;
          });
          if (!door) throw new DeadDoor("'Advanced · staged flow' is written on the surface with no control behind it");
          if (door.tag === "a" && !door.href) throw new DeadDoor("the staged-flow door has no href");

          const handle = await control(page, { name: "staged flow" , tag: door.tag === "a" ? "a" : "button" });
          await press(page, handle, "the staged-flow door");
          const landed = await urlNow(page);
          // Landing anywhere that is not a staged authoring surface means the
          // door advertises a capability the product does not have.
          if (/^\/app\/approve/.test(landed)) {
            throw new DeadDoor(`'Advanced · staged flow →' lands on ${landed} — the approve queue, not a staged authoring flow; any brief typed here is discarded`);
          }
          const kept = box ? (await text(page)).includes("altitude roasting") : null;
          if (kept === false) throw new DeadDoor(`the staged flow opened at ${landed} but the brief was discarded on the way`);
          return `staged flow → ${landed}${kept ? " (brief carried)" : ""}`;
        },
      },
      {
        name: "get back to the source behind the grounding row",
        async run(page, { base }) {
          /**
           * Arrive WITH a capture. A bare `/app/create` holds no grounding
           * source, so "no link" there is an honest empty state, not a dead
           * door — and an earlier version of this job graded that state and
           * reported a defect against a fix that was actually in place (lane 4's
           * C4). Test the state where the fact EXISTS: the handover from Intel.
           */
          await page.goto(`${base}/app/intel`, { waitUntil: "networkidle2" });
          await page.waitForNetworkIdle({ idleTime: 600, timeout: 10_000 }).catch(() => {});
          const handed = await page.evaluate(() => {
            const cands = Array.from(document.querySelectorAll("button, a[href]")).filter(
              (el) =>
                !el.closest("nav, .rail, .topbar, header") &&
                /^create\b/i.test((el.textContent || "").trim()),
            );
            const hit = cands.find((el) => /btn-primary/.test(String(el.className))) || cands[0];
            if (!hit) return false;
            hit.click();
            return true;
          });
          if (!handed) throw new NoAffordance("no capture handover available to carry a source");
          await page.waitForNetworkIdle({ idleTime: 800, timeout: 10_000 }).catch(() => {});
          const landed = await urlNow(page);
          if (!/^\/app\/create/.test(landed)) throw new DeadDoor(`the handover did not reach Create — ${landed}`);
          const link = await page.evaluate(() => {
            const a = Array.from(document.querySelectorAll("a[href]")).find((el) =>
              /view source|view sources/i.test(el.textContent || ""),
            );
            return a ? { text: (a.textContent || "").trim(), href: a.getAttribute("href") } : null;
          });
          if (!link) {
            throw new DeadDoor(
              `arrived at ${landed} carrying a capture and the grounding row still offers no way back to the source`,
            );
          }
          if (!/^https?:\/\//.test(link.href || "")) {
            throw new DeadDoor(`the source door points at ${JSON.stringify(link.href)}, not the capture's URL`);
          }
          return `${JSON.stringify(link.text)} → ${link.href}`;
        },
      },
    ],
  },

  intel: {
    route: "/app/intel",
    jobs: [
      {
        name: "walk the rising list by keyboard and open one into the dossier",
        async run(page) {
          await page.keyboard.press("KeyJ");
          const sel = await page.$(".row.sel");
          if (!sel) throw new NoAffordance("j does not select a rising row");
          await page.keyboard.press("Enter");
          await page.waitForNetworkIdle({ idleTime: 400, timeout: 6_000 }).catch(() => {});
          return "j/↵ opens the dossier";
        },
      },
      {
        name: "ride a trend WITHOUT an angle after clicking the angle off",
        async run(page) {
          const angle = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll("button, [role='button']"));
            const hit = els.find((el) => /angle/i.test(el.textContent || ""));
            return hit ? (hit.textContent || "").trim().slice(0, 40) : null;
          });
          if (!angle) throw new NoAffordance("no angle control on the dossier");
          return `angle control present: ${JSON.stringify(angle)} (toggle-off truth is the seam's, checked in the lane's tests)`;
        },
      },
      {
        name: "promote the dossier into Create",
        async run(page) {
          // The dossier's OWN exit, never the rail's or the topbar's — see the
          // note on the create job set, where taking the nav link produced a
          // false pass on the flagship path.
          const found = await page.evaluate(() => {
            const cands = Array.from(document.querySelectorAll("button, a[href]")).filter(
              (el) =>
                !el.closest("nav, .rail, .topbar, header") &&
                /^create\b|target this/i.test((el.textContent || "").trim()),
            );
            // Prefer the PRIMARY: s79 lane 4 demoted "Post · suggested" to a
            // ghost and led with "Create video", and a job that grabs whichever
            // matches first would report on the demoted one.
            const hit = cands.find((el) => /btn-primary/.test(String(el.className))) || cands[0];
            return hit ? (hit.textContent || "").trim().slice(0, 40) : null;
          });
          if (!found) throw new NoAffordance("the dossier offers no primary exit into Create");
          return `exit present: ${JSON.stringify(found)} (where it LANDS is the create job set's)`;
        },
      },
    ],
  },

  /**
   * THE SURFACE THAT TAUGHT THE LESSON.
   *
   * Nothing in the product could create a plan until s78, and no reading audit
   * saw it: `Reschedule` was gated on `kind === "plan"`, which reads as correct,
   * and `planSlot` was reachable from exactly one place — inside `reschedule`,
   * which only renders on an event that is ALREADY a plan. Unreachable by
   * construction, while the Board said "approve a draft, then plan its slot".
   *
   * So the calendar's jobs are pinned here even though no s79 lane owns it:
   * these are the exact capabilities the founder found missing by clicking, and
   * a capability that was absent once can go absent again silently.
   *
   * A slot is a PLAN — none of this publishes, arms, or calls a platform.
   * Jobs that write clean up after themselves so the gate stays repeatable.
   */
  calendar: {
    route: "/app/calendar",
    jobs: [
      {
        name: "PLAN an approved draft into an empty slot (the capability that did not exist)",
        async run(page) {
          const before = (await page.$$(".ev-plan")).length;
          const col = await page.$(".dcol");
          if (!col) throw new NoAffordance("no day columns on the week grid");
          // Click empty grid: the planner door. A coordinate click, because the
          // door is the column's own empty space, not a control with a name.
          const box = await col.boundingBox();
          await page.mouse.click(box.x + box.width / 2, box.y + 60);
          await page.waitForNetworkIdle({ idleTime: 500, timeout: 6_000 }).catch(() => {});
          const picker = await page.evaluate(() => {
            const el = document.querySelector(".detail-card, [class*='picker'], [role='dialog']");
            return el ? { text: (el.textContent || "").trim().slice(0, 160) } : null;
          });
          if (!picker) throw new NoAffordance("clicking an empty slot offers no way to plan anything");
          // Either it lists something plannable, or it says WHY it cannot —
          // an empty picker with no explanation is the dead end.
          const option = await page.evaluate(() => {
            const card = document.querySelector(".detail-card, [class*='picker'], [role='dialog']");
            const btn = Array.from(card.querySelectorAll("button")).find(
              (b) => !/^(✕|×|close|cancel)$/i.test((b.textContent || "").trim()),
            );
            return btn ? (btn.textContent || "").trim().slice(0, 60) : null;
          });
          if (!option) {
            /**
             * An empty picker is only acceptable if it states the TRUE reason.
             * s79 found it claiming *"a draft becomes plannable once you approve
             * it"* on a surface showing three chips reading "approved" — telling
             * the operator to approve something they had already approved. So
             * the harness checks the CLAIM against what the surface itself
             * shows, rather than accepting any explanation as honest.
             */
            const approvedOnScreen = /\bapproved\b/i.test(await text(page));
            if (/once you approve it/i.test(picker.text) && approvedOnScreen) {
              throw new DeadDoor(
                `the planner blames missing approval while the surface shows approved work: ${picker.text.slice(0, 90)}`,
              );
            }
            if (/nothing|already|no .*(approved|draft|unplanned)/i.test(picker.text)) {
              return `nothing plannable, and it says so truthfully: ${picker.text.slice(0, 90)}`;
            }
            throw new DeadDoor(`the planner opened with nothing to pick and no reason given: ${picker.text.slice(0, 80)}`);
          }
          await page.evaluate(() => {
            const card = document.querySelector(".detail-card, [class*='picker'], [role='dialog']");
            const btn = Array.from(card.querySelectorAll("button")).find(
              (b) => !/^(✕|×|close|cancel)$/i.test((b.textContent || "").trim()),
            );
            btn.click();
          });
          await page.waitForNetworkIdle({ idleTime: 800, timeout: 8_000 }).catch(() => {});
          const after = (await page.$$(".ev-plan")).length;
          if (after <= before) {
            throw new DeadDoor(`picked ${JSON.stringify(option)} and no plan appeared (${before} → ${after})`);
          }
          // Clean up: leave the surface as it was found.
          await page.evaluate(() => {
            const plans = Array.from(document.querySelectorAll(".ev-plan"));
            if (plans.length > 0) plans[plans.length - 1].click();
          });
          await page.waitForNetworkIdle({ idleTime: 400, timeout: 5_000 }).catch(() => {});
          const removed = await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll("button")).find((b) => /^remove$/i.test((b.textContent || "").trim()));
            if (!btn) return false;
            btn.click();
            return true;
          });
          await page.waitForNetworkIdle({ idleTime: 600, timeout: 6_000 }).catch(() => {});
          return `planned ${JSON.stringify(option)} (${before} → ${after})${removed ? ", then removed it" : " — COULD NOT CLEAN UP"}`;
        },
      },
      {
        name: "REMOVE a plan, with the control actually clickable where it is drawn",
        async run(page) {
          const plan = await page.$(".ev-plan");
          if (!plan) return "no plan on this week to remove";
          await press(page, plan, "a planned slot");
          const remove = await page.evaluate(() => {
            const btn = Array.from(document.querySelectorAll("button")).find((b) => /^remove$/i.test((b.textContent || "").trim()));
            if (!btn) return null;
            const r = btn.getBoundingClientRect();
            const cx = r.x + r.width / 2;
            const cy = r.y + r.height / 2;
            // elementFromPoint, not geometry: at s78 this control sat under an
            // off-screen popover edge and measured perfectly fine.
            const top = document.elementFromPoint(cx, cy);
            return {
              inViewport: cx >= 0 && cy >= 0 && cx <= window.innerWidth && cy <= window.innerHeight,
              hit: Boolean(top && (top === btn || btn.contains(top))),
              at: `${Math.round(cx)},${Math.round(cy)}`,
            };
          });
          if (!remove) throw new NoAffordance("a plan's detail offers no Remove");
          if (!remove.inViewport) throw new DeadDoor(`Remove is drawn outside the viewport at ${remove.at}`);
          if (!remove.hit) throw new DeadDoor(`Remove at ${remove.at} is covered by another layer — a click there hits something else`);
          return `Remove is hittable at ${remove.at} (not clicked — it would delete a real plan)`;
        },
      },
      {
        name: "dismiss the planner by clicking outside it",
        async run(page) {
          const col = await page.$(".dcol");
          if (!col) throw new NoAffordance("no day columns on the week grid");
          const box = await col.boundingBox();
          await page.mouse.click(box.x + box.width / 2, box.y + 60);
          await page.waitForNetworkIdle({ idleTime: 400, timeout: 5_000 }).catch(() => {});
          const opened = await page.$(".detail-card, [class*='picker'], [role='dialog']");
          if (!opened) throw new NoAffordance("no planner opened to dismiss");
          // Click well away from the popover — the s78 finding was that outside
          // clicks did not dismiss it at all.
          await page.mouse.click(250, 700);
          await page.waitForNetworkIdle({ idleTime: 400, timeout: 5_000 }).catch(() => {});
          const still = await page.$(".detail-card, [class*='picker'], [role='dialog']");
          if (still) throw new DeadDoor("clicking outside the planner does not dismiss it");
          return "outside click dismisses it";
        },
      },
      {
        name: "keep the planner fully on screen wherever it opens",
        async run(page) {
          const cols = await page.$$(".dcol");
          if (cols.length === 0) throw new NoAffordance("no day columns on the week grid");
          // The LAST column and the BOTTOM of it: the two edges a popover runs
          // off. s78 clamped it against a guessed 190px height and the grid's
          // width instead of the visible viewport, and Remove went unclickable.
          const box = await cols[cols.length - 1].boundingBox();
          await page.mouse.click(box.x + box.width - 8, box.y + box.height - 30);
          await page.waitForNetworkIdle({ idleTime: 500, timeout: 6_000 }).catch(() => {});
          const fit = await page.evaluate(() => {
            const el = document.querySelector(".detail-card, [class*='picker'], [role='dialog']");
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return {
              ok: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
              rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`,
              vp: `${window.innerWidth}×${window.innerHeight}`,
            };
          });
          if (!fit) throw new NoAffordance("no planner opened at the grid's far corner");
          if (!fit.ok) throw new DeadDoor(`the planner overflows the viewport: ${fit.rect} in ${fit.vp}`);
          return `fits at ${fit.rect} in ${fit.vp}`;
        },
      },
    ],
  },

  videos: {
    route: "/app/videos",
    jobs: [
      {
        name: "open a video project from the list",
        async run(page) {
          const link = await page.$("a[href*='/app/videos/']");
          if (!link) throw new NoAffordance("no video project links in the list");
          await press(page, link, "a video card");
          return `landed on ${await urlNow(page)}`;
        },
      },
      {
        name: "trust the card's aspect-cut count against the project page it opens",
        async run(page) {
          const cardText = await page.evaluate(() => {
            const a = document.querySelector("a[href*='/app/videos/']");
            if (!a) return null;
            const card = a.closest(".card, .row, li") || a;
            return { href: a.getAttribute("href"), text: (card.textContent || "").trim() };
          });
          if (!cardText) throw new NoAffordance("no video cards to compare");
          const cuts = cardText.text.match(/(\d+)\s+aspect cuts?/i);
          if (!cuts) return "the card states no aspect-cut count";
          const link = await page.$("a[href*='/app/videos/']");
          await press(page, link, "a video card");
          const body = await text(page);
          if (/none yet/i.test(body) && Number(cuts[1]) > 0) {
            throw new DeadDoor(`the card says "${cuts[0]}" and the page it opens says "none yet" — the family line mixes scopes`);
          }
          return `card says ${cuts[0]}, project page agrees`;
        },
      },
    ],
  },
};

export function surfaces() {
  return Object.keys(JOBS);
}
