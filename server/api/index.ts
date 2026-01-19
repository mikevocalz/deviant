import type { VercelRequest, VercelResponse } from "@vercel/node";

const PAYLOAD_URL = process.env.PAYLOAD_URL || "";
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY || "";

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
      request_url: reqUrl,
    });
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
