import { readEnv } from "@thalon/platform";
import { createFakeRenderTarget } from "./fake-target";
import { createHyperframesRenderTarget } from "./hyperframes-target";
import type { RenderTarget } from "./target";

/**
 * B5.1 env-selected render-driver registry (mirrors the B4.8
 * TranscriptProvider registry — drivers are config, never new render code
 * paths). `RENDER_DRIVER` selects; the DEFAULT is hyperframes (charter A11,
 * decision record docs/adr/0004-render-driver-default.md).
 *
 * "remotion" is deliberately a NAMED entry that fails loud: it is the
 * recorded swap path — same seam, no implementation — so selecting it tells
 * the operator exactly what it is instead of pretending it doesn't exist.
 */

export const RENDER_DRIVERS = ["hyperframes", "fake"] as const;
export const RENDER_DRIVER_SWAP_PATH = "remotion";

const DRIVER_REGISTRY: Record<string, () => RenderTarget> = {
  hyperframes: () => createHyperframesRenderTarget(),
  fake: () => createFakeRenderTarget(),
  [RENDER_DRIVER_SWAP_PATH]: () => {
    throw new Error(
      `render driver "remotion" is the RECORDED SWAP PATH (docs/adr/0004-render-driver-default.md) — no Remotion target is implemented; it slots in behind the same RenderTarget seam if the default is ever swapped. Select "hyperframes" (default) or "fake".`,
    );
  },
};

/** Seam resolution: explicit name > RENDER_DRIVER env (via the platform env choke point) > the hyperframes default. Unknown names fail loud with the registry listed. */
export function getRenderTarget(name?: string): RenderTarget {
  const selected = name?.trim() || readEnv().RENDER_DRIVER;
  const factory = DRIVER_REGISTRY[selected];
  if (!factory) {
    throw new Error(
      `unknown render driver "${selected}" — registered: ${RENDER_DRIVERS.join(", ")}; recorded swap path: ${RENDER_DRIVER_SWAP_PATH} (RENDER_DRIVER selects; drivers are config, never new render code paths)`,
    );
  }
  return factory();
}
