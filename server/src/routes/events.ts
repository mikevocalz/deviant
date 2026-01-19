import { Hono } from "hono";
import { payloadClient, getCookiesFromRequest } from "../lib/payload";

export const eventsRoutes = new Hono();

// GET /api/events
eventsRoutes.get("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const limit = parseInt(c.req.query("limit") || "10", 10);
    const page = parseInt(c.req.query("page") || "1", 10);
    const category = c.req.query("category");

    let where: Record<string, unknown> | undefined;
    if (category) {
      where = { category: { equals: category } };
    }

    const result = await payloadClient.find(
      { collection: "events", limit, page, where, sort: "-createdAt" },
      cookies,
    );

    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/events error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/events/:id
eventsRoutes.get("/:id", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const id = c.req.param("id");
    const depth = parseInt(c.req.query("depth") || "1", 10);

    const result = await payloadClient.findByID("events", id, depth, cookies);
    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/events/:id error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/events
eventsRoutes.post("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const body = await c.req.json();

    const result = await payloadClient.create("events", body, cookies);
    return c.json(result, 201);
  } catch (error) {
    console.error("[API] POST /api/events error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/events/:id
eventsRoutes.patch("/:id", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const id = c.req.param("id");
    const body = await c.req.json();

    const result = await payloadClient.update("events", id, body, cookies);
    return c.json(result);
  } catch (error) {
    console.error("[API] PATCH /api/events/:id error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/events/:id
eventsRoutes.delete("/:id", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const id = c.req.param("id");

    const result = await payloadClient.delete("events", id, cookies);
    return c.json(result);
  } catch (error) {
    console.error("[API] DELETE /api/events/:id error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
