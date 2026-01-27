/**
 * Follow/Unfollow User API Route
 *
 * POST /api/users/follow - Follow or unfollow a user
 *
 * STABILIZED: Uses dedicated `follows` collection with proper invariants.
 * - Idempotent: follow twice -> NOOP (409); unfollow when none -> NOOP (200)
 * - Count updates handled by collection hooks
 * - Notifications handled by collection hooks
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

    const followerId = String(currentUser.id);
    const followingId = String(userId);

    // INVARIANT: User cannot follow themselves
    if (followerId === followingId) {
      console.error("[API/follow] INVARIANT: Self-follow attempted", {
        userId: followerId,
      });
      return Response.json(
        {
          error: "Cannot follow yourself",
          code: "SELF_FOLLOW_FORBIDDEN",
        },
        { status: 409 },
      );
    }

    // Verify target user exists
    const targetUser = await payloadClient.findByID(
      {
        collection: "users",
        id: followingId,
      },
      cookies,
    );

    if (!targetUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Check if follow relationship exists
    const existingFollow = await payloadClient.find(
      {
        collection: "follows",
        where: {
          and: [
            { follower: { equals: followerId } },
            { following: { equals: followingId } },
          ],
        },
        limit: 1,
      },
      cookies,
    );

    const isFollowing = existingFollow.docs && existingFollow.docs.length > 0;

    if (action === "follow") {
      // IDEMPOTENT: Already following -> return success with current state
      if (isFollowing) {
        console.log("[API/follow] Already following, returning current state");
        // Get fresh count
        const freshTargetUser = await payloadClient.findByID(
          { collection: "users", id: followingId },
          cookies,
        );
        return Response.json({
          message: "Already following",
          following: true,
          followersCount: (freshTargetUser?.followersCount as number) || 0,
        });
      }

      // CREATE follow record in dedicated collection
      // Hooks in Follows.ts handle: duplicate prevention, count updates, notifications
      try {
        await payloadClient.create(
          {
            collection: "follows",
            data: {
              follower: followerId,
              following: followingId,
            },
          },
          cookies,
        );

        console.log("[API/follow] Follow created:", {
          follower: followerId,
          following: followingId,
        });

        // Get fresh count after hook updates
        const freshTargetUser = await payloadClient.findByID(
          { collection: "users", id: followingId },
          cookies,
        );

        return Response.json({
          message: "User followed successfully",
          following: true,
          followersCount: (freshTargetUser?.followersCount as number) || 0,
        });
      } catch (createError: any) {
        // Handle duplicate (409) gracefully - shouldn't happen due to check above
        if (createError.status === 409) {
          console.log("[API/follow] Duplicate follow prevented by hook");
          return Response.json({
            message: "Already following",
            following: true,
            followersCount: (targetUser.followersCount as number) || 0,
          });
        }
        throw createError;
      }
    } else {
      // UNFOLLOW
      // IDEMPOTENT: Not following -> return success with current state
      if (!isFollowing) {
        console.log("[API/follow] Not following, returning current state");
        return Response.json({
          message: "Not following",
          following: false,
          followersCount: (targetUser.followersCount as number) || 0,
        });
      }

      // DELETE follow record
      // Hooks in Follows.ts handle: count updates
      const followId = (existingFollow.docs[0] as any).id;
      await payloadClient.delete(
        {
          collection: "follows",
          id: followId,
        },
        cookies,
      );

      console.log("[API/follow] Follow deleted:", {
        followId,
        follower: followerId,
        following: followingId,
      });

      // Get fresh count after hook updates
      const freshTargetUser = await payloadClient.findByID(
        { collection: "users", id: followingId },
        cookies,
      );

      return Response.json({
        message: "User unfollowed successfully",
        following: false,
        followersCount: (freshTargetUser?.followersCount as number) || 0,
      });
    }
  } catch (error) {
    console.error("[API/follow] Error:", error);
    return createErrorResponse(error);
  }
}

// GET: Check if current user is following a user
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const cookies = getCookiesFromRequest(request);

    if (!userId) {
      return Response.json(
        { error: "userId query parameter is required" },
        { status: 400 },
      );
    }

    const currentUser = await payloadClient.me(cookies);
    if (!currentUser || !currentUser.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const followerId = String(currentUser.id);
    const followingId = String(userId);

    const existingFollow = await payloadClient.find(
      {
        collection: "follows",
        where: {
          and: [
            { follower: { equals: followerId } },
            { following: { equals: followingId } },
          ],
        },
        limit: 1,
      },
      cookies,
    );

    const isFollowing = existingFollow.docs && existingFollow.docs.length > 0;

    return Response.json({ following: isFollowing });
  } catch (error) {
    console.error("[API/follow] GET error:", error);
    return createErrorResponse(error);
  }
}
