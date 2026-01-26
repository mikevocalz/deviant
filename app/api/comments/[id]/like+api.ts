/**
 * Comment Like API Route
 *
 * POST /api/comments/:id/like - Like or unlike a comment
 */

import {
  payloadClient,
  getAuthFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

export async function POST(
  request: Request,
  { id }: { id: string },
) {
  try {
    const auth = getAuthFromRequest(request);
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
    const currentUser = await payloadClient.me<{ id: string }>(auth);
    if (!currentUser || !currentUser.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get the comment
    const comment = await payloadClient.findByID(
      {
        collection: "comments",
        id,
      },
      auth,
    );

    if (!comment) {
      return Response.json({ error: "Comment not found" }, { status: 404 });
    }

    // Get current user's liked comments
    const currentUserData = await payloadClient.findByID(
      {
        collection: "users",
        id: currentUser.id,
      },
      auth,
    );

    // Handle Payload array format for likedComments
    let likedComments: string[] = [];
    if (Array.isArray((currentUserData as any)?.likedComments)) {
      likedComments = (currentUserData as any).likedComments.map(
        (item: any) => {
          if (typeof item === "string") return item;
          if (item?.comment) return String(item.comment);
          if (item?.id) return String(item.id);
          return String(item);
        },
      );
    }

    const isLiked = likedComments.includes(String(id));

    if (action === "like") {
      if (isLiked) {
        return Response.json({
          message: "Already liked",
          liked: true,
          likes: ((comment as any).likes || 0) as number,
        });
      }

      // Add to liked comments list
      const updatedLikedComments = [...likedComments, String(id)].map(
        (commentId) => ({
          comment: commentId,
        }),
      );

      await payloadClient.update(
        {
          collection: "users",
          id: currentUser.id,
          data: {
            likedComments: updatedLikedComments,
          },
        },
        auth,
      );

      // Update comment's like count
      const currentLikes = ((comment as any).likes as number) || 0;
      const newLikes = currentLikes + 1;

      await payloadClient.update(
        {
          collection: "comments",
          id,
          data: {
            likes: newLikes,
          },
        },
        auth,
      );

      return Response.json({
        message: "Comment liked successfully",
        liked: true,
        likes: newLikes,
      });
    } else {
      // unlike
      if (!isLiked) {
        return Response.json({
          message: "Not liked",
          liked: false,
          likes: ((comment as any).likes || 0) as number,
        });
      }

      // Remove from liked comments list
      const updatedLikedComments = likedComments
        .filter((commentId) => String(commentId) !== String(id))
        .map((commentId) => ({
          comment: commentId,
        }));

      await payloadClient.update(
        {
          collection: "users",
          id: currentUser.id,
          data: {
            likedComments: updatedLikedComments,
          },
        },
        auth,
      );

      // Update comment's like count
      const currentLikes = ((comment as any).likes as number) || 0;
      const newLikes = Math.max(0, currentLikes - 1);

      await payloadClient.update(
        {
          collection: "comments",
          id,
          data: {
            likes: newLikes,
          },
        },
        auth,
      );

      return Response.json({
        message: "Comment unliked successfully",
        liked: false,
        likes: newLikes,
      });
    }
  } catch (error) {
    console.error("[API] POST /api/comments/:id/like error:", error);
    return createErrorResponse(error);
  }
}
