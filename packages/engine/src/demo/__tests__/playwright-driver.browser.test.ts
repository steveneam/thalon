import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { createPlaywrightDriver } from "../playwright-driver";

/**
 * The ONE integration test that drives a real chromium against a local
 * static fixture site (CHARTER B2.5). CI has no browsers installed, so this
 * is gated behind RUN_BROWSER_TESTS=1 and skips cleanly otherwise — every
 * other B2.5 test (crawl, flow map, storyboard, capture) is browser-free by
 * default via ../fake-driver.ts.
 */
const RUN_BROWSER_TESTS = process.env.RUN_BROWSER_TESTS === "1";

const fixturesDir = fileURLToPath(new URL("./fixtures/site", import.meta.url));
const indexUrl = pathToFileURL(path.join(fixturesDir, "index.html")).toString();

describe.skipIf(!RUN_BROWSER_TESTS)(
  "createPlaywrightDriver (B2.5 stage 4 real-browser integration — RUN_BROWSER_TESTS=1 only)",
  () => {
    it("drives goto/click/fill/expect against a local static fixture site", async () => {
      const videoDir = mkdtempSync(path.join(tmpdir(), "thalon-demo-video-"));
      const driver = createPlaywrightDriver({ videoDir });
      await driver.start();
      try {
        const goto = await driver.runStep({ action: "goto", target: indexUrl, value: "" });
        expect(goto.outcome).toBe("ok");

        const click = await driver.runStep({ action: "click", target: "#docs-link", value: "" });
        expect(click.outcome).toBe("ok");
        expect(click.cursor).not.toBeNull();

        const fill = await driver.runStep({ action: "fill", target: "#search-box", value: "hello" });
        expect(fill.outcome).toBe("ok");

        const expectStep = await driver.runStep({
          action: "expect",
          target: "#docs-heading",
          value: "Documentation",
        });
        expect(expectStep.outcome).toBe("ok");
      } finally {
        const artifacts = await driver.finish();
        expect(artifacts.videoPath === null || typeof artifacts.videoPath === "string").toBe(true);
        rmSync(videoDir, { recursive: true, force: true });
      }
    });

    it("reports a failing expect via outcome, never a thrown exception", async () => {
      const videoDir = mkdtempSync(path.join(tmpdir(), "thalon-demo-video-"));
      const driver = createPlaywrightDriver({ videoDir });
      await driver.start();
      try {
        await driver.runStep({ action: "goto", target: indexUrl, value: "" });
        const outcome = await driver.runStep({
          action: "expect",
          target: "h1",
          value: "this text is not on the page",
        });
        expect(outcome.outcome).toBe("error");
        expect(outcome.error).toBeDefined();
      } finally {
        await driver.finish();
        rmSync(videoDir, { recursive: true, force: true });
      }
    });
  },
);
