/**
 * Edge Function: update-avatar
 * Update user avatar with Better Auth verification
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

function errorResponse(code: string, message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

async function verifyBetterAuthSession(token: string, supabaseAdmin: any): Promise<{ odUserId: string; email: string } | null> {
  try {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("session")
      .select("id, token, userId, expiresAt")
      .eq("token", token)
      .single();

    if (sessionError || !session) return null;
    if (new Date(session.expiresAt) < new Date()) return null;

    const { data: user, error: userError } = await supabaseAdmin
      .from("user")
      .select("id, email, name")
      .eq("id", session.userId)
      .single();

    if (userError || !user) return null;
    return { odUserId: user.id, email: user.email || "" };
  } catch {
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("validation_error", "Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("unauthorized", "Missing or invalid Authorization header", 401);

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse("internal_error", "Server configuration error", 500);
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const session = await verifyBetterAuthSession(token, supabaseAdmin);
    if (!session) return errorResponse("unauthorized", "Invalid or expired session", 401);

    let body: { avatarUrl: string };
    try { body = await req.json(); } catch { return errorResponse("validation_error", "Invalid JSON body", 400); }

    const { avatarUrl } = body;
    if (!avatarUrl) return errorResponse("validation_error", "avatarUrl is required", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) return errorResponse("internal_error", "Server configuration error", 500);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData } = await supabaseAdmin.from("users").select("id").eq("auth_id", session.odUserId).single();
    if (!userData) return errorResponse("not_found", "User not found", 404);

    // Create media record
    const { data: mediaData, error: mediaError } = await supabaseAdmin
      .from("media")
      .insert({ url: avatarUrl, owner_id: userData.id })
      .select("id")
      .single();

    if (mediaError) return errorResponse("internal_error", "Failed to create media record", 500);

    // Update user avatar
    const { error } = await supabaseAdmin
      .from("users")
      .update({ avatar_id: mediaData.id })
      .eq("id", userData.id);

    if (error) return errorResponse("internal_error", "Failed to update avatar", 500);

    return jsonResponse({ ok: true, data: { success: true, avatarUrl } });
  } catch (err) {
    console.error("[Edge:update-avatar] Error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
