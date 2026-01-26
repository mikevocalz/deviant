/**
 * Push Token Registration API
 *
 * Stores Expo push tokens in Payload CMS for sending notifications
 */

import {
  payloadClient,
  getAuthFromRequest,
} from "@/lib/payload.server";

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = getAuthFromRequest(request);
    const body = await request.json();
    const { token, userId, username, platform } = body;

    if (!token) {
      return Response.json(
        { error: "Missing token" },
        { status: 400 },
      );
    }

    // Find the user by username or use the provided userId
    let payloadUserId: string | null = null;
    
    if (username) {
      // Look up user by username to get Payload CMS ID
      const userResult = await payloadClient.find({
        collection: "users",
        where: { username: { equals: username } },
        limit: 1,
      }, auth);
      
      if (userResult.docs && userResult.docs.length > 0) {
        payloadUserId = (userResult.docs[0] as { id: string }).id;
      }
    }
    
    if (!payloadUserId && userId) {
      // Try direct ID (might work if IDs match)
      payloadUserId = userId;
    }

    if (!payloadUserId) {
      return Response.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    // Update user's push token in Payload CMS
    await payloadClient.update({
      collection: "users",
      id: payloadUserId,
      data: {
        pushToken: token,
      },
    }, auth);

    console.log("[push-token] Token saved for user:", payloadUserId, "platform:", platform);
    return Response.json({ success: true });
  } catch (error) {
    console.error("[push-token] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
