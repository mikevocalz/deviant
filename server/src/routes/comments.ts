import { Hono } from "hono";
import {
  payloadClient,
  getCookiesFromRequest,
} from "../lib/payload";

export const commentsRoutes = new Hono();

// GET /api/comments?postId=xxx&limit=20&page=1&depth=2
commentsRoutes.get("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const postId = c.req.query("postId");
    const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
    const page = parseInt(c.req.query("page") || "1", 10);
    const depth = parseInt(c.req.query("depth") || "2", 10);

    if (!postId) {
      return c.json({ error: "postId is required" }, 400);
    }

    const where: Record<string, unknown> = {
      post: { equals: postId },
      parent: { exists: false },
    };

    const result = await payloadClient.find(
      {
        collection: "comments",
        limit,
        page,
        depth,
        sort: "-createdAt",
        where,
      },
      cookies,
    );

    return c.json(result);
  } catch (error) {
    console.error("[API] GET /api/comments error:", error);
    return c.json(
      { error: (error as Error).message || "Internal server error" },
      500,
    );
  }
});

// POST /api/comments — body: { post, text, authorUsername?, authorId?, parent? }
commentsRoutes.post("/", async (c) => {
  try {
    const cookies = getCookiesFromRequest(c.req.raw);
    const body = (await c.req.json()) as Record<string, unknown>;

    if (!body || typeof body !== "object") {
      return c.json({ error: "Request body is required" }, 400);
    }

    if (!body.post || !body.text) {
      return c.json(
        { error: "post and text are required" },
        400,
      );
    }

    const postId = String(body.post).trim();
    const content = String(body.text ?? "").trim();
    if (!content) {
      return c.json({ error: "Comment text cannot be empty" }, 400);
    }

    let currentUser: { id: string; username?: string; email?: string } | null =
      null;
    try {
      currentUser = await payloadClient.me<{
        id: string;
        username?: string;
        email?: string;
      }>(cookies);
    } catch {
      // ignore
    }

    let authorId: string | null = null;

    if (body.authorId && String(body.authorId).trim()) {
      const id = String(body.authorId).trim();
      try {
        await payloadClient.findByID("users", id, 0, cookies);
        authorId = id;
      } catch {
        // skip
      }
    }

    if (!authorId && currentUser?.id) {
      try {
        await payloadClient.findByID("users", currentUser.id, 0, cookies);
        authorId = currentUser.id;
      } catch {
        // skip
      }
    }

    const username = (body.authorUsername as string) || currentUser?.username;
    if (!authorId && username) {
      try {
        const r = await payloadClient.find<{ id: string }>(
          {
            collection: "users",
            where: { username: { equals: String(username) } },
            limit: 1,
          },
          cookies,
        );
        if (r.docs?.length) authorId = r.docs[0].id;
      } catch {
        // skip
      }
    }

    if (!authorId && currentUser?.email) {
      try {
        const r = await payloadClient.find<{ id: string }>(
          {
            collection: "users",
            where: { email: { equals: currentUser.email } },
            limit: 1,
          },
          cookies,
        );
        if (r.docs?.length) authorId = r.docs[0].id;
      } catch {
        // skip
      }
    }

    if (!authorId) {
      const lookupUsername = (body.authorUsername as string) || currentUser?.username;
      return c.json(
        {
          error: `User '${lookupUsername || "unknown"}' not found in Payload CMS`,
          debug: {
            usernameSearched: lookupUsername,
            hasCurrentUser: !!currentUser,
            bodyAuthorId: body.authorId,
          },
        },
        401,
      );
    }

    // Verify the post exists before creating comment
    try {
      await payloadClient.findByID("posts", postId, 0, cookies);
    } catch {
      return c.json({ error: `Post '${postId}' not found` }, 404);
    }

    const commentData: Record<string, unknown> = {
      post: postId,
      content,
      author: authorId,
    };
    if (body.parent && String(body.parent).trim()) {
      commentData.parent = String(body.parent).trim();
    }

    console.log("[API] Creating comment:", {
      post: postId,
      content: content.slice(0, 30),
      author: authorId,
    });

    const result = await payloadClient.create(
      "comments",
      commentData,
      cookies,
      2,
    );
    console.log("[API] Comment created:", result.id);
    return c.json(result, 201);
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string; errors?: unknown[] };
    console.error("[API] POST /api/comments error:", err?.message ?? error);
    const status = (typeof err?.status === "number" && err.status >= 400 && err.status < 600)
      ? err.status
      : 500;
    return c.json(
      { 
        error: err?.message || "Failed to create comment", 
        errors: err?.errors,
        hint: "Check that user exists in Payload CMS and post ID is valid",
      },
      status as 400 | 401 | 404 | 500,
    );
  }
});
