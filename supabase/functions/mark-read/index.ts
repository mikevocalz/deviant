import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveOrProvisionUser } from "../_shared/resolve-user.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    // 1. Verify session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${serviceKey}` } },
    });

    // Verify Better Auth session
    const { data: session, error: sessionError } = await supabase
      .from("session")
      .select("id, userId, expiresAt")
      .eq("token", token)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid session" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (new Date(session.expiresAt) < new Date()) {
      return new Response(
        JSON.stringify({ ok: false, error: "Session expired" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authUserId = session.userId;

    // 2. Get user's integer ID from users table (auto-provision if needed)
    const userRow = await resolveOrProvisionUser(supabase, authUserId, "id");
    if (!userRow) {
      return new Response(
        JSON.stringify({ ok: false, error: "User not found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userIntId = userRow.id;

    // 3. Parse body
    const body = await req.json();
    const conversationId = body.conversationId;

    if (!conversationId) {
      return new Response(
        JSON.stringify({ ok: false, error: "conversationId required" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Verify user is participant in conversation
    const { data: rel } = await supabase
      .from("conversations_rels")
      .select("id")
      .eq("parent_id", conversationId)
      .eq("users_id", authUserId)
      .single();

    if (!rel) {
      return new Response(
        JSON.stringify({ ok: false, error: "Not a participant" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 5. Mark all messages as read (except own messages)
    const { data: updated, error: updateError } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .is("read_at", null)
      .neq("sender_id", userIntId)
      .select("id");

    if (updateError) {
      console.error("[mark-read] Update error:", updateError);
      return new Response(
        JSON.stringify({ ok: false, error: updateError.message }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const count = updated?.length || 0;
    console.log(
      `[mark-read] Marked ${count} messages as read in conversation ${conversationId}`,
    );

    return new Response(
      JSON.stringify({ ok: true, data: { markedRead: count } }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[mark-read] Error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: "Internal error" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
