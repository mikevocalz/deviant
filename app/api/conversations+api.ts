/**
 * Conversations API Route
 *
 * GET  /api/conversations - Get user's conversations
 * POST /api/conversations - Create or get existing conversation (idempotent)
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
    const type = url.searchParams.get("type"); // 'direct' | 'group' | null

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

    // Add type filter if specified - use isGroup field (type field doesn't exist)
    if (type === "direct") {
      where = {
        ...where,
        isGroup: { equals: false },
      };
    } else if (type === "group") {
      where = {
        ...where,
        isGroup: { equals: true },
      };
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

    // Normalize participant IDs
    const participantIds = body.participants
      .map((p: string | { id: string }) => (typeof p === "object" ? p.id : p))
      .filter(Boolean);

    if (participantIds.length < 2) {
      return Response.json(
        { error: "At least 2 participants required" },
        { status: 400 },
      );
    }

    // IDEMPOTENT: For direct conversations, check if one already exists
    const isGroup = body.isGroup === true || participantIds.length > 2;

    if (!isGroup && participantIds.length === 2) {
      console.log(
        "[API/conversations] Checking for existing direct conversation...",
      );

      // Sort IDs for consistent lookup
      const [user1, user2] = [...participantIds].sort();

      // FIX: Use isGroup: false instead of type: "direct" (type field doesn't exist)
      const existing = await payloadClient.find(
        {
          collection: "conversations",
          where: {
            and: [
              { isGroup: { equals: false } },
              { participants: { contains: user1 } },
              { participants: { contains: user2 } },
            ],
          },
          depth: 2,
          limit: 1,
        },
        cookies,
      );

      if (existing.docs && existing.docs.length > 0) {
        console.log(
          "[API/conversations] Returning existing conversation:",
          existing.docs[0].id,
        );
        return Response.json(existing.docs[0], { status: 200 });
      }
    }

    // Create new conversation
    console.log("[API/conversations] Creating new conversation:", {
      participantCount: participantIds.length,
      isGroup,
    });

    try {
      const result = await payloadClient.create(
        {
          collection: "conversations",
          data: {
            ...body,
            participants: participantIds,
            // NOTE: Don't send 'type' field - it doesn't exist in schema
            isGroup,
          },
          depth: 2,
        },
        cookies,
      );

      return Response.json(result, { status: 201 });
    } catch (createError: any) {
      // Handle duplicate conversation error (409)
      if (createError.status === 409 && createError.existingId) {
        console.log(
          "[API] Duplicate detected, fetching existing:",
          createError.existingId,
        );
        const existing = await payloadClient.findByID(
          {
            collection: "conversations",
            id: createError.existingId,
            depth: 2,
          },
          cookies,
        );
        return Response.json(existing, { status: 200 });
      }
      throw createError;
    }
  } catch (error: any) {
    console.error("[API] POST /api/conversations error:", error);

    // Return appropriate status code
    if (error.status) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return createErrorResponse(error);
  }
}
