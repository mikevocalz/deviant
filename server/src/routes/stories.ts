import { Hono } from "hono";
import { payloadClient, getCookiesFromRequest } from "../lib/payload";

export const storiesRoutes = new Hono();

// GET /api/stories
storiesRoutes.get("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const limit = parseInt(c.req.query("limit") || "30", 10);

    const result = await payloadClient.find(
      { collection: "stories", limit, sort: "-createdAt" },
      cookies,
    );

    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/stories error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/stories
storiesRoutes.post("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const body = await c.req.json();

    const result = await payloadClient.create("stories", body, cookies);
    return c.json(result, 201);
  } catch (error) {
    console.error("[API] POST /api/stories error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
