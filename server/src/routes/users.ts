import { Hono } from "hono";
import { payloadClient, getCookiesFromRequest } from "../lib/payload";

export const usersRoutes = new Hono();

// GET /api/users
usersRoutes.get("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const limit = parseInt(c.req.query("limit") || "10", 10);
    const page = parseInt(c.req.query("page") || "1", 10);

    const result = await payloadClient.find(
      { collection: "users", limit, page },
      cookies,
    );

    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/users error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/users/me
usersRoutes.get("/me", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);

    // Forward to Payload's me endpoint
    const PAYLOAD_URL = process.env.PAYLOAD_URL;
    const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

    const response = await fetch(`${PAYLOAD_URL}/api/users/me`, {
      headers: {
        Authorization: `users API-Key ${PAYLOAD_API_KEY}`,
        Cookie: cookies || "",
      },
    });

    const data = await response.json();
    return c.json(data);
  } catch (error) {
    console.error("[API] GET /api/users/me error:", error);
    return c.json({ user: null }, 200);
  }
});

// PATCH /api/users/me - Update current user's profile
usersRoutes.patch("/me", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const body = await c.req.json();

    const PAYLOAD_URL = process.env.PAYLOAD_URL;
    const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY;

    // First get the current user to get their ID
    const meResponse = await fetch(`${PAYLOAD_URL}/api/users/me`, {
      headers: {
        Authorization: `users API-Key ${PAYLOAD_API_KEY}`,
        Cookie: cookies || "",
      },
    });

    const meData = await meResponse.json();
    const userId = meData?.user?.id;

    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }

    console.log("[API] PATCH /api/users/me - updating user:", userId, body);

    // Update the user via Payload API
    const updateResponse = await fetch(`${PAYLOAD_URL}/api/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `users API-Key ${PAYLOAD_API_KEY}`,
        Cookie: cookies || "",
      },
      body: JSON.stringify(body),
    });

    const updateData = await updateResponse.json();

    if (!updateResponse.ok) {
      console.error("[API] PATCH /api/users/me error:", updateData);
      return c.json(
        { error: updateData.errors?.[0]?.message || "Failed to update" },
        400,
      );
    }

    return c.json({ user: updateData });
  } catch (error) {
    console.error("[API] PATCH /api/users/me error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// GET /api/users/:id
usersRoutes.get("/:id", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const id = c.req.param("id");
    const depth = parseInt(c.req.query("depth") || "1", 10);

    const result = await payloadClient.findByID("users", id, depth, cookies);
    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/users/:id error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// POST /api/users (register)
usersRoutes.post("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const body = await c.req.json();

    const result = await payloadClient.create("users", body, cookies);
    return c.json(result, 201);
  } catch (error) {
    console.error("[API] POST /api/users error:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
