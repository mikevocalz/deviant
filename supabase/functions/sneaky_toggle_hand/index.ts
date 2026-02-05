/**
 * Edge Function: sneaky_toggle_hand
 * Raises or lowers hand in a Sneaky Lynk room
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ToggleHandSchema = z.object({
  roomId: z.string().uuid(),
  raised: z.boolean(),
});

type ErrorCode = "unauthorized" | "forbidden" | "not_found" | "validation_error" | "internal_error";

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

    const userId = user.id;

    // Parse input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
    }

    const parsed = ToggleHandSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("validation_error", parsed.error.errors[0].message, 400);
    }

    const { roomId, raised } = parsed.data;

    // Check membership is active
    const { data: member, error: memberError } = await supabase
      .from("sneaky_room_members")
      .select("status")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (memberError || !member) {
      return errorResponse("forbidden", "You are not a member of this room", 403);
    }

    if (member.status !== "active") {
      return errorResponse("forbidden", "You are not active in this room", 403);
    }

    // Insert event for realtime subscription
    await supabase.from("sneaky_room_events").insert({
      room_id: roomId,
      type: raised ? "hand_raised" : "hand_lowered",
      actor_id: userId,
      payload: { raised },
    });

    console.log(`[sneaky_toggle_hand] User ${userId} ${raised ? "raised" : "lowered"} hand in room ${roomId}`);

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error("[sneaky_toggle_hand] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
