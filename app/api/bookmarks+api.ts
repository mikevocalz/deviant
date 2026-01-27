/**
 * Bookmarks Collection API Route
 *
 * GET /api/bookmarks - Get bookmarks for a user
 *
 * Query params:
 * - where[user][equals]=userId - Get posts that userId bookmarked
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

    const limit = parseInt(url.searchParams.get("limit") || "100", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    // Parse where filters
    const userEquals = url.searchParams.get("where[user][equals]");

    // SECURITY: User can only fetch their own bookmarks
    const currentUser = await payloadClient.me(cookies);
    if (!currentUser || !currentUser.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // If no user specified, default to current user
    const targetUserId = userEquals || String(currentUser.id);

    // SECURITY: Only allow fetching own bookmarks
    if (targetUserId !== String(currentUser.id)) {
      return Response.json(
        { error: "Can only fetch your own bookmarks" },
        { status: 403 },
      );
    }

    const result = await payloadClient.find(
      {
        collection: "bookmarks",
        limit,
        page,
        depth: 1,
        sort: "-createdAt",
        where: {
          user: { equals: targetUserId },
        },
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error("[API/bookmarks] GET error:", error);
    return createErrorResponse(error);
  }
}
