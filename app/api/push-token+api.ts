/**
 * Push Token Registration API
 *
 * Stores Expo push tokens in the user-devices collection.
 * Supports multiple devices per user with upsert pattern.
 */

import { payloadClient, getCookiesFromRequest } from "@/lib/payload.server";

export async function POST(request: Request): Promise<Response> {
  try {
    const cookies = getCookiesFromRequest(request);
    const body = await request.json();
    const { token, userId, username, platform, deviceId } = body;

    // Validate required fields
    if (!token) {
      return Response.json({ error: "Missing token" }, { status: 400 });
    }

    // Validate Expo push token format
    if (!token.startsWith("ExponentPushToken[")) {
      return Response.json(
        { error: "Invalid Expo push token format" },
        { status: 400 },
      );
    }

    // Find the user by username or use the provided userId
    let payloadUserId: string | null = null;

    if (username) {
      const userResult = await payloadClient.find(
        {
          collection: "users",
          where: { username: { equals: username } },
          limit: 1,
        },
        cookies,
      );

      if (userResult.docs && userResult.docs.length > 0) {
        payloadUserId = (userResult.docs[0] as { id: string }).id;
      }
    }

    if (!payloadUserId && userId) {
      payloadUserId = userId;
    }

    if (!payloadUserId) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Generate deviceId if not provided (fallback for older clients)
    const finalDeviceId =
      deviceId || `device-${payloadUserId}-${platform || "unknown"}`;

    // Check for existing device record (upsert pattern)
    const existing = await payloadClient.find(
      {
        collection: "user-devices" as any,
        where: {
          and: [
            { user: { equals: payloadUserId } },
            { deviceId: { equals: finalDeviceId } },
          ],
        },
        limit: 1,
      },
      cookies,
    );

    if (existing.docs && existing.docs.length > 0) {
      // Update existing device
      const existingDevice = existing.docs[0] as { id: string };
      await payloadClient.update(
        {
          collection: "user-devices" as any,
          id: existingDevice.id,
          data: {
            expoPushToken: token,
            platform: platform || "ios",
            lastSeenAt: new Date().toISOString(),
            disabledAt: null, // Re-enable if was disabled
          },
        },
        cookies,
      );

      console.log(
        "[push-token] Updated device:",
        finalDeviceId,
        "user:",
        payloadUserId,
      );
      return Response.json({ success: true, updated: true });
    }

    // Create new device record
    await payloadClient.create(
      {
        collection: "user-devices" as any,
        data: {
          user: payloadUserId,
          expoPushToken: token,
          deviceId: finalDeviceId,
          platform: platform || "ios",
          lastSeenAt: new Date().toISOString(),
        },
      },
      cookies,
    );

    console.log(
      "[push-token] Registered new device:",
      finalDeviceId,
      "user:",
      payloadUserId,
    );
    return Response.json({ success: true, created: true });
  } catch (error: any) {
    // Handle the special "Device updated" error from hook
    if (error.status === 200 && error.isUpdate) {
      console.log("[push-token] Device updated via hook");
      return Response.json({ success: true, updated: true });
    }

    console.error("[push-token] Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
