/**
 * Post Like API Route
 *
 * POST /api/posts/:id/like - Like or unlike a post
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

export async function POST(
  request: Request,
  { id }: { id: string },
) {
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

    // Get the post
    const post = await payloadClient.findByID(
      {
        collection: "posts",
        id,
      },
      cookies,
    );

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    // Get current user's liked posts
    const currentUserData = await payloadClient.findByID(
      {
        collection: "users",
        id: currentUser.id,
      },
      cookies,
    );

    // Handle Payload array format for likedPosts
    let likedPosts: string[] = [];
    if (Array.isArray((currentUserData as any)?.likedPosts)) {
      likedPosts = (currentUserData as any).likedPosts.map((item: any) => {
        if (typeof item === "string") return item;
        if (item?.post) return String(item.post);
        if (item?.id) return String(item.id);
        return String(item);
      });
    }

    const isLiked = likedPosts.includes(String(id));

    if (action === "like") {
      if (isLiked) {
        return Response.json({
          message: "Already liked",
          liked: true,
          likes: ((post as any).likes || 0) as number,
        });
      }

      // Add to liked posts list
      const updatedLikedPosts = [...likedPosts, String(id)].map((postId) => ({
        post: postId,
      }));

      await payloadClient.update(
        {
          collection: "users",
          id: currentUser.id,
          data: {
            likedPosts: updatedLikedPosts,
          },
        },
        cookies,
      );

      // Update post's like count
      const currentLikes = ((post as any).likes as number) || 0;
      const newLikes = currentLikes + 1;

      await payloadClient.update(
        {
          collection: "posts",
          id,
          data: {
            likes: newLikes,
          },
        },
        cookies,
      );

      return Response.json({
        message: "Post liked successfully",
        liked: true,
        likes: newLikes,
      });
    } else {
      // unlike
      if (!isLiked) {
        return Response.json({
          message: "Not liked",
          liked: false,
          likes: ((post as any).likes || 0) as number,
        });
      }

      // Remove from liked posts list
      const updatedLikedPosts = likedPosts
        .filter((postId) => String(postId) !== String(id))
        .map((postId) => ({
          post: postId,
        }));

      await payloadClient.update(
        {
          collection: "users",
          id: currentUser.id,
          data: {
            likedPosts: updatedLikedPosts,
          },
        },
        cookies,
      );

      // Update post's like count
      const currentLikes = ((post as any).likes as number) || 0;
      const newLikes = Math.max(0, currentLikes - 1);

      await payloadClient.update(
        {
          collection: "posts",
          id,
          data: {
            likes: newLikes,
          },
        },
        cookies,
      );

      return Response.json({
        message: "Post unliked successfully",
        liked: false,
        likes: newLikes,
      });
    }
  } catch (error) {
    console.error("[API] POST /api/posts/:id/like error:", error);
    return createErrorResponse(error);
  }
}
