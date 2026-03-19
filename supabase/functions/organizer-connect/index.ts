/**
 * Organizer Connect Edge Function
 *
 * POST /organizer-connect  { action: "start" | "status", host_id }
 *
 * - "start": Create Stripe Express account + return onboarding link
 * - "status": Retrieve + sync account status
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifySession } from "../_shared/verify-session.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
// HTTPS base URL for Stripe return/refresh callbacks (custom schemes are rejected)
const FUNCTION_BASE = `${SUPABASE_URL}/functions/v1/organizer-connect`;

// ── Stripe helpers ──────────────────────────────────────────

async function stripeRequest(
  endpoint: string,
  body: Record<string, string>,
): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json();
  if (data.error) {
    console.error(
      "[organizer-connect] Stripe API error:",
      JSON.stringify(data.error),
    );
    throw new Error(data.error.message);
  }
  return data;
}

async function stripeGet(endpoint: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

// ── Callback HTML pages (served on GET for Stripe redirects) ─

const RETURN_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Setup Complete</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.c{text-align:center;padding:24px}h1{font-size:22px;margin-bottom:8px}p{color:#9ca3af;font-size:15px;line-height:1.5}</style>
</head><body><div class="c"><h1>&#10003; Setup Complete</h1><p>You can close this window and return to DVNT.</p></div></body></html>`;

const REFRESH_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Link Expired</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.c{text-align:center;padding:24px}h1{font-size:22px;margin-bottom:8px}p{color:#9ca3af;font-size:15px;line-height:1.5}</style>
</head><body><div class="c"><h1>Link Expired</h1><p>Please close this window and tap Continue Setup again.</p></div></body></html>`;

// ── JSON response helper ────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, apikey, x-client-info, x-auth-token",
      },
    });
  }

  // ── GET: Stripe callback landing pages ────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const callback = url.searchParams.get("callback");
    if (callback === "return") {
      return new Response(RETURN_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    if (callback === "refresh") {
      return new Response(REFRESH_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } },
    });

    // ── Session auth (mandatory) ──────────────────────────
    const host_id = await verifySession(supabase, req);
    if (!host_id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — invalid or expired session" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const { action } = await req.json();

    if (action === "start") {
      // Step 1: Check if account already exists
      console.log(
        "[organizer-connect] start: checking existing account for",
        host_id,
      );
      const { data: existing, error: dbErr } = await supabase
        .from("organizer_accounts")
        .select("stripe_account_id")
        .eq("host_id", host_id)
        .maybeSingle();

      if (dbErr && dbErr.code !== "PGRST116") {
        console.error("[organizer-connect] DB lookup error:", dbErr);
      }

      let stripeAccountId = existing?.stripe_account_id;

      if (!stripeAccountId) {
        // Step 2: Create new Express account
        console.log("[organizer-connect] creating Stripe Express account");
        const account = await stripeRequest("/accounts", {
          type: "express",
          "capabilities[card_payments][requested]": "true",
          "capabilities[transfers][requested]": "true",
          "metadata[dvnt_host_id]": host_id,
        });
        stripeAccountId = account.id;
        console.log(
          "[organizer-connect] Stripe account created:",
          stripeAccountId,
        );

        // Step 3: Save to DB
        const { error: upsertErr } = await supabase
          .from("organizer_accounts")
          .upsert(
            {
              host_id,
              stripe_account_id: stripeAccountId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "host_id", ignoreDuplicates: true },
          );
        if (upsertErr) {
          console.error("[organizer-connect] DB upsert error:", upsertErr);
        }

        // Re-read in case another request won the race
        const { data: recheck } = await supabase
          .from("organizer_accounts")
          .select("stripe_account_id")
          .eq("host_id", host_id)
          .maybeSingle();
        if (recheck?.stripe_account_id) {
          stripeAccountId = recheck.stripe_account_id;
        }
      }

      // Step 4: Create onboarding link
      console.log(
        "[organizer-connect] creating account link for",
        stripeAccountId,
      );
      const link = await stripeRequest("/account_links", {
        account: stripeAccountId,
        refresh_url: `${FUNCTION_BASE}?callback=refresh`,
        return_url: `${FUNCTION_BASE}?callback=return`,
        type: "account_onboarding",
      });

      console.log(
        "[organizer-connect] account link created, url prefix:",
        typeof link.url === "string"
          ? link.url.substring(0, 50)
          : String(link.url),
      );

      if (
        !link.url ||
        typeof link.url !== "string" ||
        !link.url.startsWith("https://")
      ) {
        console.error("[organizer-connect] Invalid URL from Stripe:", link.url);
        return json({ error: "Stripe returned an invalid onboarding URL" });
      }

      return json({ url: link.url, account_id: stripeAccountId });
    }

    if (action === "status") {
      const { data: account } = await supabase
        .from("organizer_accounts")
        .select("*")
        .eq("host_id", host_id)
        .maybeSingle();

      if (!account?.stripe_account_id) {
        return json({ connected: false });
      }

      // Fetch from Stripe to get latest status
      const stripeAccount = await stripeGet(
        `/accounts/${account.stripe_account_id}`,
      );

      // Sync to DB
      await supabase
        .from("organizer_accounts")
        .update({
          charges_enabled: stripeAccount.charges_enabled,
          payouts_enabled: stripeAccount.payouts_enabled,
          details_submitted: stripeAccount.details_submitted,
          updated_at: new Date().toISOString(),
        })
        .eq("host_id", host_id);

      return json({
        connected: true,
        charges_enabled: stripeAccount.charges_enabled,
        payouts_enabled: stripeAccount.payouts_enabled,
        details_submitted: stripeAccount.details_submitted,
        stripe_account_id: account.stripe_account_id,
        pending_verification: stripeAccount.requirements?.currently_due || [],
      });
    }

    return json({ error: "Invalid action" });
  } catch (err: any) {
    console.error("[organizer-connect] Error:", err);
    return json({ error: err.message || "Internal error" });
  }
});
