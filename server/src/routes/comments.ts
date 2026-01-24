import { Hono } from "hono";
import { payloadClient, getCookiesFromRequest } from "../lib/payload";

export const commentsRoutes = new Hono();

// GET /api/comments
commentsRoutes.get("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const postId = c.req.query("postId");
    const limit = parseInt(c.req.query("limit") || "50", 10);

    let where: Record<string, unknown> | undefined;
    if (postId) {
      where = { post: { equals: postId } };
    }

    const result = await payloadClient.find(
      { collection: "comments", limit, where, sort: "createdAt" },
      cookies,
    );

    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/comments error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/comments
commentsRoutes.post("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const body = await c.req.json();
    
    console.log("[API] POST /api/comments body:", JSON.stringify(body));

    const result = await payloadClient.create("comments", body, cookies);
    return c.json(result, 201);
  } catch (error: any) {
    console.error("[API] POST /api/comments error:", error?.message || error);
    
    const status = error?.status || 500;
    const errorResponse = {
      error: error?.message || "Internal server error",
      errors: error?.errors,
    };
    
    return c.json(errorResponse, status);
  }
});
