/**
 * Posts API Route
 *
 * Proxies requests to Payload CMS - API key never exposed to client.
 *
 * GET  /api/posts - List posts with pagination/filtering
 * POST /api/posts - Create a new post
 */

import {
  payloadClient,
  getAuthFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

// GET /api/posts
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const auth = getAuthFromRequest(request);

    // Parse query parameters
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const depth = parseInt(url.searchParams.get("depth") || "1", 10);
    const sort = url.searchParams.get("sort") || "-createdAt";

    // Parse where filter if provided (expects JSON string)
    let where: Record<string, unknown> | undefined;
    const whereParam = url.searchParams.get("where");
    if (whereParam) {
      try {
        where = JSON.parse(whereParam);
      } catch {
        return Response.json(
          { error: "Invalid where parameter. Must be valid JSON." },
          { status: 400 },
        );
      }
    }

    const result = await payloadClient.find(
      {
        collection: "posts",
        limit,
        page,
        depth,
        sort,
        where,
      },
      auth,
    );

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/posts error:", error);
    return createErrorResponse(error);
  }
}

// POST /api/posts
export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    const body = await request.json();

    console.log("[API] POST /api/posts - Request received");
    console.log("[API] Body keys:", Object.keys(body || {}));
    console.log("[API] Has JWT token:", !!auth.jwtToken);

    // Validate required fields
    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const depth = parseInt(url.searchParams.get("depth") || "1", 10);

    // Get the current authenticated user from Payload CMS
    let currentUser: { id: string } | null = null;
    try {
      const meResult = await payloadClient.me<{ id: string }>(auth);
      if (meResult && meResult.id) {
        currentUser = meResult;
        console.log("[API] Current authenticated user ID:", currentUser.id);
      } else {
        console.warn("[API] No authenticated user found via /users/me");
      }
    } catch (meError) {
      console.error("[API] Error getting current user:", meError);
    }

    // Prepare post data
    let postData = { ...body };
    
    // Determine the author ID (priority: username lookup > client-provided > authenticated user)
    let authorId: string | undefined;
    
    // 1. If authorUsername is provided, look up the Payload CMS ID
    if (body.authorUsername) {
      try {
        const userResult = await payloadClient.find({
          collection: "users",
          where: { username: { equals: body.authorUsername } },
          limit: 1,
        }, auth);
        
        if (userResult.docs && userResult.docs.length > 0) {
          authorId = (userResult.docs[0] as { id: string }).id;
          console.log("[API] Found author by username:", authorId);
        } else {
          console.warn("[API] User not found by username:", body.authorUsername);
        }
      } catch (lookupError) {
        console.error("[API] User lookup error:", lookupError);
      }
    }
    
    // 2. If no lookup result but client sent author ID, trust it (already a Payload CMS ID)
    if (!authorId && body.author && typeof body.author === "string") {
      authorId = body.author;
      console.log("[API] Using client-provided author ID:", authorId);
    }
    
    // 3. If still no author, use the current authenticated user
    if (!authorId && currentUser) {
      authorId = currentUser.id;
      console.log("[API] Using authenticated user as author:", authorId);
    }
    
    // Set the final author
    if (authorId) {
      postData.author = authorId;
      console.log("[API] Final author ID:", authorId);
    } else {
      delete postData.author;
      console.warn("[API] No author ID found - letting Payload hook handle it");
    }
    
    // Clean up helper fields
    delete postData.authorUsername;

    console.log("[API] Final postData:", {
      ...postData,
      media: postData.media ? `${Array.isArray(postData.media) ? postData.media.length : 0} items` : "none",
    });

    const result = await payloadClient.create(
      {
        collection: "posts",
        data: postData,
        depth,
      },
      auth,
    );

    console.log("[API] Post created successfully:", result?.id || "unknown");
    return Response.json(result, { status: 201 });
  } catch (error: any) {
    console.error("[API] POST /api/posts error:", error);
    console.error("[API] Error message:", error?.message);
    console.error("[API] Error status:", error?.status);
    console.error("[API] Error details:", JSON.stringify(error, null, 2));
    return createErrorResponse(error);
  }
}
