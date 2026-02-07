/**
 * Edge Function: create-post
 * Create a new post with media URLs (already uploaded to Bunny CDN)
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
  console.error(`[Edge:create-post] Error: ${code} - ${message}`);
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

    let body: CreatePostBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
    }

    const { content, location, isNSFW, visibility, media } = body;

    // Must have content or media
    if (
      (!content || content.trim().length === 0) &&
      (!media || media.length === 0)
    ) {
      return errorResponse(
        "validation_error",
        "Post must have content or media",
        400,
      );
    }

    // Get user's integer ID and profile info
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, username, first_name, avatar:avatar_id(url)")
      .eq("auth_id", odUserId)
      .single();

    if (userError || !userData) {
      return errorResponse("not_found", "User not found", 404);
    }

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
      return errorResponse("internal_error", "Failed to create post", 500);
    }

    console.log("[Edge:create-post] Post created:", post.id);

    // Insert media if provided
    if (media && media.length > 0) {
      const mediaInserts = media.map((m, index) => ({
        _parent_id: post.id,
        type: m.type,
        url: m.url,
        _order: index,
        id: `${post.id}_${index}`,
      }));

      const { error: mediaError } = await supabaseAdmin
        .from("posts_media")
        .insert(mediaInserts);

      if (mediaError) {
        console.error("[Edge:create-post] Media insert error:", mediaError);
        // Don't fail the whole request, post was created
      } else {
        console.log(
          "[Edge:create-post] Media inserted:",
          media.length,
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
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
