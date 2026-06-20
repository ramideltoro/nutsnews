import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TO_EMAIL = "rami.deltoro@gmail.com";
const DEFAULT_FROM_EMAIL = "NutsNews Contact <onboarding@resend.dev>";
const MAX_MESSAGE_LENGTH = 4000;
const MIN_MESSAGE_LENGTH = 10;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "Unknown";
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "Unknown"
  );
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Please submit a valid contact form." },
      { status: 400 },
    );
  }

  const form = payload as {
    email?: unknown;
    message?: unknown;
    website?: unknown;
  };

  const email = typeof form.email === "string" ? form.email.trim() : "";
  const message = typeof form.message === "string" ? form.message.trim() : "";
  const website = typeof form.website === "string" ? form.website.trim() : "";

  if (website) {
    return NextResponse.json({ ok: true });
  }

  if (!email || !isValidEmail(email) || email.length > 320) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  if (
    !message ||
    message.length < MIN_MESSAGE_LENGTH ||
    message.length > MAX_MESSAGE_LENGTH
  ) {
    return NextResponse.json(
      {
        error: `Please enter a message between ${MIN_MESSAGE_LENGTH} and ${MAX_MESSAGE_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (!resendApiKey) {
    return NextResponse.json(
      {
        error:
          "The contact form is not configured yet. Please try again later.",
      },
      { status: 503 },
    );
  }

  const toEmail = process.env.CONTACT_TO_EMAIL?.trim() || DEFAULT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL?.trim() || DEFAULT_FROM_EMAIL;
  const requestIp = getRequestIp(request);
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
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #171717;">
      <h1 style="font-size: 20px; margin-bottom: 16px;">New NutsNews contact form message</h1>
      <p><strong>From:</strong> ${escapeHtml(email)}</p>
      <p><strong>Submitted at:</strong> ${escapeHtml(submittedAt)}</p>
      <p><strong>IP:</strong> ${escapeHtml(requestIp)}</p>
      <p><strong>User agent:</strong> ${escapeHtml(userAgent)}</p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
      <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
    </div>
  `;

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
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
    });

    if (!resendResponse.ok) {
      const responseText = await resendResponse.text();
      console.error("NutsNews contact form email failed", {
        status: resendResponse.status,
        response: responseText.slice(0, 500),
      });

      return NextResponse.json(
        { error: "The message could not be sent. Please try again later." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("NutsNews contact form request failed", error);

    return NextResponse.json(
      { error: "The message could not be sent. Please try again later." },
      { status: 502 },
    );
  }
}
