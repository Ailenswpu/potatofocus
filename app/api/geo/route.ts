import { NextResponse } from "next/server";
import { normalizeCountry } from "@/lib/flags";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type CfRequest = Request & {
  cf?: {
    country?: string;
  };
};

export function GET(request: Request) {
  const cfCountry = (request as CfRequest).cf?.country;
  const headerCountry =
    request.headers.get("cf-ipcountry") ||
    request.headers.get("x-vercel-ip-country") ||
    request.headers.get("x-country-code");
  const detected = cfCountry || headerCountry;

  return NextResponse.json({
    country: detected ? normalizeCountry(detected) : null,
    source: cfCountry ? "cloudflare" : headerCountry ? "header" : "none",
  });
}
