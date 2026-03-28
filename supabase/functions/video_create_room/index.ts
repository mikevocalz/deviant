/**
 * Edge Function: video_create_room
 * Creates a new video room and assigns the creator as host
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CreateRoomSchema = z.object({
  title: z.string().min(1).max(100),
  topic: z.string().max(280).default(""),
  description: z.string().max(500).default(""),
  hasVideo: z.boolean().default(false),
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

function isMissingColumnError(error: unknown, column: string): boolean {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  return (
    message.includes(`Could not find the '${column}' column`) ||
    message.includes(`column "${column}"`) ||
    message.includes(`'${column}'`)
  );
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

Deno.serve(async (req) => {
  console.log("[video_create_room] Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("validation_error", "Method not allowed");
  }

  try {
    const authHeader = req.headers.get("Authorization");
    console.log("[video_create_room] Auth header present:", !!authHeader);

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
    console.log("[video_create_room] Looking up session...");
    const { data: session, error: sessionError } = await supabase
      .from("session")
      .select("id, token, userId, expiresAt")
      .eq("token", jwt)
      .single();

    if (sessionError || !session) {
      console.error(
        "[video_create_room] Auth error: no valid session",
        sessionError,
      );
      return errorResponse("unauthorized", "Invalid or expired session");
    }
    console.log("[video_create_room] Session found, userId:", session.userId);

    if (new Date(session.expiresAt) < new Date()) {
      return errorResponse("unauthorized", "Session expired");
    }

    const userId = session.userId;

    // Parse and validate input
    let body: unknown;
    try {
      body = await req.json();
      console.log("[video_create_room] Request body:", JSON.stringify(body));
    } catch {
      return errorResponse("validation_error", "Invalid JSON body");
    }

    const parsed = CreateRoomSchema.safeParse(body);
    if (!parsed.success) {
      console.error(
        "[video_create_room] Validation error:",
        parsed.error.errors,
      );
      return errorResponse("validation_error", parsed.error.errors[0].message);
    }

    const { title, topic, description, hasVideo, isPublic } = parsed.data;
    let { maxParticipants } = parsed.data;
    console.log("[video_create_room] Parsed data:", {
      title,
      isPublic,
      maxParticipants,
    });

    // ── Subscription-aware participant cap ────────────────────
    console.log("[video_create_room] Checking subscription...");
    const { data: userSub, error: subError } = await supabase
      .from("sneaky_subscriptions")
      .select("plan_id, status, grace_period_ends_at")
      .eq("host_id", userId)
      .maybeSingle();

    if (subError) {
      console.error(
        "[video_create_room] Subscription lookup error:",
        subError.message,
      );
    } else {
      console.log("[video_create_room] Subscription found:", !!userSub);
    }

    // Determine effective plan limits
    let planMaxParticipants = 7; // free tier default
    if (userSub) {
      console.log("[video_create_room] Subscription status:", userSub.status);
      const isGraceExpired =
        userSub.status === "past_due" &&
        userSub.grace_period_ends_at &&
        new Date(userSub.grace_period_ends_at) < new Date();

      if (isGraceExpired) {
        planMaxParticipants = 7;
        console.log(
          `[video_create_room] Grace period expired for ${userId}, enforcing free limits`,
        );
      } else if (
        userSub.status === "active" ||
        userSub.status === "trialing" ||
        userSub.status === "past_due"
      ) {
        const { data: plan, error: planError } = await supabase
          .from("sneaky_subscription_plans")
          .select("max_participants")
          .eq("id", userSub.plan_id)
          .single();
        if (planError) {
          console.error(
            "[video_create_room] Plan lookup error:",
            planError.message,
          );
        }
        if (plan) {
          planMaxParticipants = plan.max_participants;
          console.log(
            "[video_create_room] Plan max participants:",
            planMaxParticipants,
          );
        }
      }
    }

    // Cap requested participants to plan limit
    if (maxParticipants > planMaxParticipants) {
      maxParticipants = planMaxParticipants;
    }
    console.log("[video_create_room] Final max participants:", maxParticipants);

    // Rate limit check
    console.log("[video_create_room] Checking rate limit...");
    const { data: canCreate, error: rateError } = await supabase.rpc(
      "check_rate_limit",
      {
        p_user_id: userId,
        p_action: "create",
        p_room_id: null,
        p_max_attempts: 5,
        p_window_seconds: 300,
      },
    );

    if (rateError) {
      console.error(
        "[video_create_room] Rate limit check error:",
        rateError.message,
      );
    }

    if (!canCreate) {
      return errorResponse(
        "rate_limited",
        "Too many room creations. Try again later.",
      );
    }

    // Record rate limit attempt
    const { error: recordError } = await supabase.rpc("record_rate_limit", {
      p_user_id: userId,
      p_action: "create",
      p_room_id: null,
    });
    if (recordError) {
      console.error(
        "[video_create_room] Record rate limit error:",
        recordError.message,
      );
    }

    // Create room
    console.log("[video_create_room] Creating room...");
    const roomUuid = crypto.randomUUID();
    const roomInsert = {
      created_by: userId,
      title,
      topic,
      description,
      sweet_spicy_mode: "sweet",
      has_video: hasVideo,
      is_public: isPublic,
      max_participants: maxParticipants,
      participant_count: 1,
      status: "open",
      uuid: roomUuid,
    };

    let roomQuery = supabase.from("video_rooms").insert(roomInsert).select();
    let { data: room, error: roomError } = await roomQuery.single();

    if (roomError && isMissingColumnError(roomError, "participant_count")) {
      console.warn(
        "[video_create_room] participant_count missing on video_rooms, retrying without it",
      );
      const fallbackInsert = { ...roomInsert };
      delete (fallbackInsert as { participant_count?: number })
        .participant_count;
      roomQuery = supabase.from("video_rooms").insert(fallbackInsert).select();
      const retry = await roomQuery.single();
      room = retry.data;
      roomError = retry.error;
    }

    if (roomError) {
      console.error(
        "[video_create_room] Room creation error:",
        JSON.stringify(roomError),
      );
      return errorResponse("internal_error", "Failed to create room");
    }
    console.log("[video_create_room] Room created:", room.id);

    // Add creator as host
    console.log("[video_create_room] Adding creator as host...");
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
      await supabase.from("video_rooms").delete().eq("id", room.id);
      return errorResponse("internal_error", "Failed to add host to room");
    }
    console.log("[video_create_room] Host added");

    // Log event
    await supabase.from("video_room_events").insert({
      room_id: room.id,
      type: "room_created",
      actor_id: userId,
      payload: { title, topic, hasVideo, isPublic, maxParticipants },
    });

    console.log(`[video_create_room] Room created successfully: ${room.id}`);

    return jsonResponse({
      ok: true,
      data: {
        room: {
          id: roomUuid,
          internalId: room.id,
          title: room.title,
          topic: room.topic || "",
          description: room.description || "",
          sweetSpicyMode: room.sweet_spicy_mode || "sweet",
          hasVideo: room.has_video || false,
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
