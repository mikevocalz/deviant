/**
 * Edge Function: sneaky_ban_user
 * Bans a user from a Sneaky Lynk room (host/moderator only)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BanUserSchema = z.object({
  roomId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  reason: z.string().max(200).optional(),
  expiresAt: z.string().datetime().optional(), // null = permanent
});

type ErrorCode = "unauthorized" | "forbidden" | "not_found" | "conflict" | "validation_error" | "internal_error";

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: ErrorCode; message: string };
}

function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(code: ErrorCode, message: string, status = 400): Response {
  return jsonResponse({ ok: false, error: { code, message } }, status);
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
      return errorResponse("unauthorized", "Missing or invalid Authorization header", 401);
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    if (authError || !user) {
      return errorResponse("unauthorized", "Invalid token", 401);
    }

    const actorId = user.id;

    // Parse input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
    }

    const parsed = BanUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("validation_error", parsed.error.errors[0].message, 400);
    }

    const { roomId, targetUserId, reason, expiresAt } = parsed.data;

    // Check room exists
    const { data: room, error: roomError } = await supabase
      .from("sneaky_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return errorResponse("not_found", "Room not found", 404);
    }

    // Check actor is host or moderator
    const { data: actorMember } = await supabase
      .from("sneaky_room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", actorId)
      .single();

    if (!actorMember || !["host", "moderator"].includes(actorMember.role)) {
      return errorResponse("forbidden", "You don't have permission to ban users", 403);
    }

    // Check target exists
    const { data: targetMember } = await supabase
      .from("sneaky_room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", targetUserId)
      .single();

    // Can't ban host
    if (targetMember?.role === "host") {
      return errorResponse("forbidden", "Cannot ban the host", 403);
    }

    // Moderators can't ban other moderators
    if (actorMember.role === "moderator" && targetMember?.role === "moderator") {
      return errorResponse("forbidden", "Moderators cannot ban other moderators", 403);
    }

    // Insert ban record
    const { error: banError } = await supabase.from("sneaky_room_bans").insert({
      room_id: roomId,
      user_id: targetUserId,
      banned_by: actorId,
      reason,
      expires_at: expiresAt || null,
    });

    if (banError) {
      console.error("[sneaky_ban_user] Ban insert error:", banError.message);
      return errorResponse("internal_error", "Failed to ban user", 500);
    }

    // Update member status to banned (if they're a member)
    if (targetMember) {
      await supabase
        .from("sneaky_room_members")
        .update({ status: "banned", left_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .eq("user_id", targetUserId);
    }

    // Revoke all tokens for target user
    await supabase.rpc("revoke_sneaky_user_tokens", {
      p_user_id: targetUserId,
      p_room_id: roomId,
    });

    // Insert eject event for realtime subscription
    await supabase.from("sneaky_room_events").insert({
      room_id: roomId,
      type: "eject",
      actor_id: actorId,
      target_id: targetUserId,
      payload: { action: "ban", reason },
    });

    console.log(`[sneaky_ban_user] User ${targetUserId} banned from room ${roomId} by ${actorId}`);

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("[sneaky_ban_user] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
