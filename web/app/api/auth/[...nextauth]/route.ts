import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { RuntimeSafetyError, assertOAuthCallback } from "@/lib/runtimeSafety";

function oauthDisabledResponse() {
  return NextResponse.json(
    { error: "OAuth callbacks are disabled in this environment." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

function allowOAuthCallbacks(request: NextRequest) {
  try {
    assertOAuthCallback("oauth-callback", {
      url: request.url,
      host: request.headers.get("host") ?? "",
      forwardedProto: request.headers.get("x-forwarded-proto") ?? "",
    });
    return true;
  } catch (error) {
    if (error instanceof RuntimeSafetyError) {
      return false;
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  return allowOAuthCallbacks(request) ? handlers.GET(request) : oauthDisabledResponse();
}

export async function POST(request: NextRequest) {
  return allowOAuthCallbacks(request) ? handlers.POST(request) : oauthDisabledResponse();
}
