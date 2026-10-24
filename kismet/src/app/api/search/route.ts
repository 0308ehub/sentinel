import { NextRequest, NextResponse } from "next/server";
import { searchGraph } from "@/lib/graph";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 20);
  const results = searchGraph(q, limit);
  return NextResponse.json({ results });
}
