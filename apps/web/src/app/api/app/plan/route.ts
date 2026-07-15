import { NextResponse } from "next/server";
import { getRepos } from "@/lib/repos";
import { readPlan } from "@/lib/workspace/plan";

/** Dashboard v3 plan read: sweep pointer + cadence config + pipeline lineage rows. */
export async function GET() {
  const repos = await getRepos();
  return NextResponse.json(await readPlan(repos));
}
