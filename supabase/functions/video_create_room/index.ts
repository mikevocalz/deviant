/**
 * Edge Function: video_create_room
 * Creates a new video room and assigns the creator as host
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

const CreateRoomSchema = z.object({
  title: z.string().min(1).max(100),
  isPublic: z.boolean().default(false),
  maxParticipants: z.number().int().min(2).max(50).default(10),
});

type ErrorCode =
  | "unauthorized"
  | "forbidden"
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
      console.error("[video_create_room] Auth error: no valid session");
      return errorResponse("unauthorized", "Invalid or expired session");
    }
    if (new Date(session.expiresAt) < new Date()) {
      return errorResponse("unauthorized", "Session expired");
    }

    const userId = session.userId;

    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body");
    }

    const parsed = CreateRoomSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("validation_error", parsed.error.errors[0].message);
    }

    const { title, isPublic, maxParticipants } = parsed.data;

    // Rate limit check
    const { data: canCreate } = await supabase.rpc("check_rate_limit", {
      p_user_id: userId,
      p_action: "create",
      p_room_id: null,
      p_max_attempts: 5,
      p_window_seconds: 300,
    });

    if (!canCreate) {
      return errorResponse(
        "rate_limited",
        "Too many room creations. Try again later.",
      );
    }

    // Record rate limit attempt
    await supabase.rpc("record_rate_limit", {
      p_user_id: userId,
      p_action: "create",
      p_room_id: null,
    });

    // Create room — always generate a uuid so video_join_room can look it up
    const roomUuid = crypto.randomUUID();
    const { data: room, error: roomError } = await supabase
      .from("video_rooms")
      .insert({
        created_by: userId,
        title,
        is_public: isPublic,
        max_participants: maxParticipants,
        status: "open",
        uuid: roomUuid,
      })
      .select()
      .single();

    if (roomError) {
      console.error(
        "[video_create_room] Room creation error:",
        JSON.stringify(roomError),
      );
      return errorResponse("internal_error", "Failed to create room");
    }

    // Add creator as host
    const { error: memberError } = await supabase
      .from("video_room_members")
      .insert({
        room_id: room.id,
        user_id: userId,
        role: "host",
        status: "active",
      });

    if (memberError) {
      console.error(
        "[video_create_room] Member creation error:",
        memberError.message,
      );
      // Cleanup room on failure
      await supabase.from("video_rooms").delete().eq("id", room.id);
      return errorResponse("internal_error", "Failed to add host to room");
    }

    // Log event
    await supabase.from("video_room_events").insert({
      room_id: room.id,
      type: "room_created",
      actor_id: userId,
      payload: { title, isPublic, maxParticipants },
    });

    console.log(
      `[video_create_room] Room created: ${room.id} by user ${userId}`,
    );

    return jsonResponse({
      ok: true,
      data: {
        room: {
          id: roomUuid,
          internalId: room.id,
          title: room.title,
          isPublic: room.is_public,
          maxParticipants: room.max_participants,
          status: room.status,
          createdAt: room.created_at,
        },
      },
    });
  } catch (err) {
    console.error("[video_create_room] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred");
  }
});
