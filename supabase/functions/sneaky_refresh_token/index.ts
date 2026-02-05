/**
 * Edge Function: sneaky_refresh_token
 * Refreshes a Fishjam token for an active room member
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RefreshTokenSchema = z.object({
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

function generateJti(): string {
  return crypto.randomUUID();
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
    const fishjamUrl = Deno.env.get("FISHJAM_URL")!;
    const fishjamApiKey = Deno.env.get("FISHJAM_API_KEY")!;

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

    const parsed = RefreshTokenSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("validation_error", parsed.error.errors[0].message, 400);
    }

    const { roomId } = parsed.data;

    // Check room exists and is open
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

    // Check membership is active
    const { data: member, error: memberError } = await supabase
      .from("sneaky_room_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (memberError || !member) {
      return errorResponse("forbidden", "You are not a member of this room", 403);
    }

    if (member.status !== "active") {
      return errorResponse("forbidden", `You have been ${member.status} from this room`, 403);
    }

    // Revoke old tokens
    await supabase.rpc("revoke_sneaky_user_tokens", {
      p_user_id: userId,
      p_room_id: roomId,
    });

    // Create new peer token in Fishjam
    const jti = generateJti();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const addPeerRes = await fetch(`${fishjamUrl}/room/${room.fishjam_room_id}/peer`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${fishjamApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "webrtc",
        options: {
          enableSimulcast: true,
        },
        metadata: {
          userId,
          role: member.role,
          jti,
        },
      }),
    });

    if (!addPeerRes.ok) {
      const errText = await addPeerRes.text();
      console.error("[sneaky_refresh_token] Fishjam peer creation failed:", errText);
      return errorResponse("internal_error", "Failed to refresh token", 500);
    }

    const peerData = await addPeerRes.json();
    const { token: fishjamToken } = peerData.data;

    // Store new token
    await supabase.from("sneaky_room_tokens").insert({
      room_id: roomId,
      user_id: userId,
      token_jti: jti,
      expires_at: expiresAt.toISOString(),
    });

    console.log(`[sneaky_refresh_token] Token refreshed for user ${userId} in room ${roomId}`);

    return jsonResponse({
      ok: true,
      data: {
        token: fishjamToken,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[sneaky_refresh_token] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
