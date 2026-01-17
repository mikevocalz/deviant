/**
 * Send Push Notification API
 *
 * Endpoint for Payload hooks to trigger push notifications via Expo Push API
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
}

interface NotificationPayload {
  tokens: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function POST(request: Request): Promise<Response> {
  try {
    // Verify request is from our backend (simple API key check)
    const authHeader = request.headers.get("Authorization");
    const expectedKey = process.env.INTERNAL_API_KEY;

    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: NotificationPayload = await request.json();
    const { tokens, title, body: messageBody, data } = body;

    if (!tokens || !title || !messageBody) {
      return Response.json(
        { error: "Missing required fields: tokens, title, body" },
        { status: 400 },
      );
    }

    // Normalize tokens to array
    const tokenArray = Array.isArray(tokens) ? tokens : [tokens];

    // Filter valid Expo push tokens
    const validTokens = tokenArray.filter(
      (token) => token && token.startsWith("ExponentPushToken["),
    );

    if (validTokens.length === 0) {
      return Response.json(
        { error: "No valid Expo push tokens provided" },
        { status: 400 },
      );
    }

    // Build push messages
    const messages: PushMessage[] = validTokens.map((token) => ({
      to: token,
      title,
      body: messageBody,
      data,
      sound: "default",
      channelId: "default",
    }));

    // Send to Expo Push API
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[send-notification] Expo Push API error:", error);
      return Response.json(
        { error: "Failed to send notification" },
        { status: 500 },
      );
    }

    const result = await response.json();
    console.log("[send-notification] Sent to", validTokens.length, "devices");

    return Response.json({
      success: true,
      sent: validTokens.length,
      result,
    });
  } catch (error) {
    console.error("[send-notification] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
