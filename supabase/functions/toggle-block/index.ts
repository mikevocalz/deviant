/**
 * Edge Function: toggle-block
 * Block/unblock a user with Better Auth verification
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

function errorResponse(code: string, message: string): Response {
  return jsonResponse({ ok: false, error: { code, message } }, 200);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST")
    return errorResponse("validation_error", "Method not allowed");

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return errorResponse(
        "unauthorized",
        "Missing or invalid Authorization header",
        401,
      );

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

    let body: { targetUserId: number };
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body");
    }

    const { targetUserId } = body;
    if (!targetUserId)
      return errorResponse("validation_error", "targetUserId is required");

    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", authUserId)
      .single();
    if (!userData) return errorResponse("not_found", "User not found");

    if (userData.id === targetUserId)
      return errorResponse("validation_error", "Cannot block yourself");

    // Check if already blocked
    const { data: existingBlock } = await supabaseAdmin
      .from("blocks")
      .select("id")
      .eq("blocker_id", userData.id)
      .eq("blocked_id", targetUserId)
      .single();

    let blocked: boolean;

    if (existingBlock) {
      // Unblock
      await supabaseAdmin.from("blocks").delete().eq("id", existingBlock.id);
      blocked = false;
    } else {
      // Block
      await supabaseAdmin
        .from("blocks")
        .insert({ blocker_id: userData.id, blocked_id: targetUserId });
      blocked = true;
    }

    return jsonResponse({ ok: true, data: { blocked } });
  } catch (err) {
    console.error("[Edge:toggle-block] Error:", err);
    return errorResponse("internal_error", "An unexpected error occurred");
  }
});
