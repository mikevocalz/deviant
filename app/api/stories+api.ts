/**
 * Stories API Route
 *
 * GET  /api/stories - List stories (active, not expired)
 * POST /api/stories - Create a new story
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
      auth,
    );

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/stories error:", error);
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

    // Get current user to set as author
    const currentUser = await payloadClient.me<{ id: string }>(auth);
    
    // Handle author ID - client already looks up Payload CMS ID, so trust it if provided
    let storyData = { ...body };
    
    // If authorUsername is provided, look up the Payload CMS ID (for backwards compatibility)
    if (body.authorUsername) {
      try {
        const userResult = await payloadClient.find({
          collection: "users",
          where: { username: { equals: body.authorUsername } },
          limit: 1,
        }, auth);
        
        if (userResult.docs && userResult.docs.length > 0) {
          storyData.author = (userResult.docs[0] as { id: string }).id;
          console.log("[API] Found author by username:", storyData.author);
        }
      } catch (lookupError) {
        console.error("[API] User lookup error:", lookupError);
      }
      delete storyData.authorUsername;
    }
    
    // If no author set, use current user
    if (!storyData.author && currentUser) {
      storyData.author = currentUser.id;
      console.log("[API] Using authenticated user as author:", currentUser.id);
    }
    
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
      auth,
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/stories error:", error);
    return createErrorResponse(error);
  }
}
