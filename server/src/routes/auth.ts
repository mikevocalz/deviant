import { Hono } from "hono";

export const authRoutes = new Hono();

// Auth routes are handled by Better Auth on the main app
// This is a placeholder for any custom auth endpoints

authRoutes.get("/session", async (c) => {
  // Forward to Better Auth or return session info
  return c.json({ message: "Auth routes - configure with Better Auth" });
});
