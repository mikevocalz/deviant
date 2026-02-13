/**
 * Edge Function: react-message
 * Toggle emoji reaction on a message (stored in metadata JSONB)
 * Uses service_role to bypass RLS on messages table
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
  console.error(`[Edge:react-message] Error: ${code} - ${message}`);
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("unauthorized", "Missing authorization token");
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });

    // Verify session
    const session = await verifyBetterAuthSession(token, supabaseAdmin);
    if (!session) {
      return errorResponse("unauthorized", "Invalid or expired session");
    }

    const { messageId, emoji } = await req.json();
    if (!messageId || !emoji) {
      return errorResponse("bad_request", "messageId and emoji are required");
    }

    // Look up the user's integer ID and username from users table
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id, username, auth_id")
      .eq("auth_id", session.odUserId)
      .single();

    if (!userRow) {
      return errorResponse("not_found", "User not found");
    }

    const userId = session.odUserId; // Use auth_id as the reaction userId for consistency
    const username = userRow.username || "user";

    // Fetch current metadata
    const { data: msg, error: fetchError } = await supabaseAdmin
      .from("messages")
      .select("metadata")
      .eq("id", messageId)
      .single();

    if (fetchError || !msg) {
      return errorResponse("not_found", "Message not found");
    }

    const meta = msg.metadata || {};
    const reactions: Array<{ emoji: string; userId: string; username: string }> =
      Array.isArray(meta.reactions) ? [...meta.reactions] : [];

    // Toggle: remove if already reacted with same emoji, otherwise add
    const existingIdx = reactions.findIndex(
      (r) => r.emoji === emoji && r.userId === userId,
    );

    if (existingIdx >= 0) {
      reactions.splice(existingIdx, 1);
    } else {
      reactions.push({ emoji, userId, username });
    }

    // Update metadata with new reactions
    const { error: updateError } = await supabaseAdmin
      .from("messages")
      .update({ metadata: { ...meta, reactions } })
      .eq("id", messageId);

    if (updateError) {
      console.error("[Edge:react-message] Update error:", updateError);
      return errorResponse("update_failed", updateError.message);
    }

    console.log(`[Edge:react-message] ${existingIdx >= 0 ? "Removed" : "Added"} ${emoji} on message ${messageId} by ${username}`);

    return jsonResponse({
      ok: true,
      data: { reactions, toggled: existingIdx >= 0 ? "removed" : "added" },
    });
  } catch (err: any) {
    console.error("[Edge:react-message] Unexpected error:", err);
    return errorResponse("internal_error", err.message || "Internal error");
  }
});
