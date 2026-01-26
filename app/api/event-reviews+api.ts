/**
 * Event Reviews API Route
 *
 * POST /api/event-reviews - Create a review/rating for an event
 * GET /api/event-reviews?eventId=xxx - Get reviews for an event
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

// POST /api/event-reviews - Create a review
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

    if (!body.eventId || !body.rating) {
      return Response.json(
        { error: "eventId and rating are required" },
        { status: 400 },
      );
    }

    if (body.rating < 1 || body.rating > 5) {
      return Response.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 },
      );
    }

    // Get current user
    const currentUser = await payloadClient.me<{ id: string }>(cookies);
    
    if (!currentUser) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Check if user already reviewed this event
    const existingReview = await payloadClient.find({
      collection: "event-reviews",
      where: {
        event: { equals: body.eventId },
        user: { equals: currentUser.id },
      },
      limit: 1,
    }, cookies);

    if (existingReview.docs && existingReview.docs.length > 0) {
      // Update existing review
      const review = existingReview.docs[0];
      const updated = await payloadClient.update(
        {
          collection: "event-reviews",
          id: String(review.id),
          data: {
            rating: body.rating,
            comment: body.comment || undefined,
          },
          depth: 2,
        },
        cookies,
      );
      return Response.json(updated);
    }

    // Create new review
    const review = await payloadClient.create(
      {
        collection: "event-reviews",
        data: {
          event: body.eventId,
          user: currentUser.id,
          rating: body.rating,
          comment: body.comment || undefined,
        },
        depth: 2,
      },
      cookies,
    );

    return Response.json(review, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/event-reviews error:", error);
    return createErrorResponse(error);
  }
}

// GET /api/event-reviews - Get reviews for an event
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

    const reviews = await payloadClient.find({
      collection: "event-reviews",
      where: {
        event: { equals: eventId },
      },
      limit,
      page,
      sort: "-createdAt",
      depth: 2,
    }, cookies);

    return Response.json(reviews);
  } catch (error) {
    console.error("[API] GET /api/event-reviews error:", error);
    return createErrorResponse(error);
  }
}
