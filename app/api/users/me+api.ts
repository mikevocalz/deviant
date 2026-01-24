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
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Also check by username if provided
    let userId = currentUser.id;
    
    if (body.username && !userId) {
      // Look up user by username
      const userResult = await payloadClient.find({
        collection: "users",
        where: { username: { equals: body.username } },
        limit: 1,
      }, cookies);
      
      if (userResult.docs && userResult.docs.length > 0) {
        userId = (userResult.docs[0] as { id: string }).id;
      }
    }

    if (!userId) {
      return Response.json(
        { error: "User not found" },
        { status: 404 },
      );
    }

    // Only allow updating specific fields
    const allowedFields = ["name", "bio", "website", "avatar"];
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
