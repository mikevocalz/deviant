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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

async function verifyBetterAuthSession(
  token: string,
): Promise<{ odUserId: string; email: string } | null> {
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
    return { odUserId: data.user.id, email: data.user.email || "" };
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("validation_error", "Method not allowed", 405);
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
    const session = await verifyBetterAuthSession(token);
    if (!session) {
      return errorResponse("unauthorized", "Invalid or expired session", 401);
    }

    const { odUserId } = session;
    console.log(
      "[Edge:ticket_wallet_apple] Authenticated user auth_id:",
      odUserId,
    );

    // 2. Parse body
    let body: { ticketId: string; eventId: string };
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse(
        "internal_error",
        "Server configuration error",
        500,
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's integer ID from auth_id
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", odUserId)
      .single();

    if (userError || !userData) {
      return errorResponse("not_found", "User not found", 404);
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
    //   return errorResponse("not_found", "Ticket not found or not owned by user", 404);
    // }
    //
    // if (ticketData.status !== "valid") {
    //   return errorResponse("invalid_ticket", "Ticket is not valid", 400);
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
