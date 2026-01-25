/**
 * DVNT API Server - Hono App
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import "dotenv/config";

import { postsRoutes } from "./routes/posts";
import { storiesRoutes } from "./routes/stories";
import { usersRoutes } from "./routes/users";
import { eventsRoutes } from "./routes/events";
import { commentsRoutes } from "./routes/comments";
import { eventCommentsRoutes } from "./routes/event-comments";
import { conversationsRoutes } from "./routes/conversations";
import { messagesRoutes } from "./routes/messages";
import { authRoutes } from "./routes/auth";
import { pushTokenRoutes } from "./routes/push-token";

const app = new Hono().basePath("/");

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["dvnt://", "http://localhost:8081", "exp://", "*"],
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
app.route("/api/event-comments", eventCommentsRoutes);
app.route("/api/conversations", conversationsRoutes);
app.route("/api/messages", messagesRoutes);
app.route("/api/auth", authRoutes);
app.route("/api/push-token", pushTokenRoutes);

export default app;
