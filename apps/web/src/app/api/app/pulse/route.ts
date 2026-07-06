import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { readPulse } from "@/lib/workspace/pulse";

/** Shell + dashboard pulse: tenant, active profile, draft/run counts, needs-you. */
export async function GET() {
  const repos = await getRepos();
  return NextResponse.json(await readPulse(repos));
}
