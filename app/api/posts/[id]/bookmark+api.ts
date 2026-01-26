/**
 * Post Bookmark API Route
 *
 * POST /api/posts/:id/bookmark - Bookmark or unbookmark a post
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

    const { action } = body; // "bookmark" or "unbookmark"

    if (!action || (action !== "bookmark" && action !== "unbookmark")) {
      return Response.json(
        { error: "action must be 'bookmark' or 'unbookmark'" },
        { status: 400 },
      );
    }

    // Get current user
    const currentUser = await payloadClient.me<{ id: string }>(cookies);
    if (!currentUser || !currentUser.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Verify post exists
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

    // Get current user's bookmarked posts
    const currentUserData = await payloadClient.findByID(
      {
        collection: "users",
        id: currentUser.id,
      },
      cookies,
    );

    // Handle Payload array format for bookmarkedPosts
    let bookmarkedPosts: string[] = [];
    if (Array.isArray((currentUserData as any)?.bookmarkedPosts)) {
      bookmarkedPosts = (currentUserData as any).bookmarkedPosts.map(
        (item: any) => {
          if (typeof item === "string") return item;
          if (item?.post) return String(item.post);
          if (item?.id) return String(item.id);
          return String(item);
        },
      );
    }

    const isBookmarked = bookmarkedPosts.includes(String(id));

    if (action === "bookmark") {
      if (isBookmarked) {
        return Response.json({
          message: "Already bookmarked",
          bookmarked: true,
        });
      }

      // Add to bookmarked posts list
      const updatedBookmarkedPosts = [...bookmarkedPosts, String(id)].map(
        (postId) => ({
          post: postId,
        }),
      );

      await payloadClient.update(
        {
          collection: "users",
          id: currentUser.id,
          data: {
            bookmarkedPosts: updatedBookmarkedPosts,
          },
        },
        cookies,
      );

      return Response.json({
        message: "Post bookmarked successfully",
        bookmarked: true,
      });
    } else {
      // unbookmark
      if (!isBookmarked) {
        return Response.json({
          message: "Not bookmarked",
          bookmarked: false,
        });
      }

      // Remove from bookmarked posts list
      const updatedBookmarkedPosts = bookmarkedPosts
        .filter((postId) => String(postId) !== String(id))
        .map((postId) => ({
          post: postId,
        }));

      await payloadClient.update(
        {
          collection: "users",
          id: currentUser.id,
          data: {
            bookmarkedPosts: updatedBookmarkedPosts,
          },
        },
        cookies,
      );

      return Response.json({
        message: "Post unbookmarked successfully",
        bookmarked: false,
      });
    }
  } catch (error) {
    console.error("[API] POST /api/posts/:id/bookmark error:", error);
    return createErrorResponse(error);
  }
}
