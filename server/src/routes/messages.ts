import { Hono } from "hono";
import { payloadClient, getCookiesFromRequest } from "../lib/payload";

export const messagesRoutes = new Hono();

// GET /api/messages?conversationId=xxx&limit=50
messagesRoutes.get("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const conversationId = c.req.query("conversationId");
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const page = parseInt(c.req.query("page") || "1", 10);

    if (!conversationId) {
      return c.json({ error: "conversationId is required" }, 400);
    }

    const result = await payloadClient.find(
      {
        collection: "messages",
        where: { conversation: { equals: conversationId } },
        limit,
        page,
        depth: 2,
        sort: "-createdAt",
      },
      cookies,
    );

    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/messages error:", error);
    return c.json(
      { error: (error as Error).message || "Internal server error" },
      500,
    );
  }
});

// POST /api/messages - Send a message
messagesRoutes.post("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body || typeof body !== "object") {
      return c.json({ error: "Request body is required" }, 400);
    }

    if (!body.conversation || !body.content) {
      return c.json({ error: "conversation and content are required" }, 400);
    }

    // Verify conversation exists
    const conversationId = String(body.conversation).trim();
    try {
      await payloadClient.findByID("conversations", conversationId, 0, cookies);
    } catch {
      return c.json({ error: "Conversation not found" }, 404);
    }

    // Create the message - sender should already be a Payload CMS user ID
    const result = await payloadClient.create(
      "messages",
      {
        conversation: conversationId,
        sender: body.sender,
        content: String(body.content).trim(),
        media: body.media || [],
      },
      cookies,
      2,
    );

    // Update conversation's lastMessageAt
    try {
      await payloadClient.update(
        "conversations",
        conversationId,
        { lastMessageAt: new Date().toISOString() },
        cookies,
      );
    } catch (e) {
      console.warn("[API] Failed to update lastMessageAt:", e);
    }

    return c.json(result, 201);
  } catch (error) {
    console.error("[API] POST /api/messages error:", error);
    return c.json(
      { error: (error as Error).message || "Internal server error" },
      500,
    );
  }
});

// PATCH /api/messages/:id - Update message (e.g., mark as read)
messagesRoutes.patch("/:id", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const id = c.req.param("id");
    const body = (await c.req.json()) as Record<string, unknown>;

    const result = await payloadClient.update(
      "messages",
      id,
      body,
      cookies,
    );

    return c.json(result);
  } catch (error) {
    console.error("[API] PATCH /api/messages error:", error);
    return c.json(
      { error: (error as Error).message || "Internal server error" },
      500,
    );
  }
});
