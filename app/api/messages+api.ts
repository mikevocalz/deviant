/**
 * Messages API Route
 *
 * GET  /api/messages?conversationId=xxx - Get messages for a conversation
 * POST /api/messages - Send a new message
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cookies = getCookiesFromRequest(request);

    const conversationId = url.searchParams.get("conversationId");
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    if (!conversationId) {
      return Response.json(
        { error: "conversationId is required" },
        { status: 400 },
      );
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
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/messages error:", error);
    return createErrorResponse(error);
  }
}

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

    if (!body.conversation || !body.sender) {
      return Response.json(
        { error: "conversation and sender are required" },
        { status: 400 },
      );
    }

    const result = await payloadClient.create(
      {
        collection: "messages",
        data: body,
        depth: 2,
      },
      cookies,
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/messages error:", error);
    return createErrorResponse(error);
  }
}
