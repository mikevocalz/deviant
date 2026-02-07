/**
 * Edge Function: send-message
 * Send a message in a conversation with Better Auth verification
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

function errorResponse(code: string, message: string, status = 400): Response {
  console.error(`[Edge:send-message] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, status);
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
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("validation_error", "Method not allowed", 405);
  }

  try {
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
      return errorResponse("internal_error", "Server configuration error", 500);
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const session = await verifyBetterAuthSession(token, supabaseAdmin);
    if (!session) {
      return errorResponse("unauthorized", "Invalid or expired session", 401);
    }

    const { odUserId } = session;

    let body: {
      conversationId: number;
      content: string;
      mediaUrl?: string;
      metadata?: Record<string, unknown>;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
    }

    const { conversationId, content, mediaUrl, metadata } = body;
    if (!conversationId || typeof conversationId !== "number") {
      return errorResponse(
        "validation_error",
        "conversationId is required",
        400,
      );
    }
    if (
      (!content ||
        typeof content !== "string" ||
        content.trim().length === 0) &&
      !mediaUrl
    ) {
      return errorResponse(
        "validation_error",
        "content or mediaUrl is required",
        400,
      );
    }

    // Get user's integer ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("auth_id", odUserId)
      .single();

    if (userError || !userData) {
      return errorResponse("not_found", "User not found", 404);
    }

    const userId = userData.id;

    // Verify user is a member of the conversation
    // conversations_rels.users_id is TEXT (auth_id), not integer
    const { data: membership } = await supabaseAdmin
      .from("conversations_rels")
      .select("id")
      .eq("parent_id", conversationId)
      .eq("users_id", odUserId)
      .single();

    if (!membership) {
      return errorResponse(
        "forbidden",
        "You are not a member of this conversation",
        403,
      );
    }

    console.log(
      "[Edge:send-message] User:",
      userId,
      "Conversation:",
      conversationId,
    );

    // Insert message with optional metadata (e.g. story reply context, media)
    const mergedMetadata: Record<string, unknown> = {
      ...(metadata && typeof metadata === "object" ? metadata : {}),
    };
    if (mediaUrl && typeof mediaUrl === "string") {
      mergedMetadata.mediaUrl = mediaUrl;
      mergedMetadata.mediaType = mediaUrl.match(/\.(mp4|mov|webm)$/i)
        ? "video"
        : "image";
    }

    const insertPayload: Record<string, unknown> = {
      conversation_id: conversationId,
      sender_id: userId,
      content: (content || "").trim() || (mediaUrl ? "📷 Photo" : ""),
    };
    if (Object.keys(mergedMetadata).length > 0) {
      insertPayload.metadata = mergedMetadata;
    }

    const { data: message, error: insertError } = await supabaseAdmin
      .from("messages")
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error("[Edge:send-message] Insert error:", insertError);
      return errorResponse("internal_error", "Failed to send message", 500);
    }

    // Update conversation's last_message_at
    await supabaseAdmin
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    console.log("[Edge:send-message] Message sent:", message.id);

    return jsonResponse({
      ok: true,
      data: {
        message: {
          id: String(message.id),
          conversationId: String(message.conversation_id),
          senderId: String(message.sender_id),
          content: message.content,
          metadata: message.metadata || null,
          createdAt: message.created_at,
          read: message.read || false,
        },
      },
    });
  } catch (err) {
    console.error("[Edge:send-message] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
