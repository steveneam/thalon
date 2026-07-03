import { NextResponse } from "next/server";
import { resolveSeams } from "@thalon/platform";

export async function GET() {
  const { dataDir: _dataDir, ...seams } = resolveSeams();
  return NextResponse.json({
    status: "ok",
    service: "thalon",
    time: new Date().toISOString(),
    seams,
  });
}
