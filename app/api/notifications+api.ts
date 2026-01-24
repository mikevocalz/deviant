/**
 * Notifications API Route
 *
 * GET  /api/notifications - Get notifications for current user
 * POST /api/notifications - Create a new notification (mention, like, etc.)
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

// GET /api/notifications
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cookies = getCookiesFromRequest(request);

    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    // Get current user
    const currentUser = await payloadClient.me<{ id: string }>(cookies);
    if (!currentUser) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch notifications for this user
    const result = await payloadClient.find(
      {
        collection: "notifications",
        limit,
        page,
        depth: 2,
        sort: "-createdAt",
        where: {
          recipient: { equals: currentUser.id },
        },
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/notifications error:", error);
    return createErrorResponse(error);
  }
}

// POST /api/notifications
export async function POST(request: Request) {
  try {
    const cookies = getCookiesFromRequest(request);
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }

    const { type, recipientUsername, senderUsername, postId, content } = body;

    if (!type || !recipientUsername) {
      return Response.json(
        { error: "type and recipientUsername are required" },
        { status: 400 },
      );
    }

    // Look up recipient user by username
    const recipientResult = await payloadClient.find({
      collection: "users",
      where: { username: { equals: recipientUsername } },
      limit: 1,
    }, cookies);

    if (!recipientResult.docs || recipientResult.docs.length === 0) {
      return Response.json(
        { error: "Recipient user not found" },
        { status: 404 },
      );
    }

    const recipientId = (recipientResult.docs[0] as { id: string }).id;

    // Look up sender user if provided
    let senderId: string | undefined;
    if (senderUsername) {
      const senderResult = await payloadClient.find({
        collection: "users",
        where: { username: { equals: senderUsername } },
        limit: 1,
      }, cookies);

      if (senderResult.docs && senderResult.docs.length > 0) {
        senderId = (senderResult.docs[0] as { id: string }).id;
      }
    }

    // Create notification
    const notificationData: Record<string, unknown> = {
      type,
      recipient: recipientId,
      sender: senderId,
      post: postId,
      content,
      isRead: false,
    };

    const result = await payloadClient.create(
      {
        collection: "notifications",
        data: notificationData,
        depth: 2,
      },
      cookies,
    );

    // TODO: Also send push notification if user has push tokens enabled
    // This could call the /api/send-notification endpoint

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/notifications error:", error);
    return createErrorResponse(error);
  }
}
