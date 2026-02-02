/**
 * DVNT API Server - Vercel Serverless Entry Point
 * 
 * Handles special routes (comments, register) with user lookup,
 * and proxies other requests to Payload CMS.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

const PAYLOAD_URL = process.env.PAYLOAD_URL || "";
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY || "";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "").trim().replace(/\\n/g, "");
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim().replace(/\\n/g, "");

// Cache admin token (expires after 1 hour)
let adminTokenCache: { token: string; expiry: number } | null = null;

// Helper: get admin JWT token
async function getAdminToken(): Promise<string | null> {
  // Return cached token if still valid
  if (adminTokenCache && adminTokenCache.expiry > Date.now()) {
    return adminTokenCache.token;
  }

  try {
    const response = await fetch(`${PAYLOAD_URL}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });

    if (!response.ok) {
      console.error("[Auth] Admin login failed:", response.status);
      return null;
    }

    const data = await response.json();
    if (data.token) {
      // Cache for 55 minutes (token usually expires in 1 hour)
      adminTokenCache = { token: data.token, expiry: Date.now() + 55 * 60 * 1000 };
      return data.token;
    }
    return null;
  } catch (error) {
    console.error("[Auth] Admin login error:", error);
    return null;
  }
}

// Helper: make authenticated request to Payload CMS
async function payloadFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  useAdminAuth = false,
): Promise<T> {
  const url = `${PAYLOAD_URL}/api${endpoint}`;
  
  let authHeader = `users API-Key ${PAYLOAD_API_KEY}`;
  if (useAdminAuth) {
    const adminToken = await getAdminToken();
    if (adminToken) {
      authHeader = `JWT ${adminToken}`;
    }
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: authHeader,
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.errors?.[0]?.message || data?.message || "Payload error") as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return data as T;
}

// Helper: find user by username (uses admin auth for user lookups)
async function findUserByUsername(username: string): Promise<string | null> {
  try {
    const result = await payloadFetch<{ docs: Array<{ id: string }> }>(
      `/users?where[username][equals]=${encodeURIComponent(username)}&limit=1`,
      { method: "GET" },
      true, // Use admin auth
    );
    console.log(`[Users] Lookup username '${username}':`, result.docs?.length ? `Found ID ${result.docs[0].id}` : "Not found");
    return result.docs?.[0]?.id || null;
  } catch (error) {
    console.error(`[Users] Error looking up username '${username}':`, error);
    return null;
  }
}

// Helper: find user by email (uses admin auth)
async function findUserByEmail(email: string): Promise<string | null> {
  try {
    const result = await payloadFetch<{ docs: Array<{ id: string }> }>(
      `/users?where[email][equals]=${encodeURIComponent(email)}&limit=1`,
      { method: "GET" },
      true, // Use admin auth
    );
    return result.docs?.[0]?.id || null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const reqUrl = req.url || "/";
  const cookies = req.headers.cookie || undefined;

  // Health check
  if (reqUrl === "/" || reqUrl === "/health") {
    return res.json({ 
      status: "ok", 
      service: "dvnt-api", 
      payload_url: PAYLOAD_URL ? "configured" : "missing",
      payload_api_key: PAYLOAD_API_KEY ? "configured" : "missing",
      admin_email: ADMIN_EMAIL ? "configured" : "missing",
    });
  }

  // ============== COMMENTS ENDPOINT (with user lookup) ==============
  if (reqUrl.startsWith("/api/comments") && req.method === "POST") {
    try {
      const { post, text, authorUsername, authorId, parent } = req.body || {};

      if (!post || !text) {
        return res.status(400).json({ error: "post and text are required" });
      }

      const content = String(text).trim();
      if (!content) {
        return res.status(400).json({ error: "Comment text cannot be empty" });
      }

      // Find user by username (primary method - uses admin auth)
      let userId: string | null = null;
      
      if (authorUsername) {
        userId = await findUserByUsername(authorUsername);
        if (userId) {
          console.log("[Comments] Found user by username:", authorUsername, "->", userId);
        }
      }

      // Fallback: try authorId directly
      if (!userId && authorId) {
        try {
          await payloadFetch(`/users/${authorId}`, { method: "GET" }, true);
          userId = authorId;
          console.log("[Comments] Using authorId:", authorId);
        } catch {
          // Invalid ID
        }
      }

      if (!userId) {
        return res.status(401).json({
          error: `User '${authorUsername || "unknown"}' not found in Payload CMS`,
          hint: "Please log out and log back in to sync your account",
        });
      }

      // Verify post exists
      try {
        await payloadFetch(`/posts/${post}`, { method: "GET" });
      } catch {
        return res.status(404).json({ error: `Post '${post}' not found` });
      }

      // Create comment - Payload expects numeric IDs
      const postId = parseInt(String(post), 10);
      const authorIdNum = parseInt(String(userId), 10);
      
      if (isNaN(postId) || isNaN(authorIdNum)) {
        return res.status(400).json({ error: "Invalid post or author ID format" });
      }

      const commentData: Record<string, unknown> = {
        post: postId,
        content,
        author: authorIdNum,
      };

      console.log("[Comments] Creating comment:", { post: postId, author: authorIdNum, content: content.slice(0, 30) });

      const result = await payloadFetch("/comments?depth=2", {
        method: "POST",
        body: JSON.stringify(commentData),
      });

      console.log("[Comments] Created:", (result as { id: string }).id);
      return res.status(201).json(result);
    } catch (error) {
      console.error("[Comments] Error:", error);
      const err = error as { status?: number; message?: string };
      return res.status(err.status || 500).json({
        error: err.message || "Failed to create comment",
        hint: "Check that user exists in Payload CMS",
      });
    }
  }

  // ============== EVENT COMMENTS ENDPOINT (with user lookup) ==============
  if (reqUrl.startsWith("/api/event-comments") && req.method === "POST") {
    try {
      const { eventId, text, authorUsername, parent } = req.body || {};

      if (!eventId || !text) {
        return res.status(400).json({ error: "eventId and text are required" });
      }

      const content = String(text).trim();
      if (!content) {
        return res.status(400).json({ error: "Comment text cannot be empty" });
      }

      // Find user by username (uses admin auth)
      let userId: string | null = null;
      if (authorUsername) {
        userId = await findUserByUsername(authorUsername);
      }

      if (!userId) {
        return res.status(401).json({
          error: `User '${authorUsername || "unknown"}' not found`,
          hint: "Please log out and log back in",
        });
      }

      // Verify event exists
      try {
        await payloadFetch(`/events/${eventId}`, { method: "GET" });
      } catch {
        return res.status(404).json({ error: `Event '${eventId}' not found` });
      }

      // Create event comment - Payload expects numeric IDs
      const eventIdNum = parseInt(String(eventId), 10);
      const authorIdNum = parseInt(String(userId), 10);
      
      if (isNaN(eventIdNum) || isNaN(authorIdNum)) {
        return res.status(400).json({ error: "Invalid event or author ID format" });
      }

      const commentData: Record<string, unknown> = {
        event: eventIdNum,
        content,
        author: authorIdNum,
      };

      console.log("[EventComments] Creating:", { event: eventIdNum, author: authorIdNum });

      const result = await payloadFetch("/event-comments?depth=2", {
        method: "POST",
        body: JSON.stringify(commentData),
      });

      return res.status(201).json(result);
    } catch (error) {
      const err = error as { status?: number; message?: string };
      return res.status(err.status || 500).json({ error: err.message || "Failed to create event comment" });
    }
  }

  // ============== REGISTER ENDPOINT ==============
  if (reqUrl === "/api/register" && req.method === "POST") {
    try {
      const { email, password, username } = req.body || {};

      if (!email || !password || !username) {
        return res.status(400).json({ error: "Email, password, and username are required" });
      }

      // Login as admin
      const adminLoginRes = await fetch(`${PAYLOAD_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: ADMIN_EMAIL.trim(), password: ADMIN_PASSWORD.trim() }),
      });

      if (!adminLoginRes.ok) {
        return res.status(500).json({ error: "Registration service unavailable" });
      }

      const adminData = await adminLoginRes.json();
      const adminToken = adminData.token;

      // Create user
      const createRes = await fetch(`${PAYLOAD_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${adminToken}`,
        },
        body: JSON.stringify({ email, password, username }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        return res.status(createRes.status).json({
          error: createData.errors?.[0]?.message || "Registration failed",
        });
      }

      // Login new user
      const loginRes = await fetch(`${PAYLOAD_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginData = await loginRes.json();

      return res.status(200).json({
        user: createData.doc || createData,
        token: loginData.token,
        message: "Registration successful",
      });
    } catch (error) {
      console.error("[Register] Error:", error);
      return res.status(500).json({ error: "Registration failed" });
    }
  }

  // ============== PROXY OTHER REQUESTS TO PAYLOAD CMS ==============
  const apiPath = reqUrl.replace(/^\/api/, "");
  const targetUrl = `${PAYLOAD_URL}/api${apiPath}`;

  console.log("[Proxy] Forwarding:", req.method, reqUrl, "→", targetUrl);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `users API-Key ${PAYLOAD_API_KEY}`,
    };

    if (req.headers.cookie) {
      headers["Cookie"] = req.headers.cookie;
    }
    if (req.headers.authorization) {
      headers["Authorization"] = req.headers.authorization as string;
    }

    const fetchOptions: RequestInit = {
      method: req.method || "GET",
      headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      res.setHeader("Set-Cookie", setCookie);
    }

    console.log("[Proxy] Response:", response.status, "from", targetUrl);
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("[Proxy] Error forwarding to", targetUrl, ":", error);
    return res.status(500).json({ error: "Failed to proxy request" });
  }
}

export const config = {
  runtime: "nodejs",
};
