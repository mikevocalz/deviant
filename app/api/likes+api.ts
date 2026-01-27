/**
 * Likes Collection API Route
 *
 * GET /api/likes - Get likes for a user or post
 *
 * Query params:
 * - where[user][equals]=userId - Get posts that userId liked
 * - where[post][equals]=postId - Get users that liked postId
 * - where[post][exists]=true - Only post likes (not comment likes)
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
    const postEquals = url.searchParams.get("where[post][equals]");
    const postExists = url.searchParams.get("where[post][exists]");

    const whereConditions: any[] = [];

    if (userEquals) {
      whereConditions.push({ user: { equals: userEquals } });
    }

    if (postEquals) {
      whereConditions.push({ post: { equals: postEquals } });
    }

    if (postExists === "true") {
      whereConditions.push({ post: { exists: true } });
    }

    const where =
      whereConditions.length > 0 ? { and: whereConditions } : undefined;

    const result = await payloadClient.find(
      {
        collection: "likes",
        limit,
        page,
        depth: 1,
        sort: "-createdAt",
        where,
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error("[API/likes] GET error:", error);
    return createErrorResponse(error);
  }
}
