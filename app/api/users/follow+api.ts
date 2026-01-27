/**
 * Follow/Unfollow User API Route
 *
 * POST /api/users/follow - Follow or unfollow a user
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

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

    const { userId, action } = body;

    if (!userId || !action) {
      return Response.json(
        { error: "userId and action (follow/unfollow) are required" },
        { status: 400 },
      );
    }

    if (action !== "follow" && action !== "unfollow") {
      return Response.json(
        { error: "action must be 'follow' or 'unfollow'" },
        { status: 400 },
      );
    }

    // Get current user
    const currentUser = await payloadClient.me(cookies);
    if (!currentUser || !currentUser.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // PHASE 1.3: ENFORCE SELF-FOLLOW PREVENTION
    // Invariant: User cannot follow themselves
    if (String(currentUser.id) === String(userId)) {
      console.error("[API] INVARIANT VIOLATION: Self-follow attempted", {
        userId: currentUser.id,
      });
      return Response.json(
        {
          error: "Cannot follow yourself",
          code: "SELF_FOLLOW_FORBIDDEN",
        },
        { status: 409 }, // 409 Conflict - invariant violation
      );
    }

    // Get target user
    const targetUser = await payloadClient.findByID(
      {
        collection: "users",
        id: userId,
      },
      cookies,
    );

    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Get current user's following list (stored as array of user IDs)
    const currentUserData = await payloadClient.findByID(
      {
        collection: "users",
        id: String(currentUser.id),
      },
      cookies,
    );

    // Handle Payload array format (array of objects with 'user' field)
    let following: string[] = [];
    if (Array.isArray(currentUserData?.following)) {
      following = currentUserData.following
        .map((item: any) => {
          if (typeof item === "string") return item;
          if (item?.user) return String(item.user);
          if (item?.id) return String(item.id);
          return String(item);
        })
        .filter((id: string) => id && id !== "undefined" && id !== "null");
    }

    const isFollowing = following.includes(String(userId));

    if (action === "follow") {
      if (isFollowing) {
        return Response.json({ message: "Already following", following: true });
      }

      // Add to following list (Payload expects array of objects with 'user' field)
      const updatedFollowing = [...following, String(userId)].map((id) => ({
        user: id,
      }));
      await payloadClient.update(
        {
          collection: "users",
          id: String(currentUser.id),
          data: {
            following: updatedFollowing,
            followingCount: updatedFollowing.length,
          },
        },
        cookies,
      );

      // Update target user's followers count
      const targetFollowersCount =
        ((targetUser.followersCount as number) || 0) + 1;
      await payloadClient.update(
        {
          collection: "users",
          id: userId,
          data: {
            followersCount: targetFollowersCount,
          },
        },
        cookies,
      );

      return Response.json({
        message: "User followed successfully",
        following: true,
        followersCount: targetFollowersCount,
      });
    } else {
      // unfollow
      if (!isFollowing) {
        return Response.json({ message: "Not following", following: false });
      }

      // Remove from following list (Payload expects array of objects with 'user' field)
      const updatedFollowing = following
        .filter((id) => String(id) !== String(userId))
        .map((id) => ({ user: id }));
      await payloadClient.update(
        {
          collection: "users",
          id: String(currentUser.id),
          data: {
            following: updatedFollowing,
            followingCount: updatedFollowing.length,
          },
        },
        cookies,
      );

      // Update target user's followers count
      const targetFollowersCount = Math.max(
        ((targetUser.followersCount as number) || 0) - 1,
        0,
      );
      await payloadClient.update(
        {
          collection: "users",
          id: userId,
          data: {
            followersCount: targetFollowersCount,
          },
        },
        cookies,
      );

      return Response.json({
        message: "User unfollowed successfully",
        following: false,
        followersCount: targetFollowersCount,
      });
    }
  } catch (error) {
    console.error("[API] POST /api/users/follow error:", error);
    return createErrorResponse(error);
  }
}
