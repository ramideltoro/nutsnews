import { NextRequest, NextResponse } from "next/server";
import { BYPASS_CACHE_HEADERS } from "@/lib/cacheHeaders";
import { recordQuotaUsageEvent } from "@/lib/quotaUsage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TO_EMAIL = "rami.deltoro@gmail.com";
const DEFAULT_FROM_EMAIL = "NutsNews Contact <onboarding@resend.dev>";

const MAX_REQUEST_BYTES = 8_192;
const MAX_EMAIL_LENGTH = 320;
const MAX_MESSAGE_LENGTH = 4000;
const MIN_MESSAGE_LENGTH = 10;
const MAX_TURNSTILE_TOKEN_LENGTH = 2048;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_PRUNE_INTERVAL_MS = 5 * 60 * 1000;

const TURNSTILE_TIMEOUT_MS = 8000;
const RESEND_TIMEOUT_MS = 10000;

const TURNSTILE_VERIFY_URL =
  process.env.TURNSTILE_VERIFY_URL?.trim() ||
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const RESEND_EMAILS_URL =
  process.env.RESEND_EMAILS_URL?.trim() || "https://api.resend.com/emails";

type ContactPayload = {
  email?: unknown;
  message?: unknown;
  website?: unknown;
  turnstileToken?: unknown;
};

type TurnstileResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const contactRateLimitStore = new Map<string, RateLimitEntry>();
let lastRateLimitPruneAt = 0;

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(body, {
    status,
    headers: {
      ...BYPASS_CACHE_HEADERS,
      ...headers,
    },
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRequestIp(request: NextRequest) {
  const cloudflareIp = request.headers.get("cf-connecting-ip");
  if (cloudflareIp) {
    return cloudflareIp.trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "Unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "Unknown";
}

function getAllowedContactOrigins(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const forwardedProto =
    request.headers.get("x-forwarded-proto") ||
    requestUrl.protocol.replace(":", "");
  const forwardedHost =
    request.headers.get("x-forwarded-host") || request.headers.get("host");

  const origins = new Set([
    requestUrl.origin,
    "https://www.nutsnews.com",
    "https://nutsnews.com",
  ]);

  if (forwardedHost) {
    origins.add(`${forwardedProto}://${forwardedHost}`);
  }

  for (const origin of (process.env.NUTSNEWS_ALLOWED_CONTACT_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    origins.add(origin);
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return origins;
}

function isAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  return getAllowedContactOrigins(request).has(origin);
}

function getBodySizeBytes(value: string) {
  return new TextEncoder().encode(value).length;
}

function pruneRateLimitStore(now: number) {
  if (now - lastRateLimitPruneAt < RATE_LIMIT_PRUNE_INTERVAL_MS) {
    return;
  }

  lastRateLimitPruneAt = now;

  for (const [key, entry] of contactRateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      contactRateLimitStore.delete(key);
    }
  }
}

function takeRateLimitSlot(key: string) {
  const now = Date.now();
  pruneRateLimitStore(now);

  const existing = contactRateLimitStore.get(key);
  if (!existing || existing.resetAt <= now) {
    contactRateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  contactRateLimitStore.set(key, existing);

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyTurnstileToken({
  token,
  secret,
  remoteIp,
}: {
  token: string;
  secret: string;
  remoteIp: string;
}) {
  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  formData.append("idempotency_key", crypto.randomUUID());

  if (remoteIp && remoteIp !== "Unknown") {
    formData.append("remoteip", remoteIp);
  }

  let response: Response;

  try {
    response = await fetchWithTimeout(
      TURNSTILE_VERIFY_URL,
      {
        method: "POST",
        body: formData,
      },
      TURNSTILE_TIMEOUT_MS,
    );
  } catch (error) {
    console.error("NutsNews Turnstile verification request failed", error);
    return false;
  }

  if (!response.ok) {
    console.error("NutsNews Turnstile verification request failed", {
      status: response.status,
    });
    return false;
  }

  const result = (await response.json().catch(() => null)) as
    | TurnstileResponse
    | null;

  if (!result?.success) {
    console.warn("NutsNews Turnstile verification rejected", {
      errorCodes: result?.["error-codes"] ?? [],
    });
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return jsonResponse({ error: "This contact request is not allowed." }, 403);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return jsonResponse({ error: "Please submit a valid contact form." }, 415);
  }

  let bodyText = "";
  try {
    bodyText = await request.text();
  } catch {
    return jsonResponse({ error: "Please submit a valid contact form." }, 400);
  }

  if (getBodySizeBytes(bodyText) > MAX_REQUEST_BYTES) {
    return jsonResponse({ error: "The message is too large." }, 413);
  }

  let payload: unknown;

  try {
    payload = JSON.parse(bodyText);
  } catch {
    return jsonResponse({ error: "Please submit a valid contact form." }, 400);
  }

  const form = payload as ContactPayload;
  const email = typeof form.email === "string" ? form.email.trim() : "";
  const message = typeof form.message === "string" ? form.message.trim() : "";
  const website = typeof form.website === "string" ? form.website.trim() : "";
  const turnstileToken =
    typeof form.turnstileToken === "string" ? form.turnstileToken.trim() : "";

  if (website) {
    return jsonResponse({ ok: true });
  }

  if (!email || !isValidEmail(email) || email.length > MAX_EMAIL_LENGTH) {
    return jsonResponse({ error: "Please enter a valid email address." }, 400);
  }

  if (
    !message ||
    message.length < MIN_MESSAGE_LENGTH ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return jsonResponse(
      {
        error: `Please enter a message between ${MIN_MESSAGE_LENGTH} and ${MAX_MESSAGE_LENGTH} characters.`,
      },
      400,
    );
  }

  if (!turnstileToken || turnstileToken.length > MAX_TURNSTILE_TOKEN_LENGTH) {
    return jsonResponse(
      { error: "Please complete the anti-spam check before sending." },
      400,
    );
  }

  const requestIp = getRequestIp(request);
  const rateLimitKey = `${requestIp.toLowerCase()}::${email.toLowerCase()}`;
  const rateLimit = takeRateLimitSlot(rateLimitKey);

  if (!rateLimit.allowed) {
    return jsonResponse(
      { error: "Too many contact messages. Please try again later." },
      429,
      {
        "Retry-After": String(rateLimit.retryAfterSeconds),
      },
    );
  }

  const turnstileSecretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!turnstileSecretKey) {
    return jsonResponse(
      {
        error:
          "The contact form anti-spam check is not configured yet. Please try again later.",
      },
      503,
    );
  }

  const isTurnstileValid = await verifyTurnstileToken({
    token: turnstileToken,
    secret: turnstileSecretKey,
    remoteIp: requestIp,
  });

  if (!isTurnstileValid) {
    return jsonResponse(
      { error: "The anti-spam check failed. Please try again." },
      400,
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  if (!resendApiKey) {
    return jsonResponse(
      { error: "The contact form is not configured yet. Please try again later." },
      503,
    );
  }

  const toEmail = process.env.CONTACT_TO_EMAIL?.trim() || DEFAULT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
  const userAgent = request.headers.get("user-agent") ?? "Unknown";
  const submittedAt = new Date().toISOString();
  const subject = "New NutsNews contact form message";

  const textBody = [
    "New NutsNews contact form message",
    "",
    `From: ${email}`,
    `Submitted at: ${submittedAt}`,
    `IP: ${requestIp}`,
    `User agent: ${userAgent}`,
    "",
    "Message:",
    message,
  ].join("\n");

  const htmlBody = `
    <h1>New NutsNews contact form message</h1>
    <p><strong>From:</strong> ${escapeHtml(email)}</p>
    <p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>
    <p><strong>IP:</strong> ${escapeHtml(requestIp)}</p>
    <p><strong>User agent:</strong> ${escapeHtml(userAgent)}</p>
    <hr />
    <p>${escapeHtml(message).replaceAll("\n", "<br />")}</p>
  `;

  try {
    const resendResponse = await fetchWithTimeout(
      RESEND_EMAILS_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [toEmail],
          reply_to: email,
          subject,
          text: textBody,
          html: htmlBody,
        }),
      },
      RESEND_TIMEOUT_MS,
    );

    if (!resendResponse.ok) {
      const responseText = await resendResponse.text();
      console.error("NutsNews contact form email failed", {
        status: resendResponse.status,
        response: responseText.slice(0, 500),
      });

      return jsonResponse(
        { error: "The message could not be sent. Please try again later." },
        502,
      );
    }

    await recordQuotaUsageEvent({
      eventType: "email_send",
      eventSource: "contact_form",
      provider: "resend",
      quantity: 1,
      metadata: {
        toEmail,
        fromEmail,
      },
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("NutsNews contact form request failed", error);

    return jsonResponse(
      { error: "The message could not be sent. Please try again later." },
      502,
    );
  }
}
