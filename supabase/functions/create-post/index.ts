/**
 * Edge Function: create-post
 * Create a new post with media URLs (already uploaded to Bunny CDN)
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
  console.error(`[Edge:create-post] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, 200);
}

interface MediaItem {
  type: "image" | "video";
  url: string;
}

interface CreatePostBody {
  content?: string;
  location?: string;
  isNSFW?: boolean;
  visibility?: "public" | "followers" | "private";
  media?: MediaItem[];
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

    let body: CreatePostBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body");
    }

    const { content, location, isNSFW, visibility, media } = body;

    // Media is REQUIRED — this is a media-first app
    if (!media || !Array.isArray(media) || media.length === 0) {
      return errorResponse(
        "validation_error",
        "Post must include at least one photo or video",
        400,
      );
    }

    // Validate each media item has a valid URL
    for (const m of media) {
      if (!m.url || typeof m.url !== "string" || !m.url.startsWith("http")) {
        return errorResponse(
          "validation_error",
          "Each media item must have a valid URL",
          400,
        );
      }
      if (!["image", "video"].includes(m.type)) {
        return errorResponse(
          "validation_error",
          "Each media item must have type 'image' or 'video'",
          400,
        );
      }
    }

    // Get user's integer ID and profile info (auto-provision if needed)
    const userData = await resolveOrProvisionUser(
      supabaseAdmin,
      authUserId,
      "id, username, first_name, avatar:avatar_id(url)",
    );
    if (!userData) return errorResponse("not_found", "User not found");

    const userId = userData.id;
    console.log("[Edge:create-post] User:", userId);

    // Insert post
    const { data: post, error: postError } = await supabaseAdmin
      .from("posts")
      .insert({
        author_id: userId,
        content: content?.trim() || "",
        location: location || null,
        is_nsfw: isNSFW || false,
        visibility: visibility || "public",
        likes_count: 0,
        comments_count: 0,
      })
      .select()
      .single();

    if (postError) {
      console.error("[Edge:create-post] Insert error:", postError);
      return errorResponse("internal_error", "Failed to create post");
    }

    console.log("[Edge:create-post] Post created:", post.id);

    // Insert media if provided
    if (media && media.length > 0) {
      const mediaInserts: Array<Record<string, unknown>> = [];
      media.forEach((m: any, index: number) => {
        mediaInserts.push({
          _parent_id: post.id,
          type: m.type,
          url: m.url,
          _order: index,
          id: `${post.id}_${index}`,
        });
        // For video posts: store the uploaded thumbnail as a separate row
        // so the feed/grid can show a real image instead of a video URL
        if (m.type === "video" && m.thumbnail) {
          mediaInserts.push({
            _parent_id: post.id,
            type: "thumbnail",
            url: m.thumbnail,
            _order: index,
            id: `${post.id}_thumb_${index}`,
          });
          console.log(
            "[Edge:create-post] Video thumbnail stored:",
            m.thumbnail,
          );
        }
      });

      const { error: mediaError } = await supabaseAdmin
        .from("posts_media")
        .insert(mediaInserts);

      if (mediaError) {
        console.error("[Edge:create-post] Media insert error:", mediaError);
        // Don't fail the whole request, post was created
      } else {
        console.log(
          "[Edge:create-post] Media inserted:",
          mediaInserts.length,
          "items",
        );
      }
    }

    // Increment user posts count
    await supabaseAdmin.rpc("increment_posts_count", { user_id: userId });

    return jsonResponse({
      ok: true,
      data: {
        post: {
          id: String(post.id),
          authorId: String(userId),
          content: post.content,
          location: post.location,
          isNSFW: post.is_nsfw,
          visibility: post.visibility,
          likesCount: 0,
          commentsCount: 0,
          createdAt: post.created_at,
          media: media || [],
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
    console.error("[Edge:create-post] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred");
  }
});
