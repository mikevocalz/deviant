/**
 * Organizer Connect Edge Function
 *
 * POST /organizer-connect  { action: "start" | "status", host_id }
 *
 * - "start": Create Stripe Express account + return onboarding link
 * - "status": Retrieve + sync account status
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const APP_SCHEME = "dvnt";

async function stripeRequest(endpoint: string, body: Record<string, string>): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  return res.json();
}

async function stripeGet(endpoint: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { action, host_id } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (action === "start") {
      // Check if account already exists
      const { data: existing } = await supabase
        .from("organizer_accounts")
        .select("stripe_account_id")
        .eq("host_id", host_id)
        .single();

      let stripeAccountId = existing?.stripe_account_id;

      if (!stripeAccountId) {
        // Create new Express account
        const account = await stripeRequest("/accounts", {
          type: "express",
          "capabilities[card_payments][requested]": "true",
          "capabilities[transfers][requested]": "true",
          "metadata[dvnt_host_id]": host_id,
        });
        stripeAccountId = account.id;

        // Save to DB
        await supabase.from("organizer_accounts").upsert({
          host_id,
          stripe_account_id: stripeAccountId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Create onboarding link
      const link = await stripeRequest("/account_links", {
        account: stripeAccountId,
        refresh_url: `${APP_SCHEME}://organizer/connect?refresh=true`,
        return_url: `${APP_SCHEME}://organizer/connect?success=true`,
        type: "account_onboarding",
      });

      return new Response(
        JSON.stringify({ url: link.url, account_id: stripeAccountId }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (action === "status") {
      const { data: account } = await supabase
        .from("organizer_accounts")
        .select("*")
        .eq("host_id", host_id)
        .single();

      if (!account?.stripe_account_id) {
        return new Response(
          JSON.stringify({ connected: false }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // Fetch from Stripe to get latest status
      const stripeAccount = await stripeGet(`/accounts/${account.stripe_account_id}`);

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

      return new Response(
        JSON.stringify({
          connected: true,
          charges_enabled: stripeAccount.charges_enabled,
          payouts_enabled: stripeAccount.payouts_enabled,
          details_submitted: stripeAccount.details_submitted,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[organizer-connect] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
