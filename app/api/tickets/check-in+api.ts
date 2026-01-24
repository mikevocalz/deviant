/**
 * Ticket Check-In API Route
 *
 * POST /api/tickets/check-in - Check in a ticket by scanning QR code
 */

import {
  payloadClient,
  getCookiesFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

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

    if (!body.qrToken) {
      return Response.json(
        { error: "qrToken is required" },
        { status: 400 },
      );
    }

    // Get current user (organizer)
    const currentUser = await payloadClient.me<{ id: string }>(cookies);
    
    if (!currentUser) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    // Decode QR token
    let tokenData: { tid?: string; eid?: string };
    try {
      const decoded = Buffer.from(body.qrToken, "base64").toString("utf-8");
      tokenData = JSON.parse(decoded);
    } catch (decodeError) {
      return Response.json(
        { error: "Invalid QR token format" },
        { status: 400 },
      );
    }

    if (!tokenData.tid || !tokenData.eid) {
      return Response.json(
        { error: "Invalid QR token data" },
        { status: 400 },
      );
    }

    // Find ticket by ID
    const ticket = await payloadClient.find({
      collection: "tickets",
      where: {
        id: { equals: tokenData.tid },
        event: { equals: tokenData.eid },
      },
      limit: 1,
      depth: 2,
    }, cookies);

    if (!ticket.docs || ticket.docs.length === 0) {
      return Response.json(
        { error: "Ticket not found" },
        { status: 404 },
      );
    }

    const ticketDoc = ticket.docs[0] as any;

    // Verify user is organizer of the event
    const event = await payloadClient.findByID({
      collection: "events",
      id: tokenData.eid,
      depth: 1,
    }, cookies);

    if (!event) {
      return Response.json(
        { error: "Event not found" },
        { status: 404 },
      );
    }

    const eventHost = typeof event.host === "object" 
      ? (event.host as any)?.id 
      : event.host;
    
    const eventCoOrganizer = event.coOrganizer
      ? (typeof event.coOrganizer === "object" 
          ? (event.coOrganizer as any)?.id 
          : event.coOrganizer)
      : null;

    // Check if user is host or co-organizer
    const isOrganizer = eventHost === currentUser.id || eventCoOrganizer === currentUser.id;

    if (!isOrganizer) {
      return Response.json(
        { error: "Only event organizers can check in tickets" },
        { status: 403 },
      );
    }

    // Check if already checked in
    if (ticketDoc.status === "checked_in") {
      return Response.json(
        { 
          error: "Ticket already checked in",
          ticket: ticketDoc,
          alreadyCheckedIn: true,
        },
        { status: 200 },
      );
    }

    // Check if ticket is revoked
    if (ticketDoc.status === "revoked") {
      return Response.json(
        { error: "Ticket has been revoked" },
        { status: 400 },
      );
    }

    // Update ticket status
    const updatedTicket = await payloadClient.update(
      {
        collection: "tickets",
        id: ticketDoc.id,
        data: {
          status: "checked_in",
          checkedInAt: new Date().toISOString(),
          checkedInBy: currentUser.id,
        },
        depth: 2,
      },
      cookies,
    );

    return Response.json({
      success: true,
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("[API] POST /api/tickets/check-in error:", error);
    return createErrorResponse(error);
  }
}
