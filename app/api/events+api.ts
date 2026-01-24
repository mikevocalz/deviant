/**
 * Events API Route
 *
 * GET  /api/events - List events with pagination/filtering
 * POST /api/events - Create a new event
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

    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const depth = parseInt(url.searchParams.get("depth") || "2", 10);
    const sort = url.searchParams.get("sort") || "-createdAt";
    const category = url.searchParams.get("category");

    let where: Record<string, unknown> | undefined;
    const whereParam = url.searchParams.get("where");
    if (whereParam) {
      try {
        where = JSON.parse(whereParam);
      } catch {
        return Response.json(
          { error: "Invalid where parameter" },
          { status: 400 },
        );
      }
    }

    // Filter by category if provided
    if (category && category !== "all") {
      where = { ...where, category: { equals: category } };
    }

    const result = await payloadClient.find(
      {
        collection: "events",
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
    console.error("[API] GET /api/events error:", error);
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const cookies = getCookiesFromRequest(request);
    const body = await request.json();

    console.log("[API] POST /api/events - Request received", {
      hasCookies: !!cookies,
      bodyKeys: Object.keys(body || {}),
      hasDate: !!body.date,
      hasImage: !!body.image,
      imagesCount: Array.isArray(body.images) ? body.images.length : 0,
    });

    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }

    // Get current user to auto-set as organizer
    let currentUser: { id: string } | null = null;
    try {
      currentUser = await payloadClient.me<{ id: string }>(cookies);
      console.log("[API] Current user:", currentUser ? { id: currentUser.id } : "null");
    } catch (meError) {
      console.error("[API] Error getting current user:", meError);
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }
    
    if (!currentUser) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Auto-set organizer to current user if not provided
    const eventData = {
      ...body,
      host: body.host || currentUser.id, // Use 'host' field (existing field name)
      coOrganizer: body.coOrganizer || undefined, // Optional co-organizer
    };

    console.log("[API] Creating event with data:", {
      ...eventData,
      images: Array.isArray(eventData.images) ? `${eventData.images.length} items` : "none",
    });

    const result = await payloadClient.create(
      {
        collection: "events",
        data: eventData,
        depth: 2,
      },
      cookies,
    );

    console.log("[API] ✓ Event created successfully:", result?.id || "unknown");
    return Response.json(result, { status: 201 });
  } catch (error: any) {
    console.error("[API] POST /api/events error:", error);
    console.error("[API] Error message:", error?.message);
    console.error("[API] Error status:", error?.status);
    console.error("[API] Error details:", JSON.stringify(error, null, 2));
    return createErrorResponse(error);
  }
}
