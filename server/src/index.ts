/**
 * DVNT API Server
 *
 * Standalone API server for production deployment.
 * This server handles all API routes for the native mobile apps.
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import "dotenv/config";

import { postsRoutes } from "./routes/posts";
import { storiesRoutes } from "./routes/stories";
import { usersRoutes } from "./routes/users";
import { eventsRoutes } from "./routes/events";
import { commentsRoutes } from "./routes/comments";
import { authRoutes } from "./routes/auth";
import { pushTokenRoutes } from "./routes/push-token";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["dvnt://", "http://localhost:8081", "exp://"],
    credentials: true,
  }),
);

// Health check
app.get("/", (c) => c.json({ status: "ok", service: "dvnt-api" }));
app.get("/health", (c) => c.json({ status: "healthy" }));

// API Routes
app.route("/api/posts", postsRoutes);
app.route("/api/stories", storiesRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/events", eventsRoutes);
app.route("/api/comments", commentsRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/push-token", pushTokenRoutes);

// For local development with Node.js server
const isVercel = process.env.VERCEL === "1";
if (!isVercel) {
  const port = parseInt(process.env.PORT || "3001", 10);
  console.log(`🚀 DVNT API Server running on port ${port}`);
  serve({
    fetch: app.fetch,
    port,
  });
}

// Export for Vercel serverless (default export for @vercel/node)
export default app;

// Named export for Vercel edge/serverless
export const GET = app.fetch;
export const POST = app.fetch;
export const PUT = app.fetch;
export const PATCH = app.fetch;
export const DELETE = app.fetch;
export const OPTIONS = app.fetch;
