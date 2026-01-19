import { Hono } from "hono";

export const pushTokenRoutes = new Hono();

// In-memory store (replace with database in production)
const pushTokens = new Map<string, { token: string; platform: string }>();

// POST /api/push-token
pushTokenRoutes.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { token, userId, platform } = body;

    if (!token || !userId) {
      return c.json({ error: "Token and userId are required" }, 400);
    }

    // Store the push token
    pushTokens.set(userId, { token, platform });
    console.log(`[Push Token] Stored token for user ${userId}`);

    return c.json({ success: true });
  } catch (error) {
    console.error("[API] POST /api/push-token error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/push-token/:userId
pushTokenRoutes.get("/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const tokenData = pushTokens.get(userId);

    if (!tokenData) {
      return c.json({ error: "Token not found" }, 404);
    }

    return c.json(tokenData);
  } catch (error) {
    console.error("[API] GET /api/push-token/:userId error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
