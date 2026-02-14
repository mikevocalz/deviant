/**
 * Edge Function: ticket_wallet_apple
 * Generates or retrieves a short-lived .pkpass URL for Apple Wallet.
 *
 * Flow:
 * 1. Verify authenticated user via Better Auth session.
 * 2. Validate user owns the ticket.
 * 3. Generate or retrieve .pkpass (signed server-side).
 * 4. Return a short-lived HTTPS URL to the .pkpass file.
 *
 * NOTE: Actual .pkpass signing requires Apple WWDR certificate + pass type certificate.
 * These must be stored as Supabase secrets (APPLE_PASS_CERT, APPLE_PASS_KEY, APPLE_WWDR_CERT).
 * This function provides the scaffold — signing logic must be completed with real certs.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(
  code: string,
  message: string,
  status = 400,
): Response {
  console.error(`[Edge:ticket_wallet_apple] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, 200);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("validation_error", "Method not allowed");
  }

  try {
    // 1. Authenticate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(
        "unauthorized",
        "Missing or invalid Authorization header",
        401,
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse("internal_error", "Server configuration error");
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
    });

    // Verify Better Auth session via direct DB lookup
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from("session")
      .select("id, token, userId, expiresAt")
      .eq("token", token)
      .single();

    if (sessionError || !sessionData) {
      return errorResponse("unauthorized", "Invalid or expired session");
    }
    if (new Date(sessionData.expiresAt) < new Date()) {
      return errorResponse("unauthorized", "Session expired");
    }

    const authUserId = sessionData.userId;
    console.log(
      "[Edge:ticket_wallet_apple] Authenticated user auth_id:",
      authUserId,
    );

    // 2. Parse body
    let body: { ticketId: string; eventId: string };
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body");
    }

    const { ticketId, eventId } = body;
    if (!ticketId || !eventId) {
      return errorResponse(
        "validation_error",
        "ticketId and eventId are required",
        400,
      );
    }

    // 3. Verify ticket ownership via Supabase

    // Get user's integer ID from auth_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authUserId)
      .single();

    if (userError || !userData) {
      return errorResponse("not_found", "User not found");
    }

    // TODO: Verify ticket exists in tickets table and belongs to this user
    // const { data: ticketData, error: ticketError } = await supabaseAdmin
    //   .from("tickets")
    //   .select("*")
    //   .eq("id", ticketId)
    //   .eq("user_id", userData.id)
    //   .single();
    //
    // if (ticketError || !ticketData) {
    //   return errorResponse("not_found", "Ticket not found or not owned by user");
    // }
    //
    // if (ticketData.status !== "valid") {
    //   return errorResponse("invalid_ticket", "Ticket is not valid");
    // }

    // 4. Generate .pkpass
    // TODO: Implement actual .pkpass generation with Apple certificates
    // Required secrets: APPLE_PASS_CERT, APPLE_PASS_KEY, APPLE_WWDR_CERT, APPLE_PASS_TYPE_ID, APPLE_TEAM_ID
    //
    // Steps:
    // a. Build pass.json with event details, QR barcode, tier styling
    // b. Create manifest.json with SHA1 hashes of all pass files
    // c. Sign manifest with Apple certificates using PKCS#7
    // d. Package as .pkpass (ZIP)
    // e. Upload to Supabase Storage with short-lived signed URL
    //
    // For now, return a placeholder indicating setup is needed:

    const applePassCert = Deno.env.get("APPLE_PASS_CERT");
    if (!applePassCert) {
      return errorResponse(
        "not_configured",
        "Apple Wallet pass signing is not yet configured. Add APPLE_PASS_CERT, APPLE_PASS_KEY, APPLE_WWDR_CERT secrets.",
        501,
      );
    }

    // When implemented, this would return:
    // const { data: signedUrl } = await supabaseAdmin.storage
    //   .from("wallet-passes")
    //   .createSignedUrl(`apple/${ticketId}.pkpass`, 300); // 5 min expiry
    //
    // return jsonResponse({
    //   ok: true,
    //   data: { pkpassUrl: signedUrl.signedUrl },
    // });

    return errorResponse(
      "not_implemented",
      "Apple Wallet pass generation pending certificate setup",
      501,
    );
  } catch (err) {
    console.error("[Edge:ticket_wallet_apple] Unexpected error:", err);
    return errorResponse(
      "internal_error",
      "An unexpected error occurred",
      500,
    );
  }
});
