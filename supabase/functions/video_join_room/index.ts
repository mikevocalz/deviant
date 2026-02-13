/**
 * Edge Function: video_join_room
 * Joins a user to a video room and mints a Fishjam token
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JoinRoomSchema = z.object({
  roomId: z.string().uuid(),
});

type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "validation_error"
  | "internal_error";

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

function errorResponse(code: ErrorCode, message: string): Response {
  return jsonResponse({ ok: false, error: { code, message } }, 200);
}

function generateJti(): string {
  return crypto.randomUUID();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("validation_error", "Method not allowed");
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse(
        "unauthorized",
        "Missing or invalid Authorization header",
      );
    }

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const fishjamAppId = Deno.env.get("FISHJAM_APP_ID")!;
    const fishjamApiKey = Deno.env.get("FISHJAM_API_KEY")!;
    const fishjamBaseUrl = `https://fishjam.io/api/v1/connect/${fishjamAppId}`;
    console.log(
      `[video_join_room] Fishjam config: appId=${fishjamAppId}, apiKey=${fishjamApiKey?.slice(0, 8)}..., baseUrl=${fishjamBaseUrl}`,
    );

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
    });

    // Verify Better Auth session via direct DB lookup
    const { data: session, error: sessionError } = await supabase
      .from("session")
      .select("id, token, userId, expiresAt")
      .eq("token", jwt)
      .single();

    if (sessionError || !session) {
      return errorResponse("unauthorized", "Invalid or expired session");
    }
    if (new Date(session.expiresAt) < new Date()) {
      return errorResponse("unauthorized", "Session expired");
    }

    const userId = session.userId;

    // Parse input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body");
    }

    const parsed = JoinRoomSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("validation_error", parsed.error.errors[0].message);
    }

    const { roomId } = parsed.data;

    // Rate limit check
    const { data: canJoin } = await supabase.rpc("check_rate_limit", {
      p_user_id: userId,
      p_action: "join",
      p_room_id: roomId,
      p_max_attempts: 10,
      p_window_seconds: 60,
    });

    if (!canJoin) {
      return errorResponse(
        "rate_limited",
        "Too many join attempts. Try again later.",
      );
    }

    await supabase.rpc("record_rate_limit", {
      p_user_id: userId,
      p_action: "join",
      p_room_id: roomId,
    });

    // Check room exists and is open (lookup by uuid)
    const { data: room, error: roomError } = await supabase
      .from("video_rooms")
      .select("*")
      .eq("uuid", roomId)
      .single();

    if (roomError || !room) {
      return errorResponse("not_found", "Room not found");
    }

    if (room.status !== "open") {
      return errorResponse("conflict", "Room is no longer open");
    }

    const internalRoomId = room.id;

    // Check if user is banned
    const { data: isBanned } = await supabase.rpc("is_user_banned_from_room", {
      p_user_id: userId,
      p_room_id: internalRoomId,
    });

    if (isBanned) {
      return errorResponse("forbidden", "You are banned from this room");
    }

    // Check participant count
    const { data: participantCount } = await supabase.rpc(
      "count_active_participants",
      {
        p_room_id: internalRoomId,
      },
    );

    if (participantCount >= room.max_participants) {
      return errorResponse("conflict", "Room is full");
    }

    // Check existing membership
    const { data: existingMember } = await supabase
      .from("video_room_members")
      .select("*")
      .eq("room_id", internalRoomId)
      .eq("user_id", userId)
      .single();

    let memberRole = "participant";

    if (existingMember) {
      if (existingMember.status === "active") {
        // Already in room, just refresh token
        memberRole = existingMember.role;
      } else if (existingMember.status === "banned") {
        return errorResponse("forbidden", "You are banned from this room");
      } else {
        // Rejoin (was kicked or left)
        const { error: updateError } = await supabase
          .from("video_room_members")
          .update({
            status: "active",
            joined_at: new Date().toISOString(),
            left_at: null,
          })
          .eq("room_id", internalRoomId)
          .eq("user_id", userId);

        if (updateError) {
          console.error("[video_join_room] Rejoin error:", updateError.message);
          return errorResponse("internal_error", "Failed to rejoin room");
        }
        memberRole = existingMember.role;
      }
    } else {
      // New member
      const { error: insertError } = await supabase
        .from("video_room_members")
        .insert({
          room_id: internalRoomId,
          user_id: userId,
          role: "participant",
          status: "active",
        });

      if (insertError) {
        console.error("[video_join_room] Insert error:", insertError.message);
        return errorResponse("internal_error", "Failed to join room");
      }
    }

    // Update participant count
    await supabase
      .rpc("count_active_participants", { p_room_id: internalRoomId })
      .then(async ({ data: count }) => {
        if (count !== null) {
          await supabase
            .from("video_rooms")
            .update({ participant_count: count })
            .eq("id", internalRoomId);
        }
      });

    // Always create a fresh Fishjam room (old rooms may be stale after key rotation)
    let fishjamRoomId: string | null = null;

    {
      // Create Fishjam room
      const fishjamRoomUrl = `${fishjamBaseUrl}/room`;
      console.log(
        "[video_join_room] Creating Fishjam room at:",
        fishjamRoomUrl,
      );
      const createRoomRes = await fetch(fishjamRoomUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${fishjamApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxPeers: room.max_participants,
          videoCodec: "h264",
        }),
      });

      if (!createRoomRes.ok) {
        const errText = await createRoomRes.text();
        console.error(
          "[video_join_room] Fishjam room creation failed:",
          createRoomRes.status,
          errText,
        );
        return errorResponse(
          "internal_error",
          `Fishjam room creation failed (${createRoomRes.status}): ${errText.slice(0, 200)}`,
        );
      }

      const fishjamRoom = await createRoomRes.json();
      fishjamRoomId = fishjamRoom.data.room.id;
      console.log("[video_join_room] Fishjam room created:", fishjamRoomId);

      // Update room with Fishjam ID
      await supabase
        .from("video_rooms")
        .update({ fishjam_room_id: fishjamRoomId })
        .eq("id", internalRoomId);
    }

    // Create peer in Fishjam and get token
    const jti = generateJti();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    let addPeerRes = await fetch(
      `${fishjamBaseUrl}/room/${fishjamRoomId}/peer`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${fishjamApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "webrtc" }),
      },
    );

    // If 404 or 401, the Fishjam room is stale (deleted or key rotated). Create a fresh one and retry.
    if (addPeerRes.status === 404 || addPeerRes.status === 401) {
      console.warn(
        `[video_join_room] Fishjam peer returned ${addPeerRes.status} — recreating room`,
      );
      const freshRes = await fetch(`${fishjamBaseUrl}/room`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${fishjamApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maxPeers: room.max_participants,
          videoCodec: "h264",
        }),
      });
      if (!freshRes.ok) {
        const errText = await freshRes.text();
        return errorResponse(
          "internal_error",
          `Fishjam room re-creation failed: ${errText.slice(0, 200)}`,
        );
      }
      const freshRoom = await freshRes.json();
      fishjamRoomId = freshRoom.data.room.id;
      await supabase
        .from("video_rooms")
        .update({ fishjam_room_id: fishjamRoomId })
        .eq("id", internalRoomId);
      console.log(
        "[video_join_room] Fresh Fishjam room created:",
        fishjamRoomId,
      );

      addPeerRes = await fetch(`${fishjamBaseUrl}/room/${fishjamRoomId}/peer`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${fishjamApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "webrtc" }),
      });
    }

    if (!addPeerRes.ok) {
      const errText = await addPeerRes.text();
      console.error(
        "[video_join_room] Fishjam peer creation failed:",
        addPeerRes.status,
        errText,
      );
      return errorResponse(
        "internal_error",
        `Fishjam peer failed (${addPeerRes.status}): ${errText.slice(0, 200)}`,
      );
    }

    const peerData = await addPeerRes.json();
    const { peer, token: fishjamToken } = peerData.data;

    // Store token for revocation tracking
    const { error: tokenError } = await supabase
      .from("video_room_tokens")
      .insert({
        room_id: internalRoomId,
        user_id: userId,
        token_jti: jti,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error(
        "[video_join_room] Token storage error:",
        tokenError.message,
      );
    }

    // Log event
    await supabase.from("video_room_events").insert({
      room_id: internalRoomId,
      type: "member_joined",
      actor_id: userId,
      payload: { role: memberRole, peerId: peer.id },
    });

    // Get user profile for display
    const { data: profile } = await supabase
      .from("users")
      .select("username, avatar:avatar_id(url)")
      .eq("auth_id", userId)
      .single();

    console.log(`[video_join_room] User ${userId} joined room ${roomId}`);

    return jsonResponse({
      ok: true,
      data: {
        room: {
          id: room.uuid || room.id,
          internalId: room.id,
          title: room.title,
          fishjamRoomId,
        },
        token: fishjamToken,
        peer: {
          id: peer.id,
          role: memberRole,
        },
        user: {
          id: userId,
          username: profile?.username,
          avatar: profile?.avatar?.url,
        },
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[video_join_room] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred");
  }
});
