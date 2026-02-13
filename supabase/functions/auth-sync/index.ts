/**
 * Edge Function: auth-sync
 *
 * Syncs Better Auth user to Supabase users table.
 * Called after login to ensure we have a valid users row with auth_id.
 *
 * Flow:
 * 1. Verify Better Auth token
 * 2. Check if user exists by auth_id
 * 3. If not, check by email and update auth_id
 * 4. If not, create new user row
 * 5. Return the user row
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ErrorCode = "unauthorized" | "validation_error" | "internal_error";

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
  console.error(`[Edge:auth-sync] Error: ${code} - ${message}`);
  return jsonResponse({ ok: false, error: { code, message } }, 200);
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("validation_error", "Method not allowed");
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
    console.log("[Edge:auth-sync] Received sync request");

    // 2. Create Supabase admin client (needed for both session verification and user sync)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[Edge:auth-sync] Missing Supabase environment variables");
      return errorResponse("internal_error", "Server configuration error");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${supabaseServiceKey}` } },
    });

    // 3. Verify Better Auth session via direct DB lookup
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

    const authId = sessionData.userId;

    // Fetch email and name from Better Auth user table (needed for user creation/sync)
    const { data: baUser, error: baUserError } = await supabaseAdmin
      .from("user")
      .select("id, email, name, image")
      .eq("id", authId)
      .single();

    if (baUserError || !baUser) {
      console.error(
        "[Edge:auth-sync] Better Auth user lookup failed:",
        authId,
        baUserError?.message,
      );
      return errorResponse("unauthorized", "User account not found");
    }

    const email = baUser.email;
    const name = baUser.name || "";

    console.log("[Edge:auth-sync] Syncing user:", { authId, email });

    // 4. Try to find user by auth_id first
    let { data: existingUser, error: findError } = await supabaseAdmin
      .from("users")
      .select(
        `
        id,
        auth_id,
        email,
        username,
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
      .eq("auth_id", authId)
      .single();

    if (existingUser) {
      console.log("[Edge:auth-sync] Found user by auth_id:", existingUser.id);
      return jsonResponse({
        ok: true,
        data: {
          user: formatUserResponse(existingUser),
          action: "found_by_auth_id",
        },
      });
    }

    // 5. Try to find by email and update auth_id
    const { data: userByEmail, error: emailError } = await supabaseAdmin
      .from("users")
      .select(
        `
        id,
        auth_id,
        email,
        username,
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
      .eq("email", email)
      .single();

    if (userByEmail) {
      console.log(
        "[Edge:auth-sync] Found user by email, updating auth_id:",
        userByEmail.id,
      );

      // Update auth_id
      const { error: updateError } = await supabaseAdmin
        .from("users")
        .update({ auth_id: authId, updated_at: new Date().toISOString() })
        .eq("id", userByEmail.id);

      if (updateError) {
        console.error(
          "[Edge:auth-sync] Failed to update auth_id:",
          updateError,
        );
        return errorResponse("internal_error", "Failed to sync user");
      }

      return jsonResponse({
        ok: true,
        data: {
          user: formatUserResponse({ ...userByEmail, auth_id: authId }),
          action: "updated_auth_id",
        },
      });
    }

    // 6. Create new user
    console.log("[Edge:auth-sync] Creating new user for:", email);

    // Generate username from email
    const baseUsername = email
      .split("@")[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    const username = `${baseUsername}${Math.floor(Math.random() * 1000)}`;

    const { data: newUser, error: createError } = await supabaseAdmin
      .from("users")
      .insert({
        auth_id: authId,
        email: email,
        username: username,
        first_name: name || null,
        verified: false,
        followers_count: 0,
        following_count: 0,
        posts_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(
        `
        id,
        auth_id,
        email,
        username,
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

    if (createError) {
      console.error("[Edge:auth-sync] Failed to create user:", createError);
      return errorResponse("internal_error", "Failed to create user");
    }

    console.log("[Edge:auth-sync] Created new user:", newUser.id);

    return jsonResponse({
      ok: true,
      data: {
        user: formatUserResponse(newUser),
        action: "created",
      },
    });
  } catch (err) {
    console.error("[Edge:auth-sync] Unexpected error:", err);
    return errorResponse("internal_error", "An unexpected error occurred");
  }
});

function formatUserResponse(data: any) {
  return {
    id: String(data.id),
    authId: data.auth_id,
    email: data.email,
    username: data.username,
    name: data.first_name || data.username,
    firstName: data.first_name,
    lastName: data.last_name,
    bio: data.bio,
    location: data.location,
    avatar: data.avatar?.url || null,
    isVerified: data.verified || false,
    postsCount: data.posts_count || 0,
    followersCount: data.followers_count || 0,
    followingCount: data.following_count || 0,
  };
}
