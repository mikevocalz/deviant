/**
 * Edge Function: create-story
 * Create a new story with media URL (already uploaded to Bunny CDN)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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

function errorResponse(code: string, message: string, status = 400): Response {
  console.error(`[Edge:create-story] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

async function verifyBetterAuthSession(
  token: string,
  supabaseAdmin: any,
): Promise<{ odUserId: string; email: string } | null> {
  try {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("session")
      .select("id, token, userId, expiresAt")
      .eq("token", token)
      .single();

    if (sessionError || !session) return null;
    if (new Date(session.expiresAt) < new Date()) return null;

    const { data: user, error: userError } = await supabaseAdmin
      .from("user")
      .select("id, email, name")
      .eq("id", session.userId)
      .single();

    if (userError || !user) return null;
    return { odUserId: user.id, email: user.email || "" };
  } catch {
    return null;
  }
}

interface CreateStoryBody {
  mediaUrl: string;
  mediaType: "image" | "video";
  visibility?: "public" | "followers" | "close_friends";
  duration?: number;
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
      return errorResponse("internal_error", "Server configuration error", 500);
    }
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const session = await verifyBetterAuthSession(token, supabaseAdmin);
    if (!session) {
      return errorResponse("unauthorized", "Invalid or expired session", 401);
    }

    const { odUserId } = session;

    let body: CreateStoryBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
    }

    const { mediaUrl, mediaType, visibility, duration } = body;

    if (!mediaUrl || typeof mediaUrl !== "string") {
      return errorResponse("validation_error", "mediaUrl is required", 400);
    }

    if (!mediaType || !["image", "video"].includes(mediaType)) {
      return errorResponse(
        "validation_error",
        "mediaType must be 'image' or 'video'",
        400,
      );
    }

    // Get user's integer ID
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, username, first_name, avatar:avatar_id(url)")
      .eq("auth_id", odUserId)
      .single();

    if (userError || !userData) {
      return errorResponse("not_found", "User not found", 404);
    }

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

    // Create story
    const { data: story, error: storyError } = await supabaseAdmin
      .from("stories")
      .insert({
        author_id: odUserId,
        media_id: mediaRecord.id,
        expires_at: expiresAt.toISOString(),
        visibility: visibility || "public",
      })
      .select()
      .single();

    if (storyError) {
      console.error("[Edge:create-story] Story insert error:", storyError);
      return errorResponse("internal_error", "Failed to create story", 500);
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
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
