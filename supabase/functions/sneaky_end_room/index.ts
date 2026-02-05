/**
 * Edge Function: sneaky_end_room
 * Ends a Sneaky Lynk room (host only)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EndRoomSchema = z.object({
  roomId: z.string().uuid(),
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

    const parsed = EndRoomSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("validation_error", parsed.error.errors[0].message, 400);
    }

    const { roomId } = parsed.data;

    // Check room exists
    const { data: room, error: roomError } = await supabase
      .from("sneaky_rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return errorResponse("not_found", "Room not found", 404);
    }

    if (room.status === "ended") {
      return errorResponse("conflict", "Room has already ended", 409);
    }

    // Check actor is host
    const { data: actorMember } = await supabase
      .from("sneaky_room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", actorId)
      .single();

    if (!actorMember || actorMember.role !== "host") {
      return errorResponse("forbidden", "Only the host can end the room", 403);
    }

    // Update room status
    const { error: updateError } = await supabase
      .from("sneaky_rooms")
      .update({
        status: "ended",
        is_live: false,
        ended_at: new Date().toISOString(),
      })
      .eq("id", roomId);

    if (updateError) {
      console.error("[sneaky_end_room] Update error:", updateError.message);
      return errorResponse("internal_error", "Failed to end room", 500);
    }

    // Update all active members to left
    await supabase
      .from("sneaky_room_members")
      .update({ status: "left", left_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("status", "active");

    // Revoke all tokens
    await supabase
      .from("sneaky_room_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .is("revoked_at", null);

    // Insert room_ended event for realtime subscription
    await supabase.from("sneaky_room_events").insert({
      room_id: roomId,
      type: "room_ended",
      actor_id: actorId,
      payload: {},
    });

    console.log(`[sneaky_end_room] Room ${roomId} ended by ${actorId}`);

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("[sneaky_end_room] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
