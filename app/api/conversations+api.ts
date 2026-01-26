/**
 * Conversations API Route
 *
 * GET  /api/conversations - Get user's conversations
 * POST /api/conversations - Create a new conversation
 */

import {
  payloadClient,
  getAuthFromRequest,
  createErrorResponse,
} from "@/lib/payload.server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const auth = getAuthFromRequest(request);

    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    // Get current user to filter conversations
    const currentUser = await payloadClient.me<{ id: string }>(auth);
    if (!currentUser) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Parse where filter if provided
    let where: Record<string, unknown> = {
      // Only get conversations where user is a participant
      participants: { contains: currentUser.id },
    };
    const whereParam = url.searchParams.get("where");
    if (whereParam) {
      try {
        const additionalWhere = JSON.parse(whereParam);
        where = { ...where, ...additionalWhere };
      } catch {
        return Response.json(
          { error: "Invalid where parameter" },
          { status: 400 },
        );
      }
    }

    const result = await payloadClient.find(
      {
        collection: "conversations",
        limit,
        page,
        depth: 2,
        sort: "-lastMessageAt",
        where,
      },
      auth,
    );

    return Response.json(result);
  } catch (error) {
    console.error("[API] GET /api/conversations error:", error);
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthFromRequest(request);
    const body = await request.json();

    if (!body || typeof body !== "object") {
      return Response.json(
        { error: "Request body is required" },
        { status: 400 },
      );
    }

    // Get current user
    const currentUser = await payloadClient.me<{ id: string }>(auth);
    if (!currentUser) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Ensure current user is included in participants
    let participants = body.participants || [];
    if (!Array.isArray(participants)) {
      return Response.json(
        { error: "participants must be an array" },
        { status: 400 },
      );
    }

    // If participants are usernames, look them up
    if (body.participantUsernames && Array.isArray(body.participantUsernames)) {
      const resolvedParticipants: string[] = [];
      for (const username of body.participantUsernames) {
        try {
          const userResult = await payloadClient.find({
            collection: "users",
            where: { username: { equals: username } },
            limit: 1,
          }, auth);
          
          if (userResult.docs && userResult.docs.length > 0) {
            resolvedParticipants.push((userResult.docs[0] as { id: string }).id);
          }
        } catch (e) {
          console.error("[API] User lookup error for:", username, e);
        }
      }
      participants = resolvedParticipants;
      delete body.participantUsernames;
    }

    // Always include current user in participants
    if (!participants.includes(currentUser.id)) {
      participants.push(currentUser.id);
    }

    // Check if conversation already exists between these participants
    if (participants.length === 2) {
      const existingConvo = await payloadClient.find({
        collection: "conversations",
        where: {
          and: [
            { participants: { contains: participants[0] } },
            { participants: { contains: participants[1] } },
            { isGroup: { equals: false } },
          ],
        },
        limit: 1,
      }, auth);

      if (existingConvo.docs && existingConvo.docs.length > 0) {
        // Return existing conversation instead of creating a new one
        return Response.json(existingConvo.docs[0]);
      }
    }

    const result = await payloadClient.create(
      {
        collection: "conversations",
        data: {
          ...body,
          participants,
          isGroup: participants.length > 2,
        },
        depth: 2,
      },
      auth,
    );

    return Response.json(result, { status: 201 });
  } catch (error) {
    console.error("[API] POST /api/conversations error:", error);
    return createErrorResponse(error);
  }
}
