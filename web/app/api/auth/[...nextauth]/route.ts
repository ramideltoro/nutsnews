import { handlers } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { RuntimeSafetyError, assertProductionOperation } from "@/lib/runtimeSafety";

function oauthDisabledResponse() {
  return NextResponse.json(
    { error: "OAuth callbacks are disabled in this environment." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

function allowOAuthCallbacks() {
  try {
    assertProductionOperation("oauth-callback");
    return true;
  } catch (error) {
    if (error instanceof RuntimeSafetyError) {
      return false;
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  return allowOAuthCallbacks() ? handlers.GET(request) : oauthDisabledResponse();
}

export async function POST(request: NextRequest) {
  return allowOAuthCallbacks() ? handlers.POST(request) : oauthDisabledResponse();
}
