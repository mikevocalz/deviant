/**
 * Post Like API Route
 *
 * POST /api/posts/:id/like - Like or unlike a post
 *
 * STABILIZED: Uses dedicated `likes` collection with proper invariants.
 * - Idempotent: like twice -> NOOP (returns current state)
 * - Count updates handled by collection hooks (likesCount on post)
 * - Notifications handled by collection hooks
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

export async function POST(request: Request, { id }: { id: string }) {
  try {
    const cookies = getCookiesFromRequest(request);
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }

    const { action } = body; // "like" or "unlike"

    if (!action || (action !== "like" && action !== "unlike")) {
      return Response.json(
        { error: "action must be 'like' or 'unlike'" },
        { status: 400 },
      );
    }

    // Get current user
    const currentUser = await payloadClient.me<{ id: string }>(cookies);
    if (!currentUser || !currentUser.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = String(currentUser.id);
    const postId = String(id);

    // Verify post exists and get current count
    const post = await payloadClient.findByID(
      {
        collection: "posts",
        id: postId,
        depth: 0,
      },
      cookies,
    );

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if like already exists in dedicated collection
    const existingLike = await payloadClient.find(
      {
        collection: "likes",
        where: {
          and: [{ user: { equals: userId } }, { post: { equals: postId } }],
        },
        limit: 1,
      },
      cookies,
    );

    const isLiked = existingLike.docs && existingLike.docs.length > 0;

    if (action === "like") {
      // IDEMPOTENT: Already liked -> return current state
      if (isLiked) {
        console.log("[API/like] Already liked, returning current state");
        // Get fresh count
        const freshPost = await payloadClient.findByID(
          { collection: "posts", id: postId, depth: 0 },
          cookies,
        );
        return Response.json({
          message: "Already liked",
          liked: true,
          likes:
            (freshPost?.likesCount as number) || (freshPost as any)?.likes || 0,
        });
      }

      // CREATE like record in dedicated collection
      // Hooks in Likes.ts handle: duplicate prevention, count updates, notifications
      try {
        await payloadClient.create(
          {
            collection: "likes",
            data: {
              user: userId,
              post: postId,
            },
          },
          cookies,
        );

        console.log("[API/like] Like created:", { user: userId, post: postId });

        // Get fresh count after hook updates
        const freshPost = await payloadClient.findByID(
          { collection: "posts", id: postId, depth: 0 },
          cookies,
        );

        return Response.json({
          message: "Post liked successfully",
          liked: true,
          likes:
            (freshPost?.likesCount as number) || (freshPost as any)?.likes || 0,
        });
      } catch (createError: any) {
        // Handle duplicate gracefully
        if (createError.message?.includes("already liked")) {
          console.log("[API/like] Duplicate like prevented by hook");
          return Response.json({
            message: "Already liked",
            liked: true,
            likes: (post.likesCount as number) || (post as any)?.likes || 0,
          });
        }
        throw createError;
      }
    } else {
      // UNLIKE
      // IDEMPOTENT: Not liked -> return current state
      if (!isLiked) {
        console.log("[API/like] Not liked, returning current state");
        return Response.json({
          message: "Not liked",
          liked: false,
          likes: (post.likesCount as number) || (post as any)?.likes || 0,
        });
      }

      // DELETE like record
      // Hooks in Likes.ts handle: count updates
      const likeId = (existingLike.docs[0] as any).id;
      await payloadClient.delete(
        {
          collection: "likes",
          id: likeId,
        },
        cookies,
      );

      console.log("[API/like] Like deleted:", {
        likeId,
        user: userId,
        post: postId,
      });

      // Get fresh count after hook updates
      const freshPost = await payloadClient.findByID(
        { collection: "posts", id: postId, depth: 0 },
        cookies,
      );

      return Response.json({
        message: "Post unliked successfully",
        liked: false,
        likes:
          (freshPost?.likesCount as number) || (freshPost as any)?.likes || 0,
      });
    }
  } catch (error) {
    console.error("[API/like] Error:", error);
    return createErrorResponse(error);
  }
}

// GET: Check if current user has liked a post
export async function GET(request: Request, { id }: { id: string }) {
  try {
    const cookies = getCookiesFromRequest(request);

    const currentUser = await payloadClient.me<{ id: string }>(cookies);
    if (!currentUser || !currentUser.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = String(currentUser.id);
    const postId = String(id);

    const existingLike = await payloadClient.find(
      {
        collection: "likes",
        where: {
          and: [{ user: { equals: userId } }, { post: { equals: postId } }],
        },
        limit: 1,
      },
      cookies,
    );

    const isLiked = existingLike.docs && existingLike.docs.length > 0;

    // Get current count
    const post = await payloadClient.findByID(
      { collection: "posts", id: postId, depth: 0 },
      cookies,
    );

    return Response.json({
      liked: isLiked,
      likes: (post?.likesCount as number) || (post as any)?.likes || 0,
    });
  } catch (error) {
    console.error("[API/like] GET error:", error);
    return createErrorResponse(error);
  }
}
