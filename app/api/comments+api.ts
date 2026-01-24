/**
 * Comments API Route
 *
 * GET  /api/comments?postId=xxx - Get comments for a post
 * POST /api/comments - Create a new comment
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

    const postId = url.searchParams.get("postId");
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const depth = parseInt(url.searchParams.get("depth") || "2", 10);

    if (!postId) {
      return Response.json({ error: "postId is required" }, { status: 400 });
    }

    const result = await payloadClient.find(
      {
        collection: "comments",
        limit,
        page,
        depth,
        sort: "-createdAt",
        where: {
          post: { equals: postId },
          parent: { exists: false }, // Top-level comments only
        },
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/comments error:", error);
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

    if (!body.post || !body.text) {
      return Response.json(
        { error: "post and text are required" },
        { status: 400 },
      );
    }

    // Map 'text' to 'content' for Payload CMS
    // Handle author ID mapping if authorUsername is provided
    let authorId: string | undefined;
    
    if (body.authorUsername) {
      try {
        const userResult = await payloadClient.find({
          collection: "users",
          where: { username: { equals: body.authorUsername } },
          limit: 1,
        }, cookies);
        
        if (userResult.docs && userResult.docs.length > 0) {
          authorId = (userResult.docs[0] as { id: string }).id;
        }
      } catch (lookupError) {
        console.error("[API] User lookup error:", lookupError);
      }
    }
    
    const commentData: Record<string, unknown> = {
      post: body.post,
      content: body.text, // CMS expects 'content' field
      parent: body.parent || undefined,
    };
    
    if (authorId) {
      commentData.author = authorId;
    }

    const result = await payloadClient.create(
      {
        collection: "comments",
        data: commentData,
        depth: 2,
      },
      cookies,
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/comments error:", error);
    return createErrorResponse(error);
  }
}
