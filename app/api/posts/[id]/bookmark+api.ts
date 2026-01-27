/**
 * Post Bookmark API Route
 *
 * POST /api/posts/:id/bookmark - Bookmark or unbookmark a post
 *
 * STABILIZED: Uses dedicated `bookmarks` collection with proper invariants.
 * - Idempotent: bookmark twice -> NOOP (returns current state)
 * - Owner-only read (via collection access rules)
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

    const userId = String(currentUser.id);
    const postId = String(id);

    // Verify post exists
    const post = await payloadClient.findByID(
      {
        collection: "posts",
        id: postId,
      },
      cookies,
    );

    if (!post) {
      return Response.json({ error: "Post not found" }, { status: 404 });
    }

    // Check if bookmark already exists in dedicated collection
    const existingBookmark = await payloadClient.find(
      {
        collection: "bookmarks",
        where: {
          and: [{ user: { equals: userId } }, { post: { equals: postId } }],
        },
        limit: 1,
      },
      cookies,
    );

    const isBookmarked =
      existingBookmark.docs && existingBookmark.docs.length > 0;

    if (action === "bookmark") {
      // IDEMPOTENT: Already bookmarked -> return current state
      if (isBookmarked) {
        console.log(
          "[API/bookmark] Already bookmarked, returning current state",
        );
        return Response.json({
          message: "Already bookmarked",
          bookmarked: true,
        });
      }

      // CREATE bookmark record in dedicated collection
      // Hooks in Bookmarks.ts handle: duplicate prevention
      try {
        await payloadClient.create(
          {
            collection: "bookmarks",
            data: {
              user: userId,
              post: postId,
            },
          },
          cookies,
        );

        console.log("[API/bookmark] Bookmark created:", {
          user: userId,
          post: postId,
        });

        return Response.json({
          message: "Post bookmarked successfully",
          bookmarked: true,
        });
      } catch (createError: any) {
        // Handle duplicate (409) gracefully
        if (
          createError.status === 409 ||
          createError.message?.includes("already bookmarked")
        ) {
          console.log("[API/bookmark] Duplicate bookmark prevented by hook");
          return Response.json({
            message: "Already bookmarked",
            bookmarked: true,
          });
        }
        throw createError;
      }
    } else {
      // UNBOOKMARK
      // IDEMPOTENT: Not bookmarked -> return current state
      if (!isBookmarked) {
        console.log("[API/bookmark] Not bookmarked, returning current state");
        return Response.json({
          message: "Not bookmarked",
          bookmarked: false,
        });
      }

      // DELETE bookmark record
      const bookmarkId = (existingBookmark.docs[0] as any).id;
      await payloadClient.delete(
        {
          collection: "bookmarks",
          id: bookmarkId,
        },
        cookies,
      );

      console.log("[API/bookmark] Bookmark deleted:", {
        bookmarkId,
        user: userId,
        post: postId,
      });

      return Response.json({
        message: "Post unbookmarked successfully",
        bookmarked: false,
      });
    }
  } catch (error) {
    console.error("[API/bookmark] Error:", error);
    return createErrorResponse(error);
  }
}

// GET: Check if current user has bookmarked a post
export async function GET(request: Request, { id }: { id: string }) {
  try {
    const cookies = getCookiesFromRequest(request);

    const currentUser = await payloadClient.me<{ id: string }>(cookies);
    if (!currentUser || !currentUser.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userId = String(currentUser.id);
    const postId = String(id);

    const existingBookmark = await payloadClient.find(
      {
        collection: "bookmarks",
        where: {
          and: [{ user: { equals: userId } }, { post: { equals: postId } }],
        },
        limit: 1,
      },
      cookies,
    );

    const isBookmarked =
      existingBookmark.docs && existingBookmark.docs.length > 0;

    return Response.json({ bookmarked: isBookmarked });
  } catch (error) {
    console.error("[API/bookmark] GET error:", error);
    return createErrorResponse(error);
  }
}
