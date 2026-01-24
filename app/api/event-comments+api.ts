/**
 * Event Comments API Route
 *
 * POST /api/event-comments - Create a comment on an event
 * GET /api/event-comments?eventId=xxx - Get comments for an event
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

// POST /api/event-comments - Create a comment
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

    if (!body.eventId || !body.text) {
      return Response.json(
        { error: "eventId and text are required" },
        { status: 400 },
      );
    }

    // Get current user
    const currentUser = await payloadClient.me<{ id: string; username: string }>(cookies);
    
    if (!currentUser) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Look up user by username to get Payload CMS ID
    let authorId = currentUser.id;
    if (currentUser.username) {
      const userResult = await payloadClient.find({
        collection: "users",
        where: { username: { equals: currentUser.username } },
        limit: 1,
      }, cookies);
      
      if (userResult.docs && userResult.docs.length > 0) {
        authorId = (userResult.docs[0] as { id: string }).id;
      }
    }

    // Verify event exists
    const event = await payloadClient.findByID({
      collection: "events",
      id: body.eventId,
    }, cookies);

    if (!event) {
      return Response.json(
        { error: "Event not found" },
        { status: 404 },
      );
    }

    // Create comment using EventComments collection
    const comment = await payloadClient.create(
      {
        collection: "event-comments",
        data: {
          author: authorId,
          event: body.eventId,
          content: body.text.trim(),
          parent: body.parent || undefined,
        },
        depth: 2,
      },
      cookies,
    );

    return Response.json(comment, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/event-comments error:", error);
    return createErrorResponse(error);
  }
}

// GET /api/event-comments - Get comments for an event
export async function GET(request: Request) {
  try {
    const cookies = getCookiesFromRequest(request);
    const url = new URL(request.url);
    const eventId = url.searchParams.get("eventId");
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    if (!eventId) {
      return Response.json(
        { error: "eventId is required" },
        { status: 400 },
      );
    }

    // Fetch comments from EventComments collection
    const comments = await payloadClient.find({
      collection: "event-comments",
      where: {
        event: { equals: eventId },
        parent: { exists: false }, // Only top-level comments
      },
      limit,
      page,
      sort: "-createdAt",
      depth: 2,
    }, cookies);

    return Response.json(comments);
  } catch (error) {
    console.error("[API] GET /api/event-comments error:", error);
    return createErrorResponse(error);
  }
}
