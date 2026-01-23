/**
 * Conversations API Route
 *
 * GET  /api/conversations - Get user's conversations
 * POST /api/conversations - Create a new conversation
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

    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    // Parse where filter if provided
    let where: Record<string, unknown> | undefined;
    const whereParam = url.searchParams.get("where");
    if (whereParam) {
      try {
        where = JSON.parse(whereParam);
      } catch {
        return Response.json(
          { error: "Invalid where parameter" },
          { status: 400 },
        );
      }
    }

    const result = await payloadClient.find(
      {
        collection: "conversations",
        limit,
        page,
        depth: 2,
        sort: "-lastMessageAt",
        where,
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/conversations error:", error);
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

    if (!body.participants || !Array.isArray(body.participants)) {
      return Response.json(
        { error: "participants array is required" },
        { status: 400 },
      );
    }

    const result = await payloadClient.create(
      {
        collection: "conversations",
        data: body,
        depth: 2,
      },
      cookies,
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/conversations error:", error);
    return createErrorResponse(error);
  }
}
