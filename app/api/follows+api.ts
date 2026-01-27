/**
 * Follows Collection API Route
 *
 * GET /api/follows - Get follows for a user
 *
 * Query params:
 * - where[follower][equals]=userId - Get users that userId follows
 * - where[following][equals]=userId - Get users that follow userId
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
    const followerEquals = url.searchParams.get("where[follower][equals]");
    const followingEquals = url.searchParams.get("where[following][equals]");

    const whereConditions: any[] = [];

    if (followerEquals) {
      whereConditions.push({ follower: { equals: followerEquals } });
    }

    if (followingEquals) {
      whereConditions.push({ following: { equals: followingEquals } });
    }

    const where =
      whereConditions.length > 0 ? { and: whereConditions } : undefined;

    const result = await payloadClient.find(
      {
        collection: "follows",
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
    console.error("[API/follows] GET error:", error);
    return createErrorResponse(error);
  }
}
