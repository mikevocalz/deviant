/**
 * Shared Resend email helper for edge functions.
 *
 * Centralises the RESEND_API_KEY / RESEND_FROM_EMAIL env read, the POST
 * to api.resend.com, and the brand-styled HTML wrapper. Call it from any
 * edge fn that needs to send a transactional email (guest tickets,
 * receipts, confirmations, etc).
 *
 *   await sendResendEmail({
 *     to: "you@example.com",
 *     subject: "...",
 *     html: brandEmailWrapper(`<h1>...</h1>...`),
 *   });
 *
 * Returns the Resend message id. Throws on non-2xx.
 * Logs and returns null if RESEND_API_KEY isn't configured — so a
 * misconfigured dev env doesn't crash downstream flows.
 */

const APP_NAME = "DVNT";
const TAGLINE = "Where nightlife meets culture";

export interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  /** Optional from override (defaults to RESEND_FROM_EMAIL). */
  from?: string;
}

/**
 * Wrap raw HTML body in the project's dark brand shell — viewport meta,
 * centered 520px container, muted footer. Same visual language as
 * supabase/functions/send-email/index.ts:baseWrapper().
 */
export function brandEmailWrapper(content: string): string {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:0;background:#000;font-family:-apple-system,Segoe UI,Roboto,sans-serif">',
    '<div style="max-width:520px;margin:0 auto;padding:32px 20px">',
    content,
    '<hr style="border:none;border-top:1px solid #27272a;margin:32px 0"/>',
    `<p style="color:#52525b;font-size:12px;text-align:center">${APP_NAME} · ${TAGLINE}</p>`,
    "</div></body></html>",
  ].join("");
}

export async function sendResendEmail(
  args: SendEmailArgs,
): Promise<string | null> {
  const apiKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!apiKey) {
    console.warn("[send-resend-email] RESEND_API_KEY missing — skipping send");
    return null;
  }
  const from =
    args.from ||
    Deno.env.get("RESEND_FROM_EMAIL") ||
    `${APP_NAME} <onboarding@resend.dev>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
  const json = await res.json().catch(() => ({}));
  return typeof json.id === "string" ? json.id : null;
}
