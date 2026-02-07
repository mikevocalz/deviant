/**
 * Send Push Notification Edge Function
 *
 * Sends Expo push notifications to users
 * Called by database triggers or directly from the app
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushNotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  type:
    | "follow"
    | "like"
    | "comment"
    | "mention"
    | "message"
    | "event_invite"
    | "event_update";
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

serve(async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PushNotificationPayload = await req.json();
    const { userId, title, body, data, type } = payload;

    if (!userId || !title || !body || !type) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: userId, title, body, type",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // userId is the INTEGER user ID (users.id)
    const recipientId = typeof userId === "string" ? parseInt(userId) : userId;
    const actorId = data?.actorId
      ? typeof data.actorId === "string"
        ? parseInt(data.actorId as string)
        : (data.actorId as number)
      : null;

    console.log(
      `[send_notification] Sending ${type} notification to user ${recipientId}`,
    );

    // 1. Get user's push tokens (push_tokens.user_id is INTEGER)
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .eq("user_id", recipientId);

    if (tokenError) {
      console.error("[send_notification] Error fetching tokens:", tokenError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch push tokens" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!tokens || tokens.length === 0) {
      console.log("[send_notification] No push tokens found for user");
      return new Response(
        JSON.stringify({
          ok: true,
          sent: 0,
          message: "No push tokens registered",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Store notification in database (matches actual schema)
    const { error: notifError } = await supabase.from("notifications").insert({
      recipient_id: recipientId,
      actor_id: actorId,
      type,
      entity_type: data?.entityType || null,
      entity_id: data?.entityId ? String(data.entityId) : null,
    });

    if (notifError) {
      console.error(
        "[send_notification] Error storing notification:",
        notifError,
      );
      // Continue anyway - push notification is more important
    }

    // 3. Send to Expo Push Service
    const messages: ExpoPushMessage[] = tokens.map((t) => ({
      to: t.token,
      title,
      body,
      data: { ...data, type },
      sound: "default",
      channelId: "default",
    }));

    const expoResponse = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    const expoResult = await expoResponse.json();
    console.log(
      "[send_notification] Expo response:",
      JSON.stringify(expoResult),
    );

    // Check for errors in the response
    const errors =
      expoResult.data?.filter((r: any) => r.status === "error") || [];
    if (errors.length > 0) {
      console.error("[send_notification] Some notifications failed:", errors);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        sent: tokens.length - errors.length,
        failed: errors.length,
        errors: errors.map((e: any) => e.message),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[send_notification] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
