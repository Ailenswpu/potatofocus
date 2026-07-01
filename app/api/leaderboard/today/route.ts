import { NextResponse } from "next/server";
import { getTodayLeaderboard } from "@/lib/server/leaderboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const data = await getTodayLeaderboard(request);
  return NextResponse.json(data);
}
