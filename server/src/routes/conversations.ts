import { Hono } from "hono";
import { payloadClient, getCookiesFromRequest } from "../lib/payload";

export const conversationsRoutes = new Hono();

// GET /api/conversations - Get user's conversations
conversationsRoutes.get("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const limit = parseInt(c.req.query("limit") || "50", 10);
    const page = parseInt(c.req.query("page") || "1", 10);

    // Parse where filter if provided
    let where: Record<string, unknown> | undefined;
    const whereParam = c.req.query("where");
    if (whereParam) {
      try {
        where = JSON.parse(whereParam);
      } catch {
        return c.json({ error: "Invalid where parameter" }, 400);
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
      cookies,
    );

    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/conversations error:", error);
    return c.json(
      { error: (error as Error).message || "Internal server error" },
      500,
    );
  }
});

// POST /api/conversations - Create a new conversation
conversationsRoutes.post("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body || typeof body !== "object") {
      return c.json({ error: "Request body is required" }, 400);
    }

    if (!body.participants || !Array.isArray(body.participants)) {
      return c.json({ error: "participants array is required" }, 400);
    }

    const result = await payloadClient.create(
      "conversations",
      body,
      cookies,
      2,
    );

    return c.json(result, 201);
  } catch (error) {
    console.error("[API] POST /api/conversations error:", error);
    return c.json(
      { error: (error as Error).message || "Internal server error" },
      500,
    );
  }
});
