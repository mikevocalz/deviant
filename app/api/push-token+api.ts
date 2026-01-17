/**
 * Push Token Registration API
 *
 * Stores Expo push tokens in Payload CMS for sending notifications
 */

const PAYLOAD_URL = process.env.PAYLOAD_URL || "http://localhost:3000";
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { token, userId, platform } = body;

    if (!token || !userId) {
      return Response.json(
        { error: "Missing token or userId" },
        { status: 400 },
      );
    }

    // Update user's push token in Payload CMS
    const response = await fetch(`${PAYLOAD_URL}/api/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(PAYLOAD_API_KEY && { Authorization: `Bearer ${PAYLOAD_API_KEY}` }),
      },
      body: JSON.stringify({
        pushToken: token,
        pushTokenPlatform: platform,
        pushTokenUpdatedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[push-token] Failed to update user:", error);
      return Response.json(
        { error: "Failed to save push token" },
        { status: 500 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[push-token] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
