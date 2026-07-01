import { NextResponse } from "next/server";
import { bumpCount } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { clientId?: string; nickname?: string; country?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const clientId = (body.clientId || "").trim();
  const nickname = (body.nickname || "anon").trim().slice(0, 14) || "anon";
  const country = (body.country || "us").toLowerCase().slice(0, 2);
  if (!clientId) {
    return NextResponse.json({ error: "missing_clientId" }, { status: 400 });
  }
  const { count, rank } = bumpCount(clientId, nickname, country);
  return NextResponse.json({ ok: true, todayCount: count, todayRank: rank });
}
