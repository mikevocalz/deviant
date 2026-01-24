/**
 * Username Availability Check API Route
 * 
 * GET /api/users/check-username?username=xxx - Check if username is available
 * 
 * This endpoint is public (no auth required) to allow checking during signup
 */

import {
  payloadClient,
  createErrorResponse,
} from "@/lib/payload.server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const username = url.searchParams.get("username");

    if (!username) {
      return Response.json(
        { error: "username parameter is required" },
        { status: 400 },
      );
    }

    // Normalize username (lowercase, no spaces)
    const normalized = username.toLowerCase().trim();

    // Validate format
    if (normalized.length < 3) {
      return Response.json({
        available: false,
        suggestions: [],
        error: "Username must be at least 3 characters",
      });
    }

    if (normalized.length > 30) {
      return Response.json({
        available: false,
        suggestions: [],
        error: "Username must be 30 characters or less",
      });
    }

    if (!/^[a-z0-9_]+$/.test(normalized)) {
      return Response.json({
        available: false,
        suggestions: [],
        error: "Username can only contain lowercase letters, numbers, and underscores",
      });
    }

    // Check if username exists
    // Note: Users collection has read: () => true, so this should work without auth
    try {
      const result = await payloadClient.find(
        {
          collection: "users",
          where: {
            username: { equals: normalized },
          },
          limit: 1,
          depth: 0, // Don't need full user data, just check existence
        },
        undefined, // No auth required - public endpoint
      );

      const isTaken = result.docs && result.docs.length > 0;

      // Generate suggestions if taken
      const suggestions: string[] = [];
      if (isTaken) {
        // Generate some suggestions
        const base = normalized;
        const randomSuffix = Math.floor(Math.random() * 1000);
        suggestions.push(`${base}${randomSuffix}`);
        suggestions.push(`${base}_${randomSuffix}`);
        if (base.length < 25) {
          suggestions.push(`${base}1`);
        }
      }

      return Response.json({
        available: !isTaken,
        suggestions: suggestions.slice(0, 3), // Return max 3 suggestions
      });
    } catch (error: any) {
      // If access denied, we can't check - assume available and let server validate
      if (error?.status === 403 || error?.message?.includes("access")) {
        console.warn("[check-username] Access denied, assuming available");
        return Response.json({
          available: true,
          suggestions: [],
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("[API] GET /api/users/check-username error:", error);
    return createErrorResponse(error);
  }
}
