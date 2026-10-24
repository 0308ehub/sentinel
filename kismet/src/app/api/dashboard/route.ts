import { NextResponse } from "next/server";
import { nodes, edges, timeline, activities, aiRecommendations, productHealth } from "@/lib/data/seed";

export async function GET() {
  return NextResponse.json({
    nodes: nodes.length,
    edges: edges.length,
    timelineEvents: timeline.length,
    activities: activities.length,
    recommendations: aiRecommendations,
    health: productHealth,
  });
}
