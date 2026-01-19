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
