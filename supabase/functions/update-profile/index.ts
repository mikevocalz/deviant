/**
 * Edge Function: update-profile
 * Updates user profile with Better Auth session verification
 *
 * This function verifies the Better Auth session token and updates
 * the users table using the service role key (server-side only).
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

// Validation schema for profile updates
const UpdateProfileSchema = z
  .object({
    name: z.string().max(100).optional(),
    firstName: z.string().max(50).optional(),
    lastName: z.string().max(50).optional(),
    bio: z.string().max(500).optional(),
    location: z.string().max(100).optional(),
    avatarUrl: z.string().url().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "validation_error"
  | "not_found"
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

function errorResponse(
  code: ErrorCode,
  message: string,
  status = 400,
): Response {
  console.error(`[Edge:update-profile] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

/**
 * Verify Better Auth session by calling the session endpoint
 */
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

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("validation_error", "Method not allowed", 405);
  }

  try {
    // 1. Extract and validate Authorization header
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

    console.log("[Edge:update-profile] Received request with token");

    // 2. Verify Better Auth session
    const session = await verifyBetterAuthSession(token, supabaseAdmin);
    if (!session) {
      return errorResponse("unauthorized", "Invalid or expired session", 401);
    }

    const { odUserId: authId, email } = session;
    console.log("[Edge:update-profile] Authenticated user auth_id:", authId);

    // 3. Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("validation_error", "Invalid JSON body", 400);
    }

    const parsed = UpdateProfileSchema.safeParse(body);
    if (!parsed.success) {
      const errorMessage = parsed.error.errors.map((e) => e.message).join(", ");
      return errorResponse("validation_error", errorMessage, 400);
    }

    const updates = parsed.data;
    console.log(
      "[Edge:update-profile] Validated updates:",
      JSON.stringify(updates),
    );

    // 4. Build update object - map fields to database columns
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Map 'name' to 'first_name' for compatibility
    if (updates.name !== undefined) {
      updateData.first_name = updates.name;
    }
    if (updates.firstName !== undefined) {
      updateData.first_name = updates.firstName;
    }
    if (updates.lastName !== undefined) {
      updateData.last_name = updates.lastName;
    }
    if (updates.bio !== undefined) {
      updateData.bio = updates.bio;
    }
    if (updates.location !== undefined) {
      updateData.location = updates.location;
    }

    // Handle avatar: create media record and set avatar_id
    if (updates.avatarUrl) {
      const { data: mediaData, error: mediaError } = await supabaseAdmin
        .from("media")
        .insert({ url: updates.avatarUrl })
        .select("id")
        .single();

      if (mediaError) {
        console.error("[Edge:update-profile] Media insert error:", mediaError);
      } else {
        updateData.avatar_id = mediaData.id;
        console.log(
          "[Edge:update-profile] Created media record:",
          mediaData.id,
        );
      }
    }

    console.log(
      "[Edge:update-profile] Update data:",
      JSON.stringify(updateData),
    );

    // 6. Update user by auth_id
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update(updateData)
      .eq("auth_id", authId)
      .select(
        `
        id,
        auth_id,
        username,
        email,
        first_name,
        last_name,
        bio,
        location,
        verified,
        followers_count,
        following_count,
        posts_count,
        avatar:avatar_id(url)
      `,
      )
      .single();

    if (updateError) {
      console.error("[Edge:update-profile] Update error:", updateError.message);

      // Check if user not found
      if (updateError.code === "PGRST116") {
        return errorResponse("not_found", "User not found", 404);
      }

      return errorResponse("internal_error", "Failed to update profile", 500);
    }

    console.log(
      "[Edge:update-profile] Profile updated successfully for user:",
      updatedUser.id,
    );

    // 7. Return updated user data
    return jsonResponse({
      ok: true,
      data: {
        user: {
          id: String(updatedUser.id),
          authId: updatedUser.auth_id,
          email: updatedUser.email,
          username: updatedUser.username,
          name: updatedUser.first_name || updatedUser.username,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          bio: updatedUser.bio,
          location: updatedUser.location,
          avatar: (updatedUser.avatar as any)?.url,
          isVerified: updatedUser.verified || false,
          postsCount: updatedUser.posts_count || 0,
          followersCount: updatedUser.followers_count || 0,
          followingCount: updatedUser.following_count || 0,
        },
      },
    });
  } catch (err) {
    console.error("[Edge:update-profile] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
