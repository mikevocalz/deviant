/**
 * Current User API Route
 *
 * GET   /api/users/me - Get the currently authenticated user
 * PATCH /api/users/me - Update the currently authenticated user
 *
 * Uses cookie-based auth forwarding to identify the user.
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

// GET /api/users/me
export async function GET(request: Request) {
  try {
    const cookies = getCookiesFromRequest(request);
    const url = new URL(request.url);
    const includeBookmarks =
      url.searchParams.get("includeBookmarks") === "true";
    const includeLikedPosts =
      url.searchParams.get("includeLikedPosts") === "true";

    const user = await payloadClient.me(cookies);

    if (!user) {
      return Response.json(
        { error: "Not authenticated", user: null },
        { status: 401 },
      );
    }

    // If includeBookmarks or includeLikedPosts is requested, fetch full user data
    if (includeBookmarks || includeLikedPosts) {
      const userData = await payloadClient.findByID(
        {
          collection: "users",
          id: (user as any).id,
        },
        cookies,
      );

      const response: {
        user: typeof user;
        bookmarkedPosts?: string[];
        likedPosts?: string[];
      } = { user };

      if (includeBookmarks) {
        const bookmarkedPosts = (userData as any)?.bookmarkedPosts || [];
        response.bookmarkedPosts = Array.isArray(bookmarkedPosts)
          ? bookmarkedPosts.map((item: any) => {
              if (typeof item === "string") return item;
              if (item?.post) return String(item.post);
              if (item?.id) return String(item.id);
              return String(item);
            })
          : [];
      }

      if (includeLikedPosts) {
        const likedPosts = (userData as any)?.likedPosts || [];
        response.likedPosts = Array.isArray(likedPosts)
          ? likedPosts.map((item: any) => {
              if (typeof item === "string") return item;
              if (item?.post) return String(item.post);
              if (item?.id) return String(item.id);
              return String(item);
            })
          : [];
      }

      return Response.json(response);
    }

    return Response.json({ user });
  } catch (error) {
    console.error("[API] GET /api/users/me error:", error);
    return createErrorResponse(error);
  }
}

// PATCH /api/users/me - Update current user profile
export async function PATCH(request: Request) {
  try {
    const cookies = getCookiesFromRequest(request);
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }

    // First get the current user to get their ID
    const currentUser = await payloadClient.me<{ id: string }>(cookies);

    if (!currentUser) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Also check by username if provided
    let userId = currentUser.id;

    if (body.username && !userId) {
      // Look up user by username
      const userResult = await payloadClient.find(
        {
          collection: "users",
          where: { username: { equals: body.username } },
          limit: 1,
        },
        cookies,
      );

      if (userResult.docs && userResult.docs.length > 0) {
        userId = (userResult.docs[0] as { id: string }).id;
      }
    }

    if (!userId) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    // Only allow updating specific fields
    const allowedFields = [
      "name",
      "bio",
      "avatar",
      "website",
      "location",
      "hashtags",
    ];
    const updateData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updatedUser = await payloadClient.update(
      {
        collection: "users",
        id: userId,
        data: updateData,
      },
      cookies,
    );

    return Response.json({ user: updatedUser });
  } catch (error) {
    console.error("[API] PATCH /api/users/me error:", error);
    return createErrorResponse(error);
  }
}
