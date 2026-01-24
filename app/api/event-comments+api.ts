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

    // Create comment - we'll use a custom field to link to events
    // For now, we'll store eventId in a text field and handle it in the frontend
    // Or we could create a separate EventComments collection
    // Let's use the existing Comments collection but add an eventId field
    
    // Actually, let's create it as a comment with a special structure
    // We'll store eventId in the post field as a special identifier
    // Or better: create a new EventComments collection
    
    // For simplicity, let's use a text field to store eventId
    const comment = await payloadClient.create(
      {
        collection: "comments",
        data: {
          author: authorId,
          post: body.eventId, // Store eventId in post field temporarily
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

    // For now, we'll use the post field to store eventId
    // In the future, we should create a proper EventComments collection
    const comments = await payloadClient.find({
      collection: "comments",
      where: {
        post: { equals: eventId },
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
