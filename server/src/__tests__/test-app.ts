/**
 * Minimal Hono app for comments API tests.
 * Mounts only comments routes to avoid loading auth, dotenv, etc.
 */

import { Hono } from "hono";
import { commentsRoutes } from "../routes/comments";

const app = new Hono().basePath("/");
app.route("/api/comments", commentsRoutes);
export default app;
