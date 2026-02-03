/**
 * Edge Function: video_refresh_token
 * Refreshes a Fishjam token for an active room member
 * Only allowed if: membership active, not banned, no kick/ban since last token, token not revoked
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
  currentJti: z.string().optional(), // Current token JTI for validation
});

type ErrorCode = "unauthorized" | "forbidden" | "not_found" | "conflict" | "rate_limited" | "validation_error" | "internal_error";

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

    const { roomId, currentJti } = parsed.data;

    // Rate limit check
    const { data: canRefresh } = await supabase.rpc("check_rate_limit", {
      p_user_id: userId,
      p_action: "token_refresh",
      p_room_id: roomId,
      p_max_attempts: 30,
      p_window_seconds: 60,
    });

    if (!canRefresh) {
      return errorResponse("rate_limited", "Too many refresh attempts. Try again later.", 429);
    }

    await supabase.rpc("record_rate_limit", {
      p_user_id: userId,
      p_action: "token_refresh",
      p_room_id: roomId,
    });

    // Check room exists and is open
    const { data: room, error: roomError } = await supabase
      .from("video_rooms")
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
    const { data: member } = await supabase
      .from("video_room_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (!member || member.status !== "active") {
      return errorResponse("forbidden", "You are not an active member of this room", 403);
    }

    // Check if user is banned
    const { data: isBanned } = await supabase.rpc("is_user_banned_from_room", {
      p_user_id: userId,
      p_room_id: roomId,
    });

    if (isBanned) {
      return errorResponse("forbidden", "You are banned from this room", 403);
    }

    // If currentJti provided, check it's not revoked
    if (currentJti) {
      const { data: existingToken } = await supabase
        .from("video_room_tokens")
        .select("*")
        .eq("token_jti", currentJti)
        .eq("user_id", userId)
        .single();

      if (existingToken?.revoked_at) {
        return errorResponse("forbidden", "Your session has been revoked", 403);
      }
    }

    // Check for any kick/ban events since last token
    const { data: recentKickBan } = await supabase
      .from("video_room_events")
      .select("*")
      .eq("room_id", roomId)
      .eq("target_id", userId)
      .in("type", ["member_kicked", "member_banned", "eject"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recentKickBan) {
      // Check if this event is newer than the user's current active token
      const { data: latestToken } = await supabase
        .from("video_room_tokens")
        .select("*")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .is("revoked_at", null)
        .order("issued_at", { ascending: false })
        .limit(1)
        .single();

      if (latestToken && new Date(recentKickBan.created_at) > new Date(latestToken.issued_at)) {
        return errorResponse("forbidden", "Your session has been terminated", 403);
      }
    }

    // Revoke old tokens
    await supabase
      .from("video_room_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .is("revoked_at", null);

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
      console.error("[video_refresh_token] Fishjam peer creation failed:", errText);
      return errorResponse("internal_error", "Failed to refresh token", 500);
    }

    const peerData = await addPeerRes.json();
    const { peer, token: fishjamToken } = peerData.data;

    // Store new token
    await supabase.from("video_room_tokens").insert({
      room_id: roomId,
      user_id: userId,
      token_jti: jti,
      expires_at: expiresAt.toISOString(),
    });

    // Log event
    await supabase.from("video_room_events").insert({
      room_id: roomId,
      type: "token_issued",
      actor_id: userId,
      payload: { jti, peerId: peer.id },
    });

    console.log(`[video_refresh_token] Token refreshed for user ${userId} in room ${roomId}`);

    return jsonResponse({
      ok: true,
      data: {
        token: fishjamToken,
        peer: {
          id: peer.id,
          role: member.role,
        },
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[video_refresh_token] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
