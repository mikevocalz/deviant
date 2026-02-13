/**
 * Edge Function: create-conversation
 * Create or get a direct conversation with Better Auth verification
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

async function verifyBetterAuthSession(
  token: string,
  supabaseAdmin: any,
): Promise<{ odUserId: string; email: string } | null> {
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
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const session = await verifyBetterAuthSession(token, supabaseAdmin);
    if (!session)
      return errorResponse("unauthorized", "Invalid or expired session");

    let body: { otherUserId: number };
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body");
    }

    const { otherUserId } = body;
    if (!otherUserId)
      return errorResponse("validation_error", "otherUserId is required");

    // Get current user's auth_id
    const myAuthId = session.odUserId;

    // Get other user's auth_id from their integer ID
    const { data: otherUser } = await supabaseAdmin
      .from("users")
      .select("auth_id")
      .eq("id", otherUserId)
      .single();

    if (!otherUser?.auth_id)
      return errorResponse("not_found", "Other user not found");
    const otherAuthId = otherUser.auth_id;

    // Check if conversation exists
    // conversations_rels.users_id is TEXT (auth_id)
    const { data: userConvs } = await supabaseAdmin
      .from("conversations_rels")
      .select("parent_id")
      .eq("users_id", myAuthId);

    const { data: otherConvs } = await supabaseAdmin
      .from("conversations_rels")
      .select("parent_id")
      .eq("users_id", otherAuthId);

    const userConvIds = (userConvs || []).map((c: any) => c.parent_id);
    const otherConvIds = (otherConvs || []).map((c: any) => c.parent_id);
    const commonConvIds = userConvIds.filter((id: number) =>
      otherConvIds.includes(id),
    );

    // Check if any common conversation is a direct (non-group) conversation
    for (const convId of commonConvIds) {
      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .select("id, is_group")
        .eq("id", convId)
        .single();

      if (conv && !conv.is_group) {
        return jsonResponse({
          ok: true,
          data: { conversationId: String(conv.id), isNew: false },
        });
      }
    }

    // Create new conversation
    const { data: newConv, error: convError } = await supabaseAdmin
      .from("conversations")
      .insert({ is_group: false, last_message_at: new Date().toISOString() })
      .select()
      .single();

    if (convError)
      return errorResponse(
        "internal_error",
        "Failed to create conversation",
        500,
      );

    // Add participants (users_id is TEXT/auth_id)
    await supabaseAdmin.from("conversations_rels").insert([
      { parent_id: newConv.id, users_id: myAuthId, path: "participants" },
      { parent_id: newConv.id, users_id: otherAuthId, path: "participants" },
    ]);

    return jsonResponse({
      ok: true,
      data: { conversationId: String(newConv.id), isNew: true },
    });
  } catch (err) {
    console.error("[Edge:create-conversation] Error:", err);
    return errorResponse("internal_error", "An unexpected error occurred");
  }
});
