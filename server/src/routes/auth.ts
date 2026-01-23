import { Hono } from "hono";
import { auth } from "../lib/auth";

export const authRoutes = new Hono();

// Better Auth handler - handles all auth endpoints
authRoutes.all("/*", async (c) => {
  const request = c.req.raw;
  const response = await auth.handler(request);
  return response;
});
