import { asJson } from "@/lib/approve-queue/client";
import type { OnePromptVideoRequest, OnePromptVideoWire } from "./one-prompt-types";

/** Judge-gate refusals and gateway errors surface verbatim as the thrown message — the sweep convention. */
export async function generateOnePromptVideo(
  input: OnePromptVideoRequest,
): Promise<OnePromptVideoWire> {
  const res = await fetch("/api/create/video", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return asJson(res);
}
