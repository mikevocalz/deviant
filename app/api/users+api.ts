/**
 * Users API Route
 *
 * Proxies requests to Payload CMS - API key never exposed to client.
 *
 * GET  /api/users    - List users (admin only typically)
 * POST /api/users    - Register a new user
 * GET  /api/users/me - Get current authenticated user
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

// GET /api/users
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cookies = getCookiesFromRequest(request);

    // Check if this is a /me request (handled by path, but also support query)
    const me = url.searchParams.get("me");
    if (me === "true") {
      const user = await payloadClient.me(cookies);
      if (!user) {
        return Response.json({ error: "Not authenticated" }, { status: 401 });
      }
      return Response.json(user);
    }

    // Parse query parameters for list
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const depth = parseInt(url.searchParams.get("depth") || "1", 10);
    const sort = url.searchParams.get("sort") || "-createdAt";

    let where: Record<string, unknown> | undefined;
    const whereParam = url.searchParams.get("where");
    if (whereParam) {
      try {
        where = JSON.parse(whereParam);
      } catch {
        return Response.json(
          { error: "Invalid where parameter. Must be valid JSON." },
          { status: 400 },
        );
      }
    }

    const result = await payloadClient.find(
      {
        collection: "users",
        limit,
        page,
        depth,
        sort,
        where,
      },
      cookies,
    );

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/users error:", error);
    return createErrorResponse(error);
  }
}

// POST /api/users (registration)
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

    // Validate required fields for user registration
    if (!body.email || !body.password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const result = await payloadClient.create(
      {
        collection: "users",
        data: body,
      },
      cookies,
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/users error:", error);
    return createErrorResponse(error);
  }
}
