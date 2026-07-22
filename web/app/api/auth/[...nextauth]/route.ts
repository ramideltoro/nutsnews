import { handlers } from "@/auth";
import { logWarn } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { RuntimeSafetyError, assertOAuthCallback } from "@/lib/runtimeSafety";

const OAUTH_DISABLED_ERROR = "OAuth callbacks are disabled in this environment.";

function authRequestIdentity(request: NextRequest) {
  const requestUrl = new URL(request.url);

  return {
    url: request.url,
    host:
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      requestUrl.host,
    forwardedProto:
      request.headers.get("x-forwarded-proto") ??
      requestUrl.protocol.slice(0, -1),
  };
}

function oauthDisabledResponse(error: RuntimeSafetyError) {
  return NextResponse.json(
    { error: OAUTH_DISABLED_ERROR, code: error.code },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-NutsNews-Auth-Error": error.code,
      },
    },
  );
}

function requiresOAuthFlowGuard(request: NextRequest) {
  const action = new URL(request.url).pathname.split("/").filter(Boolean).at(2);

  return action === "callback" || action === "signin";
}

async function allowOAuthCallbacks(request: NextRequest) {
  if (!requiresOAuthFlowGuard(request)) {
    return { allowed: true } as const;
  }

  const identity = authRequestIdentity(request);

  try {
    assertOAuthCallback("oauth-callback", identity);
    return { allowed: true } as const;
  } catch (error) {
    if (error instanceof RuntimeSafetyError) {
      await logWarn(
        "admin.oauth_callback.blocked",
        "Admin OAuth callback refused runtime identity.",
        {
          code: error.code,
          host: identity.host,
          forwardedProto: identity.forwardedProto,
          pathname: new URL(request.url).pathname,
        },
      );
      return { allowed: false, error } as const;
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const result = await allowOAuthCallbacks(request);
  return result.allowed ? handlers.GET(request) : oauthDisabledResponse(result.error);
}

export async function POST(request: NextRequest) {
  const result = await allowOAuthCallbacks(request);
  return result.allowed ? handlers.POST(request) : oauthDisabledResponse(result.error);
}
