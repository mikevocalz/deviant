/**
 * Edge Function: send-email
 *
 * Centralized transactional email delivery via Resend.
 * Supports templates: welcome, confirm-email, reset-password.
 *
 * ALL transactional email in the app MUST go through this function.
 * Do NOT send email inline from client code or other edge functions.
 *
 * Required Deno env vars:
 *   RESEND_API_KEY        — Resend API token (re_...)
 *   RESEND_FROM_EMAIL     — Verified sender (e.g. DVNT <noreply@dvnt.app>)
 *   BETTER_AUTH_BASE_URL  — Better Auth server for session verification
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Types ───────────────────────────────────────────────────────────────────

type TemplateType = "welcome" | "confirm-email" | "reset-password";

interface SendEmailRequest {
  template: TemplateType;
  to: string;
  /** Dynamic data merged into the template */
  data?: {
    name?: string;
    url?: string;
    /** Token for confirm/reset links (alternative to full url) */
    token?: string;
  };
}

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string, status = 400): Response {
  console.error(`[Edge:send-email] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

// ─── Email Templates ─────────────────────────────────────────────────────────

const APP_NAME = "DVNT";
const BRAND_COLOR = "#6366f1";
const APP_SCHEME = "dvnt";

function baseWrapper(content: string): string {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    "<body style=\"margin:0;padding:0;background:#000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif\">",
    '<div style="max-width:480px;margin:0 auto;padding:40px 24px">',
    content,
    '<hr style="border:none;border-top:1px solid #27272a;margin:32px 0"/>',
    `<p style="color:#52525b;font-size:12px;text-align:center">${APP_NAME} &mdash; Where nightlife meets culture</p>`,
    "</div></body></html>",
  ].join("");
}

function ctaButton(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin:24px 0;padding:14px 28px;background:${BRAND_COLOR};color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:16px">${text}</a>`;
}

function buildWelcomeEmail(name: string): { subject: string; html: string } {
  return {
    subject: `Welcome to ${APP_NAME}!`,
    html: baseWrapper(
      [
        `<h1 style="color:#fff;margin:0 0 8px;font-size:28px">Welcome to ${APP_NAME} 🎉</h1>`,
        `<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Hey ${name || "there"},</p>`,
        '<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Your account is live. You\'re now part of the community where nightlife meets culture.</p>',
        '<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Here\'s what you can do:</p>',
        '<ul style="color:#a1a1aa;line-height:2;font-size:15px;padding-left:20px">',
        "<li>Discover events happening near you</li>",
        "<li>Share stories and connect with your crew</li>",
        "<li>Get exclusive access to VIP experiences</li>",
        "</ul>",
        ctaButton("Open DVNT", `${APP_SCHEME}://`),
      ].join(""),
    ),
  };
}

function buildConfirmEmail(
  name: string,
  url: string,
): { subject: string; html: string } {
  return {
    subject: `Confirm your ${APP_NAME} email`,
    html: baseWrapper(
      [
        '<h1 style="color:#fff;margin:0 0 8px;font-size:28px">Confirm Your Email</h1>',
        `<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Hey ${name || "there"},</p>`,
        '<p style="color:#a1a1aa;line-height:1.6;font-size:16px">Tap the button below to verify your email address. This link expires in 24 hours.</p>',
        ctaButton("Confirm Email", url),
        '<p style="color:#71717a;font-size:13px">If you didn\u2019t create an account, you can safely ignore this email.</p>',
        `<p style="color:#3f3f46;font-size:12px;word-break:break-all">Or copy this link: ${url}</p>`,
      ].join(""),
    ),
  };
}

function buildResetPasswordEmail(url: string): {
  subject: string;
  html: string;
} {
  return {
    subject: `Reset your ${APP_NAME} password`,
    html: baseWrapper(
      [
        '<h1 style="color:#fff;margin:0 0 8px;font-size:28px">Reset Your Password</h1>',
        '<p style="color:#a1a1aa;line-height:1.6;font-size:16px">We received a request to reset your password. Tap the button below to choose a new one. This link expires in 1 hour.</p>',
        ctaButton("Reset Password", url),
        '<p style="color:#71717a;font-size:13px">If you didn\u2019t request this, you can safely ignore this email.</p>',
        `<p style="color:#3f3f46;font-size:12px;word-break:break-all">Or copy this link: ${url}</p>`,
      ].join(""),
    ),
  };
}

// ─── Auth verification (optional — for authenticated callers) ────────────────

async function verifyBetterAuthSession(
  token: string,
): Promise<{ userId: string; email: string } | null> {
  const betterAuthUrl = Deno.env.get("BETTER_AUTH_BASE_URL");
  if (!betterAuthUrl) return null;

  try {
    const response = await fetch(`${betterAuthUrl}/api/auth/get-session`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.user?.id) return null;
    return { userId: data.user.id, email: data.user.email || "" };
  } catch {
    return null;
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("validation_error", "Method not allowed", 405);
  }

  try {
    // Validate env
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail =
      Deno.env.get("RESEND_FROM_EMAIL") || "DVNT <onboarding@resend.dev>";

    if (!resendApiKey) {
      return errorResponse(
        "internal_error",
        "RESEND_API_KEY not configured",
        500,
      );
    }

    // Parse body
    let body: SendEmailRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
    }

    const { template, to, data } = body;

    if (!template || !to) {
      return errorResponse(
        "validation_error",
        "template and to are required",
        400,
      );
    }

    if (!["welcome", "confirm-email", "reset-password"].includes(template)) {
      return errorResponse(
        "validation_error",
        `Unknown template: ${template}`,
        400,
      );
    }

    console.log(`[Edge:send-email] Sending ${template} email to ${to}`);

    // Build email content based on template
    let subject: string;
    let html: string;

    switch (template) {
      case "welcome": {
        const email = buildWelcomeEmail(data?.name || "");
        subject = email.subject;
        html = email.html;
        break;
      }
      case "confirm-email": {
        const url = data?.url || "";
        if (!url) {
          return errorResponse(
            "validation_error",
            "data.url is required for confirm-email template",
            400,
          );
        }
        const email = buildConfirmEmail(data?.name || "", url);
        subject = email.subject;
        html = email.html;
        break;
      }
      case "reset-password": {
        const url = data?.url || "";
        if (!url) {
          return errorResponse(
            "validation_error",
            "data.url is required for reset-password template",
            400,
          );
        }
        const email = buildResetPasswordEmail(url);
        subject = email.subject;
        html = email.html;
        break;
      }
      default:
        return errorResponse("validation_error", "Unknown template", 400);
    }

    // Send via Resend REST API (no npm import needed in Deno)
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errBody = await resendResponse.text();
      console.error(
        `[Edge:send-email] Resend API error (${resendResponse.status}):`,
        errBody,
      );
      return errorResponse(
        "email_delivery_failed",
        `Resend API returned ${resendResponse.status}`,
        502,
      );
    }

    const resendData = await resendResponse.json();
    console.log(
      `[Edge:send-email] ✓ ${template} email sent to ${to}, id: ${resendData.id}`,
    );

    return jsonResponse({
      ok: true,
      data: { messageId: resendData.id, template },
    });
  } catch (err) {
    console.error("[Edge:send-email] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
