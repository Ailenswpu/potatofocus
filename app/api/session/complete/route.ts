import { NextResponse } from "next/server";
import { completeSession } from "@/lib/server/leaderboard";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: {
    clientId?: string;
    country?: string;
    nickname?: string;
    sessionId?: string;
    turnstileToken?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await completeSession(request, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, ...result.data });
}

