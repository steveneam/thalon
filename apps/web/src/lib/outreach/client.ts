import { asJson } from "@/lib/approve-queue/client";
import type { ComposeEmailInput, ComposeEmailResult } from "./types";

/** Judge-gate refusals and gateway errors surface verbatim as the thrown message — the sweep convention. */
export async function composeEmail(input: ComposeEmailInput): Promise<ComposeEmailResult> {
  const res = await fetch("/api/create/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return asJson(res);
}
