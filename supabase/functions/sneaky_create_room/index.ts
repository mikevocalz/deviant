/**
 * Edge Function: sneaky_create_room
 * Creates a new Sneaky Lynk room and assigns the creator as host
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CreateRoomSchema = z.object({
  title: z.string().min(1).max(100),
  topic: z.string().min(1).max(50).default("Community"),
  description: z.string().max(500).default(""),
  hasVideo: z.boolean().default(false),
  isPublic: z.boolean().default(true),
  maxParticipants: z.number().int().min(2).max(100).default(50),
});

type ErrorCode = "unauthorized" | "forbidden" | "rate_limited" | "validation_error" | "internal_error";

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
      console.error("[sneaky_create_room] Auth error:", authError?.message);
      return errorResponse("unauthorized", "Invalid token", 401);
    }

    const userId = user.id;

    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
    }

    const parsed = CreateRoomSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("validation_error", parsed.error.errors[0].message, 400);
    }

    const { title, topic, description, hasVideo, isPublic, maxParticipants } = parsed.data;

    // Rate limit check
    const { data: canCreate } = await supabase.rpc("check_sneaky_rate_limit", {
      p_user_id: userId,
      p_action: "create",
      p_room_id: null,
      p_max_attempts: 5,
      p_window_seconds: 300,
    });

    if (!canCreate) {
      return errorResponse("rate_limited", "Too many room creations. Try again later.", 429);
    }

    // Record rate limit attempt
    await supabase.rpc("record_sneaky_rate_limit", {
      p_user_id: userId,
      p_action: "create",
      p_room_id: null,
    });

    // Create room
    const { data: room, error: roomError } = await supabase
      .from("sneaky_rooms")
      .insert({
        created_by: userId,
        title,
        topic,
        description,
        has_video: hasVideo,
        is_public: isPublic,
        max_participants: maxParticipants,
        is_live: true,
        status: "open",
      })
      .select()
      .single();

    if (roomError) {
      console.error("[sneaky_create_room] Room creation error:", roomError.message);
      return errorResponse("internal_error", "Failed to create room", 500);
    }

    // Add creator as host
    const { error: memberError } = await supabase
      .from("sneaky_room_members")
      .insert({
        room_id: room.id,
        user_id: userId,
        role: "host",
        status: "active",
      });

    if (memberError) {
      console.error("[sneaky_create_room] Member creation error:", memberError.message);
      // Cleanup room on failure
      await supabase.from("sneaky_rooms").delete().eq("id", room.id);
      return errorResponse("internal_error", "Failed to add host to room", 500);
    }

    // Log event
    await supabase.from("sneaky_room_events").insert({
      room_id: room.id,
      type: "room_created",
      actor_id: userId,
      payload: { title, topic, hasVideo, isPublic, maxParticipants },
    });

    console.log(`[sneaky_create_room] Room created: ${room.id} by user ${userId}`);

    return jsonResponse({
      ok: true,
      data: {
        room: {
          id: room.id,
          title: room.title,
          topic: room.topic,
          description: room.description,
          hasVideo: room.has_video,
          isPublic: room.is_public,
          maxParticipants: room.max_participants,
          status: room.status,
          createdAt: room.created_at,
        },
      },
    });
  } catch (err) {
    console.error("[sneaky_create_room] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
