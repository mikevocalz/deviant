import { Hono } from "hono";
import { payloadClient, getCookiesFromRequest } from "../lib/payload";

export const postsRoutes = new Hono();

// GET /api/posts
postsRoutes.get("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const limit = parseInt(c.req.query("limit") || "10", 10);
    const page = parseInt(c.req.query("page") || "1", 10);
    const depth = parseInt(c.req.query("depth") || "1", 10);
    const sort = c.req.query("sort") || "-createdAt";

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
      { collection: "posts", limit, page, depth, sort, where },
      cookies,
    );

    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/posts error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/posts/:id
postsRoutes.get("/:id", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const id = c.req.param("id");
    const depth = parseInt(c.req.query("depth") || "1", 10);

    const result = await payloadClient.findByID("posts", id, depth, cookies);
    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/posts/:id error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/posts
postsRoutes.post("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const body = await c.req.json();

    const result = await payloadClient.create("posts", body, cookies);
    return c.json(result, 201);
  } catch (error) {
    console.error("[API] POST /api/posts error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// PATCH /api/posts/:id
postsRoutes.patch("/:id", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const id = c.req.param("id");
    const body = await c.req.json();

    const result = await payloadClient.update("posts", id, body, cookies);
    return c.json(result);
  } catch (error) {
    console.error("[API] PATCH /api/posts/:id error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// DELETE /api/posts/:id
postsRoutes.delete("/:id", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const id = c.req.param("id");

    const result = await payloadClient.delete("posts", id, cookies);
    return c.json(result);
  } catch (error) {
    console.error("[API] DELETE /api/posts/:id error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
