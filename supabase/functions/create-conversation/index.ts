/**
 * Edge Function: create-conversation
 * Create or get a direct conversation with Better Auth verification
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

async function verifyBetterAuthSession(token: string): Promise<{ odUserId: string } | null> {
  const betterAuthUrl = Deno.env.get("BETTER_AUTH_BASE_URL");
  if (!betterAuthUrl) return null;
  try {
    const response = await fetch(`${betterAuthUrl}/api/auth/get-session`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.user?.id) return null;
    return { odUserId: data.user.id };
  } catch { return null; }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("validation_error", "Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("unauthorized", "Missing or invalid Authorization header", 401);

    const token = authHeader.replace("Bearer ", "");
    const session = await verifyBetterAuthSession(token);
    if (!session) return errorResponse("unauthorized", "Invalid or expired session", 401);

    let body: { otherUserId: number };
    try { body = await req.json(); } catch { return errorResponse("validation_error", "Invalid JSON body", 400); }

    const { otherUserId } = body;
    if (!otherUserId) return errorResponse("validation_error", "otherUserId is required", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) return errorResponse("internal_error", "Server configuration error", 500);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData } = await supabaseAdmin.from("users").select("id").eq("auth_id", session.odUserId).single();
    if (!userData) return errorResponse("not_found", "User not found", 404);

    const userId = userData.id;

    // Check if conversation exists
    const { data: userConvs } = await supabaseAdmin
      .from("conversations_rels")
      .select("parent_id")
      .eq("users_id", userId);

    const { data: otherConvs } = await supabaseAdmin
      .from("conversations_rels")
      .select("parent_id")
      .eq("users_id", otherUserId);

    const userConvIds = (userConvs || []).map((c: any) => c.parent_id);
    const otherConvIds = (otherConvs || []).map((c: any) => c.parent_id);
    const commonConvIds = userConvIds.filter((id: number) => otherConvIds.includes(id));

    // Check if any common conversation is a direct (non-group) conversation
    for (const convId of commonConvIds) {
      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .select("id, is_group")
        .eq("id", convId)
        .single();
      
      if (conv && !conv.is_group) {
        return jsonResponse({ ok: true, data: { conversationId: String(conv.id), isNew: false } });
      }
    }

    // Create new conversation
    const { data: newConv, error: convError } = await supabaseAdmin
      .from("conversations")
      .insert({ is_group: false, last_message_at: new Date().toISOString() })
      .select()
      .single();

    if (convError) return errorResponse("internal_error", "Failed to create conversation", 500);

    // Add participants
    await supabaseAdmin.from("conversations_rels").insert([
      { parent_id: newConv.id, users_id: userId },
      { parent_id: newConv.id, users_id: otherUserId },
    ]);

    return jsonResponse({ ok: true, data: { conversationId: String(newConv.id), isNew: true } });
  } catch (err) {
    console.error("[Edge:create-conversation] Error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
