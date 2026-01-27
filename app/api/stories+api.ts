/**
 * Stories API Route
 *
 * GET  /api/stories - List stories (active, not expired)
 * POST /api/stories - Create a new story
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

    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const depth = parseInt(url.searchParams.get("depth") || "2", 10);

    // PHASE 1.5: ENFORCE STORY EXPIRY FILTER
    // Invariant: Stories expire after 24 hours - NEVER return expired stories
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log("[API] Fetching stories with expiry filter:", {
      now: now.toISOString(),
      cutoff: twentyFourHoursAgo.toISOString(),
    });

    const result = await payloadClient.find(
      {
        collection: "stories",
        limit,
        page,
        depth,
        sort: "-createdAt",
        where: {
          // INVARIANT: Only fetch stories created within last 24 hours
          // This is the PRIMARY filter - cleanup job is secondary
          createdAt: {
            greater_than: twentyFourHoursAgo.toISOString(),
          },
        },
      },
      cookies,
    );

    // Log for monitoring
    console.log("[API] Stories returned:", {
      total: result.docs?.length || 0,
      hasMore: result.hasNextPage,
    });

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/stories error:", error);
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

    // Handle author ID - client already looks up Payload CMS ID, so trust it if provided
    let storyData = { ...body };

    // If authorUsername is provided, look up the Payload CMS ID (for backwards compatibility)
    if (body.authorUsername) {
      try {
        const userResult = await payloadClient.find(
          {
            collection: "users",
            where: { username: { equals: body.authorUsername } },
            limit: 1,
          },
          cookies,
        );

        if (userResult.docs && userResult.docs.length > 0) {
          storyData.author = (userResult.docs[0] as { id: string }).id;
          console.log("[API] Found author by username:", storyData.author);
        }
      } catch (lookupError) {
        console.error("[API] User lookup error:", lookupError);
      }
      delete storyData.authorUsername;
    }

    // If author is provided but not a valid ObjectId format, try to look it up
    // Otherwise, trust the client-provided author ID (already a Payload CMS ID)
    if (storyData.author) {
      console.log("[API] Creating story with author:", storyData.author);
    } else {
      console.warn("[API] No author ID provided for story");
    }

    const result = await payloadClient.create(
      {
        collection: "stories",
        data: storyData,
        depth: 2,
      },
      cookies,
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/stories error:", error);
    return createErrorResponse(error);
  }
}
