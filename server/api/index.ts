import type { VercelRequest, VercelResponse } from "@vercel/node";

const PAYLOAD_URL = process.env.PAYLOAD_URL || "";
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY || "";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie",
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const reqUrl = req.url || "/";

  // Health check
  if (reqUrl === "/" || reqUrl === "/health") {
    return res.json({
      status: "ok",
      service: "dvnt-api",
      payload_url: PAYLOAD_URL ? "configured" : "missing",
    });
  }

  // Debug endpoint
  if (reqUrl === "/debug") {
    return res.json({
      payload_url: PAYLOAD_URL ? "configured" : "missing",
      api_key: PAYLOAD_API_KEY ? "configured" : "missing",
      admin_email: ADMIN_EMAIL ? "configured" : "missing",
      admin_password: ADMIN_PASSWORD ? "configured" : "missing",
      request_url: reqUrl,
    });
  }

  // Public registration endpoint - creates user via admin JWT
  if (reqUrl === "/api/register" && req.method === "POST") {
    try {
      const { email, password, username } = req.body || {};

      if (!email || !password || !username) {
        return res.status(400).json({
          error: "Missing required fields",
          message: "Email, password, and username are required",
        });
      }

      // Login as admin to get JWT token
      // Trim to remove any trailing newlines from env vars
      const adminEmail = ADMIN_EMAIL.trim();
      const adminPass = ADMIN_PASSWORD.trim();
      const adminLoginRes = await fetch(`${PAYLOAD_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, password: adminPass }),
      });

      if (!adminLoginRes.ok) {
        const errBody = await adminLoginRes.text();
        console.error(
          "[Register] Admin login failed:",
          adminLoginRes.status,
          errBody,
        );
        return res.status(500).json({
          error: "Registration service unavailable",
          debug: {
            status: adminLoginRes.status,
            adminConfigured: !!ADMIN_EMAIL,
          },
        });
      }

      const adminData = await adminLoginRes.json();
      const adminToken = adminData.token;

      // Create user in Payload CMS using admin JWT
      const response = await fetch(`${PAYLOAD_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `JWT ${adminToken}`,
        },
        body: JSON.stringify({
          email,
          password,
          username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.errors?.[0]?.message || "Registration failed";
        return res
          .status(response.status)
          .json({ error: errMsg, details: data });
      }

      // Login the new user to get their token
      const loginResponse = await fetch(`${PAYLOAD_URL}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginResponse.json();

      return res.status(200).json({
        user: data.doc || data,
        token: loginData.token,
        message: "Registration successful",
      });
    } catch (error) {
      console.error("[Register] Error:", error);
      return res.status(500).json({
        error: "Registration failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Proxy API requests to Payload CMS
  // Remove leading /api if present, keep query string
  const apiPath = reqUrl.replace(/^\/api/, "");
  const targetUrl = `${PAYLOAD_URL}/api${apiPath}`;

  console.log(`[Proxy] ${req.method} ${reqUrl} -> ${targetUrl}`);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `users API-Key ${PAYLOAD_API_KEY}`,
    };

    // Forward cookies for authenticated requests
    if (req.headers.cookie) {
      headers["Cookie"] = req.headers.cookie;
    }

    // Forward authorization header if present
    if (req.headers.authorization) {
      headers["Authorization"] = req.headers.authorization as string;
    }

    const fetchOptions: RequestInit = {
      method: req.method || "GET",
      headers,
    };

    // Add body for non-GET requests
    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();

    // Forward response headers that might be useful
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      res.setHeader("Set-Cookie", setCookie);
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("[Proxy] Error:", error);
    return res.status(500).json({
      error: "Failed to proxy request",
      target: targetUrl,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export const config = {
  runtime: "nodejs",
};
