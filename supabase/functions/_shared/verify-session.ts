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
 * Standard CORS headers for edge functions.
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
