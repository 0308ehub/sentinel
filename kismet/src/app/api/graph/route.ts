import { NextResponse } from "next/server";
import { graphSnapshot } from "@/lib/data/seed";

export async function GET() {
  return NextResponse.json(graphSnapshot);
}
