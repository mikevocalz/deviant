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

    // Stories typically sorted by most recent, with active stories first
    const result = await payloadClient.find(
      {
        collection: "stories",
        limit,
        page,
        depth,
        sort: "-createdAt",
        where: {
          // Only fetch stories that haven't expired (24 hours)
          createdAt: {
            greater_than: new Date(
              Date.now() - 24 * 60 * 60 * 1000,
            ).toISOString(),
          },
        },
      },
      cookies,
    );

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

    // Handle author ID mapping - client sends Better Auth ID, we need Payload CMS ObjectID
    let storyData = { ...body };
    
    if (body.author && body.authorUsername) {
      // Look up user by username to get the real Payload CMS ID
      try {
        const userResult = await payloadClient.find({
          collection: "users",
          where: { username: { equals: body.authorUsername } },
          limit: 1,
        }, cookies);
        
        if (userResult.docs && userResult.docs.length > 0) {
          storyData.author = (userResult.docs[0] as { id: string }).id;
        } else {
          delete storyData.author;
        }
      } catch (lookupError) {
        console.error("[API] User lookup error:", lookupError);
        delete storyData.author;
      }
    } else if (body.author) {
      delete storyData.author;
    }
    
    delete storyData.authorUsername;

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
