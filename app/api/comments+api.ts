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

    console.log("[API] POST /api/comments - Request received", {
      hasCookies: !!cookies,
      bodyKeys: Object.keys(body || {}),
      post: body?.post,
      textLength: body?.text?.length,
      authorUsername: body?.authorUsername,
    });

    if (!body || typeof body !== "object") {
      console.error("[API] Invalid request body");
      return Response.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }

    if (!body.post || !body.text) {
      console.error("[API] Missing required fields", { hasPost: !!body.post, hasText: !!body.text });
      return Response.json(
        { error: "post and text are required" },
        { status: 400 },
      );
    }

    // Get current user from session
    let currentUser: { id: string; username: string; email?: string } | null = null;
    try {
      currentUser = await payloadClient.me<{ id: string; username: string; email?: string }>(cookies);
      console.log("[API] Current user from me():", currentUser ? { id: currentUser.id, username: currentUser.username, email: currentUser.email } : "null");
    } catch (meError) {
      console.error("[API] Error getting current user:", meError);
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }
    
    if (!currentUser) {
      console.error("[API] No current user found");
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Verify post exists
    let postId = String(body.post).trim();
    try {
      const post = await payloadClient.findByID({
        collection: "posts",
        id: postId,
      }, cookies);
      
      if (!post) {
        console.error("[API] Post not found:", postId);
        return Response.json(
          { error: "Post not found" },
          { status: 404 },
        );
      }
      console.log("[API] Post verified:", postId);
    } catch (postError) {
      console.error("[API] Post lookup error:", postError);
      return Response.json(
        { error: "Post not found" },
        { status: 404 },
      );
    }

    // CRITICAL: Look up user in Payload CMS to get the correct user ID
    // The currentUser from me() might be from Better Auth, not Payload CMS
    let authorId: string | null = null;
    
    // Try to find user by username first (from authorUsername or currentUser)
    const usernameToLookup = body.authorUsername || currentUser.username;
    console.log("[API] Looking up user by username:", usernameToLookup);
    
    if (usernameToLookup) {
      try {
        const userResult = await payloadClient.find({
          collection: "users",
          where: { username: { equals: usernameToLookup } },
          limit: 1,
        }, cookies);
        
        console.log("[API] Username lookup result:", {
          found: userResult.docs?.length > 0,
          count: userResult.docs?.length || 0,
        });
        
        if (userResult.docs && userResult.docs.length > 0) {
          authorId = (userResult.docs[0] as { id: string }).id;
          console.log("[API] ✓ Found user by username:", usernameToLookup, "->", authorId);
        }
      } catch (lookupError) {
        console.error("[API] User lookup by username error:", lookupError);
      }
    }
    
    // If not found by username, try by email
    if (!authorId && currentUser.email) {
      console.log("[API] Looking up user by email:", currentUser.email);
      try {
        const userResult = await payloadClient.find({
          collection: "users",
          where: { email: { equals: currentUser.email } },
          limit: 1,
        }, cookies);
        
        console.log("[API] Email lookup result:", {
          found: userResult.docs?.length > 0,
          count: userResult.docs?.length || 0,
        });
        
        if (userResult.docs && userResult.docs.length > 0) {
          authorId = (userResult.docs[0] as { id: string }).id;
          console.log("[API] ✓ Found user by email:", currentUser.email, "->", authorId);
        }
      } catch (lookupError) {
        console.error("[API] User lookup by email error:", lookupError);
      }
    }
    
    // If still not found, try using currentUser.id directly (might work if it's a Payload ID)
    if (!authorId && currentUser.id) {
      console.log("[API] Verifying currentUser.id:", currentUser.id);
      try {
        // Try to verify the ID exists in Payload
        const userCheck = await payloadClient.findByID({
          collection: "users",
          id: currentUser.id,
        }, cookies);
        
        if (userCheck) {
          authorId = currentUser.id;
          console.log("[API] ✓ Using currentUser.id directly:", authorId);
        }
      } catch (idError) {
        console.error("[API] User ID verification failed:", idError);
      }
    }
    
    // If we still don't have an author ID, this is a critical error
    if (!authorId) {
      console.error("[API] CRITICAL: Could not find user in Payload CMS", {
        username: usernameToLookup,
        email: currentUser.email,
        currentUserId: currentUser.id,
        cookiesPresent: !!cookies,
      });
      return Response.json(
        { error: "User not found in system. Please try logging in again." },
        { status: 401 },
      );
    }
    
    const commentData: Record<string, unknown> = {
      post: postId,
      content: String(body.text).trim(), // CMS expects 'content' field, ensure it's a string
      author: authorId, // Always set author with Payload CMS user ID
    };
    
    // Only add parent if it exists and is not empty
    if (body.parent && String(body.parent).trim()) {
      commentData.parent = String(body.parent).trim();
    }
    
    console.log("[API] Creating comment with data:", {
      post: postId,
      content: String(body.text).trim().substring(0, 50),
      author: authorId,
      hasParent: !!commentData.parent,
      parent: commentData.parent,
    });

    try {
      const result = await payloadClient.create(
        {
          collection: "comments",
          data: commentData,
          depth: 2,
        },
        cookies,
      );

      console.log("[API] ✓ Comment created successfully:", result?.id || "unknown");
      return Response.json(result, { status: 201 });
    } catch (createError: any) {
      console.error("[API] Payload create error:", {
        message: createError?.message,
        status: createError?.status,
        errors: createError?.errors,
        data: commentData,
      });
      
      // Return more detailed error message
      const errorMessage = createError?.message || "Failed to create comment";
      const errors = createError?.errors || [];
      
      return Response.json(
        {
          error: errorMessage,
          errors: errors,
          details: "content, post, and author are required",
        },
        { status: createError?.status || 500 },
      );
    }
  } catch (error) {
    console.error("[API] POST /api/comments error:", error);
    return createErrorResponse(error);
  }
}
