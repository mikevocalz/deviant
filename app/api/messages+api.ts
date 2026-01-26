/**
 * Messages API Route
 *
 * GET  /api/messages?conversationId=xxx - Get messages for a conversation
 * POST /api/messages - Send a new message
 */

import {
  payloadClient,
  getAuthFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const auth = getAuthFromRequest(request);

    const conversationId = url.searchParams.get("conversationId");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    if (!conversationId) {
      return Response.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
    }

    // Verify user is authenticated
    const currentUser = await payloadClient.me<{ id: string }>(auth);
    if (!currentUser) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const result = await payloadClient.find(
      {
        collection: "messages",
        limit,
        page,
        depth: 2,
        sort: "-createdAt",
        where: {
          conversation: { equals: conversationId },
        },
      },
      auth,
    );

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/messages error:", error);
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }

    // Verify user is authenticated
    const currentUser = await payloadClient.me<{ id: string }>(auth);
    if (!currentUser) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // If sender not provided, use current user
    if (!body.sender) {
      body.sender = currentUser.id;
    }

    if (!body.conversation) {
      return Response.json(
        { error: "conversation is required" },
        { status: 400 },
      );
    }

    // If senderUsername provided, look up the user
    if (body.senderUsername && !body.sender) {
      try {
        const userResult = await payloadClient.find({
          collection: "users",
          where: { username: { equals: body.senderUsername } },
          limit: 1,
        }, auth);
        
        if (userResult.docs && userResult.docs.length > 0) {
          body.sender = (userResult.docs[0] as { id: string }).id;
        }
      } catch (e) {
        console.error("[API] User lookup error:", e);
      }
      delete body.senderUsername;
    }

    const result = await payloadClient.create(
      {
        collection: "messages",
        data: body,
        depth: 2,
      },
      auth,
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/messages error:", error);
    return createErrorResponse(error);
  }
}
