/**
 * Posts API Route
 *
 * Proxies requests to Payload CMS - API key never exposed to client.
 *
 * GET  /api/posts - List posts with pagination/filtering
 * POST /api/posts - Create a new post
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

// GET /api/posts
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cookies = getCookiesFromRequest(request);

    // Parse query parameters
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const depth = parseInt(url.searchParams.get("depth") || "1", 10);
    const sort = url.searchParams.get("sort") || "-createdAt";

    // Parse where filter if provided (expects JSON string)
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
        collection: "posts",
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
    console.error("[API] GET /api/posts error:", error);
    return createErrorResponse(error);
  }
}

// POST /api/posts
export async function POST(request: Request) {
  try {
    const cookies = getCookiesFromRequest(request);
    const body = await request.json();

    // Validate required fields
    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }

    const url = new URL(request.url);
    const depth = parseInt(url.searchParams.get("depth") || "1", 10);

    const result = await payloadClient.create(
      {
        collection: "posts",
        data: body,
        depth,
      },
      cookies,
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/posts error:", error);
    return createErrorResponse(error);
  }
}
