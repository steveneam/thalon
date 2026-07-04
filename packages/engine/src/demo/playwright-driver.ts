import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { CursorPoint, DemoCaptureArtifacts, DemoDriver, DemoStepOutcome } from "./driver";

export interface PlaywrightDriverOptions {
  /** Directory Playwright writes the recorded video into (../capture.ts content-addresses it into the object store afterward). */
  videoDir: string;
  viewport?: { width: number; height: number };
}

/**
 * The real B2.5 stage-4 driver (SPINE §1: shell/driver code is read-only —
 * this module never imports @thalon/db and never persists anything;
 * ./capture.ts is the only writer). Never constructed by a test by default
 * (CI has no browsers installed) — the ONE integration test that drives this
 * against a local static fixture is gated behind RUN_BROWSER_TESTS=1 (see
 * __tests__/playwright-driver.browser.test.ts) and skips cleanly otherwise.
 */
export function createPlaywrightDriver(options: PlaywrightDriverOptions): DemoDriver {
  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;
  let sessionStart = 0;

  return {
    async start(): Promise<void> {
      browser = await chromium.launch();
      context = await browser.newContext({
        viewport: options.viewport ?? { width: 1280, height: 800 },
        recordVideo: { dir: options.videoDir },
      });
      page = await context.newPage();
      sessionStart = Date.now();
    },

    async runStep(step): Promise<DemoStepOutcome> {
      if (!page) throw new Error("PlaywrightDriver.runStep called before start()");
      const timestamp = Date.now() - sessionStart;
      let cursor: CursorPoint | null = null;
      try {
        if (step.action === "goto") {
          await page.goto(step.target);
        } else {
          const locator = page.locator(step.target);
          const box = await locator.boundingBox();
          cursor = box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
          if (step.action === "click") {
            await locator.click();
          } else if (step.action === "fill") {
            await locator.fill(step.value);
          } else if (step.action === "press") {
            await locator.press(step.value);
          } else if (step.action === "expect") {
            const text = await locator.textContent();
            if (!text || !text.includes(step.value)) {
              throw new Error(
                `expected "${step.target}" to contain "${step.value}", got "${text ?? ""}"`,
              );
            }
          }
        }
        return { action: step.action, target: step.target, timestamp, outcome: "ok", cursor };
      } catch (err) {
        return {
          action: step.action,
          target: step.target,
          timestamp,
          outcome: "error",
          error: err instanceof Error ? err.message : String(err),
          cursor,
        };
      }
    },

    async finish(): Promise<DemoCaptureArtifacts> {
      const video = page?.video() ?? null;
      await page?.close();
      const videoPath = video ? await video.path() : null;
      await context?.close();
      await browser?.close();
      return { videoPath: videoPath ?? null };
    },
  };
}
