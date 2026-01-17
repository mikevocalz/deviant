/**
 * Current User API Route
 *
 * GET /api/users/me - Get the currently authenticated user
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

    const user = await payloadClient.me(cookies);

    if (!user) {
      return Response.json(
        { error: "Not authenticated", user: null },
        { status: 401 },
      );
    }

    return Response.json({ user });
  } catch (error) {
    console.error("[API] GET /api/users/me error:", error);
    return createErrorResponse(error);
  }
}
