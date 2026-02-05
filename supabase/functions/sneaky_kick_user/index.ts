/**
 * Edge Function: sneaky_kick_user
 * Kicks a user from a Sneaky Lynk room (host/moderator only)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const KickUserSchema = z.object({
  roomId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  reason: z.string().max(200).optional(),
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

    const parsed = KickUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("validation_error", parsed.error.errors[0].message, 400);
    }

    const { roomId, targetUserId, reason } = parsed.data;

    // Check room exists
    const { data: room, error: roomError } = await supabase
      .from("sneaky_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return errorResponse("not_found", "Room not found", 404);
    }

    if (room.status !== "open") {
      return errorResponse("conflict", "Room is no longer open", 409);
    }

    // Check actor is host or moderator
    const { data: actorMember } = await supabase
      .from("sneaky_room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", actorId)
      .single();

    if (!actorMember || !["host", "moderator"].includes(actorMember.role)) {
      return errorResponse("forbidden", "You don't have permission to kick users", 403);
    }

    // Check target exists and is active
    const { data: targetMember } = await supabase
      .from("sneaky_room_members")
      .select("role, status")
      .eq("room_id", roomId)
      .eq("user_id", targetUserId)
      .single();

    if (!targetMember) {
      return errorResponse("not_found", "User not found in room", 404);
    }

    if (targetMember.status !== "active") {
      return errorResponse("conflict", "User is not active in room", 409);
    }

    // Can't kick host
    if (targetMember.role === "host") {
      return errorResponse("forbidden", "Cannot kick the host", 403);
    }

    // Moderators can't kick other moderators
    if (actorMember.role === "moderator" && targetMember.role === "moderator") {
      return errorResponse("forbidden", "Moderators cannot kick other moderators", 403);
    }

    // Update member status to kicked
    const { error: updateError } = await supabase
      .from("sneaky_room_members")
      .update({ status: "kicked", left_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("user_id", targetUserId);

    if (updateError) {
      console.error("[sneaky_kick_user] Update error:", updateError.message);
      return errorResponse("internal_error", "Failed to kick user", 500);
    }

    // Record kick
    await supabase.from("sneaky_room_kicks").insert({
      room_id: roomId,
      user_id: targetUserId,
      kicked_by: actorId,
      reason,
    });

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
      payload: { action: "kick", reason },
    });

    console.log(`[sneaky_kick_user] User ${targetUserId} kicked from room ${roomId} by ${actorId}`);

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("[sneaky_kick_user] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
