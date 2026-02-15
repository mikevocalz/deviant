/**
 * Edge Function: create-story
 * Create a new story with media URL (already uploaded to Bunny CDN)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOrProvisionUser } from "../_shared/resolve-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(code: string, message: string): Response {
  console.error(`[Edge:create-story] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, 200);
}

interface CreateStoryBody {
  mediaUrl: string;
  mediaType: "image" | "video";
  visibility?: "public" | "followers" | "close_friends";
  duration?: number;
  thumbnailUrl?: string;
}

Deno.serve(async (req) => {
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
        401,
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse("internal_error", "Server configuration error");
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
    });

    // Verify Better Auth session via direct DB lookup
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from("session")
      .select("id, token, userId, expiresAt")
      .eq("token", token)
      .single();

    if (sessionError || !sessionData) {
      return errorResponse("unauthorized", "Invalid or expired session");
    }
    if (new Date(sessionData.expiresAt) < new Date()) {
      return errorResponse("unauthorized", "Session expired");
    }

    const authUserId = sessionData.userId;

    let body: CreateStoryBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body");
    }

    const { mediaUrl, mediaType, visibility, duration, thumbnailUrl } = body;

    if (!mediaUrl || typeof mediaUrl !== "string") {
      return errorResponse("validation_error", "mediaUrl is required");
    }

    if (!mediaType || !["image", "video"].includes(mediaType)) {
      return errorResponse(
        "validation_error",
        "mediaType must be 'image' or 'video'",
        400,
      );
    }

    // Get user's integer ID (auto-provision if needed)
    const userData = await resolveOrProvisionUser(
      supabaseAdmin,
      authUserId,
      "id, username, first_name, avatar:avatar_id(url)",
    );
    if (!userData) return errorResponse("not_found", "User not found");

    const userId = userData.id;
    console.log("[Edge:create-story] User:", userId);

    // Create media record first
    const { data: mediaRecord, error: mediaError } = await supabaseAdmin
      .from("media")
      .insert({
        url: mediaUrl,
        mime_type: mediaType === "video" ? "video/mp4" : "image/jpeg",
      })
      .select()
      .single();

    if (mediaError) {
      console.error("[Edge:create-story] Media insert error:", mediaError);
      return errorResponse(
        "internal_error",
        "Failed to create media record",
        500,
      );
    }

    // Calculate expiry (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create thumbnail media record if provided (for video stories)
    let thumbnailMediaId: number | null = null;
    if (thumbnailUrl) {
      const { data: thumbRecord, error: thumbError } = await supabaseAdmin
        .from("media")
        .insert({
          url: thumbnailUrl,
          mime_type: "image/jpeg",
        })
        .select()
        .single();

      if (!thumbError && thumbRecord) {
        thumbnailMediaId = thumbRecord.id;
        console.log(
          "[Edge:create-story] Thumbnail media created:",
          thumbnailMediaId,
        );
      }
    }

    // Create story
    const storyInsert: Record<string, unknown> = {
      author_id: authUserId,
      media_id: mediaRecord.id,
      expires_at: expiresAt.toISOString(),
      visibility: visibility || "public",
    };
    if (thumbnailMediaId) {
      storyInsert.thumbnail_id = thumbnailMediaId;
    }

    const { data: story, error: storyError } = await supabaseAdmin
      .from("stories")
      .insert(storyInsert)
      .select()
      .single();

    if (storyError) {
      console.error("[Edge:create-story] Story insert error:", storyError);
      return errorResponse("internal_error", "Failed to create story");
    }

    console.log("[Edge:create-story] Story created:", story.id);

    return jsonResponse({
      ok: true,
      data: {
        story: {
          id: String(story.id),
          authorId: String(userId),
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          expiresAt: story.expires_at,
          visibility: story.visibility,
          createdAt: story.created_at,
          author: {
            id: String(userData.id),
            username: userData.username,
            name: userData.first_name || userData.username,
            avatar: (userData.avatar as any)?.url || null,
          },
        },
      },
    });
  } catch (err) {
    console.error("[Edge:create-story] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred");
  }
});
