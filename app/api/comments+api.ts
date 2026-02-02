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
    const parentId = url.searchParams.get("parentId"); // For fetching replies
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const depth = parseInt(url.searchParams.get("depth") || "2", 10);

    // If parentId is provided, fetch replies to that comment
    if (parentId) {
      const result = await payloadClient.find(
        {
          collection: "comments",
          limit,
          page,
          depth,
          sort: "-createdAt",
          where: {
            parent: { equals: parentId },
          },
        },
        cookies,
      );
      return Response.json(result);
    }

    // Otherwise, fetch top-level comments for a post
    if (!postId) {
      return Response.json({ error: "postId or parentId is required" }, { status: 400 });
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

    // Get current user from session - this is critical for Payload hooks to work
    let currentUser: { id: string; username: string; email?: string } | null = null;
    try {
      currentUser = await payloadClient.me<{ id: string; username: string; email?: string }>(cookies);
      console.log("[API] Current user from me():", currentUser ? { id: currentUser.id, username: currentUser.username, email: currentUser.email } : "null");
    } catch (meError) {
      console.error("[API] Error getting current user:", meError);
      // Don't fail immediately - let the hook try to set author
      console.warn("[API] Could not get current user, but proceeding - hook may set author");
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

    // CRITICAL: We MUST find the Payload CMS user ID - the hook might not work with API key auth
    // The client sends Better Auth ID (user.id from Zustand), but we need Payload CMS ID
    let authorId: string | null = null;
    
    // PRIORITY 1: Look up user by username - this is the MOST RELIABLE method
    // The username is the same across Better Auth and Payload CMS
    const usernameToLookup = body.authorUsername || currentUser?.username;
    console.log("[API] Looking up user by username (primary method):", usernameToLookup);
    
    if (usernameToLookup) {
      try {
        const userResult = await payloadClient.find({
          collection: "users",
          where: { username: { equals: usernameToLookup } },
          limit: 1,
        }, cookies);
        
        if (userResult.docs && userResult.docs.length > 0) {
          authorId = (userResult.docs[0] as { id: string }).id;
          console.log("[API] ✓ Found user by username:", usernameToLookup, "-> Payload ID:", authorId);
        } else {
          console.warn("[API] User not found by username:", usernameToLookup);
        }
      } catch (lookupError) {
        console.error("[API] User lookup by username error:", lookupError);
      }
    }
    
    // PRIORITY 2: Try by email if username lookup failed
    if (!authorId && currentUser?.email) {
      console.log("[API] Looking up user by email:", currentUser.email);
      try {
        const userResult = await payloadClient.find({
          collection: "users",
          where: { email: { equals: currentUser.email } },
          limit: 1,
        }, cookies);
        
        if (userResult.docs && userResult.docs.length > 0) {
          authorId = (userResult.docs[0] as { id: string }).id;
          console.log("[API] ✓ Found user by email:", currentUser.email, "-> Payload ID:", authorId);
        }
      } catch (lookupError) {
        console.error("[API] User lookup by email error:", lookupError);
      }
    }
    
    // PRIORITY 3: Try authorId from client directly (might be Payload ID in some cases)
    if (!authorId && body.authorId && String(body.authorId).trim()) {
      const clientAuthorId = String(body.authorId).trim();
      try {
        const userCheck = await payloadClient.findByID({
          collection: "users",
          id: clientAuthorId,
        }, cookies);
        
        if (userCheck) {
          authorId = clientAuthorId;
          console.log("[API] ✓ Using authorId from client:", authorId);
        }
      } catch (idError) {
        console.warn("[API] Client authorId not found in Payload:", clientAuthorId);
      }
    }
    
    // PRIORITY 4: Try currentUser.id if it exists
    if (!authorId && currentUser?.id) {
      try {
        const userCheck = await payloadClient.findByID({
          collection: "users",
          id: currentUser.id,
        }, cookies);
        
        if (userCheck) {
          authorId = currentUser.id;
          console.log("[API] ✓ Using currentUser.id:", authorId);
        }
      } catch (idError) {
        console.warn("[API] currentUser.id not valid Payload ID:", currentUser.id);
      }
    }
    
    // CRITICAL: If we still don't have authorId, we MUST fail
    if (!authorId) {
      console.error("[API] CRITICAL: Could not find user in Payload CMS", {
        username: usernameToLookup,
        email: currentUser?.email,
        currentUserId: currentUser?.id,
        bodyAuthorId: body.authorId,
        cookiesPresent: !!cookies,
      });
      return Response.json(
        { 
          error: "User not found in system. Please try logging in again.",
          details: `Username '${usernameToLookup}' not found in Payload CMS. The user may need to be synced.`,
        },
        { status: 401 },
      );
    }
    
    // Validate content is not empty after trimming
    const content = String(body.text || "").trim();
    if (!content || content.length === 0) {
      console.error("[API] Content is empty after trimming");
      return Response.json(
        { error: "Comment text cannot be empty" },
        { status: 400 },
      );
    }
    
    // Validate post ID format (should be MongoDB ObjectID or valid string)
    if (!postId || postId.length === 0) {
      console.error("[API] Post ID is empty");
      return Response.json(
        { error: "Post ID is required" },
        { status: 400 },
      );
    }
    
    // Build comment data - ensure all required fields are present
    // CRITICAL: We MUST set author explicitly - API key auth prevents hooks from setting req.user
    const commentData: Record<string, unknown> = {
      post: postId, // Must be a valid post ID
      content: content, // Must be non-empty string
      author: authorId, // MUST be set explicitly - hook won't work with API key auth
    };
    
    console.log("[API] Setting author explicitly:", authorId);
    
    // Only add parent if it exists and is not empty
    if (body.parent && String(body.parent).trim()) {
      commentData.parent = String(body.parent).trim();
    }
    
    console.log("[API] Creating comment with validated data:", {
      post: postId,
      postIdType: typeof postId,
      postIdLength: postId.length,
      content: content.substring(0, 50),
      contentLength: content.length,
      author: authorId,
      authorIdType: typeof authorId,
      authorIdLength: authorId.length,
      hasParent: !!commentData.parent,
      parent: commentData.parent,
    });

    try {
      // CRITICAL: Ensure we're sending the data correctly to Payload
      // Payload expects relationships as IDs (strings), not objects
      // If we don't have authorId, we MUST ensure cookies are passed so the hook can set it
      console.log("[API] Creating comment - cookies present:", !!cookies);
      console.log("[API] Comment data being sent:", {
        post: commentData.post,
        content: String(commentData.content || "").substring(0, 30),
        hasAuthor: !!commentData.author,
        author: commentData.author,
      });
      
      const result = await payloadClient.create(
        {
          collection: "comments",
          data: commentData,
          depth: 2,
        },
        cookies, // CRITICAL: Pass cookies so Payload can authenticate and set req.user
      );

      console.log("[API] ✓ Comment created successfully:", {
        id: result?.id || "unknown",
        author: (result as any)?.author,
        post: (result as any)?.post,
        content: ((result as any)?.content || "").substring(0, 50),
      });
      return Response.json(result, { status: 201 });
    } catch (createError: any) {
      console.error("[API] Payload create error - FULL DETAILS:", {
        message: createError?.message,
        status: createError?.status,
        errors: createError?.errors,
        stack: createError?.stack,
        dataSent: commentData,
        dataTypes: {
          post: typeof commentData.post,
          content: typeof commentData.content,
          author: typeof commentData.author,
        },
      });
      
      // Extract detailed error information
      const errorMessage = createError?.message || "Failed to create comment";
      const errors = createError?.errors || [];
      
      // Check if it's a validation error
      if (errors.length > 0) {
        const validationErrors = errors.map((e: any) => ({
          field: e.field || e.path || "unknown",
          message: e.message || e.msg || "Validation error",
        }));
        console.error("[API] Validation errors:", validationErrors);
      }
      
      return Response.json(
        {
          error: errorMessage,
          errors: errors,
          details: "content, post, and author are required",
          debug: {
            postId,
            contentLength: content.length,
            authorId,
            dataSent: commentData,
          },
        },
        { status: createError?.status || 500 },
      );
    }
  } catch (error) {
    console.error("[API] POST /api/comments error:", error);
    return createErrorResponse(error);
  }
}
