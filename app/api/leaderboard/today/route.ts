import { NextResponse } from "next/server";
import { leaderboardToday } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = leaderboardToday(20);
  return NextResponse.json(data);
}
