/**
 * pin-mint.ts — mint-week runner for B7.1 asset pinning.
 *
 * Pins one minted asset (local file or still-fresh vendor URL) into the
 * object store with its provenance manifest. Vendor mint URLs expire in
 * 30-60 min, so this runs immediately after every keeper mint.
 *
 * Usage (from repo root):
 *   npx tsx scripts/pin-mint.ts --file <path>|--url <https://...> --ext png \
 *     --vendor higgsfield --model soul_cinematic --prompt-file <path> \
 *     --credits 0.12 --tier paid --minted-at 2026-07-14T12:47:55Z \
 *     [--job-id <uuid>] [--params '{"aspect_ratio":"16:9"}'] [--source-url <url>]
 *
 * Prints the pinned keys as JSON on success; exits non-zero on any failure
 * (free-tier refusal, bad provenance, download error) per pinAsset's
 * loud-failure contract.
 */
import { readFileSync } from "node:fs";
import { getObjectStore } from "@thalon/platform";
import { pinAsset, type AssetProvenance } from "@thalon/engine";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function required(name: string): string {
  const v = arg(name);
  if (!v) {
    console.error(`missing required --${name}`);
    process.exit(2);
  }
  return v;
}

async function main() {
  const file = arg("file");
  const url = arg("url");
  const promptFile = arg("prompt-file");
  const prompt = promptFile ? readFileSync(promptFile, "utf8").trim() : arg("prompt");
  if (!prompt) {
    console.error("missing --prompt or --prompt-file");
    process.exit(2);
  }

  const provenance: AssetProvenance = {
    vendor: required("vendor"),
    model: required("model"),
    prompt,
    params: JSON.parse(arg("params") ?? "{}") as Record<string, unknown>,
    creditsSpent: Number(required("credits")),
    licenseTier: required("tier") as AssetProvenance["licenseTier"],
    mintedAt: new Date(required("minted-at")).toISOString(),
    ...(arg("source-url") ? { sourceUrl: arg("source-url") } : {}),
    ...(arg("job-id") ? { jobId: arg("job-id") } : {}),
  };

  const pinned = await pinAsset(getObjectStore(), {
    ...(file ? { bytes: readFileSync(file) } : { url: url! }),
    ext: required("ext"),
    provenance,
  });
  console.log(JSON.stringify(pinned, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
