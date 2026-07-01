import { NextResponse } from "next/server";
import { startSession } from "@/lib/server/leaderboard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    clientId?: string;
    country?: string;
    mode?: string;
    nickname?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await startSession(request, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}

