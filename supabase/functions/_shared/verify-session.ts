/**
 * Shared helper: verify Better Auth session from Authorization header.
 * Uses direct DB lookup (cookie signature issue prevents HTTP verification).
 *
 * Usage:
 *   import { verifySession } from "../_shared/verify-session.ts";
 *   const userId = await verifySession(supabase, req);
 */

export async function verifySession(
  supabase: any,
  req: Request,
): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    console.error("[verify-session] No token in Authorization header");
    return null;
  }

  // Direct DB lookup of session table (Better Auth uses camelCase columns)
  const { data: session, error } = await supabase
    .from("session")
    .select("userId, expiresAt")
    .eq("token", token)
    .single();

  if (error || !session) {
    console.error("[verify-session] Session not found:", error?.message);
    return null;
  }

  // Check expiry
  if (new Date(session.expiresAt) < new Date()) {
    console.error("[verify-session] Session expired");
    return null;
  }

  return session.userId;
}

/**
 * Allowed CORS origins.
 * Native mobile clients don't send Origin headers — they bypass CORS entirely.
 * This only restricts browser-based requests.
 */
const ALLOWED_ORIGINS = [
  "http://localhost:8081", // Expo dev server
  "http://localhost:19006", // Expo web
  "https://dvnt.app", // Future web domain
];

/**
 * Build CORS headers, reflecting the request Origin only if it's allowed.
 * If no Origin header (native mobile), returns wildcard for compatibility.
 */
export function corsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get("Origin");

  // No Origin = native client or server-to-server — allow
  const allowOrigin = !origin
    ? "*"
    : ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0]; // Fallback for rejected origins (browser will block)

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, apikey, x-client-info",
    ...(origin ? { Vary: "Origin" } : {}),
  };
}

/**
 * Legacy constant for backwards compatibility with edge functions
 * that don't pass the request object. Prefer corsHeaders(req) instead.
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, apikey, x-client-info",
};

/**
 * Standard JSON response helper.
 */
export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

/**
 * Standard error response helper.
 */
export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * Standard OPTIONS response for CORS preflight.
 */
export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
