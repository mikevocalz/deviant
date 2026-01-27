/**
 * Story Reply API Route
 *
 * POST /api/stories/reply - Reply to a story, creating/reusing a DM conversation
 *
 * STABILIZED: Creates a message in a DM conversation between sender and story author.
 * - If no conversation exists, creates one
 * - Message includes reference to the story
 * - Goes to Inbox if sender is followed by author, otherwise Spam (query-based)
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

    const { storyId, content, media } = body;

    if (!storyId) {
      return Response.json(
        { error: "storyId is required" },
        { status: 400 },
      );
    }

    if (!content?.trim() && (!media || media.length === 0)) {
      return Response.json(
        { error: "Reply must have content or media" },
        { status: 400 },
      );
    }

    // Get current user (sender)
    const currentUser = await payloadClient.me(cookies);
    if (!currentUser || !currentUser.id) {
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }

    const senderId = String(currentUser.id);

    // Get the story to find the author
    const story = await payloadClient.findByID(
      {
        collection: "stories",
        id: storyId,
        depth: 1,
      },
      cookies,
    );

    if (!story) {
      return Response.json({ error: "Story not found" }, { status: 404 });
    }

    // Get story author ID
    const authorId =
      typeof story.author === "object"
        ? (story.author as any).id
        : story.author;

    if (!authorId) {
      return Response.json(
        { error: "Story author not found" },
        { status: 404 },
      );
    }

    // INVARIANT: Cannot reply to your own story (would be weird UX)
    if (String(authorId) === senderId) {
      return Response.json(
        { error: "Cannot reply to your own story" },
        { status: 400 },
      );
    }

    // Find or create direct conversation between sender and story author
    const [user1, user2] = [senderId, String(authorId)].sort();

    let conversation: any;

    // Check for existing direct conversation
    const existingConversation = await payloadClient.find(
      {
        collection: "conversations",
        where: {
          and: [
            { isGroup: { equals: false } },
            { participants: { contains: user1 } },
            { participants: { contains: user2 } },
          ],
        },
        depth: 2,
        limit: 1,
      },
      cookies,
    );

    if (existingConversation.docs && existingConversation.docs.length > 0) {
      conversation = existingConversation.docs[0];
      console.log(
        "[API/stories/reply] Using existing conversation:",
        conversation.id,
      );
    } else {
      // Create new conversation
      try {
        conversation = await payloadClient.create(
          {
            collection: "conversations",
            data: {
              participants: [senderId, String(authorId)],
              isGroup: false,
            },
            depth: 2,
          },
          cookies,
        );
        console.log(
          "[API/stories/reply] Created new conversation:",
          conversation.id,
        );
      } catch (createError: any) {
        // Handle race condition - conversation was created between check and create
        if (createError.status === 409 && createError.existingId) {
          conversation = await payloadClient.findByID(
            {
              collection: "conversations",
              id: createError.existingId,
              depth: 2,
            },
            cookies,
          );
        } else {
          throw createError;
        }
      }
    }

    // Create message in the conversation with story reference
    const message = await payloadClient.create(
      {
        collection: "messages",
        data: {
          conversation: conversation.id,
          sender: senderId,
          content: content?.trim() || "",
          media: media || [],
          // Reference to the story this is a reply to
          storyId: storyId,
        },
        depth: 2,
      },
      cookies,
    );

    console.log("[API/stories/reply] Message created:", {
      messageId: message.id,
      conversationId: conversation.id,
      storyId,
      senderId,
      authorId,
    });

    return Response.json(
      {
        message: "Story reply sent successfully",
        messageId: message.id,
        conversationId: conversation.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[API/stories/reply] Error:", error);
    return createErrorResponse(error);
  }
}
