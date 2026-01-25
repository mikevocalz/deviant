import { Hono } from "hono";
import { payloadClient, getCookiesFromRequest } from "../lib/payload";

export const eventCommentsRoutes = new Hono();

// GET /api/event-comments?eventId=xxx&limit=10&page=1
eventCommentsRoutes.get("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const eventId = c.req.query("eventId");
    const limit = Math.min(parseInt(c.req.query("limit") || "10", 10), 100);
    const page = parseInt(c.req.query("page") || "1", 10);

    if (!eventId) {
      return c.json({ error: "eventId is required" }, 400);
    }

    const result = await payloadClient.find(
      {
        collection: "event-comments",
        where: {
          event: { equals: eventId },
          parent: { exists: false },
        },
        limit,
        page,
        sort: "-createdAt",
        depth: 2,
      },
      cookies,
    );

    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/event-comments error:", error);
    return c.json(
      { error: (error as Error).message || "Internal server error" },
      500,
    );
  }
});

// POST /api/event-comments — body: { eventId, text, authorUsername?, parent? }
eventCommentsRoutes.post("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body || typeof body !== "object") {
      return c.json({ error: "Request body is required" }, 400);
    }

    if (!body.eventId || !body.text) {
      return c.json({ error: "eventId and text are required" }, 400);
    }

    const eventId = String(body.eventId).trim();
    const content = String(body.text ?? "").trim();
    if (!content) {
      return c.json({ error: "Comment text cannot be empty" }, 400);
    }

    // Get current user from session
    let currentUser: { id: string; username?: string; email?: string } | null = null;
    try {
      currentUser = await payloadClient.me<{
        id: string;
        username?: string;
        email?: string;
      }>(cookies);
      console.log("[API] Current user:", currentUser?.username || "unknown");
    } catch {
      // ignore
    }

    // Find Payload CMS user ID by username (most reliable method)
    let authorId: string | null = null;
    const usernameToLookup = (body.authorUsername as string) || currentUser?.username;

    if (usernameToLookup) {
      try {
        const r = await payloadClient.find<{ id: string }>(
          {
            collection: "users",
            where: { username: { equals: String(usernameToLookup) } },
            limit: 1,
          },
          cookies,
        );
        if (r.docs?.length) {
          authorId = r.docs[0].id;
          console.log("[API] Found user by username:", usernameToLookup, "->", authorId);
        }
      } catch {
        // skip
      }
    }

    // Fallback: try by email
    if (!authorId && currentUser?.email) {
      try {
        const r = await payloadClient.find<{ id: string }>(
          {
            collection: "users",
            where: { email: { equals: currentUser.email } },
            limit: 1,
          },
          cookies,
        );
        if (r.docs?.length) {
          authorId = r.docs[0].id;
          console.log("[API] Found user by email ->", authorId);
        }
      } catch {
        // skip
      }
    }

    if (!authorId) {
      console.error("[API] Could not find user in Payload CMS:", usernameToLookup);
      return c.json(
        { error: "User not found. Please try logging in again." },
        401,
      );
    }

    // Verify event exists
    try {
      await payloadClient.findByID("events", eventId, 0, cookies);
    } catch {
      return c.json({ error: "Event not found" }, 404);
    }

    // Create comment
    const commentData: Record<string, unknown> = {
      event: eventId,
      content,
      author: authorId,
    };
    if (body.parent && String(body.parent).trim()) {
      commentData.parent = String(body.parent).trim();
    }

    const result = await payloadClient.create(
      "event-comments",
      commentData,
      cookies,
      2,
    );
    
    console.log("[API] Event comment created:", result.id);
    return c.json(result, 201);
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; errors?: unknown[] };
    console.error("[API] POST /api/event-comments error:", err?.message ?? error);
    const status =
      typeof err?.status === "number" && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
    return c.json(
      { error: err?.message || "Failed to create comment", errors: err?.errors },
      status as 400 | 401 | 404 | 500,
    );
  }
});
