/**
 * Event Tickets API Route
 *
 * GET /api/events/[id]/tickets - Get all tickets for an event (organizer only)
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

export async function GET(
  request: Request,
  { id }: { id: string },
) {
  try {
    const cookies = getCookiesFromRequest(request);

    // Get current user
    const currentUser = await payloadClient.me<{ id: string }>(cookies);
    
    if (!currentUser) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Get event to verify organizer
    const event = await payloadClient.findByID({
      collection: "events",
      id: id,
      depth: 1,
    }, cookies);

    if (!event) {
      return Response.json(
        { error: "Event not found" },
        { status: 404 },
      );
    }

    const eventOrganizer = typeof event.host === "object" 
      ? (event.host as any)?.id 
      : event.host;

    // Only organizer can view tickets
    if (eventOrganizer !== currentUser.id) {
      return Response.json(
        { error: "Only the event organizer can view tickets" },
        { status: 403 },
      );
    }

    // Get all tickets for this event
    const tickets = await payloadClient.find({
      collection: "tickets",
      where: {
        event: { equals: id },
      },
      limit: 1000, // Adjust as needed
      sort: "-createdAt",
      depth: 2,
    }, cookies);

    return Response.json({
      tickets: tickets.docs,
      total: tickets.totalDocs,
    });
  } catch (error) {
    console.error("[API] GET /api/events/[id]/tickets error:", error);
    return createErrorResponse(error);
  }
}
