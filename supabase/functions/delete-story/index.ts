/**
 * Edge Function: delete-story
 * Delete a story with Better Auth verification
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  return jsonResponse({ ok: false, error: { code, message } }, status);
}

async function verifyBetterAuthSession(token: string): Promise<{ odUserId: string } | null> {
  const betterAuthUrl = Deno.env.get("BETTER_AUTH_BASE_URL");
  if (!betterAuthUrl) return null;
  try {
    const response = await fetch(`${betterAuthUrl}/api/auth/get-session`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.user?.id) return null;
    return { odUserId: data.user.id };
  } catch { return null; }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("validation_error", "Method not allowed", 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("unauthorized", "Missing or invalid Authorization header", 401);

    const token = authHeader.replace("Bearer ", "");
    const session = await verifyBetterAuthSession(token);
    if (!session) return errorResponse("unauthorized", "Invalid or expired session", 401);

    let body: { storyId: number };
    try { body = await req.json(); } catch { return errorResponse("validation_error", "Invalid JSON body", 400); }

    const { storyId } = body;
    if (!storyId) return errorResponse("validation_error", "storyId is required", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) return errorResponse("internal_error", "Server configuration error", 500);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData } = await supabaseAdmin.from("users").select("id").eq("auth_id", session.odUserId).single();
    if (!userData) return errorResponse("not_found", "User not found", 404);

    // Verify ownership
    const { data: story } = await supabaseAdmin.from("stories").select("author_id").eq("id", storyId).single();
    if (!story || story.author_id !== userData.id) return errorResponse("forbidden", "You can only delete your own stories", 403);

    const { error } = await supabaseAdmin.from("stories").delete().eq("id", storyId);
    if (error) return errorResponse("internal_error", "Failed to delete story", 500);

    return jsonResponse({ ok: true, data: { success: true } });
  } catch (err) {
    console.error("[Edge:delete-story] Error:", err);
    return errorResponse("internal_error", "An unexpected error occurred", 500);
  }
});
